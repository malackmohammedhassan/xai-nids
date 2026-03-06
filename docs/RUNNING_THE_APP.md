# XAI-NIDS — How to Run, Verify & Get the Best Results

> **Quick answer:** Two terminals — one runs the backend, one runs the frontend.  
> Backend → `http://127.0.0.1:8765` | Frontend → `http://localhost:5173`

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Start the Backend](#2-start-the-backend)
3. [Start the Frontend](#3-start-the-frontend)
4. [First-Time Checks](#4-first-time-checks)
5. [Green Signs (Everything is OK)](#5-green-signs-everything-is-ok)
6. [Red Signs (Something is Wrong)](#6-red-signs-something-is-wrong)
7. [The 5-Step Workflow](#7-the-5-step-workflow)
8. [Running the Test Suites](#8-running-the-test-suites)
9. [Configuration Knobs](#9-configuration-knobs)
10. [Best Results Checklist](#10-best-results-checklist)
11. [Useful URLs at a Glance](#11-useful-urls-at-a-glance)
12. [Troubleshooting Quick-Reference](#12-troubleshooting-quick-reference)

---

## 1. Prerequisites

| Tool    | Minimum Version | Check Command      |
| ------- | --------------- | ------------------ |
| Python  | 3.10+           | `python --version` |
| Node.js | 18+             | `node --version`   |
| npm     | 9+              | `npm --version`    |

### One-time setup (if not done yet)

**Backend virtual environment**

```powershell
cd xai-nids\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Frontend node modules**

```powershell
cd xai-nids\frontend
npm install
```

---

## 2. Start the Backend

Open **Terminal 1** and run exactly this:

```powershell
cd xai-nids\backend
.\venv\Scripts\Activate.ps1
.\venv\Scripts\uvicorn.exe main:app --host 127.0.0.1 --port 8765 --reload
```

### What you should see in the terminal

```
INFO:     Will watch for changes in these directories: [...]
INFO:     Uvicorn running on http://127.0.0.1:8765 (Press CTRL+C to quit)
INFO:     Started reloader process [XXXXX]
INFO:     Started server process [XXXXX]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

✅ The last line **"Application startup complete."** is the green light.

---

## 3. Start the Frontend

Open **Terminal 2** (leave Terminal 1 running):

```powershell
cd xai-nids\frontend
npm run dev
```

### What you should see

```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

✅ `ready in XXX ms` = frontend is live.

Then open a browser and go to: **http://localhost:5173**

---

## 4. First-Time Checks

Do these immediately after both processes start:

### 4.1 Health Endpoint (30 seconds)

Open a browser tab or PowerShell:

```powershell
Invoke-RestMethod http://127.0.0.1:8765/api/v1/health
```

**Expected response:**

```json
{
  "status": "healthy",
  "version": "2.0.0",
  "backend_ready": true,
  "model_loaded": false,
  "dataset_count": 0,
  "model_count": 0
}
```

- `status: "healthy"` ✅ — backend is up
- `backend_ready: true` ✅ — all dirs and DB are initialised
- `model_loaded: false` — normal on first run (no model trained yet)

### 4.2 Interactive API Docs

Go to **http://127.0.0.1:8765/docs** in your browser.  
You should see the Swagger UI with all 50+ endpoints listed. If this page loads, the API is fully functional.

### 4.3 Dashboard UI

Go to **http://localhost:5173**.  
You should see:

- A hero banner: _"Explainable AI Network Intrusion Detection"_
- A 5-step workflow pipeline (Step 1 glowing cyan = current step)
- System status section showing API status as **Online** (green dot)

---

## 5. Green Signs (Everything is OK)

### Backend (Terminal 1)

| What you see                             | What it means                 |
| ---------------------------------------- | ----------------------------- |
| `Application startup complete.`          | Server is ready               |
| `INFO: POST /api/v1/datasets/upload 200` | Dataset uploaded successfully |
| `INFO: POST /api/v1/models/train 200`    | Training started              |
| `INFO: GET /api/v1/health 200`           | Health check passed           |
| `INFO: WS /api/v1/training/ws connected` | WebSocket live feed working   |
| `Training complete. Accuracy: 0.XX`      | Model trained successfully    |

### Frontend (Browser)

| What you see                                   | What it means                             |
| ---------------------------------------------- | ----------------------------------------- |
| Green dot next to **API Status** in Navbar     | Backend is reachable                      |
| `✓` tick next to Dataset/Training in Sidebar   | That step is complete                     |
| Cyan glowing step number in pipeline           | Current recommended step                  |
| Emerald `AI ★` badge on target column          | AI auto-detected the correct label column |
| Live confusion matrix updating during training | WebSocket stream is healthy               |
| ROC-AUC score > 0.95 on evaluation page        | Excellent model quality                   |

---

## 6. Red Signs (Something is Wrong)

### Backend Errors

| Error message                          | Cause                             | Fix                                                                                 |
| -------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------- |
| `Address already in use`               | Port 8765 is taken                | Kill the other process: `netstat -ano \| findstr 8765` then `taskkill /PID <id> /F` |
| `ModuleNotFoundError`                  | Virtual env not activated         | Run `.\venv\Scripts\Activate.ps1` first                                             |
| `ImportError: No module named 'shap'`  | Requirements not installed        | Run `pip install -r requirements.txt`                                               |
| `FileNotFoundError: uploaded_datasets` | Dirs not created yet              | Run any upload once; dirs are created on first request                              |
| `422 Unprocessable Entity`             | Bad request body                  | Check the request JSON matches the schema at `/docs`                                |
| `500 Internal Server Error`            | Unhandled exception               | Check Terminal 1 for the Python traceback                                           |
| `Training lock is active`              | A training job is already running | Wait for it to finish or restart the backend                                        |

### Frontend Errors

| What you see                                                 | Cause                                 | Fix                                           |
| ------------------------------------------------------------ | ------------------------------------- | --------------------------------------------- |
| Red dot **API Offline** in Navbar                            | Backend not running / wrong port      | Start Terminal 1 and check port 8765          |
| Amber warning banner on Training page                        | No datasets uploaded yet              | Go to Dataset page first                      |
| Amber warning banner on Evaluation/Explainability/Prediction | No trained models yet                 | Complete training first                       |
| Blank white page with error in console                       | TypeScript/build error                | Run `npm run typecheck` to see errors         |
| `Network Error` toast                                        | CORS mismatch or backend down         | Confirm backend is running; check CORS config |
| Charts not rendering                                         | Dataset has NaN / infinite values     | Clean the dataset (see §10)                   |
| WebSocket disconnected icon                                  | Browser tab was backgrounded too long | Refresh the Training page to reconnect        |

---

## 7. The 5-Step Workflow

Follow these steps in order for best results. Each step unlocks the next.

```
[1] Upload Dataset → [2] Train Model → [3] Evaluate → [4] Explain → [5] Predict
```

### Step 1 — Upload Dataset (`/dataset`)

- Click **Upload Dataset**, select a clean CSV file
- Recommended: NSL-KDD or UNSW-NB15 (≤ 200 MB)
- ✅ Green sign: row count appears, dataset card shows column count
- ❌ Red sign: "File too large" error → your CSV exceeds 200 MB limit

**Good dataset format:**

```
src_port,dst_port,pkt_size,duration,...,label
1234,80,512,0.3,...,normal
5678,443,256,1.2,...,attack
```

- Must have a clear label/target column (binary or multiclass)
- No mixed-type columns (all numeric except the label)

### Step 2 — Train Model (`/training`)

1. Select your uploaded dataset from the dropdown
2. The AI will highlight the recommended target column with `AI ★`
3. Choose **Random Forest** (faster) or **XGBoost** (usually higher accuracy)
4. Leave **Optuna ON** for automatic hyperparameter tuning (recommended)
5. Click **Start Training**

- ✅ Green: Live confusion matrix and ROC curve update in real time
- ✅ Green: `Training complete` appears in logs panel
- ❌ Red: Training stuck at 0% for > 5 min → check Terminal 1 for Python error

**Training time estimates:**

| Dataset size  | Optuna ON | Optuna OFF |
| ------------- | --------- | ---------- |
| < 10k rows    | ~1 min    | ~10 sec    |
| 10k–100k rows | ~5 min    | ~30 sec    |
| > 100k rows   | ~15 min   | ~2 min     |

### Step 3 — Evaluate Model (`/evaluation`)

- Select the model you just trained
- Check the **Metrics** tab for Accuracy, F1, ROC-AUC
- Check the **Charts** tab for Confusion Matrix and ROC Curve
- Export results with the **Export** button for your report

**What good metrics look like:**

| Metric   | Acceptable | Good   | Excellent |
| -------- | ---------- | ------ | --------- |
| Accuracy | > 0.85     | > 0.92 | > 0.97    |
| F1-Score | > 0.80     | > 0.90 | > 0.96    |
| ROC-AUC  | > 0.90     | > 0.96 | > 0.99    |

If metrics are poor, go back to Training with SMOTE on and retrain.

### Step 4 — Explain Predictions (`/explainability`)

1. Select the trained model
2. Choose **SHAP** (global, more accurate) or **LIME** (local, faster)
3. Enter feature values — use values from a real row in your CSV
4. Click **Explain**
5. Read the Waterfall chart — red bars push toward Attack, blue bars push toward Normal

- ✅ Green: Waterfall/Force chart renders with labeled bars
- ❌ Red: "SHAP computation timed out" → your model is large; switch to LIME

### Step 5 — Run Predictions (`/prediction`)

1. Select model, enter feature values or click **Random Sample**
2. Click **Run Prediction**
3. See the result: class label + confidence % + probability bars
4. Every prediction is saved to History automatically

---

## 8. Running the Test Suites

### Unit + Integration Tests (73 tests)

```powershell
cd xai-nids\backend
.\venv\Scripts\Activate.ps1
.\venv\Scripts\python.exe -m pytest tests/ -q --tb=short
```

**Expected output:**

```
73 passed, 27 warnings in ~22s
```

- Any `FAILED` line = a real problem. Read the traceback carefully.
- `warnings` are safe to ignore (they are async cleanup notices).

### E2E Live API Tests (12 scenarios)

> Requires both backend AND frontend to be running.

```powershell
cd xai-nids\backend
.\venv\Scripts\python.exe scripts/e2e_tests.py
```

**Expected output:**

```
  [PASS] T01 GET /health → 200
  [PASS] T01b health has required fields
  [PASS] T02 GET /health/plugins → 200
  ...
  [PASS] T12 ...

Results: 24 passed, 0 failed
```

### TypeScript Type Check (Frontend)

```powershell
cd xai-nids\frontend
npx tsc --noEmit
```

**Expected output:** _No output_ = zero errors. Any line printed = a type error to fix.

---

## 9. Configuration Knobs

Edit `xai-nids/backend/.env` (create it if it doesn't exist) to override defaults:

```env
# Dataset storage
DATASET_UPLOAD_DIR=./uploaded_datasets
MAX_DATASET_SIZE_MB=200

# ML tuning
OPTUNA_TRIALS=30          # increase for better hyperparams (slower)
SHAP_MAX_ROWS=5000        # decrease if SHAP is timing out on large datasets
TEST_SIZE=0.2             # fraction of data used for evaluation
RANDOM_STATE=42           # set any integer for reproducibility

# Logging
LOG_LEVEL=INFO            # set DEBUG for verbose output during development
```

Key tradeoffs:

| Setting               | Increase when...                    | Decrease when...               |
| --------------------- | ----------------------------------- | ------------------------------ |
| `OPTUNA_TRIALS`       | You want the best possible accuracy | Training is too slow           |
| `SHAP_MAX_ROWS`       | SHAP charts look oversimplified     | SHAP times out on large models |
| `MAX_DATASET_SIZE_MB` | Uploading large datasets            | Memory is limited              |

---

## 10. Best Results Checklist

Follow this before every demo or submission:

- [ ] **CSV is clean** — no blank rows, no mixed-type columns, no duplicate headers
- [ ] **Label column is binary or low-cardinality** — `0/1`, `normal/attack`, `benign/malicious`
- [ ] **Dataset has > 1000 rows** — smaller datasets produce unreliable metrics
- [ ] **Optuna is ON** during training — always produces better models
- [ ] **SMOTE is ON** if your attack/normal ratio is unbalanced (< 1:5 ratio)
- [ ] **Both backend and frontend are running** before opening the browser
- [ ] **Health endpoint returns `"status": "healthy"`** before starting the workflow
- [ ] **ROC-AUC > 0.95** before moving on to Explainability
- [ ] **Export metrics** from Evaluation page for your report
- [ ] **Export explanation JSON** from Explainability page for your report

---

## 11. Useful URLs at a Glance

| URL                                           | What it is                            |
| --------------------------------------------- | ------------------------------------- |
| `http://localhost:5173`                       | Main application (Dashboard)          |
| `http://localhost:5173/dataset`               | Upload and explore datasets           |
| `http://localhost:5173/training`              | Train a model                         |
| `http://localhost:5173/evaluation`            | View model metrics and charts         |
| `http://localhost:5173/explainability`        | SHAP / LIME explanations              |
| `http://localhost:5173/prediction`            | Live inference playground             |
| `http://127.0.0.1:8765/docs`                  | Swagger UI — interactive API explorer |
| `http://127.0.0.1:8765/redoc`                 | ReDoc — clean API reference           |
| `http://127.0.0.1:8765/api/v1/health`         | Plain-text health check               |
| `http://127.0.0.1:8765/api/v1/health/plugins` | Loaded plugin list                    |

---

## 12. Troubleshooting Quick-Reference

### "Frontend shows API Offline"

1. Check Terminal 1 is still running — it may have crashed
2. Confirm port: `netstat -ano | findstr 8765`
3. Restart backend if needed

### "Training never finishes"

1. Check Terminal 1 for a Python traceback
2. The dataset may have non-numeric columns — use the Dataset page to inspect column types
3. Restart the backend to clear the training lock: `Ctrl+C` then rerun the uvicorn command

### "SHAP takes too long / times out"

1. Set `SHAP_MAX_ROWS=500` in `.env` and restart backend
2. Or switch the method to **LIME** on the Explainability page

### "Upload fails with 413 / file too large"

1. Set `MAX_DATASET_SIZE_MB=500` in `.env` and restart backend
2. Or subsample your CSV to under 200 MB

### "pip install fails"

```powershell
pip install --upgrade pip
pip install -r requirements.txt
```

### "npm install fails"

```powershell
npm cache clean --force
npm install
```

### "Port 8765 already in use"

```powershell
# Find the process
netstat -ano | findstr :8765
# Kill it (replace XXXX with the PID)
taskkill /PID XXXX /F
```

---

_Last updated: 2 March 2026 — XAI-NIDS v2.0.0_
