"""Model list, metrics, load, delete endpoints."""
from __future__ import annotations

from fastapi import APIRouter

from schemas.metrics import LoadModelResponse, DeleteModelResponse
from services import model_registry

router = APIRouter()


@router.get("/models/list")
async def list_models():
    from plugins import list_plugins, get_all_supported_models
    models = model_registry.list_models()
    return {
        "models": models,
        "total": len(models),
        "available_model_types": get_all_supported_models(),
        "plugins": list_plugins(),
    }


@router.get("/models/{model_id}/metrics")
async def get_metrics(model_id: str):
    bundle = model_registry.load_model(model_id)
    # Try to get full metrics from meta file first
    from pathlib import Path
    import json
    from core.config import get_settings
    meta_path = Path(get_settings().model_save_dir) / f"{model_id}_meta.json"
    full_metrics: dict = {}
    if meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            full_metrics = meta.get("full_metrics", {})
        except Exception:
            pass

    metrics = full_metrics.get("metrics", bundle.get("metrics", {}))
    cm = full_metrics.get("confusion_matrix", [])
    feat_imp = full_metrics.get("feature_importance", [])
    roc_curve = full_metrics.get("roc_curve")

    return {
        "model_id": model_id,
        "accuracy": metrics.get("accuracy"),
        "f1_score": metrics.get("f1_score"),
        "precision": metrics.get("precision"),
        "recall": metrics.get("recall"),
        "roc_auc": metrics.get("roc_auc"),
        "confusion_matrix": cm,
        "roc_curve": roc_curve,
        "classification_report": full_metrics.get("classification_report"),
        "feature_importance": feat_imp,
        "class_names": bundle.get("class_names", []),
    }


@router.post("/models/{model_id}/load", response_model=LoadModelResponse)
async def load_model(model_id: str):
    model_registry.load_model(model_id)  # loads into cache
    return LoadModelResponse(loaded=True, model_id=model_id)


@router.delete("/models/{model_id}", response_model=DeleteModelResponse)
async def delete_model(model_id: str):
    model_registry.delete_model(model_id)
    return DeleteModelResponse(deleted=True, model_id=model_id)
