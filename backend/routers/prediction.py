"""Prediction endpoint with feature validation."""
from __future__ import annotations

import time

from fastapi import APIRouter

from schemas.prediction import PredictRequest, PredictResponse, SinglePrediction
from services.model_registry import get_loaded_model

router = APIRouter()


@router.post("/models/{model_id}/predict", response_model=PredictResponse)
async def predict(model_id: str, req: PredictRequest):
    from core.exceptions import ModelNotLoadedError, FeatureMismatchError
    import numpy as np

    bundle = get_loaded_model(model_id)
    if bundle is None:
        raise ModelNotLoadedError(
            f"Model {model_id} is not loaded. Call POST /models/{model_id}/load first.",
            model_id=model_id,
        )

    feature_names = bundle["feature_names"]
    class_names = bundle["class_names"]

    # Feature validation
    if req.inputs:
        input_keys = set(req.inputs[0].keys())
        expected_keys = set(feature_names)
        missing = sorted(expected_keys - input_keys)
        extra = sorted(input_keys - expected_keys)
        if missing or extra:
            raise FeatureMismatchError(
                "Input features do not match model's trained features",
                expected=feature_names,
                received=sorted(input_keys),
                missing=missing,
                extra=extra,
            )

    # NaN validation
    nan_features = []
    for row in req.inputs:
        for f, v in row.items():
            if v is None or (isinstance(v, float) and np.isnan(v)):
                nan_features.append(f)
    if nan_features:
        from core.exceptions import DatasetValidationError
        raise DatasetValidationError(
            "Input contains NaN values",
            nan_features=list(set(nan_features)),
        )

    from plugins import get_plugin
    from core.config import get_settings
    plugin = get_plugin(get_settings().default_plugin)
    model = bundle["model"]

    t_start = time.perf_counter()
    raw_results = plugin.predict(model, req.inputs, feature_names)
    duration_ms = int((time.perf_counter() - t_start) * 1000)

    predictions = [
        SinglePrediction(
            input=r["input"],
            prediction=r["prediction"],
            confidence=r.get("confidence"),
            class_probabilities=r.get("class_probabilities"),
        )
        for r in raw_results
    ]

    return PredictResponse(
        predictions=predictions,
        model_id=model_id,
        prediction_count=len(predictions),
        duration_ms=duration_ms,
    )
