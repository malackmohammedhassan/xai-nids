"""
ML service — orchestrates dataset loading, training, evaluation via the active plugin.
This is a thin orchestrator; all ML logic lives in the plugin.
"""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

from core.config import get_settings
from core.logger import get_logger
from services.dataset_service import _load_dataframe, get_dataset_meta
from services.experiment_tracker import save_run
from services.model_registry import save_model
from services.training_manager import TrainingManager

logger = get_logger("ml_service")


async def run_training_job(
    dataset_id: str,
    target_column: str,
    model_type: str,
    hyperparameters: Dict[str, Any],
    test_size: float,
    random_state: int,
    manager: TrainingManager,
    task_id: str,
) -> None:
    """Background task — run in executor to avoid blocking event loop."""
    loop = asyncio.get_running_loop()
    try:
        await loop.run_in_executor(
            None,
            _blocking_train,
            dataset_id, target_column, model_type, hyperparameters,
            test_size, random_state, manager, task_id,
        )
    except Exception as exc:
        logger.error("Training job failed", extra={"task_id": task_id, "error": str(exc)})
        manager.release_lock(failed=True, error=str(exc))
        await manager.broadcast({
            "event": "error",
            "data": {
                "error_type": type(exc).__name__,
                "message": str(exc),
                "traceback_safe": repr(exc),
            },
        })


def _blocking_train(
    dataset_id: str,
    target_column: str,
    model_type: str,
    hyperparameters: Dict[str, Any],
    test_size: float,
    random_state: int,
    manager: TrainingManager,
    task_id: str,
) -> None:
    from plugins import get_plugin

    settings = get_settings()
    plugin = get_plugin(settings.default_plugin)
    run_id = str(uuid.uuid4())

    def progress_callback(step_name: str, step_number: int, total_steps: int, metrics: dict) -> None:
        manager.update_progress(step_name, step_number, total_steps, metrics)
        manager.emit_log("INFO", f"[{step_name}] step {step_number}/{total_steps}")

    loop = asyncio.new_event_loop()

    def emit(payload: dict) -> None:
        asyncio.run_coroutine_threadsafe(manager.broadcast(payload), asyncio.get_event_loop()).result(timeout=5)

    try:
        loop.run_until_complete(
            manager.broadcast({"event": "started", "data": {"task_id": task_id, "model_type": model_type, "dataset_id": dataset_id}})
        )
    except Exception:
        pass

    meta = get_dataset_meta(dataset_id)
    df = _load_dataframe(dataset_id)

    # Save df temporarily for plugin
    import tempfile, pandas as pd
    with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
        df.to_csv(tmp.name, index=False)
        tmp_path = tmp.name

    try:
        manager.update_progress("Loading data", 1, 6, {})
        X_train, X_test, y_train, y_test, feature_names, label_encoder = plugin.load_data(
            tmp_path, target_column
        )
        manager.update_progress("Preprocessing", 2, 6, {})

        manager.update_progress("Training model", 3, 6, {})
        trained_model, train_meta = plugin.train(
            X_train, y_train, model_type, hyperparameters, progress_callback
        )
        manager.update_progress("Evaluating", 4, 6, {})
        eval_result = plugin.evaluate(trained_model, X_test, y_test, feature_names)
        manager.update_progress("Saving model", 5, 6, {})

        bundle = {
            "model": trained_model,
            "feature_names": feature_names,
            "class_names": train_meta.get("class_names", ["0", "1"]),
            "scaler": train_meta.get("scaler"),
            "selector": train_meta.get("selector"),
            "le_dict": train_meta.get("le_dict", {}),
            "original_columns": train_meta.get("original_columns", feature_names),
            "model_type": model_type,
        }

        metrics = eval_result.get("metrics", {})
        model_metadata = {
            "dataset_filename": meta["filename"],
            "accuracy": metrics.get("accuracy"),
            "f1_score": metrics.get("f1_score"),
            "hyperparameters": hyperparameters or train_meta.get("best_params", {}),
            "feature_count": len(feature_names),
            "full_metrics": eval_result,
        }
        saved_model_id = save_model(bundle, model_type, run_id, model_metadata)

        run_record = {
            "run_id": run_id,
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
            "model_type": model_type,
            "dataset_filename": meta["filename"],
            "dataset_row_count": meta["rows"],
            "hyperparameters": hyperparameters or train_meta.get("best_params", {}),
            "accuracy": metrics.get("accuracy", 0.0),
            "f1_score": metrics.get("f1_score", 0.0),
            "precision": metrics.get("precision", 0.0),
            "recall": metrics.get("recall", 0.0),
            "training_duration_seconds": train_meta.get("duration", 0.0),
            "roc_auc": metrics.get("roc_auc"),
            "confusion_matrix": eval_result.get("confusion_matrix"),
        }
        save_run(run_record)
        manager.update_progress("Complete", 6, 6, metrics)
        manager.release_lock(failed=False)

        try:
            loop.run_until_complete(
                manager.broadcast({
                    "event": "complete",
                    "data": {
                        "task_id": task_id,
                        "run_id": run_id,
                        "model_id": saved_model_id,
                        "final_metrics": metrics,
                        "duration_seconds": run_record["training_duration_seconds"],
                    },
                })
            )
        except Exception:
            pass

    finally:
        Path(tmp_path).unlink(missing_ok=True)
        loop.close()
