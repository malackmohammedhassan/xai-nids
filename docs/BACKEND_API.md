# Backend API Documentation

**Base URL:** `http://<host>:8000/api/v1`  
**Version:** 2.0.0  
**Framework:** FastAPI 0.104.1 · Python 3.11.9  
**Authentication:** None (development build)

---

## Health

### `GET /api/v1/health`

Returns server health, loaded plugin, and runtime info.

**Response 200:**

```json
{
  "status": "ok",
  "version": "2.0.0",
  "backend_ready": true,
  "model_loaded": false,
  "uptime_seconds": 42.0,
  "active_training_job": null,
  "python_version": "3.11.9 ...",
  "loaded_plugin": "xai_ids",
  "available_plugins": [
    {
      "name": "xai_ids",
      "version": "2.0.0",
      "supported_models": "random_forest xgboost"
    }
  ],
  "total_models": 0
}
```

---

## Datasets

### `POST /api/v1/datasets/upload`

Upload a CSV or Parquet dataset.

**Request:** `multipart/form-data`

- `file` — dataset file (`.csv` or `.parquet`)

**Constraints:**

- Minimum 50 rows required
- File size limit: 50 MB (configurable via `MAX_UPLOAD_MB`)

**Response 200:**

```json
{
  "dataset_id": "uuid-v4",
  "filename": "my_dataset.csv",
  "rows": 200,
  "columns": 5,
  "size_bytes": 4452,
  "upload_timestamp": "2026-02-28T00:48:47.647831Z"
}
```

**Error responses:**

- `400 dataset_too_small` — fewer than 50 rows
- `400 unsupported_format` — not CSV/Parquet
- `413 file_too_large` — exceeds size limit

---

### `GET /api/v1/datasets/list`

List all uploaded datasets.

**Response 200:**

```json
{
  "datasets": [
    {
      "dataset_id": "uuid",
      "filename": "example.csv",
      "rows": 200,
      "columns": 5,
      "size_bytes": 4452,
      "upload_timestamp": "2026-02-28T...",
      "ext": "csv"
    }
  ],
  "total": 1
}
```

---

### `GET /api/v1/datasets/{dataset_id}/summary`

Return column-level statistics for a dataset.

**Response 200:**

```json
{
  "dataset_id": "uuid",
  "filename": "example.csv",
  "shape": [200, 5],
  "columns": [
    {
      "name": "src_port",
      "dtype": "int64",
      "null_count": 0,
      "null_pct": 0.0,
      "unique_count": 199,
      "sample_values": [1825, 1680, 489]
    }
  ],
  "memory_usage_mb": 0.008,
  "sample_rows": [...],
  "class_distribution": {"0": 101, "1": 99}
}
```

**Error:** `404 dataset_not_found`

---

### `GET /api/v1/datasets/{dataset_id}/introspect`

Auto-detect task type, suggested target column, and preprocessing recommendations.

**Response 200:**

```json
{
  "dataset_id": "uuid",
  "task_type": "classification",
  "suggested_target_column": "label",
  "target_column_confidence": 0.9,
  "categorical_features": [],
  "numerical_features": [
    {
      "name": "src_port",
      "mean": 4975.3,
      "std": 2758.9,
      "min": 43.0,
      "max": 9989.0
    }
  ],
  "high_null_columns": [],
  "class_imbalance_ratio": 1.02,
  "outlier_columns": [],
  "recommended_preprocessing": ["Apply MinMaxScaler for numerical features"]
}
```

---

### `DELETE /api/v1/datasets/{dataset_id}`

Delete a dataset and its files.

**Response 200:** `{"deleted": true, "dataset_id": "uuid"}`  
**Error:** `404 dataset_not_found`

---

## Models

### `GET /api/v1/models/list`

List trained and saved models.

**Response 200:**

```json
{
  "models": [
    {
      "model_id": "random_forest_20260228_005241_10cbb25f",
      "model_type": "random_forest",
      "accuracy": 0.8333,
      "created_at": "2026-02-28T..."
    }
  ],
  "total": 1,
  "available_model_types": ["random_forest", "xgboost"],
  "plugins": [...]
}
```

---

### `GET /api/v1/models/train/configs`

Return hyperparameter schema for each model type.

**Response 200:**

```json
{
  "configs": [
    {
      "plugin": "xai_ids",
      "model_type": "random_forest",
      "n_estimators": { "type": "int", "default": 100, "min": 10, "max": 500 },
      "max_depth": { "type": "int", "default": 10, "min": 2, "max": 30 }
    }
  ]
}
```

---

### `POST /api/v1/models/train`

Start a background training job.

**Request body:**

