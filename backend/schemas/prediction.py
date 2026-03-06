"""Pydantic v2 schemas for prediction endpoints."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


MAX_PREDICT_BATCH = 1_000  # hard cap — prevents memory exhaustion on single request


class PredictRequest(BaseModel):
    inputs: List[Dict[str, Any]] = Field(..., min_length=1, max_length=MAX_PREDICT_BATCH)


class SinglePrediction(BaseModel):
    input: Dict[str, Any]
    prediction: Any
    confidence: Optional[float] = None
    class_probabilities: Optional[Dict[str, float]] = None


class PredictResponse(BaseModel):
    predictions: List[SinglePrediction]
    model_id: str
    prediction_count: int
    duration_ms: int
