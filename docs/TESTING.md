# Testing Guide

---

## Backend Tests

### Setup

```bash
cd xai-nids/backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Run All Tests

```bash
pytest tests/ -v --tb=short
# Expected: 36 passed
```

### Test Suites

| File                           | Tests | Coverage                                          |
| ------------------------------ | ----- | ------------------------------------------------- |
| `tests/test_datasets.py`       | 11    | Upload, list, summary, introspect, delete, errors |
| `tests/test_explainability.py` | 5     | SHAP/LIME explain with null scaler handling       |
| `tests/test_health.py`         | 3     | Health endpoint, plugin info, uptime              |
| `tests/test_models.py`         | 4     | Model list, metrics, load, delete                 |
| `tests/test_prediction.py`     | 5     | Predict batch, missing features, type coercion    |
| `tests/test_training.py`       | 6     | Start training, status, configs, conflict         |
| `tests/test_websocket.py`      | 2     | WS connect/disconnect, heartbeat                  |

**Total: 36 tests**

---

### Test Configuration (`tests/conftest.py`)

- **Scope:** `function` (fresh TestClient per test)
- **TestClient:** Starlette TestClient with context manager to properly handle lifespan
- **Temp paths:** Uses `tempfile.gettempdir()` (cross-platform Windows/Linux)
- **httpx version:** Pinned to 0.25.2 (0.26+ removed `app=` param support)

---

### Key Design Decisions

#### 1. TestClient Scope

The TestClient scope is `function` (not `session`) to avoid:

- Windows process reuse issues
- State bleed between tests (trained models, uploaded datasets)

#### 2. WebSocket Tests

WebSocket tests do not use `timeout=` parameter (unsupported by starlette 0.27). The training router uses `asyncio.wait_for(ws.receive(), timeout=5.0)` to detect disconnects without blocking.

#### 3. Explainability Tests

The `scaler=None` case is tested — the explainability service must handle missing scalers without crashing.

---

## Frontend Tests

### Setup

```bash
cd xai-nids/frontend
npm install
```

### Run All Tests

```bash
npm run test
# or with coverage:
npx vitest run --coverage
# Expected: 20 passed (5 test files)
```

### Test Suites

| File                                      | Tests | Coverage                                  |
| ----------------------------------------- | ----- | ----------------------------------------- |
| `src/tests/Dashboard.test.tsx`            | 3     | Navigation tabs, panel switching          |
| `src/tests/DatasetUpload.test.tsx`        | 4     | File drop, upload success/fail, drag-over |
| `src/tests/ErrorBoundary.test.tsx`        | 4     | Error catching, fallback UI, recovery     |
| `src/tests/PredictionPlayground.test.tsx` | 4     | Feature sliders, predict button, results  |
| `src/tests/TrainingMonitor.test.tsx`      | 5     | Progress bar, step log, WS messages       |

**Total: 20 tests**

---

### Test Environment

- **Runner:** Vitest 4.0.18
- **Environment:** jsdom (explicitly installed — not bundled with Vitest)
- **Setup file:** `src/tests/setup.ts`

**Mocks in setup.ts:**

```typescript
// WebSocket mock — prevents real connections in tests
// ResizeObserver mock — jsdom doesn't implement this
// HTMLElement.scrollIntoView mock — jsdom doesn't implement this
```

---

### tsconfig Configuration (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "types": ["vitest/globals", "node", "vite/client"]
  }
}
```

Required for:

- `@/` import alias resolution
- `vitest/globals` type recognition (`describe`, `it`, `expect`)
- `vite/client` for `import.meta.env`

---

## E2E Tests

### Setup

The E2E tests require the backend server to be running:

```bash
# Start backend
cd xai-nids/backend
venv/Scripts/activate
uvicorn main:app --host 127.0.0.1 --port 8000

# Run E2E in another terminal
cd ../..
python run_e2e.py
# Expected: 46/46 PASS
```

### E2E Test Coverage

| Group       | Tests        | Checks                                               |
| ----------- | ------------ | ---------------------------------------------------- |
| Health      | T01 (7)      | Status, version, plugin, backend_ready               |
| Dataset     | T02-T05 (10) | Upload, list, summary, introspect                    |
| Models      | T06-T11 (10) | Configs, train, status, poll complete, metrics, load |
| Inference   | T12 (3)      | Batch predict, predictions array, confidence         |
| Explanation | T13 (3)      | SHAP explain, method_used, shap key                  |
| Errors      | T14 (1)      | 404 for unknown model                                |
| Cleanup     | T15 (2)      | Delete dataset, 404 on repeat delete                 |

**Total: 46 assertions**

---

## Known Limitations

1. **Training speed:** E2E tests wait up to 45s for training to complete. With larger datasets or more estimators this may time out.
2. **Concurrent tests:** The training lock prevents parallel training — `test_training.py` tests that start/stop jobs must run serially.
3. **Model persistence:** E2E tests leave trained models in `backend/data/models/`. Clean up periodically.
