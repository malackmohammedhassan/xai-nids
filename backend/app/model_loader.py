import joblib
import numpy as np
from pathlib import Path
from typing import Any, Dict, Optional
from app.config import MODELS_DIR

_model_cache: Dict[str, Any] = {}


def _make_json_safe(obj):
    """Recursively convert non-JSON-serializable objects to plain Python types."""
    if isinstance(obj, dict):
        return {k: _make_json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_make_json_safe(i) for i in obj]
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, (np.bool_,)):
        return bool(obj)
    # sklearn objects (LabelEncoder etc.) → store their string representation
    if hasattr(obj, '__module__') and obj.__module__ and obj.__module__.startswith('sklearn'):
        cls_name = type(obj).__name__
        if hasattr(obj, 'classes_'):
            return {"_sklearn": cls_name, "classes_": obj.classes_.tolist()}
        return {"_sklearn": cls_name}
    return obj


def list_available_models() -> list:
    models = []
    for p in sorted(MODELS_DIR.glob("*.joblib")):
        meta_path = p.with_suffix(".meta")
        meta = {}
        if meta_path.exists():
            meta = joblib.load(meta_path)
        models.append({
            "id": p.stem,
            "filename": p.name,
            "meta": meta,
        })
    return models


def load_model(model_id: str) -> Any:
    if model_id in _model_cache:
        return _model_cache[model_id]
    path = MODELS_DIR / f"{model_id}.joblib"
    if not path.exists():
        raise FileNotFoundError(f"Model '{model_id}' not found at {path}")
    bundle = joblib.load(path)
    _model_cache[model_id] = bundle
    return bundle


def save_model(model_id: str, bundle: dict) -> Path:
    path = MODELS_DIR / f"{model_id}.joblib"
    meta_path = MODELS_DIR / f"{model_id}.meta"
    joblib.dump(bundle, path)
    # Strip non-serializable ML objects and store JSON-safe meta
    raw_meta = {k: v for k, v in bundle.items() if k not in ("model", "scaler", "selector")}
    meta = _make_json_safe(raw_meta)
    joblib.dump(meta, meta_path)
    _model_cache[model_id] = bundle
    return path


def delete_model(model_id: str) -> bool:
    path = MODELS_DIR / f"{model_id}.joblib"
    meta_path = MODELS_DIR / f"{model_id}.meta"
    if not path.exists():
        return False
    path.unlink()
    if meta_path.exists():
        meta_path.unlink()
    _model_cache.pop(model_id, None)
    return True


def get_model_meta(model_id: str) -> Optional[dict]:
    meta_path = MODELS_DIR / f"{model_id}.meta"
    if meta_path.exists():
        return joblib.load(meta_path)
    return None
