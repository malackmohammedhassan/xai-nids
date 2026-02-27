"""Pydantic v2 schemas for model metrics endpoints."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class FeatureImportanceItem(BaseModel):
    feature: str
    importance: float


class ROCData(BaseModel):
    fpr: List[float]
    tpr: List[float]
    thresholds: List[float]


class PerClassMetrics(BaseModel):
    precision: float
    recall: float
    f1_score: float
    support: int


class ModelMetrics(BaseModel):
    accuracy: float
    f1_score: float
    precision: float
    recall: float
    roc_auc: Optional[float] = None
    confusion_matrix: List[List[int]]
    roc_curve: Optional[ROCData] = None
    classification_report: Optional[Dict[str, Any]] = None
    feature_importance: List[FeatureImportanceItem]


class ModelInfo(BaseModel):
    model_id: str
    model_type: str
    run_id: str
    created_at: str
    dataset_filename: Optional[str] = None
    accuracy: Optional[float] = None
    f1_score: Optional[float] = None
    hyperparameters: Optional[Dict[str, Any]] = None
    feature_count: Optional[int] = None
    is_loaded: bool = False


class LoadModelResponse(BaseModel):
    loaded: bool
    model_id: str


class DeleteModelResponse(BaseModel):
    deleted: bool
    model_id: str
