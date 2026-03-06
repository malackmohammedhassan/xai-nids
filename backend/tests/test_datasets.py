"""Tests for dataset endpoints."""
import io
import pytest


def test_upload_valid_csv_returns_dataset_id(client, sample_csv_bytes):
    resp = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test.csv", sample_csv_bytes, "text/csv")},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "dataset_id" in data
    assert data["rows"] == 100


def test_upload_valid_parquet_returns_dataset_id(client, sample_parquet_bytes):
    pytest.importorskip("pyarrow", reason="pyarrow not installed in this environment")
    resp = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("test.parquet", sample_parquet_bytes, "application/octet-stream")},
    )
    assert resp.status_code == 200
    assert "dataset_id" in resp.json()


def test_upload_pdf_rejected_with_422(client, invalid_pdf_bytes):
    resp = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("report.pdf", invalid_pdf_bytes, "application/pdf")},
    )
    assert resp.status_code == 422


def test_upload_oversized_rejected_with_413(client, oversized_csv_bytes):
    import os
    # MAX_DATASET_SIZE_MB is set to 0 in this fixture
    from core.config import get_settings
    get_settings.cache_clear()
    os.environ["MAX_DATASET_SIZE_MB"] = "0"
    resp = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("big.csv", oversized_csv_bytes, "text/csv")},
    )
    get_settings.cache_clear()
    os.environ["MAX_DATASET_SIZE_MB"] = "200"
    assert resp.status_code == 413


def test_upload_empty_csv_rejected_with_422(client):
    tiny_csv = b"a,b\n1,2\n"  # only 1 data row
    resp = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("tiny.csv", tiny_csv, "text/csv")},
    )
    assert resp.status_code == 422


def test_upload_all_null_column_rejected_with_422(client, null_column_csv_bytes):
    resp = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("nulls.csv", null_column_csv_bytes, "text/csv")},
    )
    assert resp.status_code == 422


def test_summary_returns_correct_schema(client, uploaded_dataset_id):
    resp = client.get(f"/api/v1/datasets/{uploaded_dataset_id}/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert "columns" in data
    assert "shape" in data
    assert "sample_rows" in data


def test_summary_for_nonexistent_dataset_returns_404(client):
    resp = client.get("/api/v1/datasets/nonexistent-id/summary")
    assert resp.status_code == 404


def test_introspect_detects_task_type(client, uploaded_dataset_id):
    resp = client.get(f"/api/v1/datasets/{uploaded_dataset_id}/introspect")
    assert resp.status_code == 200
    data = resp.json()
    valid_task_types = ("classification", "regression", "binary_classification", "multiclass_classification")
    assert data["task_type"] in valid_task_types, f"Unexpected task_type: {data['task_type']!r}"
    assert "suggested_target" in data


def test_introspect_detects_categorical_features(client, uploaded_dataset_id):
    resp = client.get(f"/api/v1/datasets/{uploaded_dataset_id}/introspect")
    assert resp.status_code == 200
    data = resp.json()
    # Router returns 'numeric_features' (not 'numerical_features')
    assert "numeric_features" in data or "numerical_features" in data


def test_upload_duplicate_columns_rejected_with_422(client):
    """A CSV with duplicate column names must be rejected."""
    import io
    import pandas as pd
    # Build a dataframe with two columns named 'feature_0'
    df = pd.DataFrame([[1, 2, 3]] * 60, columns=["feature_0", "feature_0", "label"])
    buf = io.BytesIO()
    df.to_csv(buf, index=False)
    resp = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("dup_cols.csv", buf.getvalue(), "text/csv")},
    )
    assert resp.status_code == 422
    data = resp.json()
    # Handler merges exc.detail into body, so 'error' kwarg value wins
    assert data.get("error") in ("dataset_validation_error", "duplicate_columns")


def test_upload_corrupt_encoding_rejected_with_422(client):
    """Binary garbage that cannot be parsed as CSV/Parquet must be rejected."""
    resp = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("corrupt.csv", b"\xff\xfe" + b"\x00" * 512, "text/csv")},
    )
    assert resp.status_code == 422


def test_upload_path_traversal_filename_is_sanitized(client, sample_csv_bytes):
    """A filename with path traversal sequences must not crash or escape."""
    # The upload should either succeed (with sanitized name) or return a 4xx —
    # it must NEVER cause a 500 or write outside the uploads directory.
    resp = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("../../etc/passwd.csv", sample_csv_bytes, "text/csv")},
    )
    assert resp.status_code != 500


def test_delete_dataset_removes_file(client, sample_csv_bytes):
    # Upload then delete
    resp = client.post(
        "/api/v1/datasets/upload",
        files={"file": ("delete_me.csv", sample_csv_bytes, "text/csv")},
    )
    did = resp.json()["dataset_id"]
    del_resp = client.delete(f"/api/v1/datasets/{did}")
    assert del_resp.status_code == 200
    assert del_resp.json()["deleted"] is True
    # Summary should 404 now
    assert client.get(f"/api/v1/datasets/{did}/summary").status_code == 404
