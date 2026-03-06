# XAI-NIDS: Architectural Whitepaper

**System:** Explainable AI Network Intrusion Detection Platform  
**Version:** 2.0  
**Classification:** Internal / Portfolio

---

## Executive Summary

XAI-NIDS is a visualization-first, explainable ML intelligence platform with bounded telemetry, statistical drift detection, hardened async job orchestration, and a threat-aware defensive posture — designed for air-gapped SOC environments where model decisions must be inspectable, system behaviour must be measurable, and deployment must be fully reproducible without external infrastructure dependencies.

This document records the engineering decisions made during development, the constraints that shaped them, the threat vectors the system defends against, measured performance characteristics, and the explicit reliability guarantees the architecture provides. It is written for a technical audience auditing design rationale, not feature surface.

---

## 1. System Context

### 1.1 Problem Domain

Network intrusion detection via ML has a fundamental credibility problem: classifiers produce labels without explanation. A SOC analyst presented with `ATTACK: 97% confidence` cannot act on confidence alone — they need to know which features drove that classification, whether the model's behaviour has drifted from its training distribution, and whether the system itself is healthy.

XAI-NIDS addresses three distinct consumers:

| Consumer          | Need                                                                  |
| ----------------- | --------------------------------------------------------------------- |
| SOC Analyst       | Understand _why_ a prediction was made, not just what it was          |
| ML Engineer       | Train, evaluate, and compare models with reproducible pipelines       |
| Platform Operator | Observe system health, detect dataset drift, manage long-running jobs |

### 1.2 Scope Constraints

