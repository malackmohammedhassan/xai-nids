# Component Guide

This guide describes each React component's purpose, props, and usage.

---

## Common Components

### `ErrorBoundary`

**File:** `src/components/ErrorBoundary.tsx`

Catches JavaScript errors in any child component tree and displays a fallback UI instead of unmounting the app.

**Props:**

```typescript
fallback?: ReactNode   // Custom fallback UI (defaults to built-in error card)
children: ReactNode
```

**Usage:**

```tsx
<ErrorBoundary fallback={<p>Something went wrong</p>}>
  <MyComponent />
</ErrorBoundary>
```

---

## Dataset Components

### `DatasetUpload`

**File:** `src/components/dataset/DatasetUpload.tsx`

Drag-and-drop file upload for CSV / Parquet datasets. Calls backend `/datasets/upload`.

**Props:**

```typescript
onUpload: (file: File) => Promise<unknown>;
```

**Features:**

- Accepts `.csv` and `.parquet` files
- Shows drag-over visual feedback
- Calls `onUpload` callback on file selection

---

### `DatasetSummary`

**File:** `src/components/dataset/DatasetSummary.tsx`

Displays column statistics table and sample rows for an uploaded dataset.

**Props:**

```typescript
summary: DatasetSummary; // From GET /datasets/:id/summary
```

---

## Evaluation Components

### `MetricsCards`

**File:** `src/components/evaluation/MetricsCards.tsx`

Displays 5 metric cards: Accuracy, Precision, Recall, F1 Score, ROC-AUC.

**Props:**

```typescript
metrics: ModelMetrics | null;
```

**Empty state:** Renders "No metrics available" if `metrics` is null/undefined.

**Color coding:** Uses `metricGrade()` from `src/utils/formatters.ts`:

- ≥ 0.9 → A (cyan)
- ≥ 0.8 → B (green)
- ≥ 0.7 → C (yellow)
- < 0.7 → D (red)

---

### `ConfusionMatrix`

**File:** `src/components/evaluation/ConfusionMatrix.tsx`

Color-coded HTML table. Darker cells indicate higher relative count within the row.

**Props:**

```typescript
matrix: number[][]
classNames?: string[]
```

**Empty state:** Renders placeholder if `matrix` is null/empty.  
**Cell key format:** `{rowIndex}-{colIndex}` (not plain array index).

---

### `FeatureImportance`

**File:** `src/components/evaluation/FeatureImportance.tsx`

Horizontal bar chart (Recharts) of top N features by importance score.

**Props:**

```typescript
features: Array<{ feature: string; importance: number }>
maxDisplay?: number   // default: 20
```

**Empty state:** Renders placeholder if `features` is null/empty.

**Color tiers:**

- Top 3: cyan (`#22d3ee`)
- 4–8: violet (`#a78bfa`)
- Rest: gray (`#6b7280`)

---

### `ROCCurve`

**File:** `src/components/evaluation/ROCCurve.tsx`

Area chart (Recharts) of the ROC curve with AUC score displayed.

**Props:**

```typescript
fpr: number[]   // False positive rates
tpr: number[]   // True positive rates (must match fpr.length)
auc?: number
```

**Empty state:** If `fpr`/`tpr` are missing or different lengths, renders placeholder.

**Note:** SVG gradient ID is `rocGradient-{auc}` to avoid collision if multiple instances render simultaneously.

---

## Explainability Components

### `SHAPView`

**File:** `src/components/explainability/SHAPView.tsx`

Shows SHAP explanation with:

- Verdict card (Intrusion Detected / Benign Traffic)
- Optional waterfall chart (if backend returns base64 image)
- Interactive horizontal bar chart of top feature contributions

**Props:**

```typescript
shap: SHAPResult;
```

**Empty state:** Renders placeholder if `shap.shap_values` is missing.  
**Expand/collapse:** Toggle to show all features vs top 10.  
**Chart height (expanded):** `Math.max(60, shapData.length * 25)` to avoid zero-height.

---

### `LIMEView`

**File:** `src/components/explainability/LIMEView.tsx`

Shows LIME explanation as a two-column view:

- Left: features pushing toward positive class (red)
- Right: features pushing toward negative class (green)

**Props:**

```typescript
lime: LIMEResult;
```

**Empty state:** Renders placeholder if `lime.feature_weights` or `lime.prediction_proba` is missing.

**Note:** Dead recharts imports were removed — `LIMEView` uses custom HTML layout (not a Recharts chart) for the two-column view.

---

## Training Components

### `TrainingMonitor`

**File:** `src/components/training/TrainingMonitor.tsx`

Live training progress display. Connects to the WebSocket endpoint and streams events.

**Props:**

```typescript
taskId?: string
isTraining: boolean
onComplete: (modelId: string) => void
```

**Features:**

- Progress bar animated during training
- Live log viewer with INFO/WARNING/ERROR levels
- Heartbeat indicator

---

### `TrainingForm`

**File:** `src/components/training/TrainingForm.tsx`

Form for selecting dataset, target column, model type, and hyperparameters.

**Props:**

```typescript
datasets: DatasetMeta[]
onSubmit: (req: TrainRequest) => void
isLoading: boolean
```

---

## Prediction Components

### `PredictionPlayground`

**File:** `src/components/prediction/PredictionPlayground.tsx`

Interactive form with numeric inputs for each feature. Submits to `/models/:id/predict`.

**Props:**

```typescript
modelId: string
featureNames: string[]
```

**Accessibility:** Each input has `id={feat-{feature}}` and its label has `htmlFor={feat-{feature}}` for screen reader compatibility and query-by-label in tests.

---

## Layout Components

### `Layout`

**File:** `src/components/layout/Layout.tsx`

App shell wrapping all pages. Includes `Header`, `Sidebar`, and `<main>` content area.

### `Header`

**File:** `src/components/layout/Header.tsx`

Top bar with plugin status chip, version badge, and navigation controls.

### `Sidebar`

**File:** `src/components/layout/Sidebar.tsx`

Navigation sidebar with icons for: Datasets, Training, Evaluation, Predictions, Explanations.

---

## Utils

### `src/utils/formatters.ts`

```typescript
// Format a 0–1 float as a percentage
formatMetric(value: number | undefined): string
// e.g. 0.8333 → "83.3%"  |  undefined → "—"

// Return letter grade and color class
metricGrade(value: number): { grade: string; color: string }
// e.g. 0.91 → { grade: "A", color: "text-cyan-400" }
```
