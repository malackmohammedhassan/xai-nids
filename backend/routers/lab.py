"""
lab.py — Model Intelligence Lab backend router.

GET /api/v2/lab/compare/{model_a_id}/{model_b_id}
Aggregates full analytics profile for two models so the frontend
can render side-by-side dataset analysis, performance comparison,
feature distributions, and training pipeline diffs.
"""
from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException

from core.logger import get_logger
from services.model_registry import get_loaded_model, get_model_meta, get_model_metrics

router = APIRouter(prefix="/lab", tags=["Lab"])
logger = get_logger("lab")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe(v) -> Optional[float]:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def _compute_feature_stats(X: np.ndarray, feature_names: list[str]) -> dict:
    """Per-feature mean/std/min/max/skewness/kurtosis from training sample."""
    if X is None or len(X) == 0:
        return {}
    X = np.asarray(X, dtype=float)
    n_cols = min(X.shape[1], len(feature_names))
    stats: dict = {}
    for i in range(n_cols):
        col = X[:, i]
        col = col[~np.isnan(col)]
        if len(col) < 2:
            continue
        mean = float(np.mean(col))
        std = float(np.std(col, ddof=1))
        n = len(col)
        if std > 0:
            skew = float(np.mean(((col - mean) / std) ** 3))
            kurt = float(np.mean(((col - mean) / std) ** 4) - 3)
        else:
            skew, kurt = 0.0, 0.0
        stats[feature_names[i]] = {
            "mean": round(mean, 6),
            "std": round(std, 6),
            "min": round(float(np.min(col)), 6),
            "max": round(float(np.max(col)), 6),
            "skewness": round(skew, 4),
            "kurtosis": round(kurt, 4),
            "q25": round(float(np.percentile(col, 25)), 6),
            "q75": round(float(np.percentile(col, 75)), 6),
            "count": n,
        }
    return stats


def _compute_top_correlations(X: np.ndarray, feature_names: list[str], top_n: int = 15) -> list[dict]:
    """Top-N absolute pairwise feature correlations."""
    if X is None or len(X) < 3:
        return []
    try:
        X = np.asarray(X, dtype=float)
        n_cols = min(X.shape[1], len(feature_names))
        fn = feature_names[:n_cols]
        df = pd.DataFrame(X[:, :n_cols], columns=fn)
        corr = df.corr().fillna(0).abs()
        pairs: list[dict] = []
        for i in range(len(fn)):
            for j in range(i + 1, len(fn)):
                val = float(corr.iloc[i, j])
                if not np.isnan(val):
                    pairs.append({
                        "feature_a": fn[i],
                        "feature_b": fn[j],
                        "correlation": round(val, 4),
                    })
        pairs.sort(key=lambda x: x["correlation"], reverse=True)
        return pairs[:top_n]
    except Exception:
        return []


