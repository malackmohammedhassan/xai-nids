"""
XAI-IDS Plugin — implements BaseMLPlugin using xai-nids/backend/app/ logic.
sys.path injection reads ML_CORE_PATH from environment — never hardcoded.
"""
from __future__ import annotations

import os
import sys
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from core.logger import get_logger
from plugins.base_plugin import BaseMLPlugin

logger = get_logger("xai_ids_plugin")

# ── sys.path injection — ML_CORE_PATH from .env ───────────────────────────────
# We point directly at xai-nids/backend/app which has all the real implementations.
# ML_CORE_PATH can also point to xai-intrusion-detection-system/src if that
# project's stubs are eventually implemented.
_APP_PATH = os.path.join(os.path.dirname(__file__), "..", "app")
_APP_PATH = os.path.normpath(_APP_PATH)
if _APP_PATH not in sys.path:
    sys.path.insert(0, _APP_PATH)

# Also honour ML_CORE_PATH env var if set (for xai-intrusion-detection-system)
_ML_CORE = os.getenv("ML_CORE_PATH", "")
if _ML_CORE and _ML_CORE not in sys.path:
    sys.path.insert(0, os.path.normpath(_ML_CORE))

try:
    from preprocessing import preprocess_dataset, preprocess_input  # type: ignore
    from training import train_model  # type: ignore
    from evaluation import evaluate_model  # type: ignore
    import shap as _shap  # type: ignore
    import lime.lime_tabular as _lime_tab  # type: ignore
    _IMPORTS_OK = True
except ImportError as _import_err:
    _IMPORTS_OK = False
    logger.error("Plugin import failed", extra={"error": str(_import_err)})


