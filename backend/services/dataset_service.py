"""
Dataset I/O, validation, and introspection service.
No hardcoded column names or file paths — everything is dynamic.
"""
from __future__ import annotations

import json
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from core.config import get_settings
from core.exceptions import (
    DatasetNotFoundError,
    DatasetTooLargeError,
    DatasetValidationError,
)
from core.logger import get_logger

logger = get_logger("dataset_service")
_META_FILE = "meta.json"
_DATA_FILE = "data"


def _upload_dir() -> Path:
    p = Path(get_settings().dataset_upload_dir)
    p.mkdir(parents=True, exist_ok=True)
    return p


def _dataset_path(dataset_id: str) -> Path:
    return _upload_dir() / dataset_id


def _meta_path(dataset_id: str) -> Path:
    return _dataset_path(dataset_id) / _META_FILE


def _load_dataframe(dataset_id: str) -> pd.DataFrame:
    base = _dataset_path(dataset_id)
    if not base.exists():
        raise DatasetNotFoundError(f"Dataset {dataset_id} not found", dataset_id=dataset_id)
    for ext in ("csv", "parquet"):
        p = base / f"{_DATA_FILE}.{ext}"
        if p.exists():
            return pd.read_csv(p) if ext == "csv" else pd.read_parquet(p)
    raise DatasetNotFoundError(f"Data file missing for {dataset_id}", dataset_id=dataset_id)


def upload_dataset(file_bytes: bytes, filename: str) -> dict:
    settings = get_settings()
    ext = Path(filename).suffix.lower().lstrip(".")

    if ext not in ("csv", "parquet"):
        raise DatasetValidationError(
            "Invalid file type",
            error="invalid_file_type",
            received=ext,
            accepted=["csv", "parquet"],
        )

    size_bytes = len(file_bytes)
    max_bytes = settings.max_dataset_size_mb * 1024 * 1024
    if size_bytes > max_bytes:
        raise DatasetTooLargeError(
            "File too large",
            error="file_too_large",
            size_mb=round(size_bytes / 1024 / 1024, 2),
            max_mb=settings.max_dataset_size_mb,
        )

    try:
        if ext == "csv":
            df = pd.read_csv(pd.io.common.BytesIO(file_bytes))
        else:
            df = pd.read_parquet(pd.io.common.BytesIO(file_bytes))
    except Exception as exc:
        raise DatasetValidationError(f"Cannot parse file: {exc}", parse_error=str(exc)) from exc

    if df.shape[0] < 50:
        raise DatasetValidationError(
            "Dataset too small",
            error="dataset_too_small",
            rows=df.shape[0],
            min_rows=50,
        )
    if df.shape[1] < 2:
        raise DatasetValidationError(
            "Dataset must have at least 2 columns",
            error="too_few_columns",
            columns=df.shape[1],
        )

    null_cols = [c for c in df.columns if df[c].isna().all()]
    if null_cols:
        raise DatasetValidationError(
            "Dataset contains 100% null columns",
            error="null_column",
            columns=null_cols,
        )

    dataset_id = str(uuid.uuid4())
    dest = _dataset_path(dataset_id)
    dest.mkdir(parents=True, exist_ok=True)
    data_path = dest / f"{_DATA_FILE}.{ext}"
    data_path.write_bytes(file_bytes)

    meta = {
        "dataset_id": dataset_id,
        "filename": filename,
        "rows": int(df.shape[0]),
        "columns": int(df.shape[1]),
        "size_bytes": size_bytes,
        "upload_timestamp": datetime.now(tz=timezone.utc).isoformat(),
        "ext": ext,
    }
    _meta_path(dataset_id).write_text(json.dumps(meta, indent=2), encoding="utf-8")
    logger.info("Dataset uploaded", extra={"dataset_id": dataset_id, "filename": filename})
    return meta


def get_dataset_meta(dataset_id: str) -> dict:
    mp = _meta_path(dataset_id)
    if not mp.exists():
        raise DatasetNotFoundError(f"Dataset {dataset_id} not found", dataset_id=dataset_id)
    return json.loads(mp.read_text(encoding="utf-8"))


def list_datasets() -> list[dict]:
    base = _upload_dir()
    result = []
    for d in sorted(base.iterdir()):
        mp = d / _META_FILE
        if mp.exists():
            try:
                result.append(json.loads(mp.read_text(encoding="utf-8")))
            except Exception:
                pass
    return result


