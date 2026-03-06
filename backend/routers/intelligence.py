"""
Dataset Intelligence Router — /api/v2/datasets/{dataset_id}/intelligence
Triggers AI quality report generation as a background job and returns cached results.
"""
from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import APIRouter

from core.config import get_settings
from core.exceptions import DatasetNotFoundError
from core.logger import get_logger
from services.background_job_manager import get_job_manager
from services.compute_cache import cache_get, cache_set
from services.dataset_intelligence import get_intelligence_engine

logger = get_logger("router.intelligence")
router = APIRouter()


def _load_df(dataset_id: str):
    import pandas as pd
    settings = get_settings()
    base = Path(settings.dataset_upload_dir)
    parquet = base / dataset_id / "data.parquet"
    csv = base / dataset_id / "data.csv"
    meta_file = base / dataset_id / "meta.json"

    if not meta_file.exists():
        raise DatasetNotFoundError(dataset_id)

    if parquet.exists():
        return pd.read_parquet(parquet)
    elif csv.exists():
        return pd.read_csv(csv)
    else:
        raise DatasetNotFoundError(dataset_id)


@router.get("/datasets/{dataset_id}/intelligence")
async def get_intelligence_report(dataset_id: str):
    """Return cached intelligence report or 404 if not yet computed."""
    cached = cache_get(dataset_id, "intelligence")
    if cached:
        return cached
    return {"status": "not_computed", "message": "POST this endpoint to trigger computation."}


@router.post("/datasets/{dataset_id}/intelligence")
async def trigger_intelligence_report(dataset_id: str):
    """Trigger intelligence report generation as a background job."""
    settings = get_settings()
    meta_file = Path(settings.dataset_upload_dir) / dataset_id / "meta.json"
    if not meta_file.exists():
        raise DatasetNotFoundError(dataset_id)

    # Check if already cached
    cached = cache_get(dataset_id, "intelligence")
    if cached:
        return {"status": "cached", "report": cached}

    manager = get_job_manager()

    async def _run(mgr, job_id: str):
        import json
        loop = asyncio.get_event_loop()
        mgr.update_progress(job_id, "Loading dataset...", 10)

        def _compute():
            meta = json.loads(meta_file.read_text())
            df = _load_df(dataset_id)
            engine = get_intelligence_engine()
            suggested_target = meta.get("suggested_target")
            report = engine.generate_report(df, dataset_id, suggested_target)
            return report.to_dict()

        report_dict = await loop.run_in_executor(None, _compute)
        mgr.update_progress(job_id, "Caching report...", 90)
        cache_set(dataset_id, "intelligence", report_dict)
        mgr.update_progress(job_id, "Complete", 100)
        return {"fetch_url": f"/api/v2/datasets/{dataset_id}/intelligence"}

    job_id = await manager.submit(
        job_type="intelligence",
        title=f"Dataset Intelligence Report",
        coro_factory=_run,
        dataset_id=dataset_id,
    )

    return {"status": "queued", "job_id": job_id}
