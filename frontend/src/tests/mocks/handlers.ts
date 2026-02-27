import { http, HttpResponse } from 'msw';

const BASE = '/api/v1';

export const handlers = [
  // Health
  http.get(`${BASE}/health`, () =>
    HttpResponse.json({
      status: 'ok',
      version: '2.0.0',
      uptime_seconds: 120,
      dataset_dir_exists: true,
      model_dir_exists: true,
      experiment_db_exists: true,
      plugins_loaded: ['xai_ids'],
      loaded_models: [],
      active_training: false,
    })
  ),

  // Datasets
  http.get(`${BASE}/datasets/list`, () => HttpResponse.json([])),

  http.post(`${BASE}/datasets/upload`, () =>
    HttpResponse.json({
      dataset_id: 'test-dataset-id',
      filename: 'test.csv',
      row_count: 1000,
      column_count: 10,
      size_bytes: 10240,
      columns: [],
      uploaded_at: new Date().toISOString(),
    })
  ),

  http.get(`${BASE}/datasets/:id/summary`, ({ params }) =>
    HttpResponse.json({
      dataset_id: params.id,
      filename: 'test.csv',
      row_count: 1000,
      column_count: 10,
      size_bytes: 10240,
      columns: [
        { name: 'feature_1', dtype: 'float64', null_count: 0, null_pct: 0, unique_count: 100 },
        { name: 'label', dtype: 'int64', null_count: 0, null_pct: 0, unique_count: 2 },
      ],
      uploaded_at: new Date().toISOString(),
    })
  ),

  http.delete(`${BASE}/datasets/:id`, () =>
    HttpResponse.json({ message: 'deleted' })
  ),

  // Models
  http.get(`${BASE}/models/list`, () => HttpResponse.json([])),

  http.get(`${BASE}/models/train/status`, () =>
    HttpResponse.json({
      is_training: false,
      current_step: 'Idle',
      progress: 0,
      total: 100,
    })
  ),

  http.get(`${BASE}/models/train/configs`, () =>
    HttpResponse.json([
      {
        model_type: 'random_forest',
        display_name: 'Random Forest',
        hyperparameters: {
          n_estimators: { type: 'int', default: 100, min: 10, max: 500 },
        },
      },
    ])
  ),

  http.post(`${BASE}/models/train`, () =>
    HttpResponse.json({ run_id: 'test-run-id', message: 'training started' })
  ),

  // Prediction
  http.post(`${BASE}/models/:id/predict`, () =>
    HttpResponse.json({
      model_id: 'test-model-id',
      prediction: '0',
      confidence: 0.95,
      probabilities: { '0': 0.95, '1': 0.05 },
      prediction_time_ms: 2.5,
    })
  ),

  // Explainability
  http.post(`${BASE}/models/:id/explain`, () =>
    HttpResponse.json({
      model_id: 'test-model-id',
      method: 'shap',
      shap: {
        shap_values: { feature_1: 0.3, feature_2: -0.1 },
        base_value: 0.5,
        prediction: 0,
      },
      computation_time_ms: 150,
    })
  ),

  // Experiments
  http.get(`${BASE}/experiments`, () => HttpResponse.json([])),
  http.delete(`${BASE}/experiments/:id`, () => HttpResponse.json({ message: 'deleted' })),
];
