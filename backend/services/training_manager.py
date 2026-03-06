"""
Async training job manager — single asyncio.Lock, job state, WS broadcast.
"""
from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any, Callable, Dict, Optional, Set

from core.logger import get_logger
from schemas.training import TrainingStatus

logger = get_logger("training_manager")


class JobState:
    def __init__(self) -> None:
        self.task_id: Optional[str] = None
        self.status: TrainingStatus = TrainingStatus.IDLE
        self.progress_pct: float = 0.0
        self.current_step: Optional[str] = None
        self.start_time: Optional[float] = None
        self.error_message: Optional[str] = None
        self.estimated_duration: Optional[int] = None

    def reset(self) -> None:
        self.task_id = None
        self.status = TrainingStatus.IDLE
        self.progress_pct = 0.0
        self.current_step = None
        self.start_time = None
        self.error_message = None
        self.estimated_duration = None

    def to_dict(self) -> dict:
        elapsed = round(time.time() - self.start_time, 2) if self.start_time else None
        remaining: Optional[float] = None
        if elapsed and self.estimated_duration and self.progress_pct > 0:
            total_est = self.estimated_duration / max(self.progress_pct / 100, 0.01)
            remaining = max(0.0, round(total_est - elapsed, 1))
        return {
            "task_id": self.task_id,
            "status": self.status.value,
            "progress_pct": self.progress_pct,
            "current_step": self.current_step,
            "elapsed_seconds": elapsed,
            "estimated_remaining_seconds": remaining,
            "error_message": self.error_message,
        }


class TrainingManager:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self.state = JobState()
        self._ws_clients: Set[Any] = set()
        self._main_loop: Optional[asyncio.AbstractEventLoop] = None

    def set_event_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Called from async context to store the main event loop reference."""
        self._main_loop = loop

    # ── Lock management ────────────────────────────────────────────────────────

    async def acquire_lock(self) -> str:
        """Acquire training lock; return new task_id."""
        if self._lock.locked():
            from core.exceptions import TrainingInProgressError
            raise TrainingInProgressError(
                "A training job is already running",
                task_id=self.state.task_id,
            )
        await self._lock.acquire()
        task_id = str(uuid.uuid4())
        self.state.task_id = task_id
        self.state.status = TrainingStatus.RUNNING
        self.state.start_time = time.time()
        self.state.progress_pct = 0.0
        self.state.error_message = None
        return task_id

    def release_lock(
        self,
        failed: bool = False,
        error: Optional[str] = None,
        model_id: Optional[str] = None,
        run_id: Optional[str] = None,
    ) -> None:
        if self._lock.locked():
            self._lock.release()
        duration = round(time.time() - self.state.start_time, 2) if self.state.start_time else None
        if failed:
            self.state.status = TrainingStatus.FAILED
            self.state.error_message = error
            logger.warning(
                "Training job failed",
                extra={"task_id": self.state.task_id, "error": error, "duration_seconds": duration},
            )
        else:
            self.state.status = TrainingStatus.COMPLETE
            self.state.progress_pct = 100.0
            logger.info(
                "Training job completed",
                extra={"task_id": self.state.task_id, "duration_seconds": duration},
            )
        self._safe_broadcast(
            {
                "event": "complete",
                "data": {
                    "task_id": self.state.task_id,
                    "run_id": run_id,
                    "model_id": model_id,
                    "duration_seconds": duration,
                    "failed": failed,
                },
            }
        )

    # ── Progress updates ──────────────────────────────────────────────────────

    def update_progress(
        self,
        step_name: str,
        step_number: int,
        total_steps: int,
        metrics: Optional[dict] = None,
    ) -> None:
        self.state.current_step = step_name
        self.state.progress_pct = round((step_number / total_steps) * 100, 1)
        self._safe_broadcast({
            "event": "step",
            "data": {
                "step_name": step_name,
                "step_number": step_number,
                "total_steps": total_steps,
                "progress_pct": self.state.progress_pct,
            },
        })
        if metrics:
            self._safe_broadcast({"event": "metrics", "data": metrics})

    def emit_log(self, level: str, message: str) -> None:
        self._safe_broadcast({
            "event": "log",
            "data": {
                "level": level,
                "message": message,
                "timestamp": time.strftime("%H:%M:%S"),
            },
        })

    def _safe_broadcast(self, payload: dict) -> None:
        """Broadcast from any thread — uses stored event loop if available."""
        loop = self._main_loop
        if loop is None:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                return  # no loop available, skip broadcast
        if loop.is_running():
            asyncio.run_coroutine_threadsafe(self.broadcast(payload), loop)
        else:
            try:
                asyncio.create_task(self.broadcast(payload))
            except RuntimeError:
                pass  # no running loop, skip

    # ── WebSocket management ──────────────────────────────────────────────────

    def register_ws(self, ws: Any) -> None:
        self._ws_clients.add(ws)

    def unregister_ws(self, ws: Any) -> None:
        self._ws_clients.discard(ws)

    async def broadcast(self, payload: dict) -> None:
        import json

        msg = json.dumps(payload)
        dead: Set[Any] = set()
        for ws in list(self._ws_clients):
            try:
                await ws.send_text(msg)
            except Exception:
                dead.add(ws)
        self._ws_clients -= dead

    def get_status(self) -> dict:
        return self.state.to_dict()


# Module-level singleton
_manager: Optional[TrainingManager] = None


def get_training_manager() -> TrainingManager:
    global _manager
    if _manager is None:
        _manager = TrainingManager()
    return _manager
