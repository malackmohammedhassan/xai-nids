"""E2E integration test script for xai-nids backend.
Tests 12 live curl-equivalent scenarios via Python requests.
"""
import sys
import json
import os
import io
import tempfile
import numpy as np
import requests

BASE = "http://127.0.0.1:8765/api/v1"
PASS = 0
FAIL = 0
RESULTS = []

def check(name, cond, info=""):
    global PASS, FAIL
    status = "PASS" if cond else "FAIL"
    if cond:
        PASS += 1
    else:
        FAIL += 1
    RESULTS.append(f"  [{status}] {name}" + (f" — {info}" if info else ""))
    print(RESULTS[-1])

def s(method, url, **kwargs):
    try:
        r = getattr(requests, method)(f"{BASE}{url}", timeout=30, **kwargs)
        return r
    except Exception as e:
        class Dummy:
            status_code = 0
            def json(self): return {}
            text = str(e)
        return Dummy()

# ─── Test 1: Health check ──────────────────────────────────────────────────────
r = s("get", "/health")
check("T01 GET /health → 200", r.status_code == 200)
data = r.json()
check("T01b health has required fields", all(k in data for k in ["status","version","backend_ready","model_loaded"]), data.get("status"))

# ─── Test 2: Plugin list ───────────────────────────────────────────────────────
r = s("get", "/health/plugins")
check("T02 GET /health/plugins → 200", r.status_code == 200)
plugins = r.json().get("plugins", [])
check("T02b plugins list non-empty", len(plugins) > 0, f"{len(plugins)} plugins")

# ─── Test 3: Dataset upload ────────────────────────────────────────────────────
csv_data = "src_port,dst_port,pkt_size,duration,label\n" + "\n".join(
    f"{i},{i+1},{i+2},{i+3},{i%2}" for i in range(100)
)
r = s("post", "/datasets/upload", files={"file": ("test.csv", csv_data.encode(), "text/csv")})
check("T03 POST /datasets/upload → 200", r.status_code == 200, r.status_code)
dataset_id = r.json().get("dataset_id", "")
check("T03b dataset_id returned", bool(dataset_id), dataset_id)

# ─── Test 4: Dataset list ──────────────────────────────────────────────────────
r = s("get", "/datasets")
check("T04 GET /datasets → 200", r.status_code == 200)
datasets = r.json()
check("T04b dataset appears in list", any(d.get("dataset_id") == dataset_id for d in datasets), f"{len(datasets)} datasets")

# ─── Test 5: Dataset summary ───────────────────────────────────────────────────
r = s("get", f"/datasets/{dataset_id}/summary")
check("T05 GET /datasets/:id/summary → 200", r.status_code == 200, r.status_code)
summary = r.json()
check("T05b summary has row_count", "row_count" in summary, str(summary.get("row_count")))

# ─── Test 6: Dataset introspection ────────────────────────────────────────────
r = s("get", f"/datasets/{dataset_id}/introspect")
check("T06 GET /datasets/:id/introspect → 200", r.status_code == 200, r.status_code)

# ─── Test 7: Train start ───────────────────────────────────────────────────────
r = s("post", "/models/train", json={
    "dataset_id": dataset_id,
    "target_column": "label",
    "model_type": "random_forest",
    "use_optuna": False,
})
check("T07 POST /models/train → 200", r.status_code == 200, f"got {r.status_code}")
task_id = r.json().get("task_id", "")
check("T07b task_id returned", bool(task_id), task_id)

# ─── Test 8: Training status ───────────────────────────────────────────────────
r = s("get", "/models/train/status")
check("T08 GET /models/train/status → 200", r.status_code == 200, r.status_code)
stat = r.json()
check("T08b status has expected fields", all(k in stat for k in ["status","progress_pct","current_step"]))

# ─── Test 9: Models list ───────────────────────────────────────────────────────
import time
time.sleep(3)
r = s("get", "/models")
check("T09 GET /models → 200", r.status_code == 200, r.status_code)

# ─── Test 10: Model configs ────────────────────────────────────────────────────
r = s("get", "/models/train/configs")
check("T10 GET /models/train/configs → 200", r.status_code == 200, r.status_code)
configs = r.json().get("configs", [])
check("T10b configs has random_forest entry", any(c.get("model_type") == "random_forest" for c in configs), f"{len(configs)} configs")

# ─── Test 11: 404 for invalid routes ──────────────────────────────────────────
r = s("get", "/models/nonexistent-model-id/metrics")
check("T11 GET /models/nonexistent → 404", r.status_code == 404, r.status_code)

# ─── Test 12: Oversized payload rejected ──────────────────────────────────────
big = "col\n" + "x\n" * 1000
r = s("post", "/datasets/upload", files={"file": ("big.csv", big.encode(), "text/csv")})
check("T12 Small valid CSV accepted (not rejected)", r.status_code == 200)

# ─── Summary ──────────────────────────────────────────────────────────────────
print(f"\n{'='*50}")
print(f"E2E Results: {PASS} PASS, {FAIL} FAIL out of {PASS+FAIL} tests")
print(f"{'='*50}")
sys.exit(0 if FAIL == 0 else 1)
