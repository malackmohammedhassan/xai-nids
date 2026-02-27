"""
Model registry — scan MODEL_SAVE_DIR on every list call, load/save artifacts.
Naming: {model_type}_{YYYYMMDD_HHMMSS}_{run_id[:8]}.pkl
"""
from __future__ import annotations

import json
import pickle
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from core.config import get_settings
from core.exceptions import ModelNotFoundError
from core.logger import get_logger

logger = get_logger("model_registry")

# In-memory cache: model_id -> loaded bundle
_loaded_models: Dict[str, Any] = {}


def _model_dir() -> Path:
    p = Path(get_settings().model_save_dir)
    p.mkdir(parents=True, exist_ok=True)
    return p


def _pkl_path(model_id: str) -> Path:
    return _model_dir() / f"{model_id}.pkl"


def _meta_path(model_id: str) -> Path:
    return _model_dir() / f"{model_id}_meta.json"


def list_models() -> list[dict]:
    """Scan MODEL_SAVE_DIR every call — never stale."""
    result = []
    for pkl in sorted(_model_dir().glob("*.pkl")):
        model_id = pkl.stem
        meta_p = _meta_path(model_id)
        meta: dict = {}
        if meta_p.exists():
            try:
                meta = json.loads(meta_p.read_text(encoding="utf-8"))
            except Exception:
                pass
        result.append({
            "model_id": model_id,
            "model_type": meta.get("model_type", "unknown"),
            "run_id": meta.get("run_id", model_id),
            "created_at": meta.get("created_at", ""),
            "dataset_filename": meta.get("dataset_filename"),
            "accuracy": meta.get("accuracy"),
            "f1_score": meta.get("f1_score"),
            "hyperparameters": meta.get("hyperparameters"),
            "feature_count": meta.get("feature_count"),
            "is_loaded": model_id in _loaded_models,
        })
    return result


def save_model(bundle: dict, model_type: str, run_id: str, metadata: dict) -> str:
    ts = datetime.now(tz=timezone.utc).strftime("%Y%m%d_%H%M%S")
    model_id = f"{model_type}_{ts}_{run_id[:8]}"

    pkl_p = _pkl_path(model_id)
    with open(pkl_p, "wb") as f:
        pickle.dump(bundle, f, protocol=pickle.HIGHEST_PROTOCOL)

    meta = {
        "model_id": model_id,
        "model_type": model_type,
        "run_id": run_id,
        "created_at": datetime.now(tz=timezone.utc).isoformat(),
        **metadata,
    }
    _meta_path(model_id).write_text(json.dumps(meta, indent=2), encoding="utf-8")
    _loaded_models[model_id] = bundle
    logger.info("Model saved", extra={"model_id": model_id})
    return model_id


def load_model(model_id: str) -> dict:
    if model_id in _loaded_models:
        return _loaded_models[model_id]
    p = _pkl_path(model_id)
    if not p.exists():
        raise ModelNotFoundError(f"Model {model_id} not found", model_id=model_id)
    with open(p, "rb") as f:
        bundle = pickle.load(f)
    _loaded_models[model_id] = bundle
    logger.info("Model loaded", extra={"model_id": model_id})
    return bundle


def get_loaded_model(model_id: str) -> Optional[dict]:
    return _loaded_models.get(model_id)


def unload_model(model_id: str) -> None:
    _loaded_models.pop(model_id, None)


def delete_model(model_id: str) -> None:
    p = _pkl_path(model_id)
    if not p.exists():
        raise ModelNotFoundError(f"Model {model_id} not found", model_id=model_id)
    p.unlink(missing_ok=True)
    _meta_path(model_id).unlink(missing_ok=True)
    _loaded_models.pop(model_id, None)
    logger.info("Model deleted", extra={"model_id": model_id})


def get_model_metrics(model_id: str) -> dict:
    meta_p = _meta_path(model_id)
    if not meta_p.exists():
        _pkl_path(model_id)  # existence check
        raise ModelNotFoundError(f"Metrics not found for {model_id}", model_id=model_id)
    meta = json.loads(meta_p.read_text(encoding="utf-8"))
    return meta.get("full_metrics", {})
