"""
test_memory.py — Memory-leak guard tests using Python's tracemalloc.

These tests ensure key hot-path operations don't accumulate heap memory
unboundedly across repeated calls (e.g. the telemetry registry, the /system/metrics
endpoint, and repeated dataset-upload telemetry recordings).

Failure threshold: < 10 MB of NEW allocations across 100 iterations.
Peak RSS is not measured here (tracemalloc measures only Python heap objects).
"""
from __future__ import annotations

import gc
import tracemalloc

import pytest

# ─── Fixtures ─────────────────────────────────────────────────────────────────
# `client` fixture comes from conftest.py (scope=function, uses main.app)


@pytest.fixture(autouse=True)
def reset_telemetry_registry():
    """Reset the telemetry singleton before each test so leaks don't compound."""
    from core.telemetry import get_registry
    get_registry().reset()
    yield
    get_registry().reset()


# ─── Helpers ──────────────────────────────────────────────────────────────────

_10_MB = 10 * 1024 * 1024
_50_MB = 50 * 1024 * 1024


def _gc_snapshot() -> tracemalloc.Snapshot:
    """Force a GC cycle and take a tracemalloc snapshot."""
    gc.collect()
    return tracemalloc.take_snapshot()


# ─── Tests ────────────────────────────────────────────────────────────────────

def test_telemetry_record_request_no_leak():
    """Recording 10 000 requests across >MAX_ROUTES distinct paths stays bounded."""
    from core.telemetry import get_registry

    tracemalloc.start()
    snap_before = _gc_snapshot()

    reg = get_registry()
    # Use >200 distinct paths to exercise the LRU eviction path
    for i in range(10_000):
        path = f"/api/v2/route_{i % 300}"
        reg.record_request(path, float(i % 1000), is_error=(i % 10 == 0))

    snap_after = _gc_snapshot()
    tracemalloc.stop()

    top_stats = snap_after.compare_to(snap_before, "lineno")
    new_bytes = sum(s.size_diff for s in top_stats if s.size_diff > 0)
    assert new_bytes < _10_MB, (
        f"Telemetry record_request allocated {new_bytes / 1024:.1f} KB of new heap "
        f"across 10 000 calls — possible unbounded growth."
    )


def test_metrics_endpoint_no_leak(client: TestClient):
    """GET /api/v2/system/metrics 100 times should not accumulate heap objects."""
    tracemalloc.start()
    snap_before = _gc_snapshot()

    for _ in range(100):
        resp = client.get("/api/v2/system/metrics")
        assert resp.status_code == 200

    snap_after = _gc_snapshot()
    tracemalloc.stop()

    top_stats = snap_after.compare_to(snap_before, "lineno")
    new_bytes = sum(s.size_diff for s in top_stats if s.size_diff > 0)
    assert new_bytes < _10_MB, (
        f"GET /system/metrics allocated {new_bytes / 1024:.1f} KB of new heap "
        f"across 100 calls — possible unbounded growth."
    )


def test_telemetry_inference_eviction_no_leak():
    """Inference tracking respects MAX_MODELS cap and doesn't grow without bound."""
    from core.telemetry import get_registry, MAX_MODELS

    reg = get_registry()
    tracemalloc.start()
    snap_before = _gc_snapshot()

    # Record far more models than the cap to exercise eviction
    for i in range(MAX_MODELS * 5):
        reg.record_inference(f"model_{i}", float(i % 500))

    snap_after = _gc_snapshot()
    tracemalloc.stop()

    # Verify the internal dict never exceeded the cap
    assert len(reg._inference) <= MAX_MODELS, (
        f"Inference dict has {len(reg._inference)} entries — exceeds MAX_MODELS={MAX_MODELS}"
    )

    top_stats = snap_after.compare_to(snap_before, "lineno")
    new_bytes = sum(s.size_diff for s in top_stats if s.size_diff > 0)
    assert new_bytes < _10_MB, (
        f"Inference eviction path allocated {new_bytes / 1024:.1f} KB unexpectedly."
    )


def test_dataset_upload_telemetry_bounded():
    """Dataset upload size deque stays bounded at maxlen=100."""
    from core.telemetry import get_registry

    reg = get_registry()
    for i in range(500):
        reg.record_dataset_upload(i * 1024)

    sizes = list(reg._dataset_sizes)
    assert len(sizes) == 100, (
        f"Dataset sizes deque has {len(sizes)} entries — expected maxlen=100"
    )
    # Should contain the last 100 entries (400 … 499 * 1024)
    assert sizes[-1] == 499 * 1024


def test_training_history_bounded():
    """Training run deque stays bounded at maxlen=50."""
    from core.telemetry import get_registry

    reg = get_registry()
    for i in range(200):
        reg.record_training("xgboost", duration_s=float(i), accuracy=0.95, row_count=1000)

    runs = list(reg._training_runs)
    assert len(runs) == 50, (
        f"Training runs deque has {len(runs)} entries — expected maxlen=50"
    )
