"""Training endpoints — start job, status, WebSocket stream."""
from __future__ import annotations

import asyncio
import json
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from schemas.training import TrainRequest, TrainStarted, TrainStatusResponse
from services.dataset_service import get_dataset_meta
from services.training_manager import get_training_manager

router = APIRouter()


@router.post("/models/train", response_model=TrainStarted)
async def start_training(req: TrainRequest):
    from core.exceptions import DatasetNotFoundError, TrainingInProgressError
    from plugins import get_all_supported_models
    from services import dataset_service

    # Validate dataset
    try:
        meta = get_dataset_meta(req.dataset_id)
    except Exception:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail={"error": "dataset_not_found", "dataset_id": req.dataset_id})

    # Validate target_column
    from services.dataset_service import _load_dataframe
    df = _load_dataframe(req.dataset_id)
    if req.target_column not in df.columns:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=422,
            detail={
                "error": "invalid_target_column",
                "target_column": req.target_column,
                "available_columns": df.columns.tolist(),
            },
        )

    # Validate model type
    supported = get_all_supported_models()
    if req.model_type not in supported:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=422,
            detail={"error": "invalid_model_type", "model_type": req.model_type, "supported": supported},
        )

    manager = get_training_manager()
    task_id = await manager.acquire_lock()  # raises 409 if already running

    # Store current event loop so background thread can broadcast via WebSocket
    manager.set_event_loop(asyncio.get_event_loop())

    # Launch background task
    from services.ml_service import run_training_job
    asyncio.create_task(
        run_training_job(
            dataset_id=req.dataset_id,
            target_column=req.target_column,
            model_type=req.model_type,
            hyperparameters=req.hyperparameters,
            test_size=req.test_size,
            random_state=req.random_state,
            manager=manager,
            task_id=task_id,
        )
    )

    return TrainStarted(task_id=task_id, status="started", estimated_duration_seconds=120)


@router.get("/models/train/configs")
async def model_configs(plugin: str | None = None):
    """Return available model types and their hyperparameter schemas from plugins."""
    from plugins import get_plugin, list_plugins
    configs: list[dict] = []

    plugin_infos = list_plugins()
    if plugin:
        plugin_infos = [p for p in plugin_infos if p["name"] == plugin]

    for info in plugin_infos:
        p = get_plugin(info["name"])
        for model_type in p.supported_models:
            try:
                cfg = p.get_model_config(model_type)
                configs.append({"plugin": p.plugin_name, "model_type": model_type, **cfg})
            except Exception:
                configs.append({"plugin": p.plugin_name, "model_type": model_type})

    return {"configs": configs}


@router.get("/models/train/status", response_model=TrainStatusResponse)
async def training_status():
    manager = get_training_manager()
    s = manager.get_status()
    return TrainStatusResponse(
        task_id=s["task_id"],
        status=s["status"],
        progress_pct=s["progress_pct"],
        current_step=s["current_step"],
        elapsed_seconds=s["elapsed_seconds"],
        estimated_remaining_seconds=s["estimated_remaining_seconds"],
        error_message=s["error_message"],
    )


@router.websocket("/models/train/stream")
async def training_stream(ws: WebSocket):
    await ws.accept()
    manager = get_training_manager()
    manager.register_ws(ws)

    # Send heartbeat every 5 seconds; exit immediately on disconnect
    try:
        while True:
            try:
                # Await any incoming client message (incl. close frames) with 5s window
                msg = await asyncio.wait_for(ws.receive(), timeout=5.0)
                if msg.get("type") == "websocket.disconnect":
                    break
            except asyncio.TimeoutError:
                # No message from client — send heartbeat, then loop
                try:
                    await ws.send_text(
                        json.dumps({"event": "heartbeat", "data": {"timestamp": time.time()}})
                    )
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    finally:
        manager.unregister_ws(ws)
