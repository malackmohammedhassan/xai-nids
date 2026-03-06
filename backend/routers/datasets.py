"""Dataset upload, summary, introspection, delete endpoints."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, UploadFile, File, Request
from fastapi.responses import JSONResponse

from schemas.dataset import (
    UploadResponse, DatasetSummary, IntrospectResult,
    DeleteDatasetResponse, DatasetMeta,
)
from services import dataset_service

router = APIRouter()


@router.post("/datasets/upload", response_model=UploadResponse)
async def upload_dataset(request: Request, file: UploadFile = File(...)):
    content = await file.read()
    meta = dataset_service.upload_dataset(content, file.filename or "upload.csv")
    from datetime import datetime
    return UploadResponse(
        dataset_id=meta["dataset_id"],
        filename=meta["filename"],
        rows=meta["rows"],
        columns=meta["columns"],
        size_bytes=meta["size_bytes"],
        upload_timestamp=datetime.fromisoformat(meta["upload_timestamp"]),
    )


@router.get("/datasets/list")
async def list_datasets():
    items = dataset_service.list_datasets()
    normalized = [
        {
            "dataset_id": d.get("dataset_id"),
            "filename": d.get("filename"),
            "row_count": d.get("row_count", d.get("rows", 0)),
            "column_count": d.get("column_count", d.get("columns", 0)),
            "size_bytes": d.get("size_bytes", 0),
            "uploaded_at": d.get("uploaded_at", d.get("upload_timestamp", "")),
        }
        for d in items
    ]
    return {"datasets": normalized, "total": len(normalized)}


@router.get("/datasets/{dataset_id}/summary")
async def dataset_summary(dataset_id: str):
    summary = dataset_service.get_dataset_summary(dataset_id)
    meta = dataset_service.get_dataset_meta(dataset_id)
    shape = summary.get("shape", [0, 0])
    # Normalise field names to match the frontend DatasetSummary interface
    return {
        **summary,
        "row_count": summary.get("row_count", shape[0] if shape else 0),
        "column_count": summary.get("column_count", shape[1] if len(shape) > 1 else 0),
        "size_bytes": summary.get("size_bytes", meta.get("size_bytes", 0)),
        "uploaded_at": summary.get("uploaded_at", meta.get("uploaded_at", meta.get("upload_timestamp", ""))),
    }


@router.get("/datasets/{dataset_id}/introspect")
async def introspect_dataset(dataset_id: str):
    raw = dataset_service.introspect_dataset(dataset_id)
    df_meta = dataset_service.get_dataset_meta(dataset_id)

    # Normalize task_type to match frontend enum
    raw_task = raw.get("task_type", "regression")
    num_unique = 0
    try:
        import pandas as pd
        from pathlib import Path
        from core.config import get_settings
        # reuse already-computed data if available; otherwise just map
        pass
    except Exception:
        pass
    if raw_task == "regression":
        task_type = "regression"
    elif raw_task == "classification":
        # Distinguish binary vs multiclass from categorical features
        cat = raw.get("categorical_features", [])
        suggested = raw.get("suggested_target_column", "")
        # Best effort: use high_null, outlier counts, etc — default binary
        task_type = "binary_classification"
    else:
        task_type = raw_task

    # categorical_features is list of {name, unique_count} — extract names
    cat_raw = raw.get("categorical_features", [])
    cat_names = [c["name"] if isinstance(c, dict) else c for c in cat_raw]
    high_card = [c["name"] if isinstance(c, dict) else c
                 for c in cat_raw
                 if isinstance(c, dict) and c.get("unique_count", 0) > 20]

    # numerical_features is list of {name, mean, ...} — extract names
    num_raw = raw.get("numerical_features", [])
    num_names = [n["name"] if isinstance(n, dict) else n for n in num_raw]

    # outlier_columns: [{name, outlier_count}] -> {name: count}
    outlier_counts = {
        o["name"]: o["outlier_count"]
        for o in raw.get("outlier_columns", [])
        if isinstance(o, dict)
    }

    # target_classes: get unique values of suggested target column (up to 50)
    suggested = raw.get("suggested_target_column", "")
    target_classes: list = []
    if suggested:
        try:
            import pandas as pd
            df = dataset_service._load_dataframe(dataset_id)
            if suggested in df.columns:
                vc = df[suggested].value_counts()
                target_classes = [str(k) for k in vc.index.tolist()[:50]]
        except Exception:
            pass

    return {
        "dataset_id": raw.get("dataset_id", dataset_id),
        "task_type": task_type,
        "suggested_target": suggested,
        "target_classes": target_classes,
        "numeric_features": num_names,
        "categorical_features": cat_names,
        "high_cardinality_features": high_card,
        "outlier_counts": outlier_counts,
        "class_imbalance_ratio": raw.get("class_imbalance_ratio"),
        "recommended_preprocessing": raw.get("recommended_preprocessing", []),
    }



@router.get("/datasets/compare", tags=["Datasets"])
async def compare_datasets(a: str, b: str):
    """Statistical drift comparison between two datasets (PSI / KL / KS).

    Query params: ?a=<dataset_id_a>&b=<dataset_id_b>

    PSI < 0.1 → stable | 0.1-0.25 → moderate | >0.25 → significant
    KS p < 0.05 → statistically significant distribution shift
    """
    import asyncio
    from concurrent.futures import ThreadPoolExecutor

    def _compute() -> dict:
        import numpy as np
        try:
            from scipy.stats import ks_2samp, entropy as kl_entropy
        except ImportError:
            raise HTTPException(status_code=500, detail="scipy not installed")

        df_a = dataset_service._load_dataframe(a)
        df_b = dataset_service._load_dataframe(b)

        def _psi(expected: np.ndarray, actual: np.ndarray, buckets: int = 10) -> float:
            eps = 1e-8
            mn = min(expected.min(), actual.min())
            mx = max(expected.max(), actual.max())
            if mx == mn:
                return 0.0
            edges = np.linspace(mn, mx, buckets + 1)
            exp_c, _ = np.histogram(expected, bins=edges)
            act_c, _ = np.histogram(actual, bins=edges)
            ep = np.where(exp_c / (len(expected) + eps) == 0, eps, exp_c / (len(expected) + eps))
            ap = np.where(act_c / (len(actual) + eps) == 0, eps, act_c / (len(actual) + eps))
            return float(np.sum((ap - ep) * np.log(ap / ep)))

        def _severity(v: float, thresholds=(0.1, 0.25)) -> str:
            return "stable" if v < thresholds[0] else ("moderate" if v < thresholds[1] else "significant")

        all_cols = sorted(set(df_a.columns) | set(df_b.columns))
        results: dict = {}

        for col in all_cols:
            col_a = df_a[col].dropna() if col in df_a.columns else None
            col_b = df_b[col].dropna() if col in df_b.columns else None
            np_a = df_a[col].isna().sum() / max(len(df_a), 1) * 100 if col in df_a.columns else None
            np_b = df_b[col].isna().sum() / max(len(df_b), 1) * 100 if col in df_b.columns else None

            entry: dict = {
                "null_pct_a": round(np_a, 2) if np_a is not None else None,
                "null_pct_b": round(np_b, 2) if np_b is not None else None,
                "null_delta_pp": round(np_b - np_a, 2) if np_a is not None and np_b is not None else None,
            }

            if col_a is not None and col_b is not None and len(col_a) > 1 and len(col_b) > 1:
                if np.issubdtype(col_a.dtype, np.number) and np.issubdtype(col_b.dtype, np.number):
                    aa, ab = col_a.to_numpy(float), col_b.to_numpy(float)
                    psi_v = _psi(aa, ab)
                    ks_s, ks_p = ks_2samp(aa, ab)
                    entry.update({
                        "psi": round(psi_v, 4),
                        "psi_severity": _severity(psi_v),
                        "ks_statistic": round(float(ks_s), 4),
                        "ks_p_value": round(float(ks_p), 4),
                        "ks_significant": bool(ks_p < 0.05),
                        "mean_a": round(float(aa.mean()), 4),
                        "mean_b": round(float(ab.mean()), 4),
                        "mean_delta": round(float(ab.mean() - aa.mean()), 4),
                    })
                else:
                    eps = 1e-8
                    cats = sorted(set(col_a.unique()) | set(col_b.unique()))
                    p = np.array([col_a.value_counts().get(c, 0) / max(len(col_a), 1) + eps for c in cats])
                    q = np.array([col_b.value_counts().get(c, 0) / max(len(col_b), 1) + eps for c in cats])
                    kl_v = float(kl_entropy(p, q))
                    entry.update({"kl_divergence": round(kl_v, 4), "kl_severity": _severity(kl_v, (0.1, 0.5))})
            results[col] = entry

        num_cols = [c for c, v in results.items() if "psi" in v]
        return {
            "dataset_a": a, "dataset_b": b,
            "row_count_a": len(df_a), "row_count_b": len(df_b),
            "columns": results,
            "summary": {
                "total_columns": len(results),
                "numeric_columns": len(num_cols),
                "high_psi_drift_columns": [c for c in num_cols if results[c].get("psi_severity") == "significant"],
                "ks_significant_columns": [c for c in num_cols if results[c].get("ks_significant")],
                "overall_drift_score": round(sum(results[c].get("psi", 0) for c in num_cols) / max(len(num_cols), 1), 4),
            },
        }

    try:
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor(max_workers=1) as ex:
            return await loop.run_in_executor(ex, _compute)
    except HTTPException:
        raise
    except Exception as exc:
        if "not found" in str(exc).lower():
            raise HTTPException(status_code=404, detail=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/datasets/{dataset_id}/rows")
async def get_dataset_rows(
    dataset_id: str,
    page: int = 0,
    per_page: int = 100,
    row_index: int | None = None,
):
    """Return raw rows from the dataset for the Prediction / Explainability row-sampler UI.

    - ``row_index`` — return a single row by 0-based index.
    - ``page`` / ``per_page`` — paginate over all rows (default page=0, per_page=100).

    Response::

        {
          "total": 182000,
          "page": 0,
          "per_page": 100,
          "rows": [
            {"row_index": 0, "data": {"dur": 0.0, "proto": 6, ...}},
            ...
          ]
        }
    """
    import asyncio
    from concurrent.futures import ThreadPoolExecutor
    from typing import Optional as _Opt

    def _compute():
        df = dataset_service._load_dataframe(dataset_id)
        total = len(df)

        def _row_to_dict(row):
            """Convert a pandas Series to a plain Python dict (no numpy scalars)."""
            return {
                k: (v.item() if hasattr(v, "item") else (None if (isinstance(v, float) and (v != v)) else v))
                for k, v in row.items()
            }

        if row_index is not None:
            if row_index < 0 or row_index >= total:
                raise ValueError(f"row_index {row_index} is out of range [0, {total - 1}]")
            return {
                "total": total,
                "page": 0,
                "per_page": 1,
                "rows": [{"row_index": row_index, "data": _row_to_dict(df.iloc[row_index])}],
            }

        start = page * per_page
        end = min(start + per_page, total)
        rows = [
            {"row_index": start + i, "data": _row_to_dict(df.iloc[start + i])}
            for i in range(end - start)
        ]
        return {"total": total, "page": page, "per_page": per_page, "rows": rows}

    try:
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor(max_workers=1) as ex:
            return await loop.run_in_executor(ex, _compute)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        if "not found" in str(exc).lower():
            raise HTTPException(status_code=404, detail=str(exc))
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/datasets/{dataset_id}")
async def dataset_meta(dataset_id: str):
    return dataset_service.get_dataset_meta(dataset_id)


@router.delete("/datasets/{dataset_id}", response_model=DeleteDatasetResponse)
async def delete_dataset(dataset_id: str):
    dataset_service.delete_dataset(dataset_id)
    return DeleteDatasetResponse(deleted=True, dataset_id=dataset_id)
