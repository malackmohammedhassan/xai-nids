// ─── Human-readable messages for backend error codes ─────────────────────────

export const ERROR_MESSAGES: Record<string, string> = {
  // Dataset
  invalid_file_type: 'Only CSV and Parquet files are accepted.',
  file_too_large: 'File exceeds the maximum allowed size.',
  dataset_too_small: 'Dataset must have at least 50 rows.',
  too_few_columns: 'Dataset must have at least 2 columns.',
  null_column: 'One or more columns are entirely empty.',
  dataset_not_found: 'Dataset not found. It may have been deleted.',

  // Training
  training_in_progress: 'A training job is already running. Please wait.',
  BACKEND_RESTART: 'Job was interrupted by a server restart.',
  no_model_selected: 'Please select a model before continuing.',

  // Explainability
  model_not_found: 'Model not found. Re-train to regenerate.',

  // Generic
  network_error: 'Could not connect to the server. Is the backend running?',
  unknown: 'An unexpected error occurred. Check the console for details.',
};

/** Return a user-friendly message for a given error code. */
export function friendlyError(code?: string | null, fallback?: string): string {
  if (!code) return fallback ?? ERROR_MESSAGES.unknown;
  return ERROR_MESSAGES[code] ?? fallback ?? `Error: ${code}`;
}
