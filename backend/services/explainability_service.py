"""
SHAP and LIME explainability service with SHAP_MAX_ROWS memory guard.
"""
from __future__ import annotations

import io
import base64
from typing import Any, Dict, List, Optional

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from core.config import get_settings
from core.exceptions import ExplainabilityOOMError, ModelNotFoundError
from core.logger import get_logger
from services.model_registry import get_loaded_model

logger = get_logger("explainability_service")


def _fig_to_b64(fig) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=100, bbox_inches="tight", facecolor="#111827")
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode()
    plt.close(fig)
    return f"data:image/png;base64,{b64}"


def _get_bundle(model_id: str) -> dict:
    bundle = get_loaded_model(model_id)
    if bundle is None:
        raise ModelNotFoundError(f"Model {model_id} is not loaded into memory", model_id=model_id)
    return bundle


def run_explanation(
    model_id: str,
    input_row: Dict[str, Any],
    method: str,
    max_display: int,
) -> dict:
    settings = get_settings()
    bundle = _get_bundle(model_id)
    model = bundle["model"]
    feature_names: List[str] = bundle["feature_names"]
    class_names: List[str] = bundle["class_names"]
    scaler = bundle["scaler"]
    selector = bundle.get("selector")
    original_columns: List[str] = bundle.get("original_columns", feature_names)

    # Build input dataframe aligned to expected features
    row_df = pd.DataFrame([input_row])
    for col in original_columns:
        if col not in row_df.columns:
            row_df[col] = 0
    row_df = row_df[[c for c in original_columns if c in row_df.columns]]

    from sklearn.preprocessing import LabelEncoder
    le_dict = bundle.get("le_dict", {})
    for col in row_df.select_dtypes(include=["object", "category"]).columns:
        if col in le_dict:
            le = le_dict[col]
            row_df[col] = row_df[col].astype(str).apply(
                lambda x: le.transform([x])[0] if x in le.classes_ else 0
            )
        else:
            row_df[col] = 0

    if scaler is not None:
        row_scaled = pd.DataFrame(scaler.transform(row_df), columns=row_df.columns)
    else:
        row_scaled = row_df.copy()
    if selector is not None:
        input_processed = row_scaled[feature_names]
    else:
        input_processed = row_scaled

    # ── Background data from training set (sampled) ────────────────────────
    # We use the scaler transform space; recreate a representative background
    # by generating a zero-filled background matrix (acceptable for TreeSHAP)
    n_bg = min(settings.shap_max_rows, 100)
    X_background = pd.DataFrame(
        np.zeros((n_bg, len(feature_names))), columns=feature_names
    )

    result: dict = {"method_used": method}
    sampled = False

    if method in ("shap", "both"):
        try:
            shap_result, sampled = _compute_shap(
                model, input_processed, X_background, feature_names,
                max_display, settings.shap_max_rows
            )
            result["shap"] = shap_result
        except MemoryError as exc:
            raise ExplainabilityOOMError("Out of memory during SHAP computation") from exc

    if method in ("lime", "both"):
        lime_result = _compute_lime(
            model, input_processed, X_background, feature_names, class_names, max_display
        )
        result["lime"] = lime_result

    if "shap" in result:
        result["shap"]["sampled_for_performance"] = sampled

    return result


