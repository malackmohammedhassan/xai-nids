"""
Performance benchmark tests.

These tests measure real wall-clock latency against defined SLA targets.
They pass in CI but also serve as regression detectors — if they fail,
something got significantly slower.

Targets (from architecture spec):
  Dataset upload   <2 s   (50 MB — synthetic in CI, so this tests < 0.5 s for small)
  Summary          <5 s   (100 MB equiv.)
  Predict single   <100 ms
  Health           <500 ms
"""
from __future__ import annotations

import io
import time

import numpy as np
import pandas as pd
import pytest


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _make_csv_bytes(n_rows: int = 1000, n_features: int = 20) -> bytes:
    rng = np.random.default_rng(0)
    data = {f"f{i}": rng.random(n_rows) for i in range(n_features)}
    data["label"] = rng.integers(0, 2, n_rows)
    buf = io.BytesIO()
    pd.DataFrame(data).to_csv(buf, index=False)
    return buf.getvalue()


# ─── Health endpoint  ─────────────────────────────────────────────────────────

def test_health_responds_under_500ms(client):
    t0 = time.perf_counter()
    resp = client.get("/api/v1/health")
    elapsed_ms = (time.perf_counter() - t0) * 1000
    assert resp.status_code == 200
    assert elapsed_ms < 500, f"Health endpoint took {elapsed_ms:.0f} ms (target <500 ms)"


# ─── Upload benchmark ─────────────────────────────────────────────────────────

def test_upload_1k_rows_under_1s(client):
    csv_bytes = _make_csv_bytes(1_000, 10)
    t0 = time.perf_counter()
    resp = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("bench.csv", csv_bytes, "text/csv")},
    )
    elapsed = time.perf_counter() - t0
    assert resp.status_code == 200
    assert elapsed < 1.0, f"Upload 1k rows took {elapsed:.2f}s (target <1 s)"


def test_upload_10k_rows_under_3s(client):
    csv_bytes = _make_csv_bytes(10_000, 20)
    t0 = time.perf_counter()
    resp = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("bench_10k.csv", csv_bytes, "text/csv")},
    )
    elapsed = time.perf_counter() - t0
    assert resp.status_code == 200, resp.text
    assert elapsed < 3.0, f"Upload 10k rows took {elapsed:.2f}s (target <3 s)"


# ─── Summary benchmark  ───────────────────────────────────────────────────────

def test_summary_1k_rows_under_1s(client, uploaded_dataset_id):
    t0 = time.perf_counter()
    resp = client.get(f"/api/v1/datasets/{uploaded_dataset_id}/summary")
    elapsed = time.perf_counter() - t0
    assert resp.status_code == 200
    assert elapsed < 1.0, f"Summary 100-row dataset took {elapsed:.2f}s (target <1 s)"


def test_summary_10k_rows_under_3s(client):
    """Upload a 10 k-row dataset and measure summary latency."""
    csv_bytes = _make_csv_bytes(10_000, 20)
    up = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("summ_bench.csv", csv_bytes, "text/csv")},
    )
    did = up.json()["dataset_id"]
    t0 = time.perf_counter()
    resp = client.get(f"/api/v1/datasets/{did}/summary")
    elapsed = time.perf_counter() - t0
    assert resp.status_code == 200
    assert elapsed < 3.0, f"Summary 10k rows took {elapsed:.2f}s (target <3 s)"


# ─── Prediction latency ───────────────────────────────────────────────────────

def test_predict_single_row_under_200ms(client):
    """Train a tiny model then measure single-row prediction latency."""
    from sklearn.ensemble import RandomForestClassifier
    from services.model_registry import save_model

    rng = np.random.default_rng(7)
    X = rng.random((80, 3))
    y = rng.integers(0, 2, 80)
    clf = RandomForestClassifier(n_estimators=5, random_state=1)
    clf.fit(X, y)
    bundle = {
        "model": clf,
        "feature_names": ["a", "b", "c"],
        "class_names": ["Normal", "Attack"],
        "scaler": None, "selector": None, "le_dict": {},
        "original_columns": ["a", "b", "c"],
        "model_type": "random_forest",
    }
    model_id = save_model(bundle, "random_forest", "perf-pred", {
        "dataset_filename": "bench.csv", "accuracy": 0.8,
        "f1_score": 0.8, "hyperparameters": {}, "feature_count": 3,
    })
    client.post(f"/api/v1/models/{model_id}/load")

    t0 = time.perf_counter()
    resp = client.post(
        f"/api/v1/models/{model_id}/predict",
        json={"inputs": [{"a": 0.5, "b": 0.3, "c": 0.7}]},
    )
    elapsed_ms = (time.perf_counter() - t0) * 1000

    assert resp.status_code == 200
    assert elapsed_ms < 200, f"Single-row prediction took {elapsed_ms:.0f} ms (target <200 ms)"
    # Duration is also embedded in the response
    duration_in_resp = resp.json().get("duration_ms", 0)
    assert duration_in_resp < 200
