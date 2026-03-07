// ─── Dataset Types ────────────────────────────────────────────────────────────
export interface ColumnStats {
  name: string;
  dtype: string;
  null_count: number;
  null_pct: number;
  unique_count: number;
  sample_values?: (string | number | boolean)[];
  mean?: number;
  std?: number;
  min?: number;
  max?: number;
  q25?: number;
  q50?: number;
  q75?: number;
  top_values?: Record<string, number>;
}

export interface DatasetSummary {
  dataset_id: string;
  filename: string;
  row_count: number;
  column_count: number;
  size_bytes: number;
  columns: ColumnStats[];
  uploaded_at: string;
  sample_rows?: Record<string, unknown>[];
  class_distribution?: Record<string, number>;
  memory_usage_mb?: number;
  suggested_target?: string;
}

export interface DatasetIntrospection {
  dataset_id: string;
  task_type: 'binary_classification' | 'multiclass_classification' | 'regression';
  suggested_target: string;
  target_classes: string[];
  numeric_features: string[];
  categorical_features: string[];
  high_cardinality_features: string[];
  outlier_counts: Record<string, number>;
  class_imbalance_ratio?: number;
  recommended_preprocessing?: string[];
}

export interface DatasetListItem {
  dataset_id: string;
  filename: string;
  row_count: number;
  column_count: number;
  size_bytes: number;
  uploaded_at: string;
}

// ─── Training Types ───────────────────────────────────────────────────────────
export interface HyperparamSchema {
  type: 'int' | 'float' | 'str' | 'bool';
  default: unknown;
  min?: number;
  max?: number;
  choices?: unknown[];
  description?: string;
}

export interface ModelConfig {
  model_type: string;
  display_name: string;
  hyperparameters: Record<string, HyperparamSchema>;
}

export interface TrainingRequest {
  dataset_id: string;
  target_column: string;
  model_type: string;
  hyperparameters?: Record<string, unknown>;
  use_optuna?: boolean;
  plugin_name?: string;
  test_size?: number;
  random_state?: number;
  pipeline_config?: import('@/types/pipeline').PipelineConfig | null;
}

export interface TrainingStatus {
  is_training: boolean;
  current_step: string;
  progress: number;
  total: number;
  model_id?: string;
  error?: string;
}

export interface TrainingProgressEvent {
  /** matches the backend's `event` key (e.g. "step", "log", "complete", "heartbeat") */
  event: 'step' | 'log' | 'started' | 'metrics' | 'complete' | 'error' | 'heartbeat';
  data?: {
    // step
    step_name?: string;
    step_number?: number;
    total_steps?: number;
    progress_pct?: number;
    // log
    level?: string;
    message?: string;
    // shared timestamp (number for heartbeat, string for log)
    timestamp?: string | number;
    // complete
    task_id?: string;
    run_id?: string;
    model_id?: string;
    final_metrics?: Record<string, unknown>;
    duration_seconds?: number;
    // started
    model_type?: string;
    dataset_id?: string;
    // error
    error_type?: string;
    traceback_safe?: string;
    // allow arbitrary metrics keys
    [key: string]: unknown;
  };
}

// ─── Model Types ──────────────────────────────────────────────────────────────
export interface ModelMeta {
  model_id: string;
  model_type: string;
  /** UUID run_id from the training job */
  run_id?: string;
  /** Set when the model was created from a stored dataset */
  dataset_id?: string;
  /** Original CSV filename used for training (e.g. "UNSW_NB15_1.csv") */
  dataset_filename?: string;
  target_column?: string;
  feature_names: string[];
  class_names?: string[];
  created_at: string;
  plugin_name?: string;
  hyperparameters?: Record<string, unknown>;
  is_loaded: boolean;
  /** Quick-access metrics stored at save time */
  accuracy?: number;
  f1_score?: number;
  feature_count?: number;
}

export interface ModelMetrics {
  model_id: string;
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  roc_auc?: number;
  confusion_matrix?: number[][];
  class_names?: string[];
  feature_importances?: Array<{ feature: string; importance: number }>;
  roc_curve?: { fpr: number[]; tpr: number[]; thresholds: number[] };
  classification_report?: Record<string, unknown>;
}

// ─── Prediction Types ─────────────────────────────────────────────────────────
export interface PredictionRequest {
  features: Record<string, unknown>;
}

export interface PredictionResult {
  model_id: string;
  prediction: string | number;
  confidence?: number;
  probabilities?: Record<string, number>;
  prediction_time_ms: number;
}

// ─── Explainability Types ─────────────────────────────────────────────────────
export type ExplanationMethod = 'shap' | 'lime' | 'both';

export interface ExplainRequest {
  input_row: Record<string, unknown>;
  method: ExplanationMethod;
  max_display_features?: number;
}

