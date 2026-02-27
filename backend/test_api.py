import requests
import json
import time

print("=== XAI-NIDS Full API Test Suite ===\n")

BASE = "http://localhost:8001"

# ─── Test 1: Health ─────────────────────────────────────────────────────────
r = requests.get(f"{BASE}/health", timeout=10)
assert r.status_code == 200, f"Health check failed: {r.text}"
assert r.json()["service"] == "xai-nids-backend"
print(f"[PASS] Health check: {r.json()}")

# ─── Test 2: List Models (empty) ────────────────────────────────────────────
r = requests.get(f"{BASE}/models", timeout=10)
assert r.status_code == 200
print(f"[PASS] List models (empty): {r.json()}")

# ─── Test 3: Training – Random Forest Binary ────────────────────────────────
print("\n[RUN ] Training RandomForest (binary)... (this takes ~1-2 min)")
start = time.time()
with open("datasets/test_binary.csv", "rb") as f:
    resp = requests.post(
        f"{BASE}/train",
        files={"file": ("test_binary.csv", f, "text/csv")},
        data={"model_type": "random_forest", "mode": "binary", "model_name": "test_rf_binary"},
        timeout=600,
    )
elapsed = round(time.time() - start, 1)
assert resp.status_code == 200, f"Training failed: {resp.text[:500]}"
tj = resp.json()
m = tj["metrics"]
print(f"[PASS] Training complete in {elapsed}s (API duration: {tj['training_duration']}s)")
print(f"       Model ID  : {tj['model_id']}")
print(f"       Accuracy  : {m['accuracy']}")
print(f"       Precision : {m['precision']}")
print(f"       Recall    : {m['recall']}")
print(f"       F1-Score  : {m['f1_score']}")
print(f"       ROC-AUC   : {m['roc_auc']}")
print(f"       CM Plot   : {'YES' if tj['confusion_matrix_plot'] else 'NO'}")
print(f"       ROC Plot  : {'YES' if tj['roc_curve_plot'] else 'NO'}")
print(f"       PR Plot   : {'YES' if tj['pr_curve_plot'] else 'NO'}")

# ─── Test 4: List Models (should have 1 now) ────────────────────────────────
r = requests.get(f"{BASE}/models", timeout=10)
assert r.status_code == 200
models = r.json()["models"]
assert len(models) >= 1, "Expected at least 1 saved model"
print(f"\n[PASS] List models after training: {[x['id'] for x in models]}")

# ─── Test 5: Get Metrics ─────────────────────────────────────────────────────
r = requests.get(f"{BASE}/metrics", params={"model_id": "test_rf_binary"}, timeout=10)
assert r.status_code == 200
mj = r.json()
print(f"[PASS] Get metrics: accuracy={mj['metrics']['accuracy']}, mode={mj['mode']}")

# ─── Test 6: Prediction ──────────────────────────────────────────────────────
print("\n[RUN ] Prediction test...")
with open("datasets/test_binary.csv", "rb") as f:
    resp = requests.post(
        f"{BASE}/predict",
        files={"file": ("test_binary.csv", f, "text/csv")},
        data={"model_id": "test_rf_binary"},
        timeout=120,
    )
assert resp.status_code == 200, f"Prediction failed: {resp.text[:500]}"
pj = resp.json()
print(f"[PASS] Prediction: {pj['total_samples']} samples, first: {pj['predictions'][0]}")

# ─── Test 7: SHAP Explanation ────────────────────────────────────────────────
print("\n[RUN ] SHAP explanation test...")
with open("datasets/test_binary.csv", "rb") as f:
    resp = requests.post(
        f"{BASE}/explain/shap",
        files={"file": ("test_binary.csv", f, "text/csv")},
        data={"model_id": "test_rf_binary", "instance_idx": 0},
        timeout=300,
    )
assert resp.status_code == 200, f"SHAP failed: {resp.text[:500]}"
sj = resp.json()
top_features = sj["global"]["feature_importance"][:3]
print(f"[PASS] SHAP: {len(sj['global']['feature_importance'])} features")
print(f"       Top-3 features: {[f['feature'] for f in top_features]}")
print(f"       Local contributions: {len(sj['local']['contributions'])}")
print(f"       Summary plot: {'YES' if sj['global']['summary_plot'] else 'NO'}")
print(f"       Waterfall plot: {'YES' if sj['local']['waterfall_plot'] else 'NO'}")

# ─── Test 8: LIME Explanation ────────────────────────────────────────────────
print("\n[RUN ] LIME explanation test...")
with open("datasets/test_binary.csv", "rb") as f:
    resp = requests.post(
        f"{BASE}/explain/lime",
        files={"file": ("test_binary.csv", f, "text/csv")},
        data={"model_id": "test_rf_binary", "instance_idx": 0},
        timeout=300,
    )
assert resp.status_code == 200, f"LIME failed: {resp.text[:500]}"
lj = resp.json()
print(f"[PASS] LIME: stability={lj['stability_score']}")
print(f"       Feature weights: {len(lj['feature_weights'])}")
print(f"       Probabilities: {lj['prediction_probabilities']}")

# ─── Test 9: Model Metadata ──────────────────────────────────────────────────
r = requests.get(f"{BASE}/models/test_rf_binary/meta", timeout=10)
assert r.status_code == 200
print(f"\n[PASS] Model meta: mode={r.json()['meta']['mode']}, type={r.json()['meta']['model_type']}")

# ─── Test 10: Delete Model ───────────────────────────────────────────────────
r = requests.delete(f"{BASE}/models/test_rf_binary", timeout=10)
assert r.status_code == 200
r2 = requests.get(f"{BASE}/models", timeout=10)
remaining = r2.json()["models"]
assert all(m["id"] != "test_rf_binary" for m in remaining)
print(f"[PASS] Delete model: removed successfully")

print("\n" + "="*50)
print("ALL 10 TESTS PASSED ✓")
print("="*50)
