"""
SHAP and LIME explainability service — production-grade, per-sample accurate.

Key design decisions
──────────────────────────────────────────────────────────────────────────────
1. Background data: MinMaxScaler maps every feature to [0,1].  We generate a
   uniform random background in that same [0,1] space instead of all-zeros.
   All-zeros → zero variance → LIME perturbation distribution is degenerate →
   identical explanations for every input.  Uniform background represents the
   full realised feature range and is the minimal correct fix without
   requiring a stored training sample.

2. LIME num_samples=2000, kernel_width auto-tuned to √features × 0.75.
   More samples → better local linear approximation → higher fidelity.

3. SHAP TreeExplainer with the uniform background gives an average-over-
   background expected_value instead of f(zeros), which matches the textbook
   base-rate interpretation.

4. Both charts annotate actual feature values so the audience can see
   *why* a specific sample is Attack or Normal, not just abstract weights.
"""
from __future__ import annotations

import io
import base64
import re
from typing import Any, Dict, List, Optional

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
import pandas as pd

from core.config import get_settings
from core.exceptions import ExplainabilityOOMError, ModelNotFoundError
from core.logger import get_logger
from services.model_registry import get_loaded_model, load_model

logger = get_logger("explainability_service")


def _fig_to_b64(fig) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=110, bbox_inches="tight", facecolor="#111827")
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode()
    plt.close(fig)
    return f"data:image/png;base64,{b64}"


def _build_background(feature_names: List[str], n_rows: int, bundle: dict) -> pd.DataFrame:
    """Return a representative background DataFrame in *scaled* feature space.

    Priority:
    1. X_train_sample stored in bundle (best — actual training distribution).
    2. Uniform U[0,1] sampling — valid because MinMaxScaler always maps to [0,1].
       This guarantees non-zero variance for every feature so LIME perturbations
       are meaningful and SHAP base value reflects the full feature range.
    """
    stored = bundle.get("X_train_sample")
    if stored is not None:
        try:
            df_bg = pd.DataFrame(stored, columns=feature_names)
            if len(df_bg) > n_rows:
                df_bg = df_bg.sample(n=n_rows, random_state=42)
            return df_bg
        except Exception:
            pass  # fall through to uniform

    rng = np.random.default_rng(42)
    data = rng.uniform(0.0, 1.0, (n_rows, len(feature_names)))
    return pd.DataFrame(data, columns=feature_names)


