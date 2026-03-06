/**
 * CustomPipelineBuilder
 * =====================
 * A 10-step wizard that walks the user through every configurable stage of
 * the ML preprocessing pipeline.
 *
 * Props:
 *  - recommendation   → the backend PipelineRecommendation (can be null while loading)
 *  - config           → the current PipelineConfig state
 *  - onChange         → called whenever any step option changes
 *  - onReset          → reset all steps back to the AI-recommended defaults
 *  - loadingRec       → show skeleton while recommendation is loading
 *  - recError         → show warning banner if recommendation failed
 */
import { RotateCcw, Timer, Loader2, AlertTriangle, ChevronRight } from 'lucide-react';
import { PipelineStepCard } from './PipelineStepCard';
import type { PipelineConfig, PipelineRecommendation, StepRecommendation } from '@/types/pipeline';

// ── Helper: render a range slider with its value label ───────────────────────
function RangeControl({
  label,
  value,
  min,
  max,
  step,
  formatValue,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  formatValue?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-400">{label}</label>
        <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 rounded px-1.5 py-0.5">
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-cyan-500"
      />
      <div className="flex justify-between text-[10px] text-gray-600">
        <span>{formatValue ? formatValue(min) : min}</span>
        <span>{formatValue ? formatValue(max) : max}</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface CustomPipelineBuilderProps {
  recommendation: PipelineRecommendation | null;
  config: PipelineConfig;
  onChange: (updater: (prev: PipelineConfig) => PipelineConfig) => void;
  onReset: () => void;
  loadingRec: boolean;
  recError: string | null;
}

export function CustomPipelineBuilder({
  recommendation,
  config,
  onChange,
  onReset,
  loadingRec,
  recError,
}: CustomPipelineBuilderProps) {
  // Convenience: find a step recommendation by step name
  const stepRec = (step: string): StepRecommendation | undefined =>
    recommendation?.steps.find((s) => s.step === step);

  // ── Updaters per step ──────────────────────────────────────────────────────

  const setMissingStrategy = (v: string) =>
    onChange((p) => ({ ...p, missing_values: { strategy: v as PipelineConfig['missing_values']['strategy'] } }));

  const setDuplicates = (v: string) =>
    onChange((p) => ({ ...p, duplicates: { remove: v === 'remove' } }));

  const setOutlierMethod = (v: string) =>
    onChange((p) => ({ ...p, outliers: { ...p.outliers, method: v as PipelineConfig['outliers']['method'] } }));

  const setOutlierThreshold = (v: number) =>
    onChange((p) => ({ ...p, outliers: { ...p.outliers, threshold: v } }));

  const setLabelMode = (v: string) =>
    onChange((p) => ({ ...p, label_mode: { mode: v as PipelineConfig['label_mode']['mode'] } }));

  const setEncoding = (v: string) =>
    onChange((p) => ({ ...p, encoding: { strategy: v as PipelineConfig['encoding']['strategy'] } }));

  const setScaling = (v: string) =>
    onChange((p) => ({ ...p, scaling: { strategy: v as PipelineConfig['scaling']['strategy'] } }));

  const setFsMethod = (v: string) =>
    onChange((p) => ({ ...p, feature_selection: { ...p.feature_selection, method: v as PipelineConfig['feature_selection']['method'] } }));

  const setNFeatures = (v: number) =>
    onChange((p) => ({ ...p, feature_selection: { ...p.feature_selection, n_features: v } }));

  const setBalancing = (v: string) =>
    onChange((p) => ({ ...p, class_balancing: { method: v as PipelineConfig['class_balancing']['method'] } }));

  const setSplit = (v: string) =>
    onChange((p) => ({ ...p, split: { ...p.split, test_size: Number(v) } }));

  const setStratify = (v: string) =>
    onChange((p) => ({ ...p, split: { ...p.split, stratify: v === 'yes' } }));

  const setCVEnabled = (v: string) =>
    onChange((p) => ({ ...p, cross_validation: { ...p.cross_validation, enabled: v === 'enabled' } }));

  const setCVFolds = (v: number) =>
    onChange((p) => ({ ...p, cross_validation: { ...p.cross_validation, folds: v } }));

  const setCVScoring = (v: string) =>
    onChange((p) => ({ ...p, cross_validation: { ...p.cross_validation, scoring: v as PipelineConfig['cross_validation']['scoring'] } }));

  // ── Fallback recommendations used when the backend hasn't responded yet ──
  const fallbackStep = (step: string, title: string, description: string, currentValue: string, opts: { value: string; label: string; description: string }[]): StepRecommendation => ({
    step, title, description,
    recommended: currentValue,
    reason: 'Using default settings — connect a dataset to get AI recommendations',
    current_value: currentValue,
    options: opts.map((o) => ({ ...o, disabled: false, disabled_reason: null, is_recommended: o.value === currentValue })),
  });

  // ── Summary panel helpers ──────────────────────────────────────────────────
  const summaryItems: Array<{ label: string; value: string }> = [
    { label: 'Missing values', value: config.missing_values.strategy },
    { label: 'Remove duplicates', value: config.duplicates.remove ? 'Yes' : 'No' },
    { label: 'Outlier removal', value: config.outliers.method === 'none' ? 'Off' : `${config.outliers.method} (±${config.outliers.threshold}σ)` },
    { label: 'Label mode', value: config.label_mode.mode },
    { label: 'Encoding', value: config.encoding.strategy },
    { label: 'Scaling', value: config.scaling.strategy },
    { label: 'Feature selection', value: config.feature_selection.method === 'none' ? 'None' : `${config.feature_selection.method} (top ${config.feature_selection.n_features})` },
    { label: 'Class balancing', value: config.class_balancing.method },
    { label: 'Test split', value: `${Math.round(config.split.test_size * 100)}% test${config.split.stratify ? ' (stratified)' : ''}` },
    { label: 'Cross-validation', value: config.cross_validation.enabled ? `${config.cross_validation.folds}-fold (${config.cross_validation.scoring})` : 'Off' },
  ];

  // ── Skeleton placeholder when loading recommendations ─────────────────────
  if (loadingRec) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-gray-800 border border-gray-700 rounded-xl p-5 animate-pulse">
            <div className="h-4 w-1/3 bg-gray-700 rounded mb-3" />
            <div className="h-3 w-full bg-gray-750 rounded mb-2" />
            <div className="h-3 w-2/3 bg-gray-750 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header row: dataset summary + reset button */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          {recommendation && (
            <>
              <span className="text-xs text-gray-400">
                <span className="text-white font-medium">{recommendation.row_count.toLocaleString()}</span> rows
              </span>
              <ChevronRight size={12} className="text-gray-600" />
              <span className="text-xs text-gray-400">
                <span className="text-white font-medium">{recommendation.feature_count}</span> features
              </span>
              {recommendation.class_balance && (
                <>
                  <ChevronRight size={12} className="text-gray-600" />
                  <span className="text-xs text-gray-400">
                    Balance: <span className="text-white font-medium">{recommendation.class_balance}</span>
                  </span>
                </>
              )}
              {recommendation.estimated_duration_seconds > 0 && (
                <>
                  <ChevronRight size={12} className="text-gray-600" />
                  <span className="flex items-center gap-1 text-xs text-amber-400">
                    <Timer size={11} />
                    ~{recommendation.estimated_duration_seconds}s estimated
                  </span>
                </>
              )}
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onReset}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-cyan-400 border border-gray-700 hover:border-cyan-500/50 rounded-lg px-3 py-1.5 transition-colors"
        >
          <RotateCcw size={12} />
          Reset to AI defaults
        </button>
      </div>

      {/* Recommendation error warning */}
      {recError && (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
          <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300">
            Could not load AI recommendations: {recError}. Using safe defaults — you can still customise all steps manually.
          </p>
        </div>
      )}

      {/* Loading spinner if we got no recommendation yet and there's no error */}
      {!recommendation && !recError && (
        <div className="flex items-center gap-2 text-xs text-gray-400 py-4">
          <Loader2 size={14} className="animate-spin text-cyan-500" />
          Loading AI recommendations…
        </div>
      )}

      {/* ── Step cards ─────────────────────────────────────────────────────── */}

      {/* 1. Missing values */}
      <PipelineStepCard
        recommendation={stepRec('missing_values') ?? fallbackStep('missing_values', 'Missing Values', 'How to handle cells with no data.', config.missing_values.strategy, [
          { value: 'drop', label: 'Drop rows', description: 'Delete any row that contains a missing value.' },
          { value: 'mean', label: 'Fill with mean', description: 'Replace missing numerics with the column average.' },
          { value: 'median', label: 'Fill with median', description: 'Replace with the column median (robust to outliers).' },
          { value: 'mode', label: 'Fill with mode', description: 'Replace with the most frequent value in the column.' },
          { value: 'zero', label: 'Fill with zero', description: 'Replace missing values with 0.' },
        ])}
        value={config.missing_values.strategy}
        onChange={setMissingStrategy}
      />

      {/* 2. Duplicates */}
      <PipelineStepCard
        recommendation={stepRec('duplicates') ?? fallbackStep('duplicates', 'Duplicate Rows', 'Should exact duplicate rows be removed from the dataset?', config.duplicates.remove ? 'remove' : 'keep', [
          { value: 'remove', label: 'Remove duplicates', description: 'Drop exact duplicate rows — often small datasets have none.' },
          { value: 'keep', label: 'Keep duplicates', description: 'Leave the data as-is. Useful when duplicates are intentional.' },
        ])}
        value={config.duplicates.remove ? 'remove' : 'keep'}
        onChange={setDuplicates}
      />

      {/* 3. Outlier removal */}
      <PipelineStepCard
        recommendation={stepRec('outliers') ?? fallbackStep('outliers', 'Outlier Removal', 'Remove or clip extreme numeric values before training.', config.outliers.method, [
          { value: 'none', label: 'No removal', description: 'Keep all values. Good when tree models are used (they are robust).' },
          { value: 'iqr', label: 'IQR fence', description: 'Remove values outside 1.5× IQR of each column.' },
          { value: 'zscore', label: 'Z-score', description: 'Remove values more than N standard deviations from the mean.' },
        ])}
        value={config.outliers.method}
        onChange={setOutlierMethod}
      >
        {config.outliers.method !== 'none' && (
          <RangeControl
            label={config.outliers.method === 'iqr' ? 'IQR multiplier' : 'Z-score threshold (σ)'}
            value={config.outliers.threshold}
            min={1.0}
            max={5.0}
            step={0.5}
            formatValue={(v) => `${v}`}
            onChange={setOutlierThreshold}
          />
        )}
      </PipelineStepCard>

      {/* 4. Label mode */}
      <PipelineStepCard
        recommendation={stepRec('label_mode') ?? fallbackStep('label_mode', 'Label Mode', 'Whether your target has two classes or multiple.', config.label_mode.mode, [
          { value: 'binary', label: 'Binary', description: 'Two classes only (e.g. Normal / Attack). Fastest and most common.' },
          { value: 'multiclass', label: 'Multi-class', description: 'Three or more distinct attack types. Requires more data per class.' },
        ])}
        value={config.label_mode.mode}
        onChange={setLabelMode}
      />

      {/* 5. Encoding */}
      <PipelineStepCard
        recommendation={stepRec('encoding') ?? fallbackStep('encoding', 'Categorical Encoding', 'How to convert text / categorical columns into numbers.', config.encoding.strategy, [
          { value: 'label', label: 'Label encoding', description: 'Converts each unique category to an integer. Memory-efficient.' },
          { value: 'onehot', label: 'One-hot encoding', description: 'Creates a binary column per category. Best for nominal features.' },
        ])}
        value={config.encoding.strategy}
        onChange={setEncoding}
      />

      {/* 6. Scaling */}
      <PipelineStepCard
        recommendation={stepRec('scaling') ?? fallbackStep('scaling', 'Feature Scaling', 'Normalise numeric features so they share comparable ranges.', config.scaling.strategy, [
          { value: 'minmax', label: 'Min-Max (0–1)', description: 'Scale features to [0, 1]. Best when data has no extreme outliers.' },
          { value: 'standard', label: 'Standard (Z-score)', description: 'Zero mean, unit variance. Good for SVM / logistic regression.' },
          { value: 'robust', label: 'Robust (IQR)', description: 'Uses median and IQR — immune to outliers.' },
          { value: 'none', label: 'No scaling', description: 'Skip scaling. Tree-based models (RF, XGB) usually do not need it.' },
        ])}
        value={config.scaling.strategy}
        onChange={setScaling}
      />

      {/* 7. Feature selection */}
      <PipelineStepCard
        recommendation={stepRec('feature_selection') ?? fallbackStep('feature_selection', 'Feature Selection', 'Reduce the number of input features before training.', config.feature_selection.method, [
          { value: 'rfe', label: 'RFE (recursive)', description: 'Recursively removes weakest features using the model itself.' },
          { value: 'kbest', label: 'K-Best (χ²)', description: 'Keeps the K features with highest statistical score.' },
          { value: 'pca', label: 'PCA (components)', description: 'Projects data into K principal components. Loses interpretability.' },
          { value: 'none', label: 'No selection', description: 'Use all features. Fine for small feature sets.' },
        ])}
        value={config.feature_selection.method}
        onChange={setFsMethod}
      >
        {config.feature_selection.method !== 'none' && (
          <RangeControl
            label={config.feature_selection.method === 'pca' ? 'PCA components' : 'Top N features'}
            value={config.feature_selection.n_features}
            min={5}
            max={100}
            step={5}
            onChange={setNFeatures}
          />
        )}
      </PipelineStepCard>

      {/* 8. Class balancing */}
      <PipelineStepCard
        recommendation={stepRec('class_balancing') ?? fallbackStep('class_balancing', 'Class Balancing', 'Handle imbalanced datasets (far more Normal than Attack samples).', config.class_balancing.method, [
          { value: 'smote', label: 'SMOTE', description: 'Synthesises new minority-class samples by interpolation.' },
          { value: 'adasyn', label: 'ADASYN', description: 'Adaptive version of SMOTE — focuses on harder boundary examples.' },
          { value: 'class_weight', label: 'Class weights', description: 'Penalises misclassification of minority class during training.' },
          { value: 'none', label: 'None', description: 'Do nothing. Use only when classes are already balanced.' },
        ])}
        value={config.class_balancing.method}
        onChange={setBalancing}
      />

      {/* 9. Train/test split */}
      <PipelineStepCard
        recommendation={stepRec('split') ?? fallbackStep('split', 'Train / Test Split', 'How to divide data into training and holdout sets.', String(config.split.test_size), [
          { value: '0.1', label: '10% test', description: 'Small test set — use when data is scarce.' },
          { value: '0.2', label: '20% test (default)', description: 'Standard 80/20 split. Recommended for most datasets.' },
          { value: '0.25', label: '25% test', description: 'Slightly larger test set for more reliable evaluation.' },
          { value: '0.3', label: '30% test', description: 'Large test set — best when dataset is large (>10k rows).' },
        ])}
        value={String(config.split.test_size)}
        onChange={setSplit}
      >
        {/* Stratify toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-300 font-medium">Stratified split</p>
            <p className="text-xs text-gray-500">Preserve class proportions in both train and test sets.</p>
          </div>
          <div className="flex rounded-lg overflow-hidden border border-gray-600 text-xs">
            {['yes', 'no'].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setStratify(v)}
                className={`px-3 py-1.5 transition-colors ${
                  (v === 'yes') === config.split.stratify
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {v === 'yes' ? 'Yes' : 'No'}
              </button>
            ))}
          </div>
        </div>
      </PipelineStepCard>

      {/* 10. Cross-validation */}
      <PipelineStepCard
        recommendation={stepRec('cross_validation') ?? fallbackStep('cross_validation', 'Cross-Validation', 'Evaluate the model on multiple folds before final training.', config.cross_validation.enabled ? 'enabled' : 'disabled', [
          { value: 'enabled', label: 'Enable CV', description: 'Run K-fold cross-validation and report per-fold metrics (adds time).' },
          { value: 'disabled', label: 'Skip CV', description: 'Train once on the full training split. Faster, less thorough.' },
        ])}
        value={config.cross_validation.enabled ? 'enabled' : 'disabled'}
        onChange={setCVEnabled}
      >
        {config.cross_validation.enabled && (
          <div className="space-y-3">
            <RangeControl
              label="Number of folds"
              value={config.cross_validation.folds}
              min={3}
              max={10}
              step={1}
              onChange={setCVFolds}
            />
            {/* Scoring selector */}
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Scoring metric</label>
              <div className="flex rounded-lg overflow-hidden border border-gray-600 text-xs w-fit">
                {[
                  { v: 'f1_weighted', label: 'F1 (weighted)' },
                  { v: 'accuracy', label: 'Accuracy' },
                  { v: 'roc_auc', label: 'ROC-AUC' },
                ].map(({ v, label }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setCVScoring(v)}
                    className={`px-3 py-1.5 transition-colors ${
                      config.cross_validation.scoring === v
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </PipelineStepCard>

      {/* ── Pipeline summary panel ──────────────────────────────────────────── */}
      <div className="mt-2 bg-gray-900 border border-gray-700 rounded-xl px-5 py-4 space-y-2">
        <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">
          Pipeline Summary
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
          {summaryItems.map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <span className="text-xs text-gray-500">{label}</span>
              <span className="text-xs font-mono text-cyan-300 truncate max-w-[160px]">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
