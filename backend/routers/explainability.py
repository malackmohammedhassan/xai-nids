"""SHAP and LIME explainability endpoint."""
from __future__ import annotations

from fastapi import APIRouter

from schemas.explainability import ExplainRequest, ExplainResponse
from services.explainability_service import run_explanation

router = APIRouter()


@router.post("/models/{model_id}/explain")
async def explain(model_id: str, req: ExplainRequest):
    result = run_explanation(
        model_id=model_id,
        input_row=req.input_row,
        method=req.method,
        max_display=req.max_display_features,
    )
    return result