def _get_bundle(model_id: str) -> dict:
    if get_loaded_model(model_id) is None:
        try:
            load_model(model_id)
        except Exception as exc:
            raise ModelNotFoundError(
                f"Model {model_id} is not loaded and could not be loaded from disk",
                model_id=model_id,
            ) from exc
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

    # ── Background — uniform U[0,1] in MinMaxScaler output space ──────────────
    n_bg = min(settings.shap_max_rows, 200)
    X_background = _build_background(feature_names, n_bg, bundle)

    import time as _time
    t0 = _time.perf_counter()
    result: dict = {"method_used": method}
    sampled = False

    if method in ("shap", "both"):
        try:
            shap_result, sampled = _compute_shap(
                model, input_processed, X_background, feature_names, class_names,
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

    result["method"] = method
    result["model_id"] = model_id
    result["computation_time_ms"] = round((_time.perf_counter() - t0) * 1000, 2)

    # ── Normalise SHAP to match frontend SHAPResult type ──────────────────────
    if "shap" in result:
        s = result["shap"]
        shap_values_dict = {v["feature"]: v["shap_value"] for v in s.get("values", [])}
        s["shap_values"] = shap_values_dict
        s["base_value"] = s.get("expected_value", 0.0)
        # Use prediction_label if available, otherwise fall back to model.predict
        if "prediction_label" not in s:
            pred_raw = model.predict(input_processed)[0]
            s["prediction_label"] = class_names[int(pred_raw)] if int(pred_raw) < len(class_names) else str(pred_raw)
        s["prediction"] = s["prediction_label"]
        s["waterfall_chart_b64"] = s.get("force_plot_base64", "").replace("data:image/png;base64,", "")
        s["summary_chart_b64"] = s.get("summary_plot_base64", "").replace("data:image/png;base64,", "")

    # ── Normalise LIME to match frontend LIMEResult type ─────────────────────
    if "lime" in result:
        lm = result["lime"]
        lm["feature_weights"] = {item["feature_condition"]: item["weight"] for item in lm.get("explanation", [])}
        pp = lm.get("prediction_probabilities", {})
        lm["prediction_proba"] = list(pp.values())
        lm["intercept"] = lm.get("fidelity_score", lm.get("local_fidelity", 0.0))
        lm["explanation_chart_b64"] = lm.get("plot_base64", "").replace("data:image/png;base64,", "")

    return result


def _compute_shap(
    model, input_row: pd.DataFrame, X_bg: pd.DataFrame,
    feature_names: List[str], class_names: List[str],
    max_display: int, shap_max_rows: int
) -> tuple[dict, bool]:
    """Compute per-sample SHAP values with rich context for visualisation.

    Returns (result_dict, sampled_flag).
    """
    import shap

    sampled = False
    bg = X_bg
    if len(bg) > shap_max_rows:
        bg = bg.sample(n=shap_max_rows, random_state=42)
        sampled = True
        logger.warning("SHAP background sampled for performance", extra={"sampled_rows": shap_max_rows})

    explainer = shap.TreeExplainer(model, bg)
    shap_values = explainer.shap_values(input_row)

    # Prefer class-1 (Attack) for binary; otherwise use first class
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

    # Model's actual probability for attack class
    proba = model.predict_proba(input_row)[0]
    attack_prob = float(proba[1]) if len(proba) > 1 else float(proba[0])
    normal_prob = float(proba[0]) if len(proba) > 1 else 1.0 - attack_prob
    pred_class_idx = int(np.argmax(proba))
    prediction_label = class_names[pred_class_idx] if pred_class_idx < len(class_names) else str(pred_class_idx)

    # Build per-feature value list
    total_abs = float(np.sum(np.abs(sv_flat))) or 1.0
    values = [
        {
            "feature": feature_names[i],
            "value": round(float(input_row.iloc[0, i]), 6),
            "shap_value": round(float(sv_flat[i]), 6),
            "pct_contribution": round(abs(float(sv_flat[i])) / total_abs * 100, 1),
        }
        for i in range(min(len(feature_names), len(sv_flat)))
    ]
    values.sort(key=lambda x: abs(x["shap_value"]), reverse=True)
    display_values = values[:max_display]

    # Cumulative waterfall data: sorted by shap_value ASC so chart reads
    # "biggest opposing" at top, "biggest supporting" at bottom
    wf_items = sorted(display_values, key=lambda x: x["shap_value"])
    running = expected_val
    cumulative_waterfall = []
    for item in wf_items:
        start = running
        running = running + item["shap_value"]
        cumulative_waterfall.append({
            "feature": item["feature"],
            "value": item["value"],
            "shap_value": item["shap_value"],
            "start": round(start, 6),
            "end": round(running, 6),
            "pct_contribution": item["pct_contribution"],
        })

    # ── Chart 1: Rich horizontal bar chart with actual values ─────────────────
    top_n = len(display_values)
    sorted_for_chart = sorted(display_values, key=lambda x: x["shap_value"])  # low → high
    fig, ax = plt.subplots(figsize=(11, max(5, top_n * 0.52 + 2)))
    fig.patch.set_facecolor("#111827")
    ax.set_facecolor("#111827")

    y_pos = np.arange(top_n)
    feat_labels = [
        f"{v['feature'][:28]}…" if len(v['feature']) > 28 else v['feature']
        for v in sorted_for_chart
    ]
    shap_vals = [v["shap_value"] for v in sorted_for_chart]
    bar_colors = ["#ef4444" if s > 0 else "#22d3ee" for s in shap_vals]

    bars = ax.barh(y_pos, shap_vals, color=bar_colors, height=0.62, alpha=0.92)
    ax.axvline(0, color="white", linewidth=0.9, alpha=0.7)

    # Annotate each bar with shap value + actual feature value
    for bar, item in zip(bars, sorted_for_chart):
        w = bar.get_width()
        x_anno = w + (0.003 if w >= 0 else -0.003)
        ha = "left" if w >= 0 else "right"
        ax.text(
            x_anno, bar.get_y() + bar.get_height() / 2,
            f"{item['shap_value']:+.4f}  (val={item['value']:.3f}, {item['pct_contribution']:.0f}%)",
            va="center", ha=ha, color="#d1fae5" if w < 0 else "#fecaca",
            fontsize=7.5, fontweight="medium",
        )

    ax.set_yticks(y_pos)
    ax.set_yticklabels(feat_labels, fontsize=8.5, color="#e5e7eb")
    ax.set_xlabel("← Toward Normal  |  SHAP Contribution  |  Toward Attack →",
                  color="#9ca3af", fontsize=9)
    ax.set_title(
        f"SHAP Feature Contributions\n"
        f"Prediction: {prediction_label}  |  "
        f"Attack: {attack_prob*100:.1f}%  |  Normal: {normal_prob*100:.1f}%  |  "
        f"Base value: {expected_val:.4f}",
        color="white", fontsize=10, pad=10,
    )
    ax.tick_params(colors="#9ca3af", labelsize=8)
    for spine in ax.spines.values():
        spine.set_edgecolor("#374151")

    # Add legend patches
    red_patch = mpatches.Patch(color="#ef4444", label="→ Pushes toward Attack")
    cyan_patch = mpatches.Patch(color="#22d3ee", label="← Pushes toward Normal")
    ax.legend(handles=[red_patch, cyan_patch], loc="lower right",
              fontsize=8, facecolor="#1f2937", edgecolor="#374151", labelcolor="white")

    plt.tight_layout(pad=1.2)
    waterfall_b64 = _fig_to_b64(fig)

    # ── Chart 2: Waterfall (cumulative step chart) ────────────────────────────
    # Shows base → each feature's nudge → final probability
    wf_display = sorted(display_values, key=lambda x: x["shap_value"])
    n_wf = len(wf_display)
    fig2, ax2 = plt.subplots(figsize=(11, max(5, (n_wf + 2) * 0.55)))
    fig2.patch.set_facecolor("#111827")
    ax2.set_facecolor("#111827")

    row_labels = (
        ["E[f(X)] (base)"]
        + [f"{v['feature'][:26]}…" if len(v['feature']) > 26 else v['feature'] for v in wf_display]
        + ["f(x) (final)"]
    )
    starts_wf = []
    widths_wf = []
    colors_wf = []
    run2 = expected_val
    starts_wf.append(0.0)
    widths_wf.append(expected_val)
    colors_wf.append("#6b7280")  # base = grey
    for v in wf_display:
        starts_wf.append(run2 if v["shap_value"] >= 0 else run2 + v["shap_value"])
        widths_wf.append(abs(v["shap_value"]))
        colors_wf.append("#ef4444" if v["shap_value"] > 0 else "#22d3ee")
        run2 += v["shap_value"]
    starts_wf.append(0.0)
    widths_wf.append(run2)
    colors_wf.append("#f59e0b")  # final = amber

    y2 = np.arange(len(row_labels))
    ax2.barh(y2, widths_wf, left=starts_wf, color=colors_wf, height=0.62, alpha=0.9)
    ax2.axvline(0.5, color="#fbbf24", linewidth=1.4, linestyle="--", alpha=0.55,
                label="Decision threshold (0.5)")
    ax2.set_yticks(y2)
    ax2.set_yticklabels(row_labels, fontsize=8.5, color="#e5e7eb")
    ax2.set_xlabel("Model Output Score", color="#9ca3af", fontsize=9)
    ax2.set_title(
        f"SHAP Cumulative Waterfall\n"
        f"Base: {expected_val:.4f} → Final: {run2:.4f} → Prediction: {prediction_label}",
        color="white", fontsize=10, pad=10,
    )
    ax2.tick_params(colors="#9ca3af", labelsize=8)
    for spine in ax2.spines.values():
        spine.set_edgecolor("#374151")
    base_p = mpatches.Patch(color="#6b7280", label="Base value (average)")
    att_p = mpatches.Patch(color="#ef4444", label="Pushes toward Attack")
    nrm_p = mpatches.Patch(color="#22d3ee", label="Pushes toward Normal")
    fin_p = mpatches.Patch(color="#f59e0b", label="Final score")
    ax2.legend(handles=[base_p, att_p, nrm_p, fin_p], loc="lower right",
               fontsize=7.5, facecolor="#1f2937", edgecolor="#374151", labelcolor="white")
    plt.tight_layout(pad=1.2)
    summary_b64 = _fig_to_b64(fig2)

    return {
        "values": display_values,
        "cumulative_waterfall": cumulative_waterfall,
        "force_plot_base64": waterfall_b64,
        "summary_plot_base64": summary_b64,
        "expected_value": expected_val,
        "prediction_label": prediction_label,
        "prediction_probability": round(attack_prob, 4),
        "class_probabilities": {
            cn: round(float(proba[i]), 4)
            for i, cn in enumerate(class_names)
            if i < len(proba)
        },
    }, sampled


def _compute_lime(
    model, input_row: pd.DataFrame, X_bg: pd.DataFrame,
    feature_names: List[str], class_names: List[str], max_display: int
) -> dict:
    """LIME local explanation — per-sample accurate with rich feature context.

    Uses a U[0,1] background (MinMaxScaler space) to ensure non-degenerate
    perturbation sampling; each call is therefore unique per input.
    """
    import lime.lime_tabular

    # Kernel width: LIME's default is √features × 0.75 — optimal for tabular
    kernel_width = 0.75 * float(np.sqrt(len(feature_names)))

    explainer = lime.lime_tabular.LimeTabularExplainer(
        training_data=X_bg.values,
        feature_names=feature_names,
        class_names=class_names,
        mode="classification",
        discretize_continuous=True,
        kernel_width=kernel_width,
        random_state=42,
    )

    instance = input_row.values[0]
    exp = explainer.explain_instance(
        instance,
        model.predict_proba,
        num_features=max_display,
        num_samples=2000,          # More samples → better local linear fit
        labels=(0, 1) if len(class_names) > 1 else (0,),
    )

    # ── Parse LIME condition strings into structured feature details ──────────
    # LIME returns conditions like:
    #   "src_bytes <= 0.12"  |  "0.05 < rate <= 0.30"  |  "service > 2.50"
    # We extract the feature name to look up the actual input value.
    def _parse_feature_name(condition: str) -> str:
        """Extract feature name from LIME condition string."""
        m = re.search(r'(?<![<>=!.\d])\b([A-Za-z_][A-Za-z0-9_.]*)\b', condition)
        return m.group(1) if m else condition.split(" ")[0]

    feature_details = []
    for condition, weight in exp.as_list():
        fname = _parse_feature_name(condition)
        if fname in input_row.columns:
            actual_val: Optional[float] = round(float(input_row[fname].iloc[0]), 6)
        else:
            actual_val = None

        direction = "toward_attack" if weight > 0 else "toward_normal"
        feature_details.append({
            "condition": condition,
            "feature_name": fname,
            "actual_value": actual_val,
            "weight": round(float(weight), 6),
            "direction": direction,
        })

    explanation = [
        {"feature_condition": fd["condition"], "weight": fd["weight"]}
        for fd in feature_details
    ]

    # Use the *actual model* probabilities so prediction is always consistent
    actual_proba = model.predict_proba(input_row)[0]
    pred_probs = {
        cn: round(float(actual_proba[i]), 4)
        for i, cn in enumerate(class_names)
        if i < len(actual_proba)
    }
    attack_idx = 1 if len(class_names) > 1 else 0
    attack_prob = float(actual_proba[attack_idx])
    normal_prob = float(actual_proba[0]) if attack_idx == 1 else 1.0 - attack_prob
    prediction_label = "Attack" if attack_prob >= 0.5 else "Normal"

    # Fidelity = R² of local linear model on the neighbourhood
    fidelity = round(float(exp.score), 4)

    # ── Chart: rich signed bar chart with annotation ──────────────────────────
    sorted_items = sorted(feature_details, key=lambda x: x["weight"])
    n_items = len(sorted_items)

    fig, ax = plt.subplots(figsize=(11, max(5, n_items * 0.52 + 2.5)))
    fig.patch.set_facecolor("#111827")
    ax.set_facecolor("#111827")

    y_pos = np.arange(n_items)
    cond_labels = [
        (f"{d['condition'][:36]}…" if len(d['condition']) > 36 else d['condition'])
        for d in sorted_items
    ]
    weights = [d["weight"] for d in sorted_items]
    bar_colors = ["#ef4444" if w > 0 else "#22d3ee" for w in weights]

    bars = ax.barh(y_pos, weights, color=bar_colors, height=0.62, alpha=0.9)
    ax.axvline(0, color="white", linewidth=0.9, alpha=0.7)

    for bar, detail in zip(bars, sorted_items):
        w = bar.get_width()
        x_anno = w + (0.002 if w >= 0 else -0.002)
        ha = "left" if w >= 0 else "right"
        val_str = f"val={detail['actual_value']:.3f}" if detail["actual_value"] is not None else ""
        ax.text(
            x_anno, bar.get_y() + bar.get_height() / 2,
            f"{detail['weight']:+.4f}  {val_str}",
            va="center", ha=ha,
            color="#fecaca" if w > 0 else "#a7f3d0",
            fontsize=7.5, fontweight="medium",
        )

    ax.set_yticks(y_pos)
    ax.set_yticklabels(cond_labels, fontsize=8, color="#e5e7eb")
    ax.set_xlabel("← Toward Normal  |  LIME Weight  |  Toward Attack →",
                  color="#9ca3af", fontsize=9)

    fidelity_badge = f"Local Fidelity R²={fidelity:.3f}"
    if fidelity >= 0.85:
        fidelity_badge += " ✓ High"
    elif fidelity >= 0.60:
        fidelity_badge += " ~ Moderate"
    else:
        fidelity_badge += " ⚠ Low"

    ax.set_title(
        f"LIME Local Explanation\n"
        f"Prediction: {prediction_label}  |  "
        f"Attack: {attack_prob*100:.1f}%  |  Normal: {normal_prob*100:.1f}%  |  {fidelity_badge}",
        color="white", fontsize=10, pad=10,
    )
    ax.tick_params(colors="#9ca3af", labelsize=8)
    for spine in ax.spines.values():
        spine.set_edgecolor("#374151")

    red_p = mpatches.Patch(color="#ef4444", label="Supports Attack prediction")
    cyan_p = mpatches.Patch(color="#22d3ee", label="Supports Normal prediction")
    ax.legend(handles=[red_p, cyan_p], loc="lower right",
              fontsize=8, facecolor="#1f2937", edgecolor="#374151", labelcolor="white")

    ax.text(
        0.99, 0.01, fidelity_badge,
        transform=ax.transAxes, ha="right", va="bottom",
        color="#9ca3af", fontsize=8,
        bbox=dict(boxstyle="round,pad=0.3", facecolor="#1f2937", alpha=0.85),
    )

    plt.tight_layout(pad=1.2)
    plot_b64 = _fig_to_b64(fig)

    return {
        "explanation": explanation,
        "feature_details": feature_details,
        "plot_base64": plot_b64,
        "prediction_probabilities": pred_probs,
        "prediction_label": prediction_label,
        "fidelity_score": fidelity,
        "local_fidelity": fidelity,
    }
