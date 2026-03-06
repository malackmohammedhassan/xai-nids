"""
Background Job Manager — asyncio-native job queue.

Supports multiple concurrent jobs (ML=1, viz=3 by default).
Every status change is persisted to jobs.json and broadcast to connected WS clients.
Jobs survive backend restart (restored from jobs.json on startup).
"""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Callable, Coroutine, Dict, List, Optional, Set

from core.logger import get_logger

logger = get_logger("background_job_manager")

_JOBS_FILE = Path(__file__).parent.parent / "jobs.json"

# WS clients connected to /api/v2/jobs/stream
_ws_clients: Set[Any] = set()


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class StructuredError:
    error_code: str
    message: str
    fix_suggestion: str = ""
    traceback_safe: str = ""


@dataclass
class Job:
    job_id: str
    job_type: str          # "training" | "visualization" | "export" | "intelligence"
    title: str
    status: JobStatus = JobStatus.QUEUED
    progress_pct: float = 0.0
    current_step: str = ""
    dataset_id: Optional[str] = None
    parent_job_id: Optional[str] = None   # set on retry — enables lineage tracing
    created_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    logs: List[str] = field(default_factory=list)
    result: Optional[Dict] = None
    error: Optional[StructuredError] = None
    retries: int = 0
    max_retries: int = 2
    next_retry_at: Optional[float] = None  # epoch seconds; set during backoff

    def to_dict(self) -> dict:
        d = asdict(self)
        d["status"] = self.status.value
        if self.error:
            d["error"] = asdict(self.error)
        return d


