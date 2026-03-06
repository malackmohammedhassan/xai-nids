"""
Validation Router
=================
POST /api/v1/models/{model_id}/validate

Accepts an uploaded CSV file (or JSON rows) of NEW, never-seen data and
runs the trained model against it, returning:
  - Per-row predictions
  - Aggregated confusion matrix
  - Classification report (precision / recall / F1 per class)
  - Accuracy, macro-F1, ROC-AUC (if a ground-truth label column is found)
  - Download-ready result CSV

Design rationale
----------------
The Evaluation page shows metrics on the SAME train/test split used during
training (the model has already implicitly "seen" that distribution).
Validation here uses COMPLETELY NEW data — the gold-standard check for
real-world generalisation.
"""
from __future__ import annotations

import io
import json
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from core.logger import get_logger
from services.model_registry import load_model, get_model_meta

router = APIRouter()
logger = get_logger("validation_router")


# ── Response schemas ──────────────────────────────────────────────────────────

class PredictionRow(BaseModel):
    row_index: int
    prediction: str
    confidence: Optional[float]
    probabilities: Optional[Dict[str, float]]
    true_label: Optional[str] = None
    correct: Optional[bool] = None


class ValidationSummary(BaseModel):
    model_id: str
    model_type: str
    total_rows: int
    has_labels: bool
    accuracy: Optional[float]
    f1_score: Optional[float]
    roc_auc: Optional[float]
    confusion_matrix: Optional[List[List[int]]]
    classification_report: Optional[str]
    class_names: List[str]
    predictions: List[PredictionRow]
    label_column_used: Optional[str]


# ── Helpers ───────────────────────────────────────────────────────────────────

_LABEL_CANDIDATES = ["label", "Label", "attack_cat", "class", "Class", "target",
                     "attack_category", "Attack_cat"]


def _detect_label(df: pd.DataFrame) -> Optional[str]:
    for c in _LABEL_CANDIDATES:
        if c in df.columns:
            return c
    return None


