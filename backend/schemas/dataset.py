"""Pydantic v2 schemas for dataset endpoints."""
from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class ColumnInfo(BaseModel):
    name: str
    dtype: str
    null_count: int
    null_pct: float
    unique_count: int
    sample_values: List[Any]


class UploadResponse(BaseModel):
    dataset_id: str
    filename: str
    rows: int
    columns: int
    size_bytes: int
    upload_timestamp: datetime


class DatasetMeta(BaseModel):
    dataset_id: str
    filename: str
    rows: int
    columns: int
    upload_timestamp: datetime


class DatasetSummary(BaseModel):
    dataset_id: str
    filename: str
    shape: List[int]  # [rows, cols]
    columns: List[ColumnInfo]
    memory_usage_mb: float
    sample_rows: List[dict]
    class_distribution: Optional[dict] = None


class NumericalFeature(BaseModel):
    name: str
    mean: float
    std: float
    min: float
    max: float


class CategoricalFeature(BaseModel):
    name: str
    unique_count: int


class HighNullColumn(BaseModel):
    name: str
    null_pct: float


class OutlierColumn(BaseModel):
    name: str
    outlier_count: int


class IntrospectResult(BaseModel):
    dataset_id: str
    task_type: str  # "classification" | "regression"
    suggested_target_column: str
    target_column_confidence: float
    categorical_features: List[CategoricalFeature]
    numerical_features: List[NumericalFeature]
    high_null_columns: List[HighNullColumn]
    class_imbalance_ratio: Optional[float] = None
    outlier_columns: List[OutlierColumn]
    recommended_preprocessing: List[str]


class DeleteDatasetResponse(BaseModel):
    deleted: bool
    dataset_id: str
