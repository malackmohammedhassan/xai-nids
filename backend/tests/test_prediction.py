"""Tests for prediction endpoints."""
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from services.model_registry import save_model, load_model


def _seed_model():
    X = np.random.rand(80, 3)
    y = np.random.randint(0, 2, 80)
    clf = RandomForestClassifier(n_estimators=5, random_state=1)
    clf.fit(X, y)
    bundle = {
        "model": clf,
        "feature_names": ["feat_a", "feat_b", "feat_c"],
        "class_names": ["Normal", "Attack"],
        "scaler": None,
        "selector": None,
        "le_dict": {},
        "original_columns": ["feat_a", "feat_b", "feat_c"],
        "model_type": "random_forest",
    }
    return save_model(bundle, "random_forest", "pred-test-run", {
        "dataset_filename": "test.csv",
        "accuracy": 0.8,
        "f1_score": 0.8,
        "hyperparameters": {},
        "feature_count": 3,
    })


def test_predict_valid_input_returns_prediction(client):
    model_id = _seed_model()
    # Load the model first
    client.post(f"/api/v1/models/{model_id}/load")
    resp = client.post(f"/api/v1/models/{model_id}/predict", json={
        "inputs": [{"feat_a": 0.5, "feat_b": 0.3, "feat_c": 0.7}]
    })
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["predictions"]) == 1
    assert "prediction" in data["predictions"][0]


def test_predict_returns_400_if_model_not_loaded(client):
    import uuid
    fake_id = f"random_forest_20240101_000000_{str(uuid.uuid4())[:8]}"
    resp = client.post(f"/api/v1/models/{fake_id}/predict", json={
        "inputs": [{"feat_a": 0.1}]
    })
    assert resp.status_code == 400


def test_predict_missing_features_returns_422_with_details(client):
    model_id = _seed_model()
    client.post(f"/api/v1/models/{model_id}/load")
    resp = client.post(f"/api/v1/models/{model_id}/predict", json={
        "inputs": [{"feat_a": 0.5}]  # Missing feat_b, feat_c
    })
    assert resp.status_code == 422
    data = resp.json()
    assert "missing" in data


def test_predict_extra_features_returns_422_with_details(client):
    model_id = _seed_model()
    client.post(f"/api/v1/models/{model_id}/load")
    resp = client.post(f"/api/v1/models/{model_id}/predict", json={
        "inputs": [{"feat_a": 0.5, "feat_b": 0.3, "feat_c": 0.7, "extra_feat": 0.9}]
    })
    assert resp.status_code == 422
    data = resp.json()
    assert "extra" in data


def test_predict_nan_input_returns_422(client):
    model_id = _seed_model()
    client.post(f"/api/v1/models/{model_id}/load")
    resp = client.post(f"/api/v1/models/{model_id}/predict", json={
        "inputs": [{"feat_a": None, "feat_b": 0.3, "feat_c": 0.7}]
    })
    assert resp.status_code == 422
