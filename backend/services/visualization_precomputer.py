"""
Visualization Precomputer — computes chart data for all visualization tiers.

All return values are JSON-serializable dicts consumed by the React frontend (Recharts).
No matplotlib / base64 images — the frontend owns rendering.

Tier 1 (<3s, pandas only):       missing_heatmap, null_pct, cardinality, skewness, dtype_breakdown
Tier 2 (<8s, scipy/sklearn):     histograms, boxplots, correlation, violin, mutual_info
Tier 3 (<20s, background jobs):  pca, tsne, umap, isolation_forest, pairplot, dendrogram
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from core.logger import get_logger
from services.compute_cache import cache_get, cache_set

logger = get_logger("visualization_precomputer")


# ─── Tier 1 — Fast (pandas only, no ML) ──────────────────────────────────────

def compute_tier1(df: pd.DataFrame, dataset_id: str) -> dict:
    """All Tier 1 visualizations in a single pass. Cached for 48h."""
    cached = cache_get(dataset_id, "tier1")
    if cached:
        return cached

    result = {
        "viz_type": "tier1",
        "dataset_id": dataset_id,
        "missing_heatmap": _missing_heatmap(df),
        "null_pct_bar": _null_pct_bar(df),
        "cardinality_bar": _cardinality_bar(df),
        "skewness_bar": _skewness_bar(df),
        "dtype_breakdown": _dtype_breakdown(df),
        "class_distribution": _class_distribution(df),
    }
    cache_set(dataset_id, "tier1", result)
    return result


def _missing_heatmap(df: pd.DataFrame) -> dict:
    """Grid of columns × sample rows showing null presence."""
    SAMPLE = min(200, len(df))
    sample = df.head(SAMPLE)
    columns = df.columns.tolist()
    # For each column: list of 0/1 (null=1) for sample rows
    rows_data = []
    for col in columns:
        null_mask = sample[col].isnull().tolist()
        rows_data.append({
            "column": col,
            "nulls": [1 if v else 0 for v in null_mask],
            "null_pct": round(df[col].isnull().mean() * 100, 1),
        })
    return {"columns": columns, "sample_size": SAMPLE, "data": rows_data}


def _null_pct_bar(df: pd.DataFrame) -> dict:
    """Sorted bar chart of null % per column."""
    data = [
        {"column": col, "null_pct": round(df[col].isnull().mean() * 100, 2)}
        for col in df.columns
    ]
    data = sorted(data, key=lambda x: -x["null_pct"])
    return {"data": data, "total_columns": len(data)}


def _cardinality_bar(df: pd.DataFrame) -> dict:
    """Bar chart of unique count per column."""
    data = [
        {
            "column": col,
            "unique_count": int(df[col].nunique()),
            "is_high_cardinality": df[col].nunique() > 50,
            "dtype": str(df[col].dtype),
        }
        for col in df.columns
    ]
    data = sorted(data, key=lambda x: -x["unique_count"])
    return {"data": data}


def _skewness_bar(df: pd.DataFrame) -> dict:
    """Skewness coefficient per numeric column."""
    numeric = df.select_dtypes(include=np.number)
    if numeric.empty:
        return {"data": []}
    data = [
        {
            "column": col,
            "skewness": round(float(numeric[col].skew()), 3),
            "severity": "high" if abs(float(numeric[col].skew())) > 2 else (
                "moderate" if abs(float(numeric[col].skew())) > 1 else "low"
            ),
        }
        for col in numeric.columns
        if not numeric[col].isna().all()
    ]
    data = sorted(data, key=lambda x: -abs(x["skewness"]))
    return {"data": data}


def _dtype_breakdown(df: pd.DataFrame) -> dict:
    numeric = df.select_dtypes(include=np.number)
    cat = df.select_dtypes(include=["object", "category"])
    bool_cols = df.select_dtypes(include=bool)
    other = len(df.columns) - len(numeric.columns) - len(cat.columns) - len(bool_cols.columns)
    return {
        "numeric": len(numeric.columns),
        "categorical": len(cat.columns),
        "boolean": len(bool_cols.columns),
        "other": max(0, other),
        "total": len(df.columns),
    }


def _class_distribution(df: pd.DataFrame) -> dict:
    """Detect target and return class counts."""
    keywords = ["label", "attack", "class", "target", "category", "anomaly"]
    target = None
    for col in df.columns:
        if any(kw in col.lower() for kw in keywords):
            target = col
            break
    if not target:
        target = df.columns[-1]
    if target not in df.columns:
        return {}
    counts = df[target].value_counts().to_dict()
    return {"target_column": target, "counts": {str(k): int(v) for k, v in counts.items()}}


# ─── Tier 2 — Standard (scipy/sklearn, on-demand, cached) ────────────────────

def compute_histograms(df: pd.DataFrame, dataset_id: str) -> dict:
    cached = cache_get(dataset_id, "histograms")
    if cached:
        return cached

    from scipy.stats import gaussian_kde  # lazy import

    numeric = df.select_dtypes(include=np.number)
    result_cols: dict = {}

    for col in numeric.columns:
        series = numeric[col].dropna()
        if len(series) < 5:
            continue
        try:
            counts, bin_edges = np.histogram(series, bins=min(50, max(10, len(series) // 50)))
            # KDE
            kde_x = np.linspace(float(series.min()), float(series.max()), 100)
            try:
                kde = gaussian_kde(series)
                kde_y = kde(kde_x).tolist()
            except Exception:
                kde_y = []

            result_cols[col] = {
                "bins": [round(float(e), 6) for e in bin_edges.tolist()],
                "counts": counts.tolist(),
                "kde_x": [round(float(x), 6) for x in kde_x.tolist()],
                "kde_y": [round(float(y), 6) for y in kde_y],
                "mean": round(float(series.mean()), 4),
                "std": round(float(series.std()), 4),
                "min": round(float(series.min()), 4),
                "max": round(float(series.max()), 4),
                "skew": round(float(series.skew()), 4),
                "count": int(len(series)),
            }
        except Exception as exc:
            logger.warning(f"Histogram error for {col}", extra={"error": str(exc)})

    result = {"viz_type": "histograms", "dataset_id": dataset_id, "columns": result_cols}
    cache_set(dataset_id, "histograms", result)
    return result


def compute_boxplots(df: pd.DataFrame, dataset_id: str) -> dict:
    cached = cache_get(dataset_id, "boxplots")
    if cached:
        return cached

    numeric = df.select_dtypes(include=np.number)
    data = []
    for col in numeric.columns:
        series = numeric[col].dropna()
        if len(series) < 5:
            continue
        q1, q2, q3 = np.percentile(series, [25, 50, 75])
        iqr = q3 - q1
        whisker_lo = float(series[series >= q1 - 1.5 * iqr].min()) if iqr > 0 else float(series.min())
        whisker_hi = float(series[series <= q3 + 1.5 * iqr].max()) if iqr > 0 else float(series.max())
        outliers = series[(series < whisker_lo) | (series > whisker_hi)].tolist()
        data.append({
            "column": col,
            "min": round(float(series.min()), 4),
            "q1": round(float(q1), 4),
            "median": round(float(q2), 4),
            "q3": round(float(q3), 4),
            "max": round(float(series.max()), 4),
            "whisker_lo": round(whisker_lo, 4),
            "whisker_hi": round(whisker_hi, 4),
            "outlier_count": len(outliers),
            "outlier_sample": [round(float(v), 4) for v in outliers[:20]],
        })

    result = {"viz_type": "boxplots", "dataset_id": dataset_id, "data": data}
    cache_set(dataset_id, "boxplots", result)
    return result


def compute_correlation(df: pd.DataFrame, dataset_id: str, max_cols: int = 30) -> dict:
    cached = cache_get(dataset_id, "correlation")
    if cached:
        return cached

    numeric = df.select_dtypes(include=np.number)
    if numeric.empty:
        result = {"viz_type": "correlation", "dataset_id": dataset_id, "columns": [], "matrix": [], "high_correlation_pairs": []}
        cache_set(dataset_id, "correlation", result)
        return result

    # Cap at top N by variance to avoid huge matrices
    if len(numeric.columns) > max_cols:
        top_cols = numeric.var().nlargest(max_cols).index.tolist()
        numeric = numeric[top_cols]

    corr = numeric.corr()
    columns = corr.columns.tolist()
    matrix = [[round(float(v), 4) if not np.isnan(v) else 0.0 for v in row] for row in corr.values]

    # Find highly correlated pairs (upper triangle, r > 0.8)
    high_pairs = []
    for i, col_a in enumerate(columns):
        for j, col_b in enumerate(columns):
            if j <= i:
                continue
            r = float(corr.iloc[i, j])
            if abs(r) >= 0.80:
                high_pairs.append({
                    "col_a": col_a,
                    "col_b": col_b,
                    "r": round(r, 4),
                    "strength": "very_high" if abs(r) >= 0.95 else "high",
                })
    high_pairs.sort(key=lambda x: -abs(x["r"]))

    result = {
        "viz_type": "correlation",
        "dataset_id": dataset_id,
        "columns": columns,
        "matrix": matrix,
        "high_correlation_pairs": high_pairs[:20],
        "truncated": len(df.select_dtypes(include=np.number).columns) > max_cols,
        "max_cols_shown": max_cols,
    }
    cache_set(dataset_id, "correlation", result)
    return result


def compute_mutual_info(df: pd.DataFrame, dataset_id: str, target: Optional[str] = None) -> dict:
    cached = cache_get(dataset_id, "mutual_info")
    if cached:
        return cached

    from sklearn.feature_selection import mutual_info_classif  # lazy import

    if not target:
        # Auto-detect
        keywords = ["label", "attack", "class", "target", "category"]
        for col in df.columns:
            if any(kw in col.lower() for kw in keywords):
                target = col
                break
        if not target:
            target = df.columns[-1]

    if target not in df.columns:
        result = {"viz_type": "mutual_info", "dataset_id": dataset_id, "data": [], "target_column": target}
        cache_set(dataset_id, "mutual_info", result)
        return result

    try:
        X = df.drop(columns=[target]).select_dtypes(include=np.number).fillna(0)
        y = df[target]
        # Encode target if object
        if y.dtype == object:
            from sklearn.preprocessing import LabelEncoder
            y = LabelEncoder().fit_transform(y.astype(str))

        mi = mutual_info_classif(X, y, random_state=42)
        data = [
            {"feature": col, "mi_score": round(float(score), 4)}
            for col, score in zip(X.columns, mi)
        ]
        data = sorted(data, key=lambda x: -x["mi_score"])
    except Exception as exc:
        logger.warning("Mutual info error", extra={"error": str(exc)})
        data = []

    result = {
        "viz_type": "mutual_info",
        "dataset_id": dataset_id,
        "target_column": str(target),
        "data": data,
    }
    cache_set(dataset_id, "mutual_info", result)
    return result


def compute_violin(df: pd.DataFrame, dataset_id: str, target: Optional[str] = None) -> dict:
    cached = cache_get(dataset_id, "violin")
    if cached:
        return cached

    if not target:
        keywords = ["label", "attack", "class", "target", "category"]
        for col in df.columns:
            if any(kw in col.lower() for kw in keywords):
                target = col
                break
        if not target:
            target = df.columns[-1]

    numeric = df.select_dtypes(include=np.number).columns.tolist()
    if target in numeric:
        numeric = [c for c in numeric if c != target]

    classes = df[target].unique().tolist() if target in df.columns else []
    top_features = numeric[:10]  # limit to top 10

    data = []
    for feat in top_features:
        series_by_class = []
        for cls in classes[:5]:  # limit to 5 classes
            vals = df[df[target] == cls][feat].dropna()
            if len(vals) < 5:
                continue
            q1, q2, q3 = np.percentile(vals, [25, 50, 75])
            series_by_class.append({
                "class": str(cls),
                "count": int(len(vals)),
                "mean": round(float(vals.mean()), 4),
                "median": round(float(q2), 4),
                "q1": round(float(q1), 4),
                "q3": round(float(q3), 4),
                "min": round(float(vals.min()), 4),
                "max": round(float(vals.max()), 4),
            })
        if series_by_class:
            data.append({"feature": feat, "classes": series_by_class})

    result = {
        "viz_type": "violin",
        "dataset_id": dataset_id,
        "target_column": str(target),
        "data": data,
    }
    cache_set(dataset_id, "violin", result)
    return result


# ─── Tier 3 — Advanced (background jobs, sklearn) ─────────────────────────────

def compute_pca(df: pd.DataFrame, dataset_id: str, target: Optional[str] = None, max_rows: int = 100_000) -> dict:
    """PCA 2D projection. Subsamples if df > max_rows."""
    from sklearn.decomposition import PCA
    from sklearn.preprocessing import StandardScaler, LabelEncoder

    if not target:
        keywords = ["label", "attack", "class", "target"]
        for col in df.columns:
            if any(kw in col.lower() for kw in keywords):
                target = col
                break

    numeric_cols = df.select_dtypes(include=np.number).columns.tolist()
    if target and target in numeric_cols:
        numeric_cols = [c for c in numeric_cols if c != target]

    if len(numeric_cols) < 2:
        raise ValueError("PCA requires at least 2 numeric features.")

    sample = df
    was_sampled = False
    if len(df) > max_rows:
        sample = df.sample(n=max_rows, random_state=42)
        was_sampled = True

    X = sample[numeric_cols].fillna(0)
    X_scaled = StandardScaler().fit_transform(X)

    pca = PCA(n_components=2, random_state=42)
    coords = pca.fit_transform(X_scaled)

    labels = ["unknown"] * len(sample)
    if target and target in sample.columns:
        labels = sample[target].astype(str).tolist()

    points = [
        {
            "x": round(float(coords[i, 0]), 4),
            "y": round(float(coords[i, 1]), 4),
            "label": labels[i],
        }
        for i in range(len(coords))
    ]

    return {
        "viz_type": "pca",
        "dataset_id": dataset_id,
        "points": points,
        "explained_variance": [round(float(v), 4) for v in pca.explained_variance_ratio_.tolist()],
        "components": 2,
        "was_sampled": was_sampled,
        "sample_size": len(sample),
        "feature_names": numeric_cols[:10],  # top features for legend
    }


def compute_tsne(df: pd.DataFrame, dataset_id: str, target: Optional[str] = None, max_rows: int = 5_000) -> dict:
    """t-SNE projection. Hard refusal above max_rows."""
    if len(df) > max_rows:
        raise ValueError(
            f"Dataset has {len(df):,} rows — t-SNE is limited to {max_rows:,} rows. "
            "Use PCA instead for larger datasets."
        )

    from sklearn.manifold import TSNE
    from sklearn.preprocessing import StandardScaler

    if not target:
        keywords = ["label", "attack", "class", "target"]
        for col in df.columns:
            if any(kw in col.lower() for kw in keywords):
                target = col
                break

    numeric_cols = df.select_dtypes(include=np.number).columns.tolist()
    if target and target in numeric_cols:
        numeric_cols = [c for c in numeric_cols if c != target]

    X = df[numeric_cols].fillna(0)
    X_scaled = StandardScaler().fit_transform(X)

    tsne = TSNE(n_components=2, random_state=42, perplexity=min(30, len(df) - 1))
    coords = tsne.fit_transform(X_scaled)

    labels = ["unknown"] * len(df)
    if target and target in df.columns:
        labels = df[target].astype(str).tolist()

    points = [
        {"x": round(float(coords[i, 0]), 4), "y": round(float(coords[i, 1]), 4), "label": labels[i]}
        for i in range(len(coords))
    ]

    return {
        "viz_type": "tsne",
        "dataset_id": dataset_id,
        "points": points,
        "sample_size": len(df),
    }


def compute_isolation_forest(df: pd.DataFrame, dataset_id: str, target: Optional[str] = None) -> dict:
    """Isolation Forest anomaly detection overlaid on PCA projection."""
    from sklearn.ensemble import IsolationForest
    from sklearn.decomposition import PCA
    from sklearn.preprocessing import StandardScaler

    if not target:
        keywords = ["label", "attack", "class", "target"]
        for col in df.columns:
            if any(kw in col.lower() for kw in keywords):
                target = col
                break

    numeric_cols = df.select_dtypes(include=np.number).columns.tolist()
    if target and target in numeric_cols:
        numeric_cols = [c for c in numeric_cols if c != target]

    sample_size = min(10_000, len(df))
    sample = df.sample(n=sample_size, random_state=42) if len(df) > sample_size else df

    X = sample[numeric_cols].fillna(0)
    X_scaled = StandardScaler().fit_transform(X)

    # Anomaly detection
    iso = IsolationForest(contamination=0.05, random_state=42, n_jobs=-1)
    predictions = iso.fit_predict(X_scaled)
    scores = iso.decision_function(X_scaled)

    # PCA for 2D projection
    pca = PCA(n_components=2, random_state=42)
    coords = pca.fit_transform(X_scaled)

    labels = ["unknown"] * len(sample)
    if target and target in sample.columns:
        labels = sample[target].astype(str).tolist()

    points = [
        {
            "x": round(float(coords[i, 0]), 4),
            "y": round(float(coords[i, 1]), 4),
            "label": labels[i],
            "is_anomaly": bool(predictions[i] == -1),
            "score": round(float(scores[i]), 4),
        }
        for i in range(len(coords))
    ]

    anomaly_count = int((predictions == -1).sum())
    return {
        "viz_type": "isolation_forest",
        "dataset_id": dataset_id,
        "points": points,
        "anomaly_count": anomaly_count,
        "anomaly_pct": round(anomaly_count / len(sample) * 100, 2),
        "sample_size": len(sample),
    }
