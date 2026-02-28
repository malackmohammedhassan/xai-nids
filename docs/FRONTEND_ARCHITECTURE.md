# Frontend Architecture

**Framework:** React 18 · TypeScript 5.9.3 · Vite 5.0.8  
**Styling:** Tailwind CSS 3.x · clsx  
**Charts:** Recharts  
**Icons:** Lucide React  
**HTTP:** Axios (via `src/api/index.ts`)  
**Testing:** Vitest 4.0.18 · Testing Library · jsdom

---

## Directory Structure

```
frontend/src/
├── api/
│   └── index.ts                  # Axios client + typed API functions
├── components/
│   ├── ErrorBoundary.tsx          # React error boundary wrapper
│   ├── common/                    # Shared UI — Button, Badge, LoadingSpinner etc.
│   ├── dataset/
│   │   ├── DatasetUpload.tsx      # Drag-and-drop CSV/Parquet uploader
│   │   ├── DatasetList.tsx        # Uploaded dataset table
│   │   ├── DatasetSummary.tsx     # Column statistics view
│   │   └── IntrospectView.tsx     # Auto-detected task type + recommendations
│   ├── evaluation/
│   │   ├── ConfusionMatrix.tsx    # Color-coded confusion matrix table
│   │   ├── FeatureImportance.tsx  # Horizontal bar chart (Recharts)
│   │   ├── MetricsCards.tsx       # Accuracy / F1 / Precision / Recall / AUC cards
│   │   └── ROCCurve.tsx           # Area chart (Recharts)
│   ├── explainability/
│   │   ├── LIMEView.tsx           # Feature weight pos/neg split view
│   │   ├── SHAPView.tsx           # SHAP waterfall + bar chart
│   │   └── ExplainPanel.tsx       # SHAP + LIME combined panel
│   ├── layout/
│   │   ├── Header.tsx             # Top navigation bar + plugin status chip
│   │   ├── Sidebar.tsx            # Navigation sidebar (collapsible)
│   │   └── Layout.tsx             # App shell (sidebar + header + content)
│   ├── prediction/
│   │   └── PredictionPlayground.tsx  # Feature slider + batch predict form
│   └── training/
│       ├── TrainingMonitor.tsx    # Progress bar + live log viewer
│       ├── TrainingForm.tsx       # Dataset select + hyperparameter form
│       ├── ModelList.tsx          # Trained model registry table
│       └── ModelDetails.tsx       # Metrics, feature importance, ROC curve
├── hooks/
│   └── useTrainingWebSocket.ts    # WebSocket hook for live training events
├── pages/
│   └── Dashboard.tsx              # Main app page (tab navigation)
├── tests/
│   ├── setup.ts                   # Test setup (mocks: WebSocket, ResizeObserver)
│   ├── Dashboard.test.tsx
│   ├── DatasetUpload.test.tsx
│   ├── ErrorBoundary.test.tsx
│   ├── PredictionPlayground.test.tsx
│   └── TrainingMonitor.test.tsx
├── types/
│   └── index.ts                   # Shared TypeScript interfaces
└── utils/
    └── formatters.ts              # formatMetric(), metricGrade()
```

---

## API Layer (`src/api/index.ts`)

Encapsulates all backend communication using Axios. Named exports by domain:

```typescript
// Dataset API
datasetsApi.upload(file: File): Promise<DatasetMeta>
datasetsApi.list(): Promise<DatasetListResponse>
datasetsApi.summary(datasetId: string): Promise<DatasetSummary>
datasetsApi.introspect(datasetId: string): Promise<IntrospectResult>
datasetsApi.delete(datasetId: string): Promise<void>

// Models API
modelsApi.list(): Promise<ModelListResponse>
modelsApi.metrics(modelId: string): Promise<ModelMetrics>
modelsApi.load(modelId: string): Promise<LoadModelResponse>
modelsApi.delete(modelId: string): Promise<void>
modelsApi.trainConfigs(): Promise<TrainConfigsResponse>

// Training API
trainingApi.start(req: TrainRequest): Promise<TrainStarted>
trainingApi.status(): Promise<TrainStatusResponse>

// Prediction API
predictionApi.predict(modelId: string, inputs: Record<string, number>[]): Promise<PredictResponse>

// Explanation API
explainApi.explain(modelId: string, inputRow: Record<string, number>, method: string): Promise<ExplainResponse>
```

---

## TypeScript Types (`src/types/index.ts`)

Key interfaces used across the app:

```typescript
interface ModelMetrics {
  model_id: string;
  accuracy?: number;
  f1_score?: number;
  precision?: number;
  recall?: number;
  roc_auc?: number;
  confusion_matrix?: number[][];
  roc_curve?: { fpr: number[]; tpr: number[] };
  feature_importance?: Array<{ feature: string; importance: number }>;
  class_names?: string[];
}

interface SHAPResult {
  prediction: string | number;
  base_value?: number;
  shap_values: Record<string, number>;
  waterfall_chart_b64?: string;
}

interface LIMEResult {
  prediction_proba: number[];
  feature_weights: Record<string, number>;
  intercept: number;
  explanation_chart_b64?: string;
}
```

---

## State Management

The app uses **React's built-in state** (useState / useCallback) — no external state library.

Key state locations:

- `Dashboard.tsx` — active tab, selected dataset, selected model
- `TrainingMonitor.tsx` — training status, WebSocket events
- `PredictionPlayground.tsx` — feature values, prediction results

---

## WebSocket Integration

`useTrainingWebSocket.ts` manages the WebSocket connection for live training updates:

```typescript
const { status, logs, progress } = useTrainingWebSocket({
  enabled: isTraining,
  onComplete: (modelId) => refetchModels(),
  onError: (msg) => setError(msg),
});
```

Server sends JSON messages with `event` field: `started`, `step`, `metrics`, `log`, `complete`, `error`, `heartbeat`.

---

## Build

```bash
npm run build
# Output: dist/ (Vite production bundle)
# Approx bundle sizes:
#   vendor.js    ~164 kB (React + deps)
#   charts.js    ~386 kB (Recharts)
#   index.js     ~72 kB (app code)
```

---

## Testing Patterns

### Rendering with Providers

Components that use React context (if any) need the relevant providers in tests:

```tsx
import { render, screen } from "@testing-library/react";
render(<MyComponent prop="value" />);
const el = screen.getByRole("button", { name: /submit/i });
```

### Mocking API Calls

```tsx
import * as api from "@/api";
vi.spyOn(api.datasetsApi, "upload").mockResolvedValue({
  dataset_id: "test-id",
  filename: "test.csv",
  rows: 100,
});
```

### WebSocket Testing

The global WebSocket is mocked in `setup.ts`. Components that use WebSocket will receive mock events injected via:

```typescript
// From setup.ts mock
MockWebSocket.instances[0].simulateMessage({
  event: "complete",
  data: { model_id: "xyz" },
});
```
