"""
system.py — System resource monitoring endpoint.
Returns real-time CPU and RAM usage via psutil.
"""
from __future__ import annotations

from fastapi import APIRouter

try:
    import psutil
    _PSUTIL_AVAILABLE = True
except ImportError:
    _PSUTIL_AVAILABLE = False

router = APIRouter()


@router.get("/system/resources", tags=["System"])
async def get_system_resources() -> dict:
    """Return current CPU %, RAM used MB, RAM total MB, and active training jobs."""
    if not _PSUTIL_AVAILABLE:
        return {
            "cpu_pct": 0.0,
            "ram_used_mb": 0,
            "ram_total_mb": 0,
            "active_jobs": 0,
            "available": False,
        }

    cpu_pct = psutil.cpu_percent(interval=0.1)
    vm = psutil.virtual_memory()
    ram_used_mb = round(vm.used / 1024 / 1024)
    ram_total_mb = round(vm.total / 1024 / 1024)

    # Count running background jobs
    active_jobs = 0
    try:
        from services.background_job_manager import get_job_manager
        mgr = get_job_manager()
        active_jobs = sum(1 for j in mgr.get_all_jobs() if j.get("status") == "running")
    except Exception:
        pass

    return {
        "cpu_pct": round(cpu_pct, 1),
        "ram_used_mb": ram_used_mb,
        "ram_total_mb": ram_total_mb,
        "active_jobs": active_jobs,
        "available": True,
    }


@router.get("/system/metrics", tags=["System"])
async def get_telemetry_metrics() -> dict:
    """Return aggregated telemetry: route latencies (p50/p95/p99), error rates,
    inference stats, training history and dataset upload sizes."""
    try:
        from core.telemetry import get_registry
        return get_registry().summary()
    except Exception as exc:
        return {"error": str(exc), "available": False}