def _binary_encode(y: pd.Series) -> pd.Series:
    normal_vals = {"normal", "0", "benign", "0.0"}
    return y.astype(str).str.strip().str.lower().map(
        lambda v: 0 if v in normal_vals else 1
    ).astype(int)


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/models/{model_id}/validate", response_model=ValidationSummary)
async def validate_model(
    model_id: str,
    file: UploadFile = File(..., description="CSV file with feature columns (and optionally a label column)"),
    label_column: Optional[str] = Form(None, description="Name of the ground-truth label column, if present"),
    max_rows: int = Form(default=50_000, ge=1, le=500_000, description="Max rows to evaluate"),
):
    """
    Run a trained model against a new CSV dataset.

    - If the CSV contains a label/target column the response includes
      accuracy, F1, confusion matrix, and per-row correctness flags.
    - If there is no label column the response contains only predictions
      and confidence scores — still useful for exploratory testing.
    """
    # ── Load model ────────────────────────────────────────────────────────────
    try:
        meta = get_model_meta(model_id)
    except Exception:
        raise HTTPException(status_code=404, detail={
            "error": "model_not_found",
            "model_id": model_id,
            "message": f"No trained model found with ID '{model_id}'. Train a model first.",
        })

    try:
        bundle = load_model(model_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail={
            "error": "model_load_failed",
            "message": f"Model found in registry but could not be loaded: {exc}",
        })

    model        = bundle["model"]
    feature_names = bundle.get("feature_names", meta.get("feature_names", []))
    scaler        = bundle.get("scaler")
    selector      = bundle.get("selector")
    le_dict       = bundle.get("le_dict", {})
    original_cols = bundle.get("original_columns", feature_names)
    class_names   = bundle.get("class_names", ["Normal", "Attack"])
    model_type    = bundle.get("model_type", meta.get("model_type", "unknown"))

    # ── Read uploaded CSV ─────────────────────────────────────────────────────
    content = await file.read()
    if not content:
        raise HTTPException(status_code=422, detail={
            "error": "empty_file",
            "message": "The uploaded file is empty.",
        })

    try:
        df_raw = pd.read_csv(io.BytesIO(content))
    except Exception as exc:
        raise HTTPException(status_code=422, detail={
            "error": "invalid_csv",
            "message": f"Could not parse CSV: {exc}. Check that the file is valid CSV.",
        })

    if df_raw.empty:
        raise HTTPException(status_code=422, detail={
            "error": "empty_dataset",
            "message": "The CSV file has no data rows.",
        })

    # Limit rows
    df_raw = df_raw.head(max_rows)

    # ── Detect / extract label column ─────────────────────────────────────────
    label_col  = label_column or _detect_label(df_raw)
    has_labels = label_col is not None and label_col in df_raw.columns

    y_true_raw = None
    if has_labels:
        y_true_raw = df_raw[label_col].copy()

    # Drop label + any other non-feature columns
    drop_cols = [c for c in _LABEL_CANDIDATES if c in df_raw.columns]
    if label_col and label_col not in drop_cols:
        drop_cols.append(label_col)
    df_features = df_raw.drop(columns=drop_cols, errors="ignore").copy()

    # ── Validate feature alignment ────────────────────────────────────────────
    if df_features.empty:
        raise HTTPException(status_code=422, detail={
            "error": "no_feature_columns",
            "message": (
                "After removing label columns, no feature columns remain. "
                f"The model expects these features: {feature_names[:10]}…"
            ),
        })

    # Warn about missing features — fill with 0 so we can still score
    missing_features = [f for f in feature_names if f not in df_features.columns]
    if len(missing_features) == len(feature_names):
        raise HTTPException(status_code=422, detail={
            "error": "feature_mismatch",
            "message": (
                f"None of the model's features were found in the uploaded CSV. "
                f"Model expects: {feature_names[:5]}… "
                f"CSV has: {df_features.columns.tolist()[:5]}…"
            ),
        })

    # ── Apply same preprocessing the model used ───────────────────────────────
    try:
        from app.preprocessing import preprocess_input  # type: ignore
        X_processed = preprocess_input(df_features, bundle)
    except Exception:
        # Fallback: manual alignment
        df_work = df_features.copy()
        df_work.replace([np.inf, -np.inf], np.nan, inplace=True)
        df_work.fillna(0, inplace=True)

        # Encode categoricals using stored label encoders
        for col in df_work.select_dtypes(include=["object", "category"]).columns:
            if col in le_dict:
                le = le_dict[col]
                df_work[col] = df_work[col].astype(str).apply(
                    lambda x: le.transform([x])[0] if x in le.classes_ else 0
                )
            else:
                from sklearn.preprocessing import LabelEncoder
                df_work[col] = LabelEncoder().fit_transform(df_work[col].astype(str))

        # Align shape to original columns
        for col in original_cols:
            if col not in df_work.columns:
                df_work[col] = 0
        df_work = df_work[[c for c in original_cols if c in df_work.columns]]

        # Scale
        if scaler is not None:
            try:
                df_work = pd.DataFrame(scaler.transform(df_work), columns=df_work.columns)
            except Exception:
                pass

        # Select features
        for f in feature_names:
            if f not in df_work.columns:
                df_work[f] = 0
        X_processed = df_work[feature_names]

    # Final safety fill
    X_processed = X_processed.fillna(0).replace([np.inf, -np.inf], 0)

    # ── Run predictions ───────────────────────────────────────────────────────
    try:
        raw_preds = model.predict(X_processed)
        proba = model.predict_proba(X_processed) if hasattr(model, "predict_proba") else None
    except Exception as exc:
        raise HTTPException(status_code=500, detail={
            "error": "prediction_failed",
            "message": f"Model prediction raised an error: {exc}",
        })

    # ── Build per-row results ─────────────────────────────────────────────────
    # Encode ground truth to integer for comparison
    y_true_int = None
    if has_labels and y_true_raw is not None:
        normal_vals = {"normal", "0", "benign", "0.0"}
        y_true_int = (
            y_true_raw.astype(str).str.strip().str.lower()
            .map(lambda v: 0 if v in normal_vals else 1)
            .values
        )

    prediction_rows: List[PredictionRow] = []
    for i in range(len(raw_preds)):
        idx       = int(raw_preds[i])
        pred_label = class_names[idx] if idx < len(class_names) else str(idx)
        confidence = None
        prob_dict: Dict[str, float] = {}

        if proba is not None:
            confidence = round(float(np.max(proba[i])), 4)
            for j, cn in enumerate(class_names):
                if j < proba.shape[1]:
                    prob_dict[cn] = round(float(proba[i][j]), 4)

        true_label = None
        correct    = None
        if y_true_raw is not None and i < len(y_true_raw):
            true_label = str(y_true_raw.iloc[i])
            if y_true_int is not None:
                correct = bool(y_true_int[i] == int(raw_preds[i]))

        prediction_rows.append(PredictionRow(
            row_index   = i,
            prediction  = pred_label,
            confidence  = confidence,
            probabilities = prob_dict if prob_dict else None,
            true_label  = true_label,
            correct     = correct,
        ))

    # ── Compute metrics (only if we have labels) ──────────────────────────────
    accuracy        = None
    f1_score_val    = None
    roc_auc_val     = None
    conf_matrix     = None
    clf_report      = None

    if has_labels and y_true_int is not None and len(y_true_int) > 0:
        from sklearn.metrics import (
            accuracy_score,
            f1_score,
            confusion_matrix,
            classification_report,
            roc_auc_score,
        )

        y_pred_int = raw_preds.astype(int)

        try:
            accuracy = round(float(accuracy_score(y_true_int, y_pred_int)), 4)
        except Exception:
            pass

        try:
            f1_score_val = round(float(f1_score(y_true_int, y_pred_int, average="weighted", zero_division=0)), 4)
        except Exception:
            pass

        try:
            if proba is not None and proba.shape[1] > 1:
                roc_auc_val = round(float(roc_auc_score(y_true_int, proba[:, 1])), 4)
        except Exception:
            pass

        try:
            cm = confusion_matrix(y_true_int, y_pred_int)
            conf_matrix = cm.tolist()
        except Exception:
            pass

        try:
            target_names = class_names[:len(np.unique(y_true_int))]
            clf_report = classification_report(
                y_true_int, y_pred_int,
                target_names=target_names,
                zero_division=0,
            )
        except Exception:
            pass

    return ValidationSummary(
        model_id             = model_id,
        model_type           = model_type,
        total_rows           = len(df_raw),
        has_labels           = has_labels,
        accuracy             = accuracy,
        f1_score             = f1_score_val,
        roc_auc              = roc_auc_val,
        confusion_matrix     = conf_matrix,
        classification_report = clf_report,
        class_names          = class_names,
        predictions          = prediction_rows,
        label_column_used    = label_col if has_labels else None,
    )


@router.get("/models/{model_id}/validate/download")
async def download_validation_results(model_id: str, results: str = ""):
    """
    Placeholder — actual CSV download is handled on the frontend
    by serialising the ValidationSummary JSON into a Blob.
    """
    raise HTTPException(status_code=501, detail="Use the frontend Export button to download CSV results.")
