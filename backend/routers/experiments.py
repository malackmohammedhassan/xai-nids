"""Experiment history endpoints."""
from __future__ import annotations

from fastapi import APIRouter

from schemas.experiment import DeleteExperimentResponse
from services import experiment_tracker

router = APIRouter()


@router.get("/experiments")
async def list_experiments():
    runs = experiment_tracker.get_all_runs()
    normalized = [_normalize_run(r) for r in runs]
    return {"experiments": normalized, "total": len(normalized)}


@router.get("/experiments/{run_id}")
async def get_experiment(run_id: str):
    run = experiment_tracker.get_run(run_id)
    return _normalize_run(run)


def _normalize_run(r: dict) -> dict:
    """Map flat SQLite row fields to the frontend ExperimentRun interface."""
    return {
        "run_id": r.get("run_id", ""),
        "model_id": r.get("model_id", r.get("run_id", "")),
        "model_type": r.get("model_type", ""),
        "dataset_id": r.get("dataset_id", r.get("dataset_filename", "")),
        "target_column": r.get("target_column", ""),
        "plugin_name": r.get("plugin_name", ""),
        "hyperparameters": r.get("hyperparameters", {}),
        "metrics": {
            "model_id": r.get("run_id", ""),
            "accuracy": r.get("accuracy"),
            "precision": r.get("precision"),
            "recall": r.get("recall"),
            "f1_score": r.get("f1_score"),
            "roc_auc": r.get("roc_auc"),
            "confusion_matrix": r.get("confusion_matrix"),
        },
        "status": r.get("status", "success"),
        "error": r.get("error"),
        "created_at": r.get("created_at", r.get("timestamp", "")),
        "duration_seconds": r.get("duration_seconds", r.get("training_duration_seconds")),
    }


@router.delete("/experiments/{run_id}", response_model=DeleteExperimentResponse)
async def delete_experiment(run_id: str):
    experiment_tracker.delete_run(run_id)
    return DeleteExperimentResponse(deleted=True, run_id=run_id)
