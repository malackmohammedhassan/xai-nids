"""Tests for GET /api/v1/health"""


def test_health_returns_200(client):
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200


def test_health_has_all_fields(client):
    data = client.get("/api/v1/health").json()
    required = ["status", "version", "backend_ready", "model_loaded",
                "uptime_seconds", "python_version", "loaded_plugin"]
    for field in required:
        assert field in data, f"Missing field: {field}"


def test_health_reports_no_model_on_fresh_start(client):
    data = client.get("/api/v1/health").json()
    assert data["status"] == "ok"
    assert data["backend_ready"] is True
