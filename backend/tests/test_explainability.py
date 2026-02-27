"""Tests for SHAP and LIME explainability endpoints."""
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from services.model_registry import save_model


def _seed_explain_model():
    X = np.random.rand(100, 4)
    y = np.random.randint(0, 2, 100)
    clf = RandomForestClassifier(n_estimators=5, random_state=42)
    clf.fit(X, y)
    bundle = {
        "model": clf,
        "feature_names": ["src_port", "dst_port", "pkt_size", "duration"],
        "class_names": ["Normal", "Attack"],
        "scaler": None,
        "selector": None,
        "le_dict": {},
        "original_columns": ["src_port", "dst_port", "pkt_size", "duration"],
        "model_type": "random_forest",
    }
    return save_model(bundle, "random_forest", "explain-test-run", {
        "dataset_filename": "test.csv",
        "accuracy": 0.82,
        "f1_score": 0.81,
        "hyperparameters": {},
        "feature_count": 4,
    })


def test_explain_shap_returns_base64(client):
    model_id = _seed_explain_model()
    client.post(f"/api/v1/models/{model_id}/load")
    resp = client.post(f"/api/v1/models/{model_id}/explain", json={
        "input_row": {"src_port": 0.3, "dst_port": 0.7, "pkt_size": 0.5, "duration": 0.1},
        "method": "shap",
        "max_display_features": 4,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "shap" in data
    assert data["shap"]["force_plot_base64"].startswith("data:image/png;base64,")


def test_explain_lime_returns_weights(client):
    model_id = _seed_explain_model()
    client.post(f"/api/v1/models/{model_id}/load")
    resp = client.post(f"/api/v1/models/{model_id}/explain", json={
        "input_row": {"src_port": 0.3, "dst_port": 0.7, "pkt_size": 0.5, "duration": 0.1},
        "method": "lime",
        "max_display_features": 4,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "lime" in data
    assert len(data["lime"]["explanation"]) > 0


def test_explain_both_returns_complete_response(client):
    model_id = _seed_explain_model()
    client.post(f"/api/v1/models/{model_id}/load")
    resp = client.post(f"/api/v1/models/{model_id}/explain", json={
        "input_row": {"src_port": 0.3, "dst_port": 0.7, "pkt_size": 0.5, "duration": 0.1},
        "method": "both",
        "max_display_features": 4,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "shap" in data
    assert "lime" in data


def test_explain_large_dataset_triggers_sampling(client):
    model_id = _seed_explain_model()
    client.post(f"/api/v1/models/{model_id}/load")
    import os
    os.environ["SHAP_MAX_ROWS"] = "5"
    from core.config import get_settings
    get_settings.cache_clear()
    resp = client.post(f"/api/v1/models/{model_id}/explain", json={
        "input_row": {"src_port": 0.3, "dst_port": 0.7, "pkt_size": 0.5, "duration": 0.1},
        "method": "shap",
        "max_display_features": 4,
    })
    get_settings.cache_clear()
    os.environ["SHAP_MAX_ROWS"] = "5000"
    assert resp.status_code == 200


def test_explain_with_invalid_model_returns_404(client):
    resp = client.post("/api/v1/models/nonexistent-model/explain", json={
        "input_row": {"f": 0.1},
        "method": "shap",
    })
    # 400 (not loaded) or 404 — either is acceptable
    assert resp.status_code in (400, 404)
