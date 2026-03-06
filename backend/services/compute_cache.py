"""
Compute cache — 3-tier caching for expensive dataset computations.

Tier 1: In-process LRU dict  (maxsize=50) → instant (RAM)
Tier 2: Disk JSON cache      (backend/compute_cache/) → survives restart
Tier 3: Recompute            (pandas / sklearn)

Cache keys: f"{dataset_id}:{computation_type}"
Invalidation: on dataset delete or manual flush.
"""
from __future__ import annotations

import hashlib
import json
import shutil
import time
from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

from core.logger import get_logger

logger = get_logger("compute_cache")

_CACHE_DIR = Path(__file__).parent.parent / "compute_cache"
_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# In-process LRU: simple dict with max size
_MEM_CACHE: dict[str, dict] = {}
_MEM_MAX = 50


def _cache_key(dataset_id: str, computation_type: str, params: dict | None = None) -> str:
    raw = f"{dataset_id}:{computation_type}"
    if params:
        raw += ":" + json.dumps(params, sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _evict_if_needed() -> None:
    while len(_MEM_CACHE) >= _MEM_MAX:
        oldest = next(iter(_MEM_CACHE))
        _MEM_CACHE.pop(oldest, None)


def cache_get(dataset_id: str, computation_type: str, params: dict | None = None) -> Optional[dict]:
    """Return cached result or None if not found / expired."""
    key = _cache_key(dataset_id, computation_type, params)

    # Tier 1 — memory
    if key in _MEM_CACHE:
        return _MEM_CACHE[key]

    # Tier 2 — disk
    entry_dir = _CACHE_DIR / key
    meta_file = entry_dir / "meta.json"
    result_file = entry_dir / "result.json"

    if not meta_file.exists() or not result_file.exists():
        return None

    try:
        meta = json.loads(meta_file.read_text())
        ttl_seconds = meta.get("ttl_hours", 48) * 3600
        if time.time() - meta.get("computed_at", 0) > ttl_seconds:
            logger.debug("Cache entry expired", extra={"key": key})
            return None
        result = json.loads(result_file.read_text())
        # Promote to memory
        _evict_if_needed()
        _MEM_CACHE[key] = result
        return result
    except Exception as exc:
        logger.warning("Cache read error", extra={"key": key, "error": str(exc)})
        return None


def cache_set(
    dataset_id: str,
    computation_type: str,
    value: dict,
    params: dict | None = None,
    ttl_hours: int = 48,
) -> None:
    """Store result in both memory and disk."""
    key = _cache_key(dataset_id, computation_type, params)

    # Memory
    _evict_if_needed()
    _MEM_CACHE[key] = value

    # Disk
    entry_dir = _CACHE_DIR / key
    entry_dir.mkdir(parents=True, exist_ok=True)
    try:
        meta = {
            "dataset_id": dataset_id,
            "computation_type": computation_type,
            "computed_at": time.time(),
            "ttl_hours": ttl_hours,
            "key": key,
        }
        (entry_dir / "meta.json").write_text(json.dumps(meta, indent=2))
        (entry_dir / "result.json").write_text(json.dumps(value, indent=2, default=str))
    except Exception as exc:
        logger.warning("Cache write error", extra={"key": key, "error": str(exc)})


def cache_invalidate(dataset_id: str) -> None:
    """Remove all cache entries for a dataset (called on dataset delete)."""
    # Memory — remove all keys that belong to this dataset
    keys_to_remove = []
    for key in list(_MEM_CACHE.keys()):
        # We can't reverse the hash, but we check disk meta files instead
        pass
    _MEM_CACHE.clear()  # safer: clear all memory cache on any invalidation

    # Disk — scan all entries, read meta to find ones matching dataset_id
    removed = 0
    for entry_dir in _CACHE_DIR.iterdir():
        if not entry_dir.is_dir():
            continue
        meta_file = entry_dir / "meta.json"
        if meta_file.exists():
            try:
                meta = json.loads(meta_file.read_text())
                if meta.get("dataset_id") == dataset_id:
                    shutil.rmtree(entry_dir, ignore_errors=True)
                    removed += 1
            except Exception:
                pass

    logger.info("Cache invalidated", extra={"dataset_id": dataset_id, "entries_removed": removed})


def cache_flush_all() -> None:
    """Remove all cached entries (admin use)."""
    _MEM_CACHE.clear()
    for entry_dir in _CACHE_DIR.iterdir():
        if entry_dir.is_dir():
            shutil.rmtree(entry_dir, ignore_errors=True)
    logger.info("Full cache flush completed")
