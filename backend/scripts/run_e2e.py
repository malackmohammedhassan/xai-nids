#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
E2E Integration Tests for xai-nids backend
Runs against http://127.0.0.1:8765/api/v1
"""
import sys
import time
import json
import random
import csv
import io
import requests

# Force UTF-8 output on Windows (cp1252 can't encode arrows etc.)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BASE = "http://127.0.0.1:8765/api/v1"
PASS = 0
FAIL = 0

def check(name, cond, info=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  [PASS] {name}" + (f"  ({info})" if info else ""))
    else:
        FAIL += 1
        print(f"  [FAIL] {name}" + (f"  ({info})" if info else ""))

def get(path, **kw):
    try:
        return requests.get(f"{BASE}{path}", timeout=30, **kw)
    except Exception as e:
        class E:
            status_code = 0
            text = str(e)
            def json(self): return {}
        return E()

def post(path, **kw):
    try:
        return requests.post(f"{BASE}{path}", timeout=60, **kw)
    except Exception as e:
        class E:
            status_code = 0
            text = str(e)
            def json(self): return {}
        return E()

def delete(path, **kw):
    try:
        return requests.delete(f"{BASE}{path}", timeout=30, **kw)
    except Exception as e:
        class E:
            status_code = 0
            text = str(e)
            def json(self): return {}
        return E()

print("=" * 60)
print("XAI-NIDS Backend E2E Integration Tests")
print("=" * 60)

# ── T01: Health check ─────────────────────────────────────────
print("\n--- Health ---")
r = get("/health")
check("T01 GET /health → 200", r.status_code == 200, f"got {r.status_code}")
h = r.json()
check("T01b status=ok", h.get("status") == "ok")
check("T01c version present", bool(h.get("version")), h.get("version"))
check("T01d backend_ready=true", h.get("backend_ready") is True)
check("T01e model_loaded field exists", "model_loaded" in h)
check("T01f loaded_plugin=xai_ids", h.get("loaded_plugin") == "xai_ids", h.get("loaded_plugin"))
plugins = h.get("available_plugins", [])
check("T01g >=1 plugin available", len(plugins) >= 1, f"{len(plugins)} plugins")

# ── T02: Dataset upload ───────────────────────────────────────
print("\n--- Dataset Upload ---")
random.seed(99)
rows = [["src_port","dst_port","pkt_size","duration","label"]]
for i in range(200):
    rows.append([
        random.randint(1, 65535),
        random.randint(1, 65535),
        random.randint(40, 1460),
        round(random.uniform(0.0, 10.0), 3),
        random.randint(0, 1),
    ])
buf = io.StringIO()
csv.writer(buf).writerows(rows)
csv_bytes = buf.getvalue().encode()

r = post("/datasets/upload", files={"file": ("nids_e2e.csv", csv_bytes, "text/csv")})
check("T02 POST /datasets/upload → 200", r.status_code == 200, f"got {r.status_code}: {r.text[:100]}")
ds = r.json()
dataset_id = ds.get("dataset_id", "")
check("T02b dataset_id returned", bool(dataset_id), dataset_id)
check("T02c rows=200", ds.get("rows") == 200, f"rows={ds.get('rows')}")

# ── T03: Dataset list ─────────────────────────────────────────
print("\n--- Dataset List ---")
r = get("/datasets/list")
check("T03 GET /datasets/list → 200", r.status_code == 200, f"got {r.status_code}")
dlist = r.json().get("datasets", [])
check("T03b list is array", isinstance(dlist, list), f"{len(dlist)} items")
ids_in_list = [d.get("dataset_id") for d in dlist]
check("T03c uploaded dataset in list", dataset_id in ids_in_list)

# ── T04: Dataset summary ──────────────────────────────────────
print("\n--- Dataset Summary ---")
r = get(f"/datasets/{dataset_id}/summary")
check("T04 GET /datasets/:id/summary → 200", r.status_code == 200, f"got {r.status_code}")
s = r.json()
check("T04b row_count present", "shape" in s or "row_count" in s, str(s.get("shape", s.get("row_count"))))
cols = s.get("columns", [])
check("T04c 5 columns described", len(cols) == 5, f"{len(cols)} cols")
check("T04d class_distribution present", "class_distribution" in s, str(s.get("class_distribution")))

# ── T05: Dataset introspect ───────────────────────────────────
print("\n--- Dataset Introspect ---")
r = get(f"/datasets/{dataset_id}/introspect")
check("T05 GET /datasets/:id/introspect → 200", r.status_code == 200, f"got {r.status_code}")
intr = r.json()
check("T05b task_type=classification", intr.get("task_type") == "classification", intr.get("task_type"))
check("T05c suggested_target=label", intr.get("suggested_target_column") == "label", intr.get("suggested_target_column"))

# ── T06: Model train configs ──────────────────────────────────
print("\n--- Model Configs ---")
r = get("/models/train/configs")
check("T06 GET /models/train/configs → 200", r.status_code == 200, f"got {r.status_code}")
configs = r.json().get("configs", [])
check("T06b >= 2 configs", len(configs) >= 2, f"{len(configs)} configs")
model_types = [c.get("model_type") for c in configs]
check("T06c random_forest config present", "random_forest" in model_types)
check("T06d xgboost config present", "xgboost" in model_types)

# ── T07: Start training ───────────────────────────────────────
print("\n--- Model Training ---")
r = post("/models/train", json={
    "dataset_id": dataset_id,
    "target_column": "label",
    "model_type": "random_forest",
    "use_optuna": False,
    "hyperparameters": {"n_estimators": 20},
})
check("T07 POST /models/train → 200", r.status_code == 200, f"got {r.status_code}: {r.text[:120]}")
tj = r.json()
task_id = tj.get("task_id", "")
check("T07b task_id returned", bool(task_id), task_id)
check("T07c status in running/queued/pending", tj.get("status") in ("running","queued","pending","started"), tj.get("status"))

# ── T08: Training status ──────────────────────────────────────
print("\n--- Training Status ---")
r = get("/models/train/status")
check("T08 GET /models/train/status → 200", r.status_code == 200, f"got {r.status_code}")
st = r.json()
check("T08b status field present", "status" in st, str(st))
check("T08c progress_pct present", "progress_pct" in st, f"pct={st.get('progress_pct')}")

# Wait for training to complete (up to 45s)
print("  Waiting for training to complete...", end="", flush=True)
model_id = None
for _ in range(30):
    time.sleep(1.5)
    r2 = get("/models/train/status")
    if r2.status_code == 200:
        s2 = r2.json()
        if s2.get("status") in ("completed", "done", "finished", "success"):
            model_id = s2.get("model_id") or s2.get("result", {}).get("model_id")
            print(f" done (model_id={model_id})")
            break
        elif s2.get("status") in ("error", "failed"):
            print(f" FAILED: {s2}")
            break
    print(".", end="", flush=True)
else:
    print(f" timeout — last status: {r2.json()}")

# ── T09: Models list ──────────────────────────────────────────
print("\n--- Models List ---")
r = get("/models/list")
check("T09 GET /models/list → 200", r.status_code == 200, f"got {r.status_code}")
mlist = r.json().get("models", [])
check("T09b >= 1 model in list", len(mlist) >= 1, f"{len(mlist)} models")
if mlist and not model_id:
    model_id = mlist[-1].get("model_id")
    print(f"  (using model_id={model_id} from list)")
check("T09c model_id resolved", bool(model_id), str(model_id))

# ── T10: Model metrics ────────────────────────────────────────
if model_id:
    print("\n--- Model Metrics ---")
    r = get(f"/models/{model_id}/metrics")
    check("T10 GET /models/:id/metrics → 200", r.status_code == 200, f"got {r.status_code}: {r.text[:120]}")
    if r.status_code == 200:
        m = r.json()
        check("T10b accuracy present", "accuracy" in m or "test_accuracy" in m, str(list(m.keys())[:5]))

# ── T11: Load model ───────────────────────────────────────────
if model_id:
    print("\n--- Load Model ---")
    r = post(f"/models/{model_id}/load")
    check("T11 POST /models/:id/load → 200", r.status_code == 200, f"got {r.status_code}: {r.text[:120]}")
    if r.status_code == 200:
        ld = r.json()
        check("T11b model_loaded=true or loaded=true", ld.get("loaded") is True or ld.get("model_loaded") is True, str(ld))

# ── T12: Predict ──────────────────────────────────────────────
if model_id:
    print("\n--- Prediction ---")
    features = {"src_port": 1234, "dst_port": 80, "pkt_size": 500, "duration": 1.2}
    r = post(f"/models/{model_id}/predict", json={"inputs": [features]})
    check("T12 POST /models/:id/predict → 200", r.status_code == 200, f"got {r.status_code}: {r.text[:200]}")
    if r.status_code == 200:
        pred = r.json()
        preds = pred.get("predictions", [])
        check("T12b predictions array present", len(preds) >= 1, f"count={len(preds)}")
        if preds:
            p0 = preds[0]
            check("T12c prediction field present", "prediction" in p0, str(list(p0.keys())))

# ── T13: Explain ──────────────────────────────────────────────
if model_id:
    print("\n--- Explanation ---")
    features = {"src_port": 1234, "dst_port": 80, "pkt_size": 500, "duration": 1.2}
    r = post(f"/models/{model_id}/explain", json={"input_row": features, "method": "shap"})
    check("T13 POST /models/:id/explain → 200", r.status_code == 200, f"got {r.status_code}: {r.text[:200]}")
    if r.status_code == 200:
        exp = r.json()
        check("T13b method_used in response", "method_used" in exp or "method" in exp, str(list(exp.keys())))
        check("T13c shap/lime/explanation present", any(k in exp for k in ("shap","lime","explanation","feature_importance","shap_values")), str(list(exp.keys())))

# ── T14: 404 for unknown model ────────────────────────────────
print("\n--- Error Handling ---")
r = get("/models/nonexistent-abc-123/metrics")
check("T14 GET /models/bad-id/metrics → 404", r.status_code == 404, f"got {r.status_code}")

# ── T15: Delete dataset ───────────────────────────────────────
print("\n--- Cleanup ---")
r = delete(f"/datasets/{dataset_id}")
check("T15 DELETE /datasets/:id → 200 or 204", r.status_code in (200, 204), f"got {r.status_code}")
# Verify it's gone
r2 = delete(f"/datasets/{dataset_id}")
check("T15b second DELETE → 404", r2.status_code == 404, f"got {r2.status_code}")

# ── Summary ───────────────────────────────────────────────────
print("\n" + "=" * 60)
total = PASS + FAIL
print(f"E2E RESULTS: {PASS}/{total} PASS  ({FAIL} FAIL)")
print("=" * 60)

if FAIL > 0:
    sys.exit(1)
