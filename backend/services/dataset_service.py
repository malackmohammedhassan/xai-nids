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
from core.security import sanitize_filename, assert_within_base

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
    # ── Security: sanitize filename before any path operations ──────────────
    filename = sanitize_filename(filename)
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
            import csv as _csv
            # Detect duplicate column names from the raw header BEFORE pandas
            # renames them (pd.read_csv silently appends ".1", ".2", etc.).
            first_line = file_bytes.partition(b"\n")[0]
            # Handle CRLF
            first_line_str = first_line.rstrip(b"\r").decode("utf-8", errors="replace")
            raw_header = next(_csv.reader([first_line_str]), [])
            seen_h: set[str] = set()
            dup_h: list[str] = []
            for h in raw_header:
                if h in seen_h and h not in dup_h:
                    dup_h.append(h)
                seen_h.add(h)
            if dup_h:
                raise DatasetValidationError(
                    "Dataset contains duplicate column names",
                    error="duplicate_columns",
                    columns=dup_h,
                )
            df = pd.read_csv(pd.io.common.BytesIO(file_bytes))
        else:
            df = pd.read_parquet(pd.io.common.BytesIO(file_bytes))
    except DatasetValidationError:
        raise
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

    # ── Duplicate column names ───────────────────────────────────────────────
    col_list = df.columns.tolist()
    seen: set[str] = set()
    dup_cols: list[str] = []
    for c in col_list:
        if c in seen and c not in dup_cols:
            dup_cols.append(c)
        seen.add(c)
    if dup_cols:
        raise DatasetValidationError(
            "Dataset contains duplicate column names",
            error="duplicate_columns",
            columns=dup_cols,
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
    # ── Security: confirm write target is inside the upload directory ────────
    assert_within_base(_upload_dir(), data_path)
    data_path.write_bytes(file_bytes)

    # Also save as Parquet for fast future reads (5× faster than CSV)
    try:
        if ext == "csv":
            df.to_parquet(dest / f"{_DATA_FILE}.parquet", index=False)
    except Exception as exc:
        logger.warning("Parquet cache write failed (non-fatal)", extra={"error": str(exc)})

    # Detect suggested target column
    suggested_target = None
    keywords = ["label", "attack", "class", "target", "category", "anomaly", "intrusion"]
    for col in df.columns:
        if any(kw in col.lower() for kw in keywords):
            suggested_target = col
            break
    if not suggested_target:
        suggested_target = df.columns[-1]

    # Compute class distribution for the target
    class_distribution: dict = {}
    if suggested_target and suggested_target in df.columns:
        class_distribution = {str(k): int(v) for k, v in df[suggested_target].value_counts().items()}

    meta = {
        "dataset_id": dataset_id,
        "filename": filename,
        "rows": int(df.shape[0]),
        "columns": int(df.shape[1]),
        "size_bytes": size_bytes,
        "upload_timestamp": datetime.now(tz=timezone.utc).isoformat(),
        "ext": ext,
        "suggested_target": suggested_target,
        "class_distribution": class_distribution,
        "numeric_columns": df.select_dtypes(include="number").columns.tolist(),
        "categorical_columns": df.select_dtypes(include=["object", "category"]).columns.tolist(),
    }
    _meta_path(dataset_id).write_text(json.dumps(meta, indent=2), encoding="utf-8")
    logger.info("Dataset uploaded", extra={"dataset_id": dataset_id, "file_name": filename})
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
        col_entry: dict = {
            "name": col,
            "dtype": str(df[col].dtype),
            "null_count": int(df[col].isna().sum()),
            "null_pct": round(float(df[col].isna().mean() * 100), 2),
            "unique_count": int(df[col].nunique()),
            "sample_values": sample,
        }
        # Add numeric stats for numeric columns
        if pd.api.types.is_numeric_dtype(df[col]):
            numeric_series = pd.to_numeric(df[col], errors="coerce").dropna()
            if len(numeric_series) > 0:
                col_entry["mean"] = round(float(numeric_series.mean()), 4)
                col_entry["std"]  = round(float(numeric_series.std()), 4)
                col_entry["min"]  = round(float(numeric_series.min()), 4)
                col_entry["max"]  = round(float(numeric_series.max()), 4)
                col_entry["q25"]  = round(float(numeric_series.quantile(0.25)), 4)
                col_entry["q50"]  = round(float(numeric_series.quantile(0.50)), 4)
                col_entry["q75"]  = round(float(numeric_series.quantile(0.75)), 4)
        columns.append(col_entry)

    sample_rows = df.head(10).replace({np.nan: None}).to_dict(orient="records")
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
        "suggested_target": target or "",
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
