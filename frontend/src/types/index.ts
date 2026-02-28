// ─── Dataset Types ────────────────────────────────────────────────────────────
export interface ColumnStats {
  name: string;
  dtype: string;
  null_count: number;
  null_pct: number;
  unique_count: number;
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
  type: 'progress' | 'complete' | 'error' | 'heartbeat';
  step?: string;
  progress?: number;
  total?: number;
  model_id?: string;
  error?: string;
  timestamp: string;
}

// ─── Model Types ──────────────────────────────────────────────────────────────
export interface ModelMeta {
  model_id: string;
  model_type: string;
  dataset_id: string;
  target_column: string;
  feature_names: string[];
  class_names?: string[];
  created_at: string;
  plugin_name: string;
  hyperparameters: Record<string, unknown>;
  is_loaded: boolean;
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
  waterfall_chart_b64?: string;
  summary_chart_b64?: string;
  // Raw fields also present
  values?: Array<{ feature: string; value: number; shap_value: number }>;
  expected_value?: number;
  force_plot_base64?: string;
  summary_plot_base64?: string;
  sampled_for_performance?: boolean;
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