class XAIIDSPlugin(BaseMLPlugin):
    plugin_name = "xai_ids"
    plugin_version = "2.0.0"
    supported_models = ["random_forest", "xgboost"]

    def __init__(self) -> None:
        if not _IMPORTS_OK:
            raise RuntimeError(
                f"XAIIDSPlugin failed to import dependencies. "
                f"Ensure xai-nids/backend/app/ is accessible."
            )

    # ── Model config ──────────────────────────────────────────────────────────

    def get_model_config(self, model_type: str) -> Dict[str, Any]:
        configs: Dict[str, Dict[str, Any]] = {
            "random_forest": {
                "n_estimators": {"type": "int", "default": 100, "min": 10, "max": 500, "description": "Number of trees"},
                "max_depth": {"type": "int", "default": 10, "min": 2, "max": 30, "description": "Max tree depth"},
                "min_samples_split": {"type": "int", "default": 2, "min": 2, "max": 20, "description": "Min samples to split node"},
                "min_samples_leaf": {"type": "int", "default": 1, "min": 1, "max": 10, "description": "Min samples in leaf"},
                "max_features": {"type": "categorical", "default": "sqrt", "options": ["sqrt", "log2"], "description": "Features per split"},
            },
            "xgboost": {
                "n_estimators": {"type": "int", "default": 100, "min": 10, "max": 500, "description": "Number of boosting rounds"},
                "max_depth": {"type": "int", "default": 6, "min": 2, "max": 15, "description": "Max tree depth"},
                "learning_rate": {"type": "float", "default": 0.1, "min": 0.01, "max": 0.3, "description": "Learning rate (eta)"},
                "subsample": {"type": "float", "default": 0.8, "min": 0.5, "max": 1.0, "description": "Row subsampling ratio"},
                "colsample_bytree": {"type": "float", "default": 0.8, "min": 0.5, "max": 1.0, "description": "Column subsampling ratio"},
            },
        }
        if model_type not in configs:
            raise ValueError(f"Unknown model type: {model_type}. Supported: {self.supported_models}")
        return configs[model_type]

    # ── Data loading ──────────────────────────────────────────────────────────

    def load_data(
        self, filepath: str, target_column: str
    ) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series, List[str], Optional[Any]]:
        from core.config import get_settings
        settings = get_settings()

        df = pd.read_csv(filepath)
        if target_column not in df.columns:
            raise ValueError(f"Target column '{target_column}' not found in dataset columns: {df.columns.tolist()}")

        # Use existing preprocess_dataset but override label detection to use the provided target
        # We temporarily rename the column to 'label' so detect_label_column picks it up
        df_work = df.copy()
        if target_column != "label":
            if "label" in df_work.columns and target_column != "label":
                df_work = df_work.rename(columns={"label": "__orig_label__"})
            df_work = df_work.rename(columns={target_column: "label"})

        prep = preprocess_dataset(df_work, mode="binary", max_rfe_features=30)

        X = prep["X"]
        y = prep["y"]
        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size=settings.test_size,
            random_state=settings.random_state,
            stratify=y,
        )
        return X_train, X_test, y_train, y_test, prep["feature_names"], prep.get("label_encoder")

    # ── Preprocessing ─────────────────────────────────────────────────────────

    def preprocess(
        self, X_train: pd.DataFrame, X_test: pd.DataFrame
    ) -> Tuple[pd.DataFrame, pd.DataFrame, Any]:
        # Preprocessing is baked into load_data via preprocess_dataset
        return X_train, X_test, None

    # ── Training ──────────────────────────────────────────────────────────────

    def train(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        model_type: str,
        hyperparameters: Dict[str, Any],
        progress_callback: Callable[[str, int, int, dict], None],
    ) -> Tuple[Any, Dict[str, Any]]:
        from config import RANDOM_STATE  # type: ignore

        progress_callback("Initialising Optuna", 1, 3, {})

        start = time.time()
        if hyperparameters:
            # Direct training with provided hyperparameters (skip Optuna)
            progress_callback("Training with provided hyperparameters", 2, 3, {})
            model = _build_model(model_type, hyperparameters, RANDOM_STATE)
            model.fit(X_train, y_train)
            best_params = hyperparameters
        else:
            # Use Optuna tuning
            progress_callback("Running Optuna hyperparameter search", 2, 3, {})
            model, best_params, _ = train_model(X_train, y_train, model_type=model_type, mode="binary")

        duration = round(time.time() - start, 2)
        progress_callback("Training complete", 3, 3, {})

        return model, {
            "best_params": best_params,
            "duration": duration,
            "class_names": ["Normal", "Attack"],
        }

    # ── Evaluation ────────────────────────────────────────────────────────────

    def evaluate(
        self, model: Any, X_test: pd.DataFrame, y_test: pd.Series, feature_names: List[str]
    ) -> Dict[str, Any]:
        result = evaluate_model(model, X_test, y_test, class_names=["Normal", "Attack"])

        # Build ROC curve data
        from sklearn.metrics import roc_curve
        roc_data = None
        if result.get("y_prob") is not None:
            y_prob = np.array(result["y_prob"])
            y_true = np.array(result["y_test"])
            if y_prob.ndim == 2:
                # Use column 1 (positive class) when available; fall back to column 0
                # to handle the edge case where the model only outputs one class
                y_scores = y_prob[:, 1] if y_prob.shape[1] > 1 else y_prob[:, 0]
            else:
                y_scores = y_prob
            try:
                fpr, tpr, thresholds = roc_curve(y_true, y_scores)
                roc_data = {
                    "fpr": fpr.tolist(),
                    "tpr": tpr.tolist(),
                    "thresholds": thresholds.tolist(),
                }
            except Exception:
                pass

        # Feature importance
        feat_imp: List[Dict[str, float]] = []
        if hasattr(model, "feature_importances_"):
            importances = model.feature_importances_
            feat_imp = sorted(
                [{"feature": feature_names[i], "importance": round(float(importances[i]), 6)}
                 for i in range(min(len(feature_names), len(importances)))],
                key=lambda x: x["importance"],
                reverse=True,
            )

        return {
            "metrics": result["metrics"],
            "confusion_matrix": result["confusion_matrix"],
            "classification_report": result["classification_report"],
            "roc_curve": roc_data,
            "feature_importance": feat_imp,
        }

    # ── Prediction ────────────────────────────────────────────────────────────

    def predict(
        self, model: Any, input_rows: List[Dict[str, Any]], feature_names: List[str]
    ) -> List[Dict[str, Any]]:
        class_names = ["Normal", "Attack"]
        df = pd.DataFrame(input_rows)
        for f in feature_names:
            if f not in df.columns:
                df[f] = 0
        df = df[feature_names]
        # Coerce to numeric — frontend sends all values as strings from form inputs
        df = df.apply(pd.to_numeric, errors="coerce").fillna(0)

        preds = model.predict(df)
        proba = model.predict_proba(df) if hasattr(model, "predict_proba") else None

        results = []
        for i in range(len(preds)):
            idx = int(preds[i])
            label = class_names[idx] if idx < len(class_names) else str(idx)
            conf = None
            prob_dict: Dict[str, float] = {}
            if proba is not None:
                conf = round(float(np.max(proba[i])), 4)
                for j, cn in enumerate(class_names):
                    if j < proba.shape[1]:
                        prob_dict[cn] = round(float(proba[i][j]), 4)
            results.append({
                "input": input_rows[i],
                "prediction": label,
                "confidence": conf,
                "class_probabilities": prob_dict,
            })
        return results

    # ── Explanation ───────────────────────────────────────────────────────────

    def explain(
        self,
        model: Any,
        input_row: Dict[str, Any],
        X_background: pd.DataFrame,
        feature_names: List[str],
        method: str,
        max_display: int,
        shap_max_rows: int,
    ) -> Dict[str, Any]:
        from services.explainability_service import _compute_shap, _compute_lime

        df_row = pd.DataFrame([input_row])
        for f in feature_names:
            if f not in df_row.columns:
                df_row[f] = 0
        df_row = df_row[feature_names]
        # Coerce to numeric — frontend sends all values as strings from form inputs
        df_row = df_row.apply(pd.to_numeric, errors="coerce").fillna(0)

        result: Dict[str, Any] = {"method_used": method}
        class_names = ["Normal", "Attack"]

        if method in ("shap", "both"):
            shap_result, sampled = _compute_shap(model, df_row, X_background, feature_names, max_display, shap_max_rows)
            shap_result["sampled_for_performance"] = sampled
            result["shap"] = shap_result

        if method in ("lime", "both"):
            result["lime"] = _compute_lime(model, df_row, X_background, feature_names, class_names, max_display)

        return result


def _build_model(model_type: str, params: Dict[str, Any], random_state: int) -> Any:
    if model_type == "random_forest":
        from sklearn.ensemble import RandomForestClassifier
        p = {**params, "random_state": random_state, "n_jobs": -1}
        return RandomForestClassifier(**p)
    elif model_type == "xgboost":
        from xgboost import XGBClassifier
        p = {**params, "random_state": random_state, "n_jobs": -1,
             "objective": "binary:logistic", "eval_metric": "logloss"}
        return XGBClassifier(**p)
    raise ValueError(f"Unknown model type: {model_type}")
