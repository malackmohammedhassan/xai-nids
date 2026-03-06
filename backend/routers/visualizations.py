"""
Visualizations Router — /api/v2/datasets/{dataset_id}/visualizations/*
Serves pre-computed visualization data in JSON format (no images).
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.config import get_settings
from core.exceptions import DatasetNotFoundError
from core.logger import get_logger
from services.background_job_manager import get_job_manager
from services.compute_cache import cache_get, cache_set
from services import visualization_precomputer as vpc

logger = get_logger("router.visualizations")
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
    raise DatasetNotFoundError(dataset_id)


def _get_suggested_target(dataset_id: str) -> str | None:
    settings = get_settings()
    meta_file = Path(settings.dataset_upload_dir) / dataset_id / "meta.json"
    if meta_file.exists():
        try:
            return json.loads(meta_file.read_text()).get("suggested_target")
        except Exception:
            pass
    return None


# ─── Tier 1 ──────────────────────────────────────────────────────────────────

@router.get("/datasets/{dataset_id}/visualizations/tier1")
async def get_tier1_visualizations(dataset_id: str):
    """Returns all Tier 1 visualization data (fast, cached). Auto-triggers computation if needed."""
    cached = cache_get(dataset_id, "tier1")
    if cached:
        return cached

    loop = asyncio.get_event_loop()
    try:
        df = await loop.run_in_executor(None, lambda: _load_df(dataset_id))
        result = await loop.run_in_executor(None, lambda: vpc.compute_tier1(df, dataset_id))
        return result
    except DatasetNotFoundError:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ─── Tier 2 ──────────────────────────────────────────────────────────────────

TIER2_HANDLERS = {
    "histograms": vpc.compute_histograms,
    "boxplots": vpc.compute_boxplots,
    "correlation": vpc.compute_correlation,
    "mutual_info": vpc.compute_mutual_info,
    "violin": vpc.compute_violin,
}


@router.get("/datasets/{dataset_id}/visualizations/tier2/{viz_type}")
async def get_tier2_visualization(dataset_id: str, viz_type: str):
    """Compute and return a Tier 2 visualization (on-demand, cached)."""
    if viz_type not in TIER2_HANDLERS:
        raise HTTPException(status_code=404, detail=f"Unknown tier2 viz type: {viz_type}. Valid: {list(TIER2_HANDLERS.keys())}")

    cached = cache_get(dataset_id, viz_type)
    if cached:
        return cached

    loop = asyncio.get_event_loop()
    try:
        df = await loop.run_in_executor(None, lambda: _load_df(dataset_id))
        target = _get_suggested_target(dataset_id)
        handler = TIER2_HANDLERS[viz_type]

        if viz_type in ("mutual_info", "violin"):
            result = await loop.run_in_executor(None, lambda: handler(df, dataset_id, target))
        else:
            result = await loop.run_in_executor(None, lambda: handler(df, dataset_id))

        return result
    except DatasetNotFoundError:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ─── Tier 3 ──────────────────────────────────────────────────────────────────

TIER3_JOBS = {
    "pca": ("PCA Projection", vpc.compute_pca),
    "tsne": ("t-SNE Projection", vpc.compute_tsne),
    "isolation_forest": ("Anomaly Detection (Isolation Forest)", vpc.compute_isolation_forest),
}


@router.post("/datasets/{dataset_id}/visualizations/tier3/{viz_type}")
async def trigger_tier3_visualization(dataset_id: str, viz_type: str):
    """Submit a Tier 3 visualization as a background job. Returns job_id."""
    if viz_type not in TIER3_JOBS:
        raise HTTPException(status_code=404, detail=f"Unknown tier3 type: {viz_type}. Valid: {list(TIER3_JOBS.keys())}")

    settings = get_settings()
    meta_file = Path(settings.dataset_upload_dir) / dataset_id / "meta.json"
    if not meta_file.exists():
        raise DatasetNotFoundError(dataset_id)

    cached = cache_get(dataset_id, viz_type)
    if cached:
        return {"status": "cached", "fetch_url": f"/api/v2/datasets/{dataset_id}/visualizations/tier3/{viz_type}"}

    title, compute_fn = TIER3_JOBS[viz_type]
    manager = get_job_manager()

    async def _run(mgr, job_id: str):
        loop = asyncio.get_event_loop()
        mgr.update_progress(job_id, "Loading dataset...", 10)
        df = await loop.run_in_executor(None, lambda: _load_df(dataset_id))
        target = _get_suggested_target(dataset_id)
        mgr.update_progress(job_id, f"Computing {viz_type}...", 30)
        result = await loop.run_in_executor(None, lambda: compute_fn(df, dataset_id, target))
        mgr.update_progress(job_id, "Caching result...", 90)
        cache_set(dataset_id, viz_type, result)
        mgr.update_progress(job_id, "Complete", 100)
        return {"fetch_url": f"/api/v2/datasets/{dataset_id}/visualizations/tier3/{viz_type}"}

    job_id = await manager.submit(
        job_type="visualization",
        title=title,
        coro_factory=_run,
        dataset_id=dataset_id,
    )
    return {"status": "queued", "job_id": job_id}


@router.get("/datasets/{dataset_id}/visualizations/tier3/{viz_type}")
async def get_tier3_visualization(dataset_id: str, viz_type: str):
    """Return cached Tier 3 result. 404 if not yet computed."""
    cached = cache_get(dataset_id, viz_type)
    if cached:
        return cached
    raise HTTPException(
        status_code=404,
        detail="Result not available. POST to this endpoint first to trigger computation."
    )