def _compute_feature_samples(X: np.ndarray, feature_names: list[str], max_features: int = 25, max_pts: int = 150) -> dict:
    """Downsampled raw value lists per feature for histogram rendering."""
    if X is None or len(X) == 0:
        return {}
    X = np.asarray(X, dtype=float)
    n_cols = min(X.shape[1], len(feature_names), max_features)
    result: dict = {}
    for i in range(n_cols):
        col = X[:, i]
        col = col[~np.isnan(col)]
        step = max(1, len(col) // max_pts)
        result[feature_names[i]] = [round(float(v), 6) for v in col[::step][:max_pts]]
    return result


def _class_dist_from_report(report: dict, class_names: list[str]) -> dict:
    """Extract per-class sample counts from classification_report support field."""
    if not report:
        return {}
    dist: dict = {}
    for cls in class_names:
        for key in [str(cls), cls.lower(), cls.upper()]:
            entry = report.get(key) or {}
            if isinstance(entry, dict) and "support" in entry:
                dist[str(cls)] = int(entry["support"])
                break
    return dist


def _normalise_roc(roc_curve) -> Optional[dict]:
    """Normalise roc_curve to {fpr: list, tpr: list} regardless of storage format."""
    if roc_curve is None:
        return None
    if isinstance(roc_curve, dict):
        fpr = roc_curve.get("fpr") or roc_curve.get("x") or []
        tpr = roc_curve.get("tpr") or roc_curve.get("y") or []
        if not fpr:
            return None
        return {"fpr": [round(float(v), 5) for v in fpr], "tpr": [round(float(v), 5) for v in tpr]}
    if isinstance(roc_curve, list) and roc_curve:
        if isinstance(roc_curve[0], (list, tuple)):
            return {
                "fpr": [round(float(p[0]), 5) for p in roc_curve],
                "tpr": [round(float(p[1]), 5) for p in roc_curve],
            }
    return None


def _normalise_importances(raw) -> Optional[dict]:
    """Normalise feature_importances to {name: value} dict."""
    if raw is None:
        return None
    if isinstance(raw, dict):
        return {k: round(float(v), 6) for k, v in raw.items()}
    if isinstance(raw, list):
        # list of {feature, importance} or list of floats
        if raw and isinstance(raw[0], dict):
            return {str(item.get("feature", i)): round(float(item.get("importance", 0)), 6)
                    for i, item in enumerate(raw)}
        return {str(i): round(float(v), 6) for i, v in enumerate(raw)}
    return None


def _profile_model(model_id: str) -> dict:
    meta = get_model_meta(model_id)
    if not meta:
        raise HTTPException(status_code=404, detail=f"Model {model_id!r} not found.")

    # full_metrics = {"metrics": {accuracy,precision,...}, "confusion_matrix": ...,
    #                 "roc_curve": ..., "classification_report": ..., "feature_importance": [...]}
    full_metrics: dict = get_model_metrics(model_id) or {}
    # Scalar metrics nested under "metrics" sub-key; fall back to top-level meta fields
    perf: dict = full_metrics.get("metrics") or {}

    class_names: list[str] = (
        meta.get("class_names")
        or ["Normal", "Attack"]
    )
    feature_names: list[str] = meta.get("feature_names") or []

    bundle = get_loaded_model(model_id)
    X_sample: Optional[np.ndarray] = None
    if bundle is not None:
        raw_X = bundle.get("X_train_sample")
        if raw_X is not None:
            X_sample = np.asarray(raw_X, dtype=float)

    feature_stats = _compute_feature_stats(X_sample, feature_names) if X_sample is not None else {}
    top_correlations = _compute_top_correlations(X_sample, feature_names) if X_sample is not None else []
    feature_samples = _compute_feature_samples(X_sample, feature_names) if X_sample is not None else {}
    class_distribution = _class_dist_from_report(
        full_metrics.get("classification_report"), class_names
    )

    return {
        "model_id": model_id,
        "model_type": meta.get("model_type", "unknown"),
        "dataset_id": meta.get("dataset_id"),
        "dataset_filename": meta.get("dataset_filename"),
        "feature_names": feature_names,
        "class_names": class_names,
        "hyperparameters": meta.get("hyperparameters") or {},
        "created_at": meta.get("created_at"),
        "feature_count": meta.get("feature_count") or len(feature_names),
        "is_loaded": bundle is not None,
        # Metrics — from perf sub-dict, with top-level meta as fallback
        "accuracy":  _safe(perf.get("accuracy")  or meta.get("accuracy")),
        "precision": _safe(perf.get("precision") or meta.get("precision")),
        "recall":    _safe(perf.get("recall")    or meta.get("recall")),
        "f1_score":  _safe(perf.get("f1_score")  or meta.get("f1_score")),
        "roc_auc":   _safe(perf.get("roc_auc")   or meta.get("roc_auc")),
        "confusion_matrix": full_metrics.get("confusion_matrix"),
        "roc_curve": _normalise_roc(full_metrics.get("roc_curve")),
        "classification_report": full_metrics.get("classification_report"),
        "feature_importances": _normalise_importances(
            full_metrics.get("feature_importances") or full_metrics.get("feature_importance")
        ),
        # Dataset / training-sample stats
        "sample_size": int(len(X_sample)) if X_sample is not None else 0,
        "feature_stats": feature_stats,
        "class_distribution": class_distribution,
        "top_correlations": top_correlations,
        "feature_samples": feature_samples,
    }


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/compare/{model_a_id}/{model_b_id}")
async def compare_models(model_a_id: str, model_b_id: str):
    """
    Full analytics profile for two model IDs side-by-side.
    Used by the Model Intelligence Lab frontend page.

    Both models must exist (be registered).  Load them via POST /models/{id}/load
    beforehand to unlock dataset-statistics derived from X_train_sample.
    """
    try:
        profile_a = _profile_model(model_a_id)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Lab: failed to profile model A %s", model_a_id)
        raise HTTPException(status_code=500, detail=f"Error profiling model A: {exc}") from exc

    try:
        profile_b = _profile_model(model_b_id)
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Lab: failed to profile model B %s", model_b_id)
        raise HTTPException(status_code=500, detail=f"Error profiling model B: {exc}") from exc

    set_a = set(profile_a["feature_names"])
    set_b = set(profile_b["feature_names"])

    def _delta(key: str) -> Optional[float]:
        a, b = profile_a.get(key), profile_b.get(key)
        return round(float(b) - float(a), 6) if a is not None and b is not None else None

    return {
        "model_a": profile_a,
        "model_b": profile_b,
        "shared_features": sorted(set_a & set_b),
        "only_in_a": sorted(set_a - set_b),
        "only_in_b": sorted(set_b - set_a),
        "metric_deltas": {
            "accuracy": _delta("accuracy"),
            "precision": _delta("precision"),
            "recall": _delta("recall"),
            "f1_score": _delta("f1_score"),
            "roc_auc": _delta("roc_auc"),
        },
    }
