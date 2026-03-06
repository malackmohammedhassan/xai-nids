"""
locustfile.py — XAI-NIDS load tests.

Run with:
    pip install locust
    locust -f load_test/locustfile.py \
           --host http://127.0.0.1:8765 \
           --users 50 --spawn-rate 5 --run-time 60s --headless

Scenarios
─────────
• HealthUser    — lightweight liveness/health polling (realistic dashboard poller)
• ApiUser       — typical analyst: upload dataset  list datasets  get metrics
• PredictUser   — burst inference stress
• WebSocketUser — concurrent WS stream (monitors training progress)
"""
from __future__ import annotations

import json
import random
import io
import time

from locust import HttpUser, TaskSet, task, between, events

try:
    import websocket  # websocket-client package (optional)
    _WS_AVAILABLE = True
except ImportError:
    _WS_AVAILABLE = False

# ─── Shared helpers ──────────────────────────────────────────────────────────

BASE = "/api/v2"


def _csv_payload(rows: int = 100, cols: int = 10) -> bytes:
    """Generate a small synthetic CSV with numeric features + binary label."""
    header = ",".join([f"f{i}" for i in range(cols)] + ["label"])
    data_rows = [
        ",".join([str(round(random.gauss(0, 1), 4)) for _ in range(cols)] + [str(random.randint(0, 1))])
        for _ in range(rows)
    ]
    return "\n".join([header] + data_rows).encode()


def _sample_feature_values(n: int = 10) -> dict:
    return {f"f{i}": round(random.gauss(0, 1), 4) for i in range(n)}


# ─── Health polling user ──────────────────────────────────────────────────────

class HealthUser(HttpUser):
    """Simulates a dashboard widget polling every 5 s."""
    weight = 2
    wait_time = between(4, 6)

    @task(3)
    def check_health(self):
        self.client.get(f"{BASE}/health", name="/health")

    @task(1)
    def check_liveness(self):
        self.client.get(f"{BASE}/health/live", name="/health/live")

    @task(1)
    def check_resources(self):
        self.client.get(f"{BASE}/system/resources", name="/system/resources")

    @task(1)
    def check_metrics(self):
        self.client.get(f"{BASE}/system/metrics", name="/system/metrics")


# ─── Analyst user ─────────────────────────────────────────────────────────────

class AnalystUser(HttpUser):
    """Typical analyst browsing the UI, uploading data, listing datasets."""
    weight = 5
    wait_time = between(1, 3)

    def on_start(self):
        self.dataset_ids: list[str] = []
        # Warm-up: list existing datasets
        r = self.client.get(f"{BASE}/datasets", name="/datasets")
        if r.status_code == 200:
            try:
                data = r.json()
                self.dataset_ids = [d["dataset_id"] for d in data.get("datasets", [])]
            except Exception:
                pass

    @task(3)
    def list_datasets(self):
        self.client.get(f"{BASE}/datasets", name="/datasets")

    @task(2)
    def upload_small_dataset(self):
        csv_bytes = _csv_payload(rows=200)
        files = {"file": ("stress_test.csv", io.BytesIO(csv_bytes), "text/csv")}
        r = self.client.post(f"{BASE}/datasets/upload", files=files, name="/datasets/upload")
        if r.status_code == 200:
            try:
                ds_id = r.json().get("dataset_id")
                if ds_id:
                    self.dataset_ids.append(ds_id)
            except Exception:
                pass

    @task(2)
    def get_dataset_summary(self):
        if not self.dataset_ids:
            return
        ds_id = random.choice(self.dataset_ids)
        self.client.get(f"{BASE}/datasets/{ds_id}/summary", name="/datasets/{id}/summary")

    @task(1)
    def list_models(self):
        self.client.get(f"{BASE}/models", name="/models")

    @task(1)
    def list_jobs(self):
        self.client.get(f"{BASE}/jobs", name="/jobs")


# ─── Inference stress user ────────────────────────────────────────────────────

class PredictUser(HttpUser):
    """Hammers the prediction endpoint — models inference throughput."""
    weight = 8
    wait_time = between(0.05, 0.5)

    def on_start(self):
        self.model_ids: list[str] = []
        r = self.client.get(f"{BASE}/models", name="/models")
        if r.status_code == 200:
            try:
                self.model_ids = [m["model_id"] for m in r.json().get("models", [])]
            except Exception:
                pass

    @task
    def predict(self):
        if not self.model_ids:
            return
        model_id = random.choice(self.model_ids)
        payload = {
            "model_id": model_id,
            "features": _sample_feature_values(),
        }
        self.client.post(
            f"{BASE}/predict",
            json=payload,
            name="/predict",
        )


# ─── Burst concurrent upload user ───────────────────────────────────────────

class UploadStressUser(HttpUser):
    """Simulates concurrent large CSV uploads to surface race conditions."""
    weight = 1
    wait_time = between(2, 4)

    @task
    def upload_medium_dataset(self):
        csv_bytes = _csv_payload(rows=5_000, cols=15)
        files = {"file": ("batch_upload.csv", io.BytesIO(csv_bytes), "text/csv")}
        self.client.post(f"{BASE}/datasets/upload", files=files, name="/datasets/upload[5k]")


# ─── WebSocket stream user ────────────────────────────────────────────────────

class WSStreamUser(HttpUser):
    """Connects to the WS stream and holds it open, reading events."""
    weight = 3
    wait_time = between(5, 10)

    @task
    def hold_ws_connection(self):
        if not _WS_AVAILABLE:
            return
        host = self.host.replace("http://", "ws://").replace("https://", "wss://")
        ws_url = f"{host}{BASE}/ws/stream"
        try:
            ws = websocket.create_connection(ws_url, timeout=5)
            start = time.time()
            messages = 0
            while time.time() - start < 4:
                try:
                    ws.settimeout(1)
                    raw = ws.recv()
                    data = json.loads(raw)
                    messages += 1
                    if data.get("event") == "job_complete":
                        break
                except Exception:
                    break
            ws.close()
            events.request.fire(
                request_type="WS",
                name="/ws/stream",
                response_time=int((time.time() - start) * 1000),
                response_length=messages,
                exception=None,
                context=self.context(),
            )
        except Exception as exc:
            events.request.fire(
                request_type="WS",
                name="/ws/stream",
                response_time=0,
                response_length=0,
                exception=exc,
                context=self.context(),
            )
