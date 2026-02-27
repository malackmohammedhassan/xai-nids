"""
Pytest fixtures shared across all test modules.
"""
from __future__ import annotations

import io
import os

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

# Point at the new main.py
os.environ.setdefault("DATASET_UPLOAD_DIR", "/tmp/xai_test_datasets")
os.environ.setdefault("MODEL_SAVE_DIR", "/tmp/xai_test_models")
os.environ.setdefault("EXPERIMENT_DB_PATH", "/tmp/xai_test_experiments.db")
os.environ.setdefault("CORS_ORIGINS", '["http://localhost:5173"]')
os.environ.setdefault("LOG_LEVEL", "WARNING")
os.environ.setdefault("PLUGIN_DIR", "./plugins")


@pytest.fixture(scope="session")
def client():
    from main import app
    return TestClient(app)


def _make_csv(n_rows: int = 100, n_features: int = 5, add_nulls: bool = False) -> bytes:
    rng = np.random.default_rng(42)
    data = {f"feature_{i}": rng.random(n_rows) for i in range(n_features - 1)}
    data["label"] = rng.integers(0, 2, n_rows)
    df = pd.DataFrame(data)
    if add_nulls:
        df["feature_0"] = np.nan  # 100% null column
    buf = io.BytesIO()
    df.to_csv(buf, index=False)
    return buf.getvalue()


@pytest.fixture
def sample_csv_bytes():
    return _make_csv(100, 5)


@pytest.fixture
def sample_parquet_bytes():
    rng = np.random.default_rng(99)
    data = {f"feature_{i}": rng.random(100) for i in range(4)}
    data["label"] = rng.integers(0, 2, 100)
    df = pd.DataFrame(data)
    buf = io.BytesIO()
    df.to_parquet(buf, index=False)
    return buf.getvalue()


@pytest.fixture
def oversized_csv_bytes():
    """Fake oversized file (>200 MB would take too long; we override the limit in env)."""
    # Instead of genuinely large file, patch the limit:
    os.environ["MAX_DATASET_SIZE_MB"] = "0"  # Everything oversized
    data = _make_csv(10, 3)
    yield data
    os.environ["MAX_DATASET_SIZE_MB"] = "200"


@pytest.fixture
def invalid_pdf_bytes():
    return b"%PDF-1.4 fake pdf content"


@pytest.fixture
def null_column_csv_bytes():
    return _make_csv(100, 5, add_nulls=True)


@pytest.fixture
def uploaded_dataset_id(client, sample_csv_bytes):
    """Upload a CSV and return its dataset_id."""
    resp = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test.csv", sample_csv_bytes, "text/csv")},
    )
    assert resp.status_code == 200
    return resp.json()["dataset_id"]