export interface SHAPResult {
  // Normalised fields (set by backend adapter)
  shap_values: Record<string, number>;
  base_value: number;
  prediction: number | string;
  /** "Attack" | "Normal" — human-readable prediction label */
  prediction_label?: string;
  /** Probability of the attack class (0–1) */
  prediction_probability?: number;
  /** { Normal: 0.13, Attack: 0.87 } */
  class_probabilities?: Record<string, number>;
  waterfall_chart_b64?: string;
  summary_chart_b64?: string;
  // Raw fields also present
  values?: Array<{
    feature: string;
    value: number;
    shap_value: number;
    pct_contribution?: number;
  }>;
  /** Cumulative waterfall steps for interactive chart */
  cumulative_waterfall?: Array<{
    feature: string;
    value: number;
    shap_value: number;
    start: number;
    end: number;
    pct_contribution: number;
  }>;
  expected_value?: number;
  force_plot_base64?: string;
  summary_plot_base64?: string;
  sampled_for_performance?: boolean;
}

/** Parsed LIME feature condition with structured context */
export interface LIMEFeatureDetail {
  condition: string;
  feature_name: string;
  actual_value: number | null;
  weight: number;
  direction: 'toward_attack' | 'toward_normal';
}

export interface LIMEResult {
  // Normalised fields
  feature_weights: Record<string, number>;
  intercept: number;
  prediction_proba: number[];
  explanation_chart_b64?: string;
  // Raw fields also present
  explanation?: Array<{ feature_condition: string; weight: number }>;
  prediction_probabilities?: Record<string, number>;
  local_fidelity?: number;
  /** R² of local linear model (0–1, higher is better) */
  fidelity_score?: number;
  /** "Attack" | "Normal" */
  prediction_label?: string;
  /** { Normal: 0.13, Attack: 0.87 } */
  class_probabilities?: Record<string, number>;
  /** Rich parsed feature details */
  feature_details?: LIMEFeatureDetail[];
  plot_base64?: string;
}

export interface ExplanationResult {
  model_id: string;
  method: ExplanationMethod;
  method_used: string;   // backend also sends this alias
  shap?: SHAPResult;
  lime?: LIMEResult;
  computation_time_ms: number;
}

// ─── Model Intelligence Lab Types ────────────────────────────────────────────
export interface LabFeatureStat {
  mean: number;
  std: number;
  min: number;
  max: number;
  skewness: number;
  kurtosis: number;
  q25: number;
  q75: number;
  count: number;
}

export interface LabTopCorrelation {
  feature_a: string;
  feature_b: string;
  correlation: number;
}

export interface LabModelProfile {
  model_id: string;
  model_type: string;
  dataset_id?: string;
  dataset_filename?: string;
  feature_names: string[];
  class_names: string[];
  hyperparameters: Record<string, unknown>;
  created_at?: string;
  feature_count: number;
  is_loaded: boolean;
  // Metrics
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  roc_auc?: number;
  confusion_matrix?: number[][];
  roc_curve?: { fpr: number[]; tpr: number[] };
  classification_report?: Record<string, Record<string, number>>;
  feature_importances?: Record<string, number>;
  // Dataset stats
  sample_size: number;
  feature_stats: Record<string, LabFeatureStat>;
  class_distribution?: Record<string, number>;
  top_correlations?: LabTopCorrelation[];
  feature_samples?: Record<string, number[]>;
}

export interface LabCompareResult {
  model_a: LabModelProfile;
  model_b: LabModelProfile;
  shared_features: string[];
  only_in_a: string[];
  only_in_b: string[];
  metric_deltas: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1_score?: number;
    roc_auc?: number;
  };
}

// ─── Experiment Types ─────────────────────────────────────────────────────────
export interface ExperimentRun {
  run_id: string;
  model_id: string;
  model_type: string;
  dataset_id: string;
  target_column: string;
  plugin_name: string;
  hyperparameters: Record<string, unknown>;
  metrics: ModelMetrics;
  status: 'success' | 'failed';
  error?: string;
  created_at: string;
  duration_seconds?: number;
}

// ─── Health Types ─────────────────────────────────────────────────────────────
export interface HealthStatus {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  uptime_seconds: number;
  backend_ready?: boolean;
  // Directory / DB presence checks
  dataset_dir_exists: boolean;
  model_dir_exists: boolean;
  experiment_db_exists: boolean;
  // Plugin / model info
  plugins_loaded: string[];
  loaded_models: string[];
  active_training: boolean;
  // Legacy fields still present in backend response
  model_loaded?: boolean;
  active_training_job?: string | null;
  loaded_plugin?: string;
  available_plugins?: Array<{ name: string; version: string; supported_models: string[] }>;
  total_models?: number;
}

// ─── Plugin Types ─────────────────────────────────────────────────────────────
export interface PluginInfo {
  name: string;
  version: string;
  description: string;
  supported_models: string[];
}

export interface PluginsResponse {
  plugins: PluginInfo[];
  available_models: string[];
}

// ─── API Generic ──────────────────────────────────────────────────────────────
export interface ApiError {
  detail: string;
  error_code?: string;
  status_code?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}