class BackgroundJobManager:
    """
    Singleton job manager. Access via get_job_manager().

    - max_ml_jobs=1   : only one ML training at a time
    - max_viz_jobs=3  : up to 3 visualization jobs concurrently
    - Each job is an asyncio.Task running a coroutine in the event loop.
    - Heavy blocking work should use run_in_executor inside the coroutine.
    """

    def __init__(self):
        self._jobs: Dict[str, Job] = {}
        self._tasks: Dict[str, asyncio.Task] = {}
        self._coro_factories: Dict[str, Callable] = {}  # stored for retry support
        self._main_loop: Optional[asyncio.AbstractEventLoop] = None
        self._max_ml_jobs = 1
        self._max_viz_jobs = 3
        self._lock = asyncio.Lock()

    def set_event_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._main_loop = loop

    # ─── WS Client Registry ──────────────────────────────────────────────────

    def register_ws(self, ws: Any) -> None:
        _ws_clients.add(ws)

    def unregister_ws(self, ws: Any) -> None:
        _ws_clients.discard(ws)

    async def broadcast(self, payload: dict) -> None:
        if not _ws_clients:
            return
        message = json.dumps(payload)
        dead: Set[Any] = set()
        for ws in list(_ws_clients):
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        _ws_clients -= dead

    def _safe_broadcast(self, payload: dict) -> None:
        """Thread-safe broadcast from non-async context."""
        if self._main_loop and not self._main_loop.is_closed():
            asyncio.run_coroutine_threadsafe(self.broadcast(payload), self._main_loop)

    # ─── Job Lifecycle ────────────────────────────────────────────────────────

    async def submit(
        self,
        job_type: str,
        title: str,
        coro_factory: Callable[["BackgroundJobManager", str], Coroutine],
        dataset_id: Optional[str] = None,
        max_retries: int = 0,
        parent_job_id: Optional[str] = None,
        retry_delay_s: float = 0.0,
    ) -> str:
        """Submit a new job. Returns job_id immediately."""
        job_id = str(uuid.uuid4())[:8]
        job = Job(
            job_id=job_id,
            job_type=job_type,
            title=title,
            dataset_id=dataset_id,
            status=JobStatus.QUEUED,
            max_retries=max_retries,
            parent_job_id=parent_job_id,
        )
        async with self._lock:
            self._jobs[job_id] = job
        self._persist()

        # Store factory for potential retry, then schedule the task
        self._coro_factories[job_id] = coro_factory
        task = asyncio.create_task(self._run_job(job, coro_factory, retry_delay_s))
        self._tasks[job_id] = task
        logger.info("Job submitted", extra={"job_id": job_id, "type": job_type, "title": title})
        return job_id

    async def _run_job(
        self,
        job: Job,
        coro_factory: Callable[["BackgroundJobManager", str], Coroutine],
        retry_delay_s: float = 0.0,
    ) -> None:
        """Internal: optionally wait for backoff delay, then execute job."""
        if retry_delay_s > 0:
            job.status = JobStatus.QUEUED
            job.current_step = f"Waiting {retry_delay_s:.0f}s before retry..."
            job.next_retry_at = time.time() + retry_delay_s
            self._persist()
            await asyncio.sleep(retry_delay_s)
            job.next_retry_at = None
        job.status = JobStatus.RUNNING
        job.started_at = time.time()
        await self.broadcast({
            "event": "job_progress",
            "data": {
                "job_id": job.job_id,
                "job_type": job.job_type,
                "title": job.title,
                "status": "running",
                "progress_pct": 0.0,
                "current_step": "Starting...",
            },
        })
        self._persist()
        try:
            result = await coro_factory(self, job.job_id)
            job.status = JobStatus.COMPLETED
            job.completed_at = time.time()
            job.progress_pct = 100.0
            job.result = result
            await self.broadcast({
                "event": "job_complete",
                "data": {
                    "job_id": job.job_id,
                    "job_type": job.job_type,
                    "title": job.title,
                    "result_available": result is not None,
                    "fetch_url": result.get("fetch_url") if result else None,
                    "duration_seconds": round(job.completed_at - (job.started_at or job.completed_at), 1),
                },
            })
            logger.info("Job completed", extra={"job_id": job.job_id})
        except asyncio.CancelledError:
            job.status = JobStatus.CANCELLED
            job.completed_at = time.time()
            logger.info("Job cancelled", extra={"job_id": job.job_id})
        except Exception as exc:
            job.status = JobStatus.FAILED
            job.completed_at = time.time()
            job.error = StructuredError(
                error_code="JOB_FAILED",
                message=str(exc),
                traceback_safe=type(exc).__name__,
            )
            await self.broadcast({
                "event": "job_failed",
                "data": {
                    "job_id": job.job_id,
                    "error_code": job.error.error_code,
                    "message": job.error.message,
                    "fix_suggestion": job.error.fix_suggestion,
                },
            })
            logger.error("Job failed", extra={"job_id": job.job_id, "error": str(exc)})
        finally:
            self._persist()
            self._tasks.pop(job.job_id, None)

    async def cancel(self, job_id: str) -> bool:
        task = self._tasks.get(job_id)
        if task and not task.done():
            task.cancel()
            return True
        return False

    async def retry(self, job_id: str) -> Optional[str]:
        """Re-queue a failed/cancelled job with exponential backoff.

        Backoff formula:  delay = RETRY_BASE_DELAY_S * 2 ** (attempt - 1)
          attempt 1 -> 5 s
          attempt 2 -> 10 s
          attempt 3 -> 20 s

        Returns new_job_id on success or raises ValueError.
        """
        RETRY_BASE_DELAY_S = 5.0
        # Permanent error codes that should NOT be retried automatically
        PERMANENT_CODES = {
            "VALIDATION_ERROR", "DATASET_NOT_FOUND", "FEATURE_MISMATCH",
            "INSUFFICIENT_DATA", "UNSUPPORTED_FORMAT",
        }

        job = self._jobs.get(job_id)
        if not job:
            raise ValueError(f"Job {job_id!r} not found")
        if job.status not in (JobStatus.FAILED, JobStatus.CANCELLED):
            raise ValueError(f"Job {job_id!r} cannot be retried (status={job.status.value})")
        if job.error and job.error.error_code in PERMANENT_CODES:
            raise ValueError(
                f"Job {job_id!r} failed with permanent error "
                f"({job.error.error_code}) — retry not allowed."
            )
        factory = self._coro_factories.get(job_id)
        if factory is None:
            raise ValueError(
                f"Retry factory for job {job_id!r} unavailable (server restarted?)."
            )
        attempt = job.retries + 1
        if attempt > job.max_retries:
            raise ValueError(
                f"Job {job_id!r} exhausted retry budget ({job.max_retries} max)."
            )

        delay_s = RETRY_BASE_DELAY_S * (2 ** (attempt - 1))
        logger.info(
            "Scheduling job retry",
            extra={"original_job_id": job_id, "attempt": attempt, "delay_s": delay_s},
        )

        new_id = await self.submit(
            job_type=job.job_type,
            title=f"{job.title} (retry {attempt})",
            coro_factory=factory,
            dataset_id=job.dataset_id,
            max_retries=max(0, job.max_retries - attempt),
            parent_job_id=job_id,
            retry_delay_s=delay_s,
        )
        job.retries = attempt  # persist updated count on the original job
        self._persist()
        return new_id

    def update_progress(
        self,
        job_id: str,
        step: str,
        progress_pct: float,
        log_line: Optional[str] = None,
    ) -> None:
        """Called from within job coroutines to report progress."""
        job = self._jobs.get(job_id)
        if not job:
            return
        job.current_step = step
        job.progress_pct = progress_pct
        if log_line:
            job.logs = [*job.logs[-499:], log_line]  # cap at 500

        self._safe_broadcast({
            "event": "job_progress",
            "data": {
                "job_id": job_id,
                "job_type": job.job_type,
                "title": job.title,
                "status": job.status.value,
                "progress_pct": progress_pct,
                "current_step": step,
            },
        })

    def append_log(self, job_id: str, line: str) -> None:
        job = self._jobs.get(job_id)
        if job:
            job.logs = [*job.logs[-499:], line]

    def get(self, job_id: str) -> Optional[Job]:
        return self._jobs.get(job_id)

    def get_all(self) -> List[Job]:
        return list(self._jobs.values())

    def get_recent(self, limit: int = 50) -> List[Job]:
        """Return most recently created jobs."""
        return sorted(self._jobs.values(), key=lambda j: j.created_at, reverse=True)[:limit]

    # ─── Persistence ──────────────────────────────────────────────────────────

    def _persist(self) -> None:
        """Write jobs to disk for survival across restarts."""
        try:
            data = [j.to_dict() for j in self._jobs.values()]
            _JOBS_FILE.write_text(json.dumps(data, indent=2, default=str))
        except Exception as exc:
            logger.warning("Failed to persist jobs", extra={"error": str(exc)})

    def restore_from_disk(self) -> None:
        """Called on startup to restore job history from jobs.json."""
        if not _JOBS_FILE.exists():
            return
        try:
            data = json.loads(_JOBS_FILE.read_text())
            for item in data:
                status = item.get("status", "completed")
                # Mark any jobs that were 'running' or 'queued' as failed
                # (they were interrupted by restart)
                if status in ("running", "queued"):
                    item["status"] = "failed"
                    if not item.get("error"):
                        item["error"] = {
                            "error_code": "BACKEND_RESTART",
                            "message": "Job interrupted by backend restart.",
                            "fix_suggestion": "Resubmit the job.",
                            "traceback_safe": "",
                        }
                job = Job(
                    job_id=item["job_id"],
                    job_type=item["job_type"],
                    title=item["title"],
                    status=JobStatus(item["status"]),
                    progress_pct=item.get("progress_pct", 0.0),
                    current_step=item.get("current_step", ""),
                    dataset_id=item.get("dataset_id"),
                    parent_job_id=item.get("parent_job_id"),
                    created_at=item.get("created_at", time.time()),
                    started_at=item.get("started_at"),
                    completed_at=item.get("completed_at"),
                    logs=item.get("logs", []),
                    result=item.get("result"),
                    retries=item.get("retries", 0),
                    max_retries=item.get("max_retries", 2),
                )
                err = item.get("error")
                if err:
                    job.error = StructuredError(**err)
                self._jobs[job.job_id] = job
            logger.info("Jobs restored", extra={"count": len(self._jobs)})
        except Exception as exc:
            logger.warning("Failed to restore jobs", extra={"error": str(exc)})


# ─── Singleton ────────────────────────────────────────────────────────────────

_manager: Optional[BackgroundJobManager] = None


def get_job_manager() -> BackgroundJobManager:
    global _manager
    if _manager is None:
        _manager = BackgroundJobManager()
    return _manager