def _compute_shap(
    model, input_row: pd.DataFrame, X_bg: pd.DataFrame,
    feature_names: List[str], max_display: int, shap_max_rows: int
) -> tuple[dict, bool]:
    import shap

    sampled = False
    bg = X_bg
    if len(bg) > shap_max_rows:
        bg = bg.sample(n=shap_max_rows, random_state=42)
        sampled = True
        logger.warning("SHAP background sampled for performance", extra={"sampled_rows": shap_max_rows})

    explainer = shap.TreeExplainer(model, bg)
    shap_values = explainer.shap_values(input_row)

    if isinstance(shap_values, list):
        sv = shap_values[1] if len(shap_values) > 1 else shap_values[0]
    else:
        sv = shap_values
    sv_flat = np.array(sv).flatten()

    expected_val = explainer.expected_value
    if isinstance(expected_val, (list, np.ndarray)):
        expected_val = float(expected_val[1]) if len(expected_val) > 1 else float(expected_val[0])
    else:
        expected_val = float(expected_val)

    values = [
        {
            "feature": feature_names[i],
            "value": round(float(input_row.iloc[0, i]), 6),
            "shap_value": round(float(sv_flat[i]), 6),
        }
        for i in range(min(len(feature_names), len(sv_flat)))
    ]
    values.sort(key=lambda x: abs(x["shap_value"]), reverse=True)
    values = values[:max_display]

    # Waterfall-style bar chart
    top_n = min(max_display, len(values))
    fig, ax = plt.subplots(figsize=(8, max(4, top_n * 0.5)))
    fig.patch.set_facecolor("#111827")
    ax.set_facecolor("#111827")
    feats = [v["feature"] for v in values[::-1]]
    shap_vals = [v["shap_value"] for v in values[::-1]]
    colors = ["#ef4444" if s > 0 else "#22c55e" for s in shap_vals]
    ax.barh(feats, shap_vals, color=colors)
    ax.axvline(0, color="white", linewidth=0.8)
    ax.set_xlabel("← More Normal  |  More Attack →", color="white")
    ax.set_title("Feature Contributions (SHAP)", color="white", fontsize=12)
    ax.tick_params(colors="white")
    for spine in ax.spines.values():
        spine.set_edgecolor("#4b5563")
    waterfall_b64 = _fig_to_b64(fig)

    # Summary dot plot (simple)
    fig2, ax2 = plt.subplots(figsize=(8, max(4, top_n * 0.5)))
    fig2.patch.set_facecolor("#111827")
    ax2.set_facecolor("#111827")
    abs_vals = [abs(v["shap_value"]) for v in values[::-1]]
    ax2.barh(feats, abs_vals, color="#60a5fa")
    ax2.set_xlabel("Mean |SHAP value|", color="white")
    ax2.set_title("Feature Importance (|SHAP|)", color="white", fontsize=12)
    ax2.tick_params(colors="white")
    for spine in ax2.spines.values():
        spine.set_edgecolor("#4b5563")
    summary_b64 = _fig_to_b64(fig2)

    return {
        "values": values,
        "force_plot_base64": waterfall_b64,
        "summary_plot_base64": summary_b64,
        "expected_value": expected_val,
    }, sampled


def _compute_lime(
    model, input_row: pd.DataFrame, X_bg: pd.DataFrame,
    feature_names: List[str], class_names: List[str], max_display: int
) -> dict:
    import lime.lime_tabular

    explainer = lime.lime_tabular.LimeTabularExplainer(
        training_data=X_bg.values,
        feature_names=feature_names,
        class_names=class_names,
        mode="classification",
        discretize_continuous=True,
        random_state=42,
    )

    instance = input_row.values[0]
    exp = explainer.explain_instance(
        instance,
        model.predict_proba,
        num_features=max_display,
        num_samples=500,
    )

    explanation = [
        {"feature_condition": feat, "weight": round(float(w), 6)}
        for feat, w in exp.as_list()
    ]
    probs = model.predict_proba(input_row)[0]
    pred_probs = {
        cn: round(float(probs[i]), 4)
        for i, cn in enumerate(class_names)
        if i < len(probs)
    }

    # LIME bar plot
    pos = [(f, w) for f, w in exp.as_list() if w > 0]
    neg = [(f, w) for f, w in exp.as_list() if w <= 0]

    fig, axes = plt.subplots(1, 2, figsize=(12, max(4, max_display * 0.4)))
    fig.patch.set_facecolor("#111827")
    for ax in axes:
        ax.set_facecolor("#111827")

    if pos:
        axes[0].barh([p[0] for p in pos], [p[1] for p in pos], color="#22c55e")
        axes[0].set_title("Supporting Evidence", color="white")
        axes[0].tick_params(colors="white")
    axes[0].set_facecolor("#111827")

    if neg:
        axes[1].barh([n[0] for n in neg], [abs(n[1]) for n in neg], color="#ef4444")
        axes[1].set_title("Opposing Evidence", color="white")
        axes[1].tick_params(colors="white")
    axes[1].set_facecolor("#111827")

    plt.tight_layout()
    plot_b64 = _fig_to_b64(fig)

    return {
        "explanation": explanation,
        "plot_base64": plot_b64,
        "prediction_probabilities": pred_probs,
        "local_fidelity": round(float(exp.score), 4),
    }
