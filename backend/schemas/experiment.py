"""Pydantic v2 schemas for experiment tracking endpoints."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class ExperimentRecord(BaseModel):
    run_id: str
    timestamp: datetime
    model_type: str
    dataset_filename: str
    dataset_row_count: int
    hyperparameters: Dict[str, Any]
    accuracy: float
    f1_score: float
    precision: float
    recall: float
    training_duration_seconds: float
    roc_auc: Optional[float] = None
    confusion_matrix: Optional[List[List[int]]] = None


class ExperimentList(BaseModel):
    experiments: List[ExperimentRecord]
    total: int


class DeleteExperimentResponse(BaseModel):
    deleted: bool
    run_id: str
