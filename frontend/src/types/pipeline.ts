/**
 * TypeScript mirror of backend/schemas/pipeline.py
 * Keep in sync when the backend schema changes.
 */

// ── Per-step config types ──────────────────────────────────────────────────

export type MissingValueStrategy = 'drop' | 'mean' | 'median' | 'mode' | 'zero';
export type OutlierMethod        = 'none' | 'iqr' | 'zscore';
export type LabelMode            = 'binary' | 'multiclass';
export type EncodingStrategy     = 'label' | 'onehot';
export type ScalingStrategy      = 'minmax' | 'standard' | 'robust' | 'none';
export type FeatureSelectionMethod = 'rfe' | 'kbest' | 'pca' | 'none';
export type ClassBalancingMethod = 'smote' | 'adasyn' | 'class_weight' | 'none';
export type CVScoring            = 'f1_weighted' | 'accuracy' | 'roc_auc';

export interface MissingValueConfig   { strategy: MissingValueStrategy; }
export interface DuplicateConfig      { remove: boolean; }
export interface OutlierConfig        { method: OutlierMethod; threshold: number; }
export interface LabelModeConfig      { mode: LabelMode; }
export interface EncodingConfig       { strategy: EncodingStrategy; }
export interface ScalingConfig        { strategy: ScalingStrategy; }
export interface FeatureSelectionConfig { method: FeatureSelectionMethod; n_features: number; }
export interface ClassBalancingConfig { method: ClassBalancingMethod; }
export interface TrainTestSplitConfig { test_size: number; stratify: boolean; }
export interface CrossValidationConfig { enabled: boolean; folds: number; scoring: CVScoring; }

/** Full pipeline configuration — one field per preprocessing step. */
export interface PipelineConfig {
  missing_values:    MissingValueConfig;
  duplicates:        DuplicateConfig;
  outliers:          OutlierConfig;
  label_mode:        LabelModeConfig;
  encoding:          EncodingConfig;
  scaling:           ScalingConfig;
  feature_selection: FeatureSelectionConfig;
  class_balancing:   ClassBalancingConfig;
  split:             TrainTestSplitConfig;
  cross_validation:  CrossValidationConfig;
}

// ── Default config (mirrors all Python defaults) ──────────────────────────

export function defaultPipelineConfig(): PipelineConfig {
  return {
    missing_values:    { strategy: 'drop' },
    duplicates:        { remove: true },
    outliers:          { method: 'none', threshold: 3.0 },
    label_mode:        { mode: 'binary' },
    encoding:          { strategy: 'label' },
    scaling:           { strategy: 'minmax' },
    feature_selection: { method: 'rfe', n_features: 30 },
    class_balancing:   { method: 'smote' },
    split:             { test_size: 0.2, stratify: true },
    cross_validation:  { enabled: false, folds: 5, scoring: 'f1_weighted' },
  };
}

// ── Recommendation types (from GET /models/train/recommend/{dataset_id}) ──

export interface StepOption {
  value: string;
  label: string;
  description: string;
  disabled: boolean;
  disabled_reason: string | null;
  is_recommended: boolean;
}

export interface StepRecommendation {
  step:          string;
  title:         string;
  description:   string;
  recommended:   string;
  reason:        string;
  options:       StepOption[];
  current_value: string;
}

export interface PipelineRecommendation {
  dataset_id:                string;
  dataset_name:              string;
  row_count:                 number;
  feature_count:             number;
  class_balance:             string | null;
  unique_labels:             string[];
  steps:                     StepRecommendation[];
  estimated_duration_seconds: number;
}

// ── Validation types (from POST /models/{model_id}/validate) ──────────────

export interface PredictionRow {
  row_index:     number;
  prediction:    string;
  confidence:    number | null;
  probabilities: Record<string, number> | null;
  true_label:    string | null;
  correct:       boolean | null;
}

export interface ValidationSummary {
  model_id:               string;
  model_type:             string;
  total_rows:             number;
  has_labels:             boolean;
  accuracy:               number | null;
  f1_score:               number | null;
  roc_auc:                number | null;
  confusion_matrix:       number[][] | null;
  classification_report:  string | null;
  class_names:            string[];
  predictions:            PredictionRow[];
  label_column_used:      string | null;
}
