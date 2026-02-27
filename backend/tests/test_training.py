"""Tests for training endpoints."""
import time
import pytest


def test_train_starts_and_returns_task_id(client, uploaded_dataset_id):
    resp = client.post("/api/v1/models/train", json={
        "dataset_id": uploaded_dataset_id,
        "target_column": "label",
        "model_type": "random_forest",
        "hyperparameters": {"n_estimators": 10, "max_depth": 3},
        "test_size": 0.2,
        "random_state": 42,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "task_id" in data
    assert data["status"] == "started"
    # Reset training state for subsequent tests
    time.sleep(0.1)


def test_train_returns_409_if_already_running(client, uploaded_dataset_id):
    from services.training_manager import get_training_manager
    from schemas.training import TrainingStatus
    manager = get_training_manager()
    # Manually set state to RUNNING
    import asyncio
    asyncio.get_event_loop().run_until_complete(manager.acquire_lock())
    try:
        resp = client.post("/api/v1/models/train", json={
            "dataset_id": uploaded_dataset_id,
            "target_column": "label",
            "model_type": "random_forest",
            "hyperparameters": {},
            "test_size": 0.2,
            "random_state": 42,
        })
        assert resp.status_code == 409
    finally:
        manager.release_lock(failed=True, error="test cleanup")


def test_train_returns_404_for_invalid_dataset_id(client):
    resp = client.post("/api/v1/models/train", json={
        "dataset_id": "nonexistent-dataset",
        "target_column": "label",
        "model_type": "random_forest",
        "hyperparameters": {},
        "test_size": 0.2,
        "random_state": 42,
    })
    assert resp.status_code == 404


def test_train_returns_422_for_invalid_target_column(client, uploaded_dataset_id):
    resp = client.post("/api/v1/models/train", json={
        "dataset_id": uploaded_dataset_id,
        "target_column": "nonexistent_column",
        "model_type": "random_forest",
        "hyperparameters": {},
        "test_size": 0.2,
        "random_state": 42,
    })
    assert resp.status_code == 422


def test_train_returns_422_for_invalid_model_type(client, uploaded_dataset_id):
    resp = client.post("/api/v1/models/train", json={
        "dataset_id": uploaded_dataset_id,
        "target_column": "label",
        "model_type": "neural_network",
        "hyperparameters": {},
        "test_size": 0.2,
        "random_state": 42,
    })
    assert resp.status_code == 422


def test_train_status_returns_correct_structure(client):
    resp = client.get("/api/v1/models/train/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "progress_pct" in data
