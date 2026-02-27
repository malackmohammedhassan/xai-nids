"""Pydantic v2 schemas for training endpoints."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, field_validator


class TrainingStatus(str, Enum):
    IDLE = "IDLE"
    RUNNING = "RUNNING"
    COMPLETE = "COMPLETE"
    FAILED = "FAILED"


class TrainRequest(BaseModel):
    dataset_id: str
    target_column: str
    model_type: str
    hyperparameters: Dict[str, Any] = Field(default_factory=dict)
    test_size: float = Field(default=0.2, ge=0.1, le=0.4)
    random_state: int = Field(default=42, ge=0)

    @field_validator("test_size")
    @classmethod
    def validate_test_size(cls, v: float) -> float:
        if not (0.1 <= v <= 0.4):
            raise ValueError("test_size must be between 0.1 and 0.4")
        return v


class TrainStarted(BaseModel):
    task_id: str
    status: str = "started"
    estimated_duration_seconds: Optional[int] = None


class TrainStatusResponse(BaseModel):
    task_id: Optional[str]
    status: TrainingStatus
    progress_pct: float = 0.0
    current_step: Optional[str] = None
    elapsed_seconds: Optional[float] = None
    estimated_remaining_seconds: Optional[float] = None
    error_message: Optional[str] = None


class TrainStreamEvent(BaseModel):
    event: str
    data: Dict[str, Any]
