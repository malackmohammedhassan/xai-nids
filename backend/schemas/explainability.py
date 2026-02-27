"""Pydantic v2 schemas for explainability endpoints."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SHAPFeatureValue(BaseModel):
    feature: str
    value: float
    shap_value: float


class SHAPResult(BaseModel):
    values: List[SHAPFeatureValue]
    force_plot_base64: Optional[str] = None
    summary_plot_base64: Optional[str] = None
    expected_value: float
    sampled_for_performance: bool = False


class LIMEFeatureWeight(BaseModel):
    feature_condition: str
    weight: float


class LIMEResult(BaseModel):
    explanation: List[LIMEFeatureWeight]
    plot_base64: Optional[str] = None
    prediction_probabilities: Dict[str, float]
    local_fidelity: float


class ExplainRequest(BaseModel):
    input_row: Dict[str, Any]
    method: str = Field(default="both", pattern="^(shap|lime|both)$")
    max_display_features: int = Field(default=10, ge=1, le=50)


class ExplainResponse(BaseModel):
    method_used: str
    shap: Optional[SHAPResult] = None
    lime: Optional[LIMEResult] = None
