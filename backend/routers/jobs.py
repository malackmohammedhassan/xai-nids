"""
Jobs Router — /api/v2/jobs
Background job CRUD + WebSocket stream.
"""
from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException

from core.logger import get_logger
from services.background_job_manager import get_job_manager, JobStatus

logger = get_logger("router.jobs")
router = APIRouter()


@router.get("/jobs")
async def list_jobs(limit: int = 50):
    """Return recent background jobs."""
    manager = get_job_manager()
    jobs = manager.get_recent(limit=limit)
    return {"jobs": [j.to_dict() for j in jobs]}


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    """Return single job detail with full logs."""
    manager = get_job_manager()
    job = manager.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")
    return job.to_dict()


@router.delete("/jobs/{job_id}")
async def cancel_job(job_id: str):
    """Cancel a running job."""
    manager = get_job_manager()
    cancelled = await manager.cancel(job_id)
    return {"cancelled": cancelled, "job_id": job_id}


@router.post("/jobs/{job_id}/retry")
async def retry_job(job_id: str):
    """Retry a failed job by re-submitting its recorded factory.

    This marks the job as retried and creates a new job entry.
    """
    manager = get_job_manager()
    job = manager.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found.")
    if job.status not in (JobStatus.FAILED, JobStatus.CANCELLED):
        raise HTTPException(
            status_code=409,
            detail=f"Job {job_id} has status '{job.status.value}' — only FAILED or CANCELLED jobs can be retried.",
        )
    if job.retries >= job.max_retries:
        raise HTTPException(
            status_code=429,
            detail=f"Job {job_id} has exhausted its retry budget ({job.max_retries} max).",
        )
    new_id = await manager.retry(job_id)
    return {"retried": True, "original_job_id": job_id, "new_job_id": new_id}


@router.websocket("/jobs/stream")
async def jobs_stream(websocket: WebSocket):
    """WebSocket for real-time job progress events."""
    await websocket.accept()
    manager = get_job_manager()
    manager.register_ws(websocket)

    # Send current job state immediately on connect
    try:
        jobs = manager.get_recent(limit=20)
        await websocket.send_json({
            "event": "initial_state",
            "data": {"jobs": [j.to_dict() for j in jobs]},
        })

        while True:
            try:
                # Keep the connection alive — client sends pings
                msg = await websocket.receive_text()
                if msg == "ping":
                    await websocket.send_text("pong")
            except WebSocketDisconnect:
                break
            except Exception:
                break
    finally:
        manager.unregister_ws(websocket)
