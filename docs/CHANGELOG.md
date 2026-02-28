# Changelog

All notable changes to `xai-nids` are documented here.

## [2.0.0] — 2026-02-28

### Added

- Plugin architecture: `BasePlugin` abstract class, `xai_ids` built-in plugin
- FastAPI backend with full REST API (datasets, models, training, prediction, explanation)
- React 18 frontend with TypeScript 5.9 and Vite 5.0.8
- WebSocket endpoint for live training progress streaming
- `asyncio.wait_for` based WebSocket heartbeat + disconnect detection
- Dataset introspection endpoint (`/datasets/:id/introspect`) — auto-detects task type, target column, preprocessing recommendations
- NaN/Infinity sanitization in metrics response (`_sanitize()` helper in `routers/models.py`)
- Thread-safe WebSocket broadcast from background training thread via `asyncio.run_coroutine_threadsafe`
- `TrainingManager.set_event_loop()` to capture the main event loop before background thread starts
- 6 visualization components with empty/null state guards (ConfusionMatrix, FeatureImportance, MetricsCards, ROCCurve, LIMEView, SHAPView)
- SHAPView: stable `Cell key={entry.fullName}`, safe `base_value` null handling, min-height guard
- ROCCurve: `fpr.length === tpr.length` guard, unique SVG gradient ID per instance
- LIMEView: removed dead recharts imports, null guards on `feature_weights` and `prediction_proba`
- Documentation: ML_CORE_API.md, BACKEND_API.md, PLUGIN_SYSTEM.md, TESTING.md, FRONTEND_ARCHITECTURE.md, COMPONENT_GUIDE.md, DEPLOYMENT.md, CHANGELOG.md

### Fixed

- `KeyError: 'filename'` in `dataset_service.py` logger call (LogRecord reserved key) — renamed to `file_name`
- `KeyError: 'message'` in `core/exceptions.py` logger call — renamed to `error_message`
- `asyncio.create_task()` crash in background thread (`'no running event loop'`) — replaced with `_safe_broadcast()` using `asyncio.run_coroutine_threadsafe`
- `ml_service.py` `emit()` function using wrong `asyncio.get_event_loop()` from thread
- Flask backend `scaler=None` crash in `explainability_service.py` predict path — added null guard
- WebSocket test hang — removed unsupported `timeout=` kwarg from `ws.receive_text()`
- `RANDOM_STATE = 42` and `TEST_SIZE = 0.2` hardcoded values replaced with `os.getenv()` reads
- httpx incompatibility: pinned to 0.25.2 (0.26+ removed `app=` param used by starlette TestClient)
- TestClient scope changed from `session` to `function` to fix Windows teardown crashes
- Temp file paths changed from hardcoded `/tmp/` to `tempfile.gettempdir()` (cross-platform)
- Escaped docstring characters (`\"\"\"`) in 18 `xai-intrusion-detection-system/src/` files from JSON-encoding artifact
- Frontend: `src/api.js` obsolete stub was shadowing `src/api/index.ts` — deleted
- Frontend: `tsconfig.json` missing `baseUrl`, `paths`, `types` for `@/` alias and `vitest/globals`
- Frontend: `jsdom` was missing from devDependencies — added
- Frontend: `ResizeObserver` and `scrollIntoView` mocks added to `tests/setup.ts` for jsdom compatibility
- Frontend: `PredictionPlayground.tsx` label/input association (`id` + `htmlFor`) for accessibility and testing
- Frontend: `DatasetUpload.tsx` `onUpload` type widened to `Promise<unknown>`
- Frontend: `ErrorBoundary.test.tsx` missing React import and explicit return type

### Test Results

- Backend unit tests: **36/36 pass** (`pytest tests/ -v`)
- Frontend tests: **20/20 pass** (`npx vitest run`)
- E2E integration tests: **46/46 pass** (`python run_e2e.py`)
- TypeScript: **0 errors** (`npx tsc --noEmit`)
- Frontend build: **success** (`npm run build`, 6.20s)
