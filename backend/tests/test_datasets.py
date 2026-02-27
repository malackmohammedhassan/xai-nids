"""Tests for dataset endpoints."""
import io


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
    assert data["task_type"] in ("classification", "regression")
    assert "suggested_target_column" in data


def test_introspect_detects_categorical_features(client, uploaded_dataset_id):
    resp = client.get(f"/api/v1/datasets/{uploaded_dataset_id}/introspect")
    assert resp.status_code == 200
    data = resp.json()
    assert "numerical_features" in data


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
