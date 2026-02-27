"""GET /api/v1/health"""
from __future__ import annotations

import platform
import sys
import time

from fastapi import APIRouter

router = APIRouter()
_start_time = time.time()


@router.get("/health")
async def health() -> dict:
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

    return {
        "status": "ok",
        "version": settings.app_version,
        "backend_ready": True,
        "model_loaded": has_loaded_model,
        "uptime_seconds": round(time.time() - _start_time, 1),
        "active_training_job": manager.state.task_id if manager.state.task_id else None,
        "python_version": sys.version,
        "loaded_plugin": loaded_plugin,
        "available_plugins": plugins,
        "total_models": len(models),
    }
