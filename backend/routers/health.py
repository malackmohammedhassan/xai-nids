"""GET /api/v1/health  —  liveness + readiness probes."""
from __future__ import annotations

import platform
import sys
import time

from fastapi import APIRouter

router = APIRouter()
_start_time = time.time()


@router.get("/health/live")
async def liveness() -> dict:
    """Kubernetes-style liveness probe — only confirms the process is alive."""
    return {"status": "healthy", "uptime": round(time.time() - _start_time, 1)}


@router.get("/health")
async def health() -> dict:
    import os
    from pathlib import Path
    from core.config import get_settings
    from plugins import list_plugins
    from services.model_registry import list_models
    from services.training_manager import get_training_manager

    settings = get_settings()
    manager = get_training_manager()
    models = list_models()
    plugins = list_plugins()
    loaded_plugin = plugins[0]["name"] if plugins else "none"
    has_loaded_model = any(m["is_loaded"] for m in models)
    loaded_model_ids = [m["model_id"] for m in models if m["is_loaded"]]
    plugins_loaded = [p["name"] for p in plugins]
    is_training = manager.state.task_id is not None and manager.state.status in ("RUNNING", "PENDING")

    return {
        # Core fields — frontend and health-check framework expect these
        "status": "healthy",
        "version": settings.app_version,
        "uptime": round(time.time() - _start_time, 1),  # short alias used by liveness dashboards
        "backend_ready": True,
        "model_loaded": has_loaded_model,
        "uptime_seconds": round(time.time() - _start_time, 1),  # kept for backward compat
        "active_training_job": manager.state.task_id if manager.state.task_id else None,
        "python_version": sys.version,
        "loaded_plugin": loaded_plugin,
        "available_plugins": plugins,
        "total_models": len(models),
        # Fields required by frontend HealthStatus type
        "dataset_dir_exists": Path(settings.dataset_upload_dir).exists(),
        "model_dir_exists": Path(settings.model_save_dir).exists(),
        "experiment_db_exists": Path(settings.experiment_db_path).exists(),
        "plugins_loaded": plugins_loaded,
        "loaded_models": loaded_model_ids,
        "active_training": is_training,
    }