```json
{
  "dataset_id": "uuid",
  "target_column": "label",
  "model_type": "random_forest",
  "use_optuna": false,
  "hyperparameters": { "n_estimators": 100 },
  "test_size": 0.2,
  "random_state": 42
}
```

**Response 200:**

```json
{
  "task_id": "uuid",
  "status": "started",
  "estimated_duration_seconds": 120
}
```

**Errors:**

- `404 dataset_not_found`
- `409 training_in_progress` — another job is running
- `422 invalid_target_column` — column doesn't exist
- `422 invalid_model_type` — not in supported models

---

### `GET /api/v1/models/train/status`

Get status of the current (or last) training job.

**Response 200:**

```json
{
  "task_id": "uuid",
  "status": "RUNNING",
  "progress_pct": 50.0,
  "current_step": "Training model",
  "elapsed_seconds": 15.3,
  "estimated_remaining_seconds": 14.7,
  "error_message": null
}
```

Status values: `IDLE` | `RUNNING` | `COMPLETE` | `FAILED`

---

### `GET /api/v1/models/{model_id}/metrics`

Return evaluation metrics for a trained model.

**Response 200:**

```json
{
  "model_id": "random_forest_...",
  "accuracy": 0.8333,
  "f1_score": 0.834,
  "precision": 0.835,
  "recall": 0.8333,
  "roc_auc": 0.9012,
  "confusion_matrix": [[50, 2], [4, 44]],
  "roc_curve": {"fpr": [...], "tpr": [...]},
  "feature_importance": [{"feature": "duration", "importance": 0.34}],
  "classification_report": {...},
  "class_names": ["Normal", "Attack"]
}
```

NaN/Infinity values are sanitized to `null` in the response.

**Error:** `404 model_not_found`

---

### `POST /api/v1/models/{model_id}/load`

Load a model into memory for inference.

**Response 200:** `{"loaded": true, "model_id": "..."}`

---

### `DELETE /api/v1/models/{model_id}`

Delete a saved model.

**Response 200:** `{"deleted": true, "model_id": "..."}`

---

## Prediction

### `POST /api/v1/models/{model_id}/predict`

Run batch inference.

**Request body:**

```json
{
  "inputs": [
    { "src_port": 1234, "dst_port": 80, "pkt_size": 500, "duration": 1.2 }
  ]
}
```

**Response 200:**

```json
{
  "predictions": [
    {
      "input": {
        "src_port": 1234,
        "dst_port": 80,
        "pkt_size": 500,
        "duration": 1.2
      },
      "prediction": "Normal",
      "confidence": 0.87,
      "class_probabilities": { "Normal": 0.87, "Attack": 0.13 }
    }
  ],
  "model_id": "random_forest_...",
  "prediction_count": 1,
  "duration_ms": 3
}
```

**Errors:**

- `404 model_not_found`
- `422 missing_features` — input row missing required columns
- `409 model_not_loaded` — model must be loaded first

---

## XAI Explanations

### `POST /api/v1/models/{model_id}/explain`

Generate SHAP or LIME explanation for a single input.

**Request body:**

```json
{
  "input_row": {
    "src_port": 1234,
    "dst_port": 80,
    "pkt_size": 500,
    "duration": 1.2
  },
  "method": "shap",
  "max_display_features": 10
}
```

`method` options: `"shap"` | `"lime"` | `"both"`

**Response 200 (shap):**

```json
{
  "method_used": "shap",
  "shap": {
    "values": [{ "feature": "duration", "value": 1.2, "shap_value": 0.137 }],
    "base_value": 0.421,
    "prediction": "Normal",
    "prediction_confidence": 0.87
  }
}
```

---

## Experiments

### `GET /api/v1/experiments`

List all experiment runs.

### `GET /api/v1/experiments/{run_id}`

Get details for a specific experiment run.

---

## Error Response Format

All errors follow:

```json
{
  "error": "error_code",
  "message": "Human readable message",
  "<additional fields>": "..."
}
```

HTTP status codes used:

- `400` — validation error (bad input)
- `404` — resource not found
- `409` — conflict (e.g. training in progress)
- `413` — payload too large
- `422` — unprocessable entity
- `500` — unexpected server error

---

## WebSocket

### `WS /api/v1/models/train/ws`

Real-time training progress stream.

**Message types received:**

```json
{"event": "started", "data": {"task_id": "...", "model_type": "..."}}
{"event": "step", "data": {"step_name": "...", "progress_pct": 50.0}}
{"event": "metrics", "data": {"accuracy": 0.83}}
{"event": "log", "data": {"level": "INFO", "message": "..."}}
{"event": "complete", "data": {"model_id": "...", "final_metrics": {...}}}
{"event": "error", "data": {"error_type": "...", "message": "..."}}
{"event": "heartbeat", "data": {"timestamp": "..."}}
```