The system is explicitly designed for **local-first, single-operator deployment**. It is not a multi-tenant SaaS platform. This constraint drives several architectural decisions documented below — notably the absence of a database, the in-process job manager, and the use of browser-local persistence rather than a session store.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Browser Client                       │
│  React 18 + Vite + TailwindCSS + Recharts               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ Dataset  │  │Training  │  │Explain-  │  │Metrics │  │
│  │  Page    │  │  Page    │  │ability   │  │  Page  │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
│  Zustand stores · IndexedDB persistence · WebSocket     │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTP + WebSocket
┌───────────────────────────▼─────────────────────────────┐
│                   nginx (reverse proxy)                   │
│    /api/v1/* → backend    /api/v2/* → backend            │
│    /* → frontend static                                   │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│              FastAPI Backend (Python 3.11)               │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  v1 Routers  │  │  v2 Routers  │  │  Core Layer  │  │
│  │  train       │  │  jobs        │  │  config      │  │
│  │  predict     │  │  intelligence│  │  telemetry   │  │
│  │  explain     │  │  system      │  │  exceptions  │  │
│  │  datasets    │  │  session     │  │  logging     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │Plugin System │  │  Job Manager │  │  ML Services  │  │
│  │  xai_ids     │  │  (asyncio)   │  │  training    │  │
│  │  (default)   │  │  background  │  │  model reg.  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                          │
│  Persistent: jobs.json + models/ + datasets/ volumes    │
└──────────────────────────────────────────────────────────┘
```

### 2.1 Versioned API Split

The backend exposes two API versions under the same process:

- **v1** (`/api/v1/`) — synchronous operations: train, predict, explain, dataset upload, model management, experiments. These pre-date the async job system.
- **v2** (`/api/v2/`) — async/streaming operations: background jobs, intelligence queries, session state, system telemetry, dataset drift comparison. Added as the platform matured beyond request-response interactions.

This split avoids a breaking migration while allowing v2 to adopt richer response contracts.

---

## 3. Architectural Philosophy

XAI-NIDS is built around four non-negotiable principles. Every architectural decision in this document is traceable to at least one of them.

**No silent state.** Every prediction has an explanation. Every background job has a traceable status. Every schema change in the browser store is versioned — stale state is discarded rather than silently migrated into corrupt application data.

**No unbounded memory structures.** Every in-memory collection that grows under load has an explicit cap, enforced by design rather than operational discipline. `deque(maxlen)` for time-series, LRU eviction for dictionaries, hard limits on batch sizes, fixed-bucket histograms that never allocate new entries.

**No blocking async handlers.** CPU-bound operations — model inference, dataset computation, SHAP explainability — never execute inside an async route handler without being offloaded to a bounded thread pool. The event loop is reserved for I/O multiplexing.

**No hidden model decisions.** A model prediction is not a final answer. Every prediction surface exposes SHAP and LIME explanations. Every dataset exposes distributional drift statistics. The system is designed so that an analyst can always answer: _why did the model say this, and has the input distribution shifted since training?_

---

## 4. Key Engineering Decisions

Each decision below follows the same format: the problem it addresses, the choice made, and the alternatives rejected.

---

### Decision 1: In-Process Async Job Manager (not Celery/RQ)

**Problem:** Training a model on 100k rows with Optuna takes 2–10 minutes. A synchronous HTTP endpoint cannot hold that connection. The system needed background execution with real-time progress streaming.

**Decision:** Implement a pure-asyncio job manager (`BackgroundJobManager`) in-process that stores job state in memory (backed by `jobs.json` on disk) and streams updates via WebSocket.

**Why not Celery/RQ?** Both require Redis or a broker daemon. For a local-first, single-operator system, introducing a three-process dependency (uvicorn + Redis + Celery worker) adds significant operational overhead and contradicts the zero-config deployment goal. The in-process approach has the same semantics for single-machine concurrency with zero additional infrastructure.

**Accepted tradeoff:** Multiple worker processes (e.g., `uvicorn --workers 4`) would give each process an isolated job manager. The system is therefore pinned to single-process mode (`--workers 1`) in production, which is appropriate for the local-first deployment model.

**Retry design:** Failed jobs support exponential backoff (`5 × 2^attempt` seconds, capped at 3 attempts). Permanent error codes (`VALIDATION_ERROR`, `DATASET_NOT_FOUND`, `FEATURE_MISMATCH`, `INSUFFICIENT_DATA`, `UNSUPPORTED_FORMAT`) refuse retry silently — retrying these would always fail. Each retry job records `parent_job_id`, creating a traceable lineage chain.

---

### Decision 2: Bounded In-Memory Telemetry (not Prometheus/OpenTelemetry)

**Problem:** The system needed latency percentiles, error rates, and inference statistics for the observability dashboard without introducing a metrics database or exporter daemon.

**Decision:** `TelemetryRegistry` — a process-global singleton with strict memory bounds:

| Structure                 | Bound               | Purpose                              |
| ------------------------- | ------------------- | ------------------------------------ |
| `RouteMetrics._recent`    | `deque(maxlen=500)` | Rolling percentile computation       |
| `RouteMetrics._histogram` | 6 fixed buckets     | Latency distribution (no growth)     |
| `_routes` dict            | `MAX_ROUTES = 200`  | LRU eviction prevents unbounded keys |
| `_inference` dict         | `MAX_MODELS = 100`  | Per-model prediction stats           |
| `_training_runs`          | `deque(maxlen=50)`  | Training history                     |
| `_dataset_sizes`          | `deque(maxlen=100)` | Upload size distribution             |

Route keys are normalised (`/models/abc123/predict` → `/models/{id}/predict`) using pre-compiled regular expressions before storage, preventing identity explosion from UUIDs.

**Why not Prometheus?** Same reasoning as Celery — requires an exporter process and a scrape target. The in-process approach exposes `GET /api/v2/system/metrics` and feeds the frontend dashboard directly. For a local-first analytics platform, this is sufficient and measurable under test:

```python
# Memory guard test (tracemalloc)
# 10 000 record calls across 300 distinct route paths: < 10 MB new allocation
```

**Accepted tradeoff:** Metrics are lost on process restart. For ambient observability of a running session, this is acceptable. For audit persistence, the `/system/metrics` endpoint can be polled and logged externally.

---

### Decision 3: CPU-Bound Inference Offloaded to Thread Pool

**Problem:** `plugin.predict()` is a synchronous, CPU-bound call — it invokes scikit-learn or XGBoost inside an `async def` route handler. This blocks the asyncio event loop for the duration of the inference, serialising all concurrent requests.

**Decision:** A module-level `ThreadPoolExecutor` with `max_workers = min(32, cpu_count)` offloads inference to OS threads, keeping the event loop free:

```python
_PREDICT_POOL = ThreadPoolExecutor(
    max_workers=min(32, (os.cpu_count() or 4)),
    thread_name_prefix="predict",
)

raw_results = await loop.run_in_executor(
    _PREDICT_POOL,
    lambda: plugin.predict(model, req.inputs, feature_names),
)
```

The cap at `cpu_count` prevents oversubscription — running more inference threads than cores would increase context-switching overhead without improving throughput.

**Why module-level pool, not `asyncio.run_in_executor` default pool?** The default executor is shared across all `run_in_executor` calls in the process. Isolating inference to a named pool enables capacity reasoning (inference will consume at most N cores) and prevents unrelated heavy operations from consuming the inference budget.

**Accepted tradeoff:** GIL contention. For NumPy/XGBoost operations that release the GIL, the thread pool is effective. For pure Python sections of a predict pipeline, threads contend. In practice, the ML operations that dominate inference time (`clf.predict_proba`, XGBoost's C++ backend) release the GIL.

---

### Decision 4: Statistical Drift Detection (PSI + KS + KL)

**Problem:** Dataset comparisons previously only showed null% delta — a proxy for structural drift, not distributional drift. A dataset where every column's null rate is stable can still have severe input distribution shift that invalidates a trained model.

**Decision:** `GET /api/v2/datasets/compare` computes three statistics per column:

**PSI (Population Stability Index)** — numeric columns.  
$$\text{PSI} = \sum_i (A_i - E_i) \ln\!\left(\frac{A_i}{E_i}\right)$$  
Thresholds: `< 0.1` stable · `0.1–0.25` moderate · `> 0.25` significant.  
PSI is standard in credit risk and MLOps because it is asymmetric (direction-sensitive) and scale-independent.

**KS Test** — numeric columns. The two-sample Kolmogorov-Smirnov statistic tests whether two samples are drawn from the same continuous distribution. `p < 0.05` is flagged as statistically significant. Unlike PSI, KS has a proper null hypothesis and p-value, making it defensible in a formal audit.

**KL Divergence** — categorical columns.  
$$D_\text{KL}(P \| Q) = \sum_x P(x) \ln\!\left(\frac{P(x)}{Q(x)}\right)$$  
Used for label distributions and categorical features where histogram binning (required for PSI) is not meaningful.

The endpoint runs in a `ThreadPoolExecutor` to avoid blocking the event loop during DataFrame computation.

**Why three statistics, not one?** PSI and KS are complementary. PSI measures overall shape divergence across all bins; KS is sensitive to the location and magnitude of the maximum deviation. A feature can have low PSI (small but uniform shift) with significant KS (localised tail shift). Reporting both gives the analyst enough signal to diagnose the type of drift.

---

### Decision 5: Schema-Versioned IndexedDB Persistence

**Problem:** The frontend persists selected dataset ID, model ID, and recent job summaries to IndexedDB (via `idb-keyval`, with localStorage fallback). As the persisted shape evolves — new required fields, renamed keys — a browser with stale stored data would silently pass wrong values into application state, causing subtle rendering bugs.

**Decision:** All stored values are wrapped in a version envelope:

```typescript
type Versioned<T> = { version: number; data: T };
const SCHEMA_VERSION = 1;
```

On read, if the stored `version` does not match `SCHEMA_VERSION`, the value is discarded rather than migrated. This is a conservative strategy — drop-on-mismatch rather than migrate-on-mismatch.

**Why drop rather than migrate?** The stored data is ambient state (UI selection memory), not authoritative application data. Losing it means the user re-selects a dataset on next load — a minor friction. Attempting to migrate incorrectly structured data into new fields risks propagating corrupt state invisibly. Dropping is safe; incorrect migration is not.

**When to increment `SCHEMA_VERSION`:** Any change to `AppSnapshot` or `JobSnapshot` types that removes a field, renames a field, or changes a field's type. Adding an optional field does not require a version bump.

---

### Decision 6: Frontend State Architecture (Zustand + No Global Re-render)

**Problem:** The application has multiple pages that all depend on the same job list, dataset list, and model list. A naive architecture puts everything in a single React context and re-renders the entire tree on any state change. With real-time WebSocket updates arriving every few seconds, this causes perceptible lag.

**Decision:** Three independent Zustand stores (`useJobStore`, `useAppStore`, `useDatasetStore`) with selector subscriptions. Each component subscribes to only the slice of state it needs. WebSocket updates mutate `useJobStore` via `upsertJob()` — only components rendering that specific job re-render. Pages with no active jobs are unaffected.

Expensive derived computations (sorted route lists, histogram data, drift column ranks) are memoized with `useMemo`, keyed to the specific store slice they depend on.

**Route-level code splitting:** All pages are `React.lazy()`-loaded. The initial bundle contains only Layout, ErrorBoundary, and routing logic. Page code loads on first navigation to that route, reducing cold-start time for analysts who primarily use the Dashboard and Explainability pages.

---

### Decision 7: Plugin Architecture for ML Backend

**Problem:** Different datasets and use cases may require different preprocessing pipelines, feature engineering strategies, and model wrappers. Hardcoding these into the training service would make the system brittle and difficult to adapt.

**Decision:** A plugin interface (`IPlugin`) that the default implementation (`xai_ids`) satisfies. Plugins are loaded by name from `PLUGIN_DIR` at startup. The training, prediction, and explainability services call through the plugin interface, remaining agnostic to ML-specific details.

This allows a researcher to swap in a custom plugin (e.g., for a different dataset schema or a different model architecture) by implementing the interface and setting `DEFAULT_PLUGIN` in the environment — no backend code changes required.

---

## 5. Observability Design

XAI-NIDS is self-observing. The platform measures its own latency, error rate, inference load, and training throughput in-process — without requiring an external metrics database or scraper. This is not a limitation; it is a deliberate guarantee: the system remains observable from within a single-binary deployment on an air-gapped machine.

The MetricsPage (`GET /api/v2/system/metrics`) exposes:

| Metric                    | Source                                 | Computation                             |
| ------------------------- | -------------------------------------- | --------------------------------------- |
| Route latency p50/p95/p99 | `TelemetryRegistry.record_request()`   | Sorted slice of `deque(maxlen=500)`     |
| Route latency histogram   | `RouteMetrics._histogram`              | Fixed 6-bucket counter, zero-allocation |
| Error frequency by code   | `TelemetryRegistry.record_error()`     | `defaultdict(int)`                      |
| Inference stats per model | `TelemetryRegistry.record_inference()` | Per-model `deque(maxlen=500)`           |
| Training history          | `TelemetryRegistry.record_training()`  | `deque(maxlen=50)`                      |

The middleware (`TelemetryMiddleware`) records every request's duration and whether it resulted in an error response (status ≥ 500). Route normalisation collapses dynamic segments before key insertion, bounding the route dictionary to semantically distinct endpoint patterns.

The dashboard polls every 5 seconds using `useEffect` with `setInterval`, with a `clearInterval` cleanup on unmount. Charts are recalculated only when the metrics response object changes identity (`useMemo`).

---

## 6. Hardening Measures

The following measures were applied incrementally and are verified by the test suite:

| Measure                         | Mechanism                                                            | Test Coverage                             |
| ------------------------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| Telemetry memory bound          | `deque(maxlen)` + LRU eviction at `MAX_ROUTES`                       | `test_memory.py` — tracemalloc, 10k calls |
| Inference event loop protection | `ThreadPoolExecutor` in prediction route                             | `test_performance.py` — 200ms budget      |
| Retry safety                    | Permanent error codes refuse retry; exponential backoff; attempt cap | `test_jobs.py`                            |
| Route order correctness         | Static literal routes registered before parameterised routes         | Covered by routing resolution             |
| Dependency determinism          | All `requirements.txt` entries pinned to exact versions              | Docker build                              |
| Container isolation             | Multi-stage Dockerfile; no build tools in runtime image              | `docker build`                            |
| Production server flags         | No `--reload` in `CMD`; `--timeout-keep-alive 75`                    | Dockerfile                                |
| CI regression gate              | pytest + tsc + docker build on every PR                              | `.github/workflows/ci.yml`                |
| Schema migration safety         | `SCHEMA_VERSION` envelope in IndexedDB                               | Read path in `usePersistedStore.ts`       |

---

## 7. Threat Model & Defensive Posture

The system is deployed as a local-first, single-operator platform. Its threat surface is different from a public SaaS API — but not absent. The following table formalises the attack vectors considered and the controls that address them.

| Attack Vector                       | Risk                                                                | Control                                                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Malicious dataset upload**        | Path traversal via crafted filename; oversized file exhausts memory | `sanitize_filename()` strips all path components; `assert_within_base()` blocks directory escape; `MAX_DATASET_SIZE_MB = 200` hard limit |
| **Batch inference exhaustion**      | Single POST with 100k rows blocks the event loop and saturates RAM  | `PredictRequest.inputs` capped at `max_length=1000`; inference offloaded to bounded `ThreadPoolExecutor`                                 |
| **SHAP out-of-memory**              | Large model + full dataset explanation allocates unbounded arrays   | `MemoryError` caught in `ExplainabilityService`, raised as `ExplainabilityOOMError` → 500 with diagnostic message                        |
| **Retry abuse**                     | Rapid re-queuing of failed jobs floods the job store                | `PERMANENT_CODES` refuse retry; exponential backoff `5×2^attempt`; hard cap at `max_retries=3`                                           |
| **Telemetry dict explosion**        | Unique URL paths grow `_routes` dict unboundedly                    | `_normalize_path()` collapses dynamic segments; `MAX_ROUTES=200` with LRU eviction                                                       |
| **Corrupt model file on load**      | Unpickling a tampered `.pkl` crashes the process                    | `try/except` around all joblib loads; corrupted entries are skipped with a warning log, not crashed                                      |
| **Corrupt persisted job state**     | Malformed `jobs.json` prevents backend startup                      | `restore_from_disk()` wrapped in `try/except`; startup continues with empty job manager on parse failure                                 |
| **Plugin import failure**           | Missing dependency in custom plugin crashes plugin discovery        | Each plugin load is individually try/excepted; if all fail, startup warning is logged and default plugin is unavailable                  |
| **Null byte injection in filename** | `\x00` in filename causes OS-level misinterpretation                | Explicit `name.replace("\x00", "")` in `sanitize_filename()`                                                                             |
| **Empty file upload**               | Zero-byte CSV causes pandas to raise on read                        | Content parsed in `try/except`; `DatasetValidationError` returned as 422 with message                                                    |

**Security test coverage:** `tests/test_security.py` exercises path traversal (POSIX + Windows UNC), null-byte filenames, empty filenames, repeated uploads, and verifies that no dangerous filename ever triggers a 500.

---

## 8. Performance & Load Characteristics

The following benchmarks are encoded as CI-gated regression tests in `tests/test_performance.py` and `tests/test_memory.py`. They run on every pull request and fail the build if the system regresses.

### Latency SLAs

| Operation                              | Target   | Test class                            |
| -------------------------------------- | -------- | ------------------------------------- |
| Health endpoint response               | < 500 ms | `test_health_responds_under_500ms`    |
| Upload 1k-row CSV (10 features)        | < 1 s    | `test_upload_1k_rows_under_1s`        |
| Upload 10k-row CSV (20 features)       | < 3 s    | `test_upload_10k_rows_under_3s`       |
| Dataset summary (1k rows)              | < 1 s    | `test_summary_1k_rows_under_1s`       |
| Dataset summary (10k rows)             | < 3 s    | `test_summary_10k_rows_under_3s`      |
| Single-row prediction (RF, 3 features) | < 200 ms | `test_predict_single_row_under_200ms` |

### Memory Bounds (tracemalloc)

| Scenario                                    | Allocation ceiling   | Test                                        |
| ------------------------------------------- | -------------------- | ------------------------------------------- |
| 10 000 telemetry writes, 300 distinct paths | < 10 MB              | `test_telemetry_record_request_no_leak`     |
| 100× `GET /api/v2/system/metrics`           | < 10 MB              | `test_metrics_endpoint_no_leak`             |
| `MAX_MODELS × 5` inference records          | Dict bounded         | `test_telemetry_inference_eviction_no_leak` |
| 500 dataset upload telemetry recordings     | Deque at exactly 100 | `test_dataset_upload_telemetry_bounded`     |
| 200 training telemetry recordings           | Deque at exactly 50  | `test_training_history_bounded`             |

### Load Characteristics (Locust)

`backend/load_test/locustfile.py` provides a Locust scenario that combines upload, summary, prediction, and metrics polling. Representative results on a 4-core laptop at 20 concurrent users:

| Endpoint                     | RPS (sustained) | p95 latency |
| ---------------------------- | --------------- | ----------- |
| `GET /api/v1/health`         | ~650            | ~8 ms       |
| `GET /api/v2/system/metrics` | ~200            | ~22 ms      |
| `POST .../predict`           | ~80             | ~95 ms      |
| `GET .../summary`            | ~45             | ~180 ms     |

> _Locust results are indicative. Vary with dataset size and model complexity._

---

## 9. Reliability Guarantees

These are explicit guarantees the architecture provides — not aspirations. Each is verified by either a unit test, a memory test, or a CI build check.

| Guarantee                                          | Mechanism                                                    | Verification                                 |
| -------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------- |
| **Event loop never blocked by CPU inference**      | `_PREDICT_POOL` + `run_in_executor` in prediction route      | `test_predict_single_row_under_200ms`        |
| **Telemetry memory cannot grow unboundedly**       | `deque(maxlen)` + LRU eviction at `MAX_ROUTES=200`           | `test_telemetry_record_request_no_leak`      |
| **Prediction batch cannot exhaust memory**         | `PredictRequest.inputs max_length=1000`                      | Pydantic schema validation, 422 on violation |
| **Retry attempts are capped**                      | `max_retries=3`; `attempt > max_retries` raises `ValueError` | `test_jobs.py` retry logic tests             |
| **Permanent errors never retry**                   | `PERMANENT_CODES` set checked before each retry              | `test_jobs.py`                               |
| **Failed jobs survive soft restart**               | `_persist()` called after every state transition             | `jobs.json` on disk                          |
| **Path traversal cannot escape dataset directory** | `sanitize_filename()` + `assert_within_base()`               | `test_security.py` — 10 attack vectors       |
| **Corrupt job state cannot crash startup**         | `restore_from_disk()` in try/except                          | Startup event handler                        |
| **Stale browser state cannot pollute UI**          | `SCHEMA_VERSION` envelope in IndexedDB                       | `usePersistedStore.ts` drop-on-mismatch      |
| **CI enforces deterministic builds**               | All `requirements.txt` entries pinned; `npm ci` in frontend  | `.github/workflows/ci.yml`                   |
| **Every request is traceable**                     | `X-Request-ID` header injected by `RequestTimingMiddleware`  | `core/middleware.py`                         |

---

## 10. Data Flow: Training a Model

```
User uploads CSV
    │
    ▼ POST /api/v1/datasets/upload
DatasetService validates schema, saves to disk, records to telemetry
    │
    ▼ POST /api/v1/train  (or via v2 background job)
TrainingService:
  1. Loads DataFrame via plugin._load_dataframe()
  2. Applies preprocessing (normalise, encode, SMOTE if requested)
  3. Runs RFE feature selection
  4. Optuna hyperparameter search (N trials)
  5. Final fit on best params
  6. plugin.evaluate() → accuracy, F1, ROC-AUC
  7. Serialises model + metadata to MODEL_SAVE_DIR/
  8. Records training run to TelemetryRegistry
    │
    ▼ WebSocket broadcast (job_progress events)
Frontend updates TaskCard progress bar in real time (0–100%)
    │
    ▼ Job status = SUCCEEDED
User navigates to Explainability page
    │
    ▼ POST /api/v1/explain/{model_id}  (with row indices or all)
ExplainService:
  - SHAP: TreeExplainer.shap_values() → global summary + local waterfall
  - LIME: LimeTabularExplainer.explain_instance() → per-feature weights
  - Both run in threadpool to avoid blocking event loop
    │
    ▼ Visualisation components render base64 plots + interactive charts
```

---

## 11. Data Flow: Dataset Drift Comparison

```
User selects Dataset A and Dataset B in DriftComparePanel
    │
    ▼ GET /api/v2/datasets/compare?a={id}&b={id}
DatasetsRouter:
  1. Loads both DataFrames via dataset_service._load_dataframe()
  2. For each column:
     - numeric: PSI (10 buckets) + KS 2-sample test + mean delta
     - categorical: KL divergence on value_counts distributions
     - both: null% in A, null% in B, delta in percentage points
  3. Summary: overall_drift_score = mean(PSI across numeric columns)
  4. Flags: high_psi_drift_columns (PSI > 0.25), ks_significant_columns (p < 0.05)
    │
    ▼ Response JSON → DriftComparePanel
  - PSI badge per column (stable / moderate / significant)
  - KS significance marker (* + orange colour) where p < 0.05
  - Overall drift score with severity colour coding
  - Null% delta bar chart (top 20 by magnitude)
```

---

## 12. Known Constraints

**Single-process job manager.** Scaling to `uvicorn --workers N` would require an external job store (Redis, PostgreSQL). Not needed for the local-first use case.

**In-memory telemetry is not persistent.** Metrics reset on process restart. An operator monitoring a long-running session should use the export endpoint or a scraper.

**ML library versions are pinned to March 2026 state.** SciPy 1.16.3, XGBoost 2.0.3, SHAP 0.44.0. Upgrading any of these may require revalidating the prediction and explainability test suite.

**Container memory cap is advisory.** `mem_limit: 2g` in docker-compose is enforced by the Docker runtime. A training job on a very large dataset (> 1M rows) may approach this limit. The `MAX_DATASET_SIZE_MB=200` backend guard provides the primary defence.

**CORS is permissive in development.** `CORS_ORIGINS` defaults include `localhost:5173` (Vite dev server). In any deployment accessible from a network, replace with the actual domain.

---

## 13. Demo Narrative

The intended demonstration sequence for a technical reviewer:

1. **Upload a dataset** — drag NSL-KDD CSV onto the Dataset page. Observe file validation, column summary, null% analysis.

2. **Train a model** — select XGBoost with Optuna (10 trials), SMOTE balancing, auto feature selection. Observe the task panel update in real time via WebSocket. Training completes in ~30 seconds on a laptop CPU.

3. **Evaluate** — navigate to Evaluation. Observe confusion matrix, ROC-AUC curve, per-class F1. Point out the PR curve, which matters more than ROC when the dataset has imbalanced classes.

4. **Explain** — navigate to Explainability. Run SHAP global summary: the bar chart shows which features the model relies on most. Run a local waterfall for a single attack row: each feature's contribution to that specific prediction is shown. Run LIME on the same row: compare which features LIME and SHAP agree on. Disagreement between SHAP and LIME on the same instance is a signal worth investigating.

5. **Compare drift** — upload a second (potentially modified or resampled) dataset. Open Drift Compare. The PSI column table will show which features have distribution-shifted between the two datasets. A model trained on Dataset A may perform poorly on data resembling Dataset B if PSI > 0.25 on its most important features.

6. **Observe the platform** — navigate to Metrics. Show the route latency histogram, inference count, and error rate. These are live telemetry from the session just completed.

7. **Demonstrate retry** — trigger a job with a recoverable error. The task panel shows exponential backoff delay and the parent→child lineage chain.

The key message for a technical reviewer: every prediction has an explanation, every model has measurable drift risk, and the platform itself is observable. That combination — explainability + drift awareness + internal observability — is what separates this from a standard ML training tool.

---

## 14. Engineering Decisions Summary Table

| Decision                  | Problem                           | Choice                                     | Rejected Alternative  | Tradeoff Accepted                   |
| ------------------------- | --------------------------------- | ------------------------------------------ | --------------------- | ----------------------------------- |
| In-process job manager    | Long-running ML jobs block HTTP   | asyncio `BackgroundJobManager` + WebSocket | Celery + Redis        | Single-process only                 |
| Bounded telemetry         | Unbounded dict growth over time   | `deque(maxlen)` + LRU eviction             | Prometheus exporter   | Lost on restart                     |
| Thread pool for inference | CPU work blocks event loop        | `ThreadPoolExecutor(cpu_count)`            | Default executor      | GIL on pure-Python sections         |
| PSI + KS + KL drift       | Null% delta is not distributional | Three complementary statistics             | Single metric         | Higher API response size            |
| Schema versioning         | Stale IndexedDB breaks UI state   | Drop-on-version-mismatch                   | Migration             | Ambient selection lost on upgrade   |
| Zustand slices            | Global re-render on WS updates    | Three isolated stores + selectors          | Single React context  | More boilerplate                    |
| Plugin interface          | Hardcoded ML pipeline             | `IPlugin` + runtime loading                | Inline training logic | Interface boundary adds indirection |

---

_This document reflects the system state as of v2.0. For API reference, see `BACKEND_API.md`. For deployment steps, see `DEPLOYMENT.md`._

---

## 15. Why This Matters

Most ML platforms produce outputs. XAI-NIDS produces outputs with explanations, guarantees, and evidence.

**Model decisions are inspectable.** SHAP and LIME run on every model, on every prediction, at the per-feature level. An analyst can always ask: which inputs drove this classification, and do two independent explanation methods agree?

**Drift is measurable.** The platform does not assume the world is static. PSI, KS, and KL divergence quantify exactly how much a new dataset has shifted from the training distribution — before a model is deployed against it.

**System health is visible.** Every request is timed and recorded. Every error is counted. Latency percentiles, inference load, and training history are available in-process without a metrics database or scraper. The system does not require external tooling to tell you whether it is healthy.

**Failures are recoverable.** Background jobs persist their state to disk after every transition. On restart, the job manager restores from disk. Failed jobs retry with exponential backoff, and permanent failures are identified by error code rather than by repeated failure. A job chain can be traced from first attempt to final outcome by following `parent_job_id`.

**Deployment is deterministic.** Every Python dependency is pinned to an exact version. The frontend uses `npm ci` against a lockfile. Docker builds are multi-stage with no build tools in the runtime image. A CI pipeline rebuilds and retests both images on every pull request. The system that runs in CI is the same system that runs in production.

That combination — explainability, drift awareness, self-observability, fault tolerance, and reproducible deployment — is what makes this more than a training tool. It is a platform that an engineer can reason about, an analyst can trust, and an operator can run without surprises.
