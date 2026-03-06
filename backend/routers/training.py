"""Training endpoints — start job, status, WebSocket stream, pipeline recommendations."""
from __future__ import annotations

import asyncio
import json
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException

from schemas.training import TrainRequest, TrainStarted, TrainStatusResponse
from schemas.pipeline import PipelineRecommendation
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

    # Estimate duration for UI
    mode = "quick" if req.pipeline_config is None else "custom"
    try:
        from services.dataset_service import _load_dataframe
        _meta = get_dataset_meta(req.dataset_id)
        est_secs = 60 if _meta.get("rows", 0) < 10_000 else 300
    except Exception:
        est_secs = 120

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
            pipeline_config=req.pipeline_config,
            use_optuna=req.use_optuna,
        )
    )

    return TrainStarted(task_id=task_id, status="started",
                        estimated_duration_seconds=est_secs, mode=mode)


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


@router.get("/models/train/recommend/{dataset_id}", response_model=PipelineRecommendation)
async def recommend_pipeline(dataset_id: str, target_column: str | None = None):
    """
    Analyse *dataset_id* and return per-step pipeline recommendations.

    The frontend uses this to pre-fill the Custom Train builder and
    explain which options are available / disabled for this specific dataset.
    """
    try:
        meta = get_dataset_meta(dataset_id)
    except Exception:
        raise HTTPException(
            status_code=404,
            detail={"error": "dataset_not_found", "dataset_id": dataset_id},
        )

    from services.dataset_service import _load_dataframe
    from services.pipeline_advisor import advise_pipeline

    try:
        df = _load_dataframe(dataset_id)
        recommendation = advise_pipeline(
            df=df,
            dataset_id=dataset_id,
            dataset_name=meta.get("filename", dataset_id),
            target_column=target_column,
        )
        return recommendation
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"error": "advisor_failed", "message": str(exc)},
        )


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
