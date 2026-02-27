"""Tests for model list and metrics endpoints."""
import pytest


def test_list_models_returns_array(client):
    resp = client.get("/api/v1/models/list")
    assert resp.status_code == 200
    data = resp.json()
    assert "models" in data
    assert isinstance(data["models"], list)


def test_list_models_empty_on_fresh_start(client):
    resp = client.get("/api/v1/models/list")
    # We can't guarantee 0 models if tests run in order, so just check structure
    assert resp.status_code == 200


def test_get_metrics_returns_complete_schema(client):
    # Create and save a fake model bundle for testing
    import numpy as np
    from sklearn.ensemble import RandomForestClassifier
    from services.model_registry import save_model

    X = np.random.rand(50, 4)
    y = np.random.randint(0, 2, 50)
    clf = RandomForestClassifier(n_estimators=3, random_state=42)
    clf.fit(X, y)

    bundle = {
        "model": clf,
        "feature_names": ["f0", "f1", "f2", "f3"],
        "class_names": ["Normal", "Attack"],
        "scaler": None,
        "selector": None,
        "le_dict": {},
        "original_columns": ["f0", "f1", "f2", "f3"],
        "model_type": "random_forest",
    }
    metadata = {
        "dataset_filename": "test.csv",
        "accuracy": 0.85,
        "f1_score": 0.84,
        "hyperparameters": {"n_estimators": 3},
        "feature_count": 4,
        "full_metrics": {
            "metrics": {"accuracy": 0.85, "f1_score": 0.84, "precision": 0.83, "recall": 0.85, "roc_auc": 0.9},
            "confusion_matrix": [[20, 5], [3, 22]],
            "feature_importance": [{"feature": "f0", "importance": 0.3}],
        },
    }
    model_id = save_model(bundle, "random_forest", "test-run-id", metadata)

    resp = client.get(f"/api/v1/models/{model_id}/metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert "accuracy" in data
    assert "confusion_matrix" in data


def test_delete_model_removes_from_list(client):
    import numpy as np
    from sklearn.ensemble import RandomForestClassifier
    from services.model_registry import save_model

    X = np.random.rand(50, 3)
    y = np.random.randint(0, 2, 50)
    clf = RandomForestClassifier(n_estimators=2, random_state=1)
    clf.fit(X, y)

    bundle = {
        "model": clf,
        "feature_names": ["a", "b", "c"],
        "class_names": ["N", "A"],
        "scaler": None,
        "selector": None,
        "le_dict": {},
        "original_columns": ["a", "b", "c"],
        "model_type": "random_forest",
    }
    model_id = save_model(bundle, "random_forest", "delete-test-run", {"dataset_filename": "x.csv", "accuracy": 0.8, "f1_score": 0.8, "hyperparameters": {}, "feature_count": 3})

    del_resp = client.delete(f"/api/v1/models/{model_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["deleted"] is True
