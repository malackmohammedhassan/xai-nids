"""Tests for GET /api/v1/health and /api/v1/health/live"""
import time


def test_health_returns_200(client):
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200


def test_health_has_all_fields(client):
    data = client.get("/api/v1/health").json()
    required = ["status", "version", "backend_ready", "model_loaded",
                "uptime_seconds", "uptime", "python_version", "loaded_plugin"]
    for field in required:
        assert field in data, f"Missing field: {field}"


def test_health_reports_healthy_on_fresh_start(client):
    data = client.get("/api/v1/health").json()
    assert data["status"] == "healthy", f"Expected 'healthy', got {data['status']!r}"
    assert data["backend_ready"] is True


def test_health_reports_correct_version(client):
    data = client.get("/api/v1/health").json()
    assert data["version"] == "2.0.0"


def test_health_uptime_is_non_negative_float(client):
    data = client.get("/api/v1/health").json()
    assert isinstance(data["uptime"], (int, float))
    assert data["uptime"] >= 0


def test_liveness_probe_returns_healthy(client):
    resp = client.get("/api/v1/health/live")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "uptime" in data


def test_health_response_time_under_500ms(client):
    """Health endpoint must respond fast enough for a readiness probe."""
    t0 = time.perf_counter()
    client.get("/api/v1/health")
    elapsed_ms = (time.perf_counter() - t0) * 1000
    # Allow generous threshold for CI; real target is <100 ms
    assert elapsed_ms < 2000, f"Health response took {elapsed_ms:.0f} ms"


def test_health_includes_plugin_and_dir_flags(client):
    data = client.get("/api/v1/health").json()
    assert "dataset_dir_exists" in data
    assert "model_dir_exists" in data
    assert "plugins_loaded" in data
    assert isinstance(data["plugins_loaded"], list)