def get_dataset_summary(dataset_id: str) -> dict:
    meta = get_dataset_meta(dataset_id)
    df = _load_dataframe(dataset_id)

    columns = []
    for col in df.columns:
        sample = df[col].dropna().head(3).tolist()
        sample = [str(v) if not isinstance(v, (int, float, bool)) else v for v in sample]
        columns.append({
            "name": col,
            "dtype": str(df[col].dtype),
            "null_count": int(df[col].isna().sum()),
            "null_pct": round(float(df[col].isna().mean() * 100), 2),
            "unique_count": int(df[col].nunique()),
            "sample_values": sample,
        })

    sample_rows = df.head(5).replace({np.nan: None}).to_dict(orient="records")
    mem_mb = round(float(df.memory_usage(deep=True).sum()) / 1024 / 1024, 3)

    class_dist: Optional[dict] = None
    target = _detect_target_column(df)
    if target and df[target].dtype in (object, "category") or (
        target and df[target].nunique() <= 20
    ):
        class_dist = df[target].value_counts().to_dict()
        class_dist = {str(k): int(v) for k, v in class_dist.items()}

    return {
        "dataset_id": dataset_id,
        "filename": meta["filename"],
        "shape": [int(df.shape[0]), int(df.shape[1])],
        "columns": columns,
        "memory_usage_mb": mem_mb,
        "sample_rows": sample_rows,
        "class_distribution": class_dist,
    }


def _detect_target_column(df: pd.DataFrame) -> Optional[str]:
    """
    Heuristic: prefer columns with few unique values at the end of the dataframe.
    No hardcoded column names — purely structural.
    """
    # 1. Low-cardinality columns (<=20 unique, not float-like continuous)
    candidates = [
        c for c in df.columns
        if df[c].nunique() <= 20 and df[c].nunique() >= 2
    ]
    # 2. Prefer columns whose name sounds like a label (heuristic keyword list
    #    intentionally minimal — users can override via target_column in TrainRequest)
    label_hints = ["label", "target", "class", "attack", "category", "outcome", "y"]
    for hint in label_hints:
        for c in candidates:
            if hint in c.lower():
                return c
    # 3. Fall back to last low-cardinality column
    if candidates:
        return candidates[-1]
    # 4. Absolute fallback: last column
    return df.columns[-1] if len(df.columns) > 0 else None


def introspect_dataset(dataset_id: str) -> dict:
    df = _load_dataframe(dataset_id)

    suggested_target = _detect_target_column(df)
    confidence = 0.9 if suggested_target else 0.5

    num_unique_target = df[suggested_target].nunique() if suggested_target else 0
    task_type = "classification" if num_unique_target <= 20 else "regression"

    cat_features = []
    num_features = []
    features = [c for c in df.columns if c != suggested_target]

    for col in features:
        if df[col].dtype in ("object", "category") or df[col].nunique() <= 20:
            cat_features.append({"name": col, "unique_count": int(df[col].nunique())})
        else:
            col_data = pd.to_numeric(df[col], errors="coerce").dropna()
            if len(col_data) > 0:
                num_features.append({
                    "name": col,
                    "mean": round(float(col_data.mean()), 4),
                    "std": round(float(col_data.std()), 4),
                    "min": round(float(col_data.min()), 4),
                    "max": round(float(col_data.max()), 4),
                })

    high_null = [
        {"name": c, "null_pct": round(float(df[c].isna().mean() * 100), 2)}
        for c in df.columns
        if df[c].isna().mean() > 0.30
    ]

    imbalance_ratio: Optional[float] = None
    if task_type == "classification" and suggested_target:
        vc = df[suggested_target].value_counts()
        if len(vc) >= 2:
            imbalance_ratio = round(float(vc.iloc[0] / vc.iloc[-1]), 2)

    # IQR-based outlier detection
    outlier_cols = []
    for col in df.select_dtypes(include=[np.number]).columns:
        if col == suggested_target:
            continue
        q1 = df[col].quantile(0.25)
        q3 = df[col].quantile(0.75)
        iqr = q3 - q1
        n_outliers = int(((df[col] < q1 - 1.5 * iqr) | (df[col] > q3 + 1.5 * iqr)).sum())
        if n_outliers > 0:
            outlier_cols.append({"name": col, "outlier_count": n_outliers})

    recommendations = []
    if high_null:
        recommendations.append(f"Impute or drop {len(high_null)} high-null columns (>30% missing)")
    if imbalance_ratio and imbalance_ratio > 3:
        recommendations.append("Apply SMOTE or class-weight balancing — class imbalance detected")
    if outlier_cols:
        recommendations.append(f"Clip or investigate outliers in {len(outlier_cols)} columns")
    if cat_features:
        recommendations.append(f"Encode {len(cat_features)} categorical features (LabelEncoder / OneHot)")
    recommendations.append("Apply MinMaxScaler or StandardScaler for numerical features")
    recommendations.append("Use RFE or feature importance to select top features")

    return {
        "dataset_id": dataset_id,
        "task_type": task_type,
        "suggested_target_column": suggested_target or df.columns[-1],
        "target_column_confidence": confidence,
        "categorical_features": cat_features,
        "numerical_features": num_features,
        "high_null_columns": high_null,
        "class_imbalance_ratio": imbalance_ratio,
        "outlier_columns": outlier_cols,
        "recommended_preprocessing": recommendations,
    }


def delete_dataset(dataset_id: str) -> None:
    path = _dataset_path(dataset_id)
    if not path.exists():
        raise DatasetNotFoundError(f"Dataset {dataset_id} not found", dataset_id=dataset_id)
    shutil.rmtree(path)
    logger.info("Dataset deleted", extra={"dataset_id": dataset_id})
