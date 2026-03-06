"""
Custom Preprocessor
===================
A flexible drop-in replacement for app/preprocessing.py::preprocess_dataset()
that honours every field in schemas/pipeline.PipelineConfig.

The returned bundle is compatible with the existing preprocess_input() function
so prediction / explainability still work without changes.
"""
from __future__ import annotations

import warnings
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import (
    LabelEncoder,
    MinMaxScaler,
    StandardScaler,
    RobustScaler,
)
from sklearn.feature_selection import RFE, SelectKBest, f_classif
from sklearn.decomposition import PCA
from sklearn.ensemble import RandomForestClassifier

from core.logger import get_logger
from schemas.pipeline import PipelineConfig

logger = get_logger("custom_preprocessor")

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)


# ── Label helpers (copied from app/preprocessing for portability) ─────────────

_BINARY_NORMAL_VALUES = {"normal", "0", "benign", "0.0"}


def _detect_label_column(df: pd.DataFrame, hint: Optional[str] = None) -> str:
    if hint and hint in df.columns:
        return hint
    candidates = ["label", "Label", "attack_cat", "class", "Class", "target"]
    for c in candidates:
        if c in df.columns:
            return c
    return df.columns[-1]


def _encode_binary(y: pd.Series) -> pd.Series:
    mapped = y.astype(str).str.strip().str.lower().map(
        lambda v: 0 if v in _BINARY_NORMAL_VALUES else 1
    )
    return mapped.astype(int)


def _encode_multiclass(y: pd.Series) -> Tuple[pd.Series, LabelEncoder]:
    le = LabelEncoder()
    encoded = pd.Series(le.fit_transform(y.astype(str).str.strip()), index=y.index)
    return encoded, le


# ── Step implementations ──────────────────────────────────────────────────────

def _apply_missing(df: pd.DataFrame, strategy: str) -> pd.DataFrame:
    """Step 1: handle NaN / Inf values."""
    df = df.copy()
    df.replace([np.inf, -np.inf], np.nan, inplace=True)

    if strategy == "drop":
        df.dropna(inplace=True)
    elif strategy == "mean":
        num_cols = df.select_dtypes(include=[np.number]).columns
        df[num_cols] = df[num_cols].fillna(df[num_cols].mean())
    elif strategy == "median":
        num_cols = df.select_dtypes(include=[np.number]).columns
        df[num_cols] = df[num_cols].fillna(df[num_cols].median())
    elif strategy == "mode":
        for col in df.columns:
            df[col] = df[col].fillna(df[col].mode().iloc[0] if not df[col].mode().empty else 0)
    elif strategy == "zero":
        df.fillna(0, inplace=True)
    return df


def _apply_duplicates(df: pd.DataFrame, remove: bool) -> pd.DataFrame:
    if remove:
        before = len(df)
        df = df.drop_duplicates()
        removed = before - len(df)
        if removed:
            logger.info(f"Removed {removed} duplicate rows")
    return df


def _apply_outliers(df: pd.DataFrame, target_col: str, method: str, threshold: float) -> pd.DataFrame:
    if method == "none":
        return df
    feature_cols = [c for c in df.columns if c != target_col and df[c].dtype in [np.float64, np.int64, float, int]]
    if method == "iqr":
        for col in feature_cols:
            q1, q3 = df[col].quantile(0.25), df[col].quantile(0.75)
            iqr = q3 - q1
            lo, hi = q1 - threshold * iqr, q3 + threshold * iqr
            df[col] = df[col].clip(lower=lo, upper=hi)
    elif method == "zscore":
        from scipy import stats as scipy_stats  # soft import
        mask = pd.Series([True] * len(df), index=df.index)
        for col in feature_cols:
            if df[col].std() > 0:
                z = np.abs(scipy_stats.zscore(df[col].dropna()))
                bad_idx = df[col].dropna().index[z > threshold]
                mask[bad_idx] = False
        before = len(df)
        df = df[mask]
        logger.info(f"Z-score outlier removal: removed {before - len(df)} rows")
    return df


def _encode_categoricals(
    X: pd.DataFrame, strategy: str
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    cat_cols = X.select_dtypes(include=["object", "category"]).columns.tolist()
    le_dict: Dict[str, Any] = {}

    if not cat_cols:
        return X, le_dict

    if strategy == "label":
        for col in cat_cols:
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col].astype(str))
            le_dict[col] = le
    elif strategy == "onehot":
        X = pd.get_dummies(X, columns=cat_cols, drop_first=False)
        # Store column names so prediction can align them
        le_dict["__onehot_columns__"] = X.columns.tolist()
    return X, le_dict


def _make_scaler(strategy: str):
    if strategy == "minmax":
        return MinMaxScaler()
    if strategy == "standard":
        return StandardScaler()
    if strategy == "robust":
        return RobustScaler()
    return None  # "none"


def _apply_scaling(
    X: pd.DataFrame, strategy: str
) -> Tuple[pd.DataFrame, Any]:
    scaler = _make_scaler(strategy)
    if scaler is None:
        return X, None
    X_scaled = pd.DataFrame(scaler.fit_transform(X), columns=X.columns, index=X.index)
    return X_scaled, scaler


def _apply_feature_selection(
    X: pd.DataFrame,
    y: pd.Series,
    method: str,
    n_features: int,
) -> Tuple[pd.DataFrame, Any, List[str]]:
    n_features = min(n_features, X.shape[1])

    if method == "none":
        return X, None, X.columns.tolist()

    if method == "rfe":
        estimator = RandomForestClassifier(n_estimators=50, random_state=42, n_jobs=-1)
        selector = RFE(estimator=estimator, n_features_to_select=n_features, step=5)
        selector.fit(X, y)
        selected = X.columns[selector.support_].tolist()
        return X[selected], selector, selected

    if method == "kbest":
        X_non_neg = X.copy()
        X_non_neg[X_non_neg < 0] = 0     # f_classif requires non-negative for chi2; f_classif handles all
        selector = SelectKBest(f_classif, k=n_features)
        selector.fit(X_non_neg, y)
        selected = X.columns[selector.get_support()].tolist()
        return X[selected], selector, selected

    if method == "pca":
        pca = PCA(n_components=n_features, random_state=42)
        X_pca_arr = pca.fit_transform(X)
        col_names = [f"PC{i+1}" for i in range(n_features)]
        X_pca = pd.DataFrame(X_pca_arr, columns=col_names, index=X.index)
        return X_pca, pca, col_names

    return X, None, X.columns.tolist()


def _apply_class_balancing(
    X: pd.DataFrame,
    y: pd.Series,
    method: str,
) -> Tuple[pd.DataFrame, pd.Series]:
    if method == "none" or method == "class_weight":
        # class_weight is passed to the model — no resampling here
        return X, y

    minority_count = y.value_counts().min()
    k_neighbors = min(5, minority_count - 1)

    if k_neighbors < 1:
        logger.warning(
            f"Cannot apply {method}: minority class has only {minority_count} sample(s). "
            "Falling back to no balancing."
        )
        return X, y

    try:
        if method == "smote":
            from imblearn.over_sampling import SMOTE
            sampler = SMOTE(random_state=42, k_neighbors=k_neighbors)
        elif method == "adasyn":
            from imblearn.over_sampling import ADASYN
            sampler = ADASYN(random_state=42, n_neighbors=k_neighbors)
        else:
            return X, y

        X_res, y_res = sampler.fit_resample(X, y)
        return pd.DataFrame(X_res, columns=X.columns), pd.Series(y_res)

    except Exception as e:
        logger.warning(f"{method} failed ({e}) — falling back to unbalanced data.")
        return X, y


# ── Cross-validation helper ───────────────────────────────────────────────────

def run_cross_validation(
    X: pd.DataFrame,
    y: pd.Series,
    model_type: str,
    folds: int,
    scoring: str,
    random_state: int = 42,
    progress_callback=None,
) -> Dict[str, Any]:
    """Run stratified K-fold CV and return fold scores + mean/std."""
    from sklearn.ensemble import RandomForestClassifier
    try:
        from xgboost import XGBClassifier
    except ImportError:
        XGBClassifier = None

    if model_type == "random_forest":
        clf = RandomForestClassifier(n_estimators=100, random_state=random_state, n_jobs=-1)
    elif model_type == "xgboost" and XGBClassifier:
        clf = XGBClassifier(
            n_estimators=100, random_state=random_state, n_jobs=-1,
            objective="binary:logistic", eval_metric="logloss",
        )
    else:
        clf = RandomForestClassifier(n_estimators=100, random_state=random_state, n_jobs=-1)

    cv = StratifiedKFold(n_splits=folds, shuffle=True, random_state=random_state)

    if progress_callback:
        progress_callback(f"Running {folds}-fold cross-validation", 0, folds, {})

    scores = cross_val_score(clf, X, y, cv=cv, scoring=scoring, n_jobs=-1)

    return {
        "fold_scores":    [round(float(s), 4) for s in scores],
        "mean":           round(float(scores.mean()), 4),
        "std":            round(float(scores.std()), 4),
        "scoring_metric": scoring,
        "n_folds":        folds,
    }


# ── Main public function ──────────────────────────────────────────────────────

def preprocess_with_config(
    df: pd.DataFrame,
    target_column: str,
    config: PipelineConfig,
    model_type: str = "random_forest",
    random_state: int = 42,
    progress_callback=None,
) -> Dict[str, Any]:
    """
    Preprocess *df* according to *config* and return a bundle compatible
    with the existing model registry / explainability pipeline.

    Returns
    -------
    dict with keys:
        X_train, X_test, y_train, y_test,
        feature_names, label_encoder, class_names,
        scaler, selector, selected_features, le_dict,
        original_columns, cv_results (if cross_validation enabled),
        class_weight (if class_balancing == "class_weight")
    """
    def _cb(msg: str, step: int, total: int, metrics: dict = {}):
        if progress_callback:
            progress_callback(msg, step, total, metrics)
        logger.info(f"Preprocessing [{step}/{total}]: {msg}")

    total_steps = 10
    step = 0

    # ── 1. Missing values ─────────────────────────────────────────────────────
    step += 1; _cb("Handling missing values", step, total_steps)
    df = _apply_missing(df, config.missing_values.strategy)

    if len(df) == 0:
        raise ValueError(
            "After applying the missing-value strategy, the dataset is empty. "
            "Try switching from 'Drop Rows' to a fill strategy."
        )

    # ── 2. Duplicate removal ──────────────────────────────────────────────────
    step += 1; _cb("Removing duplicate rows", step, total_steps)
    df = _apply_duplicates(df, config.duplicates.remove)

    if len(df) == 0:
        raise ValueError("After removing duplicates the dataset is empty.")

    # ── 3. Validate target column still exists ──────────────────────────────
    if target_column not in df.columns:
        raise ValueError(
            f"Target column '{target_column}' was not found after preprocessing. "
            f"Available columns: {df.columns.tolist()}"
        )

    # ── 4. Outlier handling ───────────────────────────────────────────────────
    step += 1; _cb("Handling outliers", step, total_steps)
    df = _apply_outliers(df, target_column, config.outliers.method, config.outliers.threshold)

    # ── 5. Separate features + labels ────────────────────────────────────────
    step += 1; _cb("Encoding labels", step, total_steps)

    label_mode = config.label_mode.mode
    attack_cat_candidates = ["attack_cat", "attack_category", "Attack_cat"]
    attack_cat_col = next((c for c in attack_cat_candidates if c in df.columns), None)

    if label_mode == "multiclass" and attack_cat_col and attack_cat_col != target_column:
        y_raw = df[attack_cat_col].copy()
        drop_cols = [c for c in [target_column, attack_cat_col] if c in df.columns]
    else:
        y_raw = df[target_column].copy()
        drop_cols = [target_column]
        if attack_cat_col and attack_cat_col in df.columns:
            drop_cols.append(attack_cat_col)

    X = df.drop(columns=drop_cols, errors="ignore").copy()

    label_encoder = None
    if label_mode == "binary":
        y = _encode_binary(y_raw)
        class_names = ["Normal", "Attack"]
    else:
        y, label_encoder = _encode_multiclass(y_raw)
        class_names = list(label_encoder.classes_)

    # ── 6. Categorical encoding ───────────────────────────────────────────────
    step += 1; _cb("Encoding categorical features", step, total_steps)
    X, le_dict = _encode_categoricals(X, config.encoding.strategy)
    original_columns = X.columns.tolist()

    # ── 7. Scaling ────────────────────────────────────────────────────────────
    step += 1; _cb("Scaling features", step, total_steps)
    X, scaler = _apply_scaling(X, config.scaling.strategy)

    # ── 8. Feature selection ──────────────────────────────────────────────────
    step += 1; _cb("Selecting features", step, total_steps)
    X, selector, selected_features = _apply_feature_selection(
        X, y, config.feature_selection.method, config.feature_selection.n_features
    )

    # Guard: ensure we have some features
    if X.shape[1] == 0:
        raise ValueError("Feature selection removed all columns. Reduce n_features or change the method.")

    # ── 9. Cross-validation (optional, runs on full balanced set) ─────────────
    cv_results = None
    if config.cross_validation.enabled:
        step += 1; _cb(f"Running {config.cross_validation.folds}-fold cross-validation", step, total_steps)
        # Balance first for CV scoring
        X_cv, y_cv = _apply_class_balancing(X, y, config.class_balancing.method)
        cv_results = run_cross_validation(
            X_cv, y_cv,
            model_type     = model_type,
            folds          = config.cross_validation.folds,
            scoring        = config.cross_validation.scoring,
            random_state   = random_state,
            progress_callback = progress_callback,
        )
        _cb(
            f"CV done — {config.cross_validation.scoring} mean={cv_results['mean']:.3f} ±{cv_results['std']:.3f}",
            step, total_steps, cv_results
        )
    else:
        step += 1  # keep step counter consistent

    # ── 10. Train / test split ────────────────────────────────────────────────
    step += 1; _cb("Splitting train / test sets", step, total_steps)
    test_size     = float(config.split.test_size)
    should_stratify = config.split.stratify and y.nunique() < 50

    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size    = test_size,
            random_state = random_state,
            stratify     = y if should_stratify else None,
        )
    except ValueError as e:
        # Stratify can fail when a class has fewer samples than n_splits
        logger.warning(f"Stratified split failed ({e}) — retrying without stratification.")
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state
        )

    # ── 11. Class balancing on train set only ─────────────────────────────────
    step += 1; _cb("Balancing training classes", step, total_steps)
    X_train, y_train = _apply_class_balancing(X_train, y_train, config.class_balancing.method)

    # class_weight for the model (used when method == "class_weight")
    class_weight = "balanced" if config.class_balancing.method == "class_weight" else None

    _cb("Preprocessing complete", total_steps, total_steps, {})

    return {
        "X_train":          X_train,
        "X_test":           X_test,
        "y_train":          y_train,
        "y_test":           y_test,
        "feature_names":    selected_features,
        "selected_features": selected_features,
        "label_encoder":    label_encoder,
        "class_names":      class_names,
        "scaler":           scaler,
        "selector":         selector,
        "le_dict":          le_dict,
        "original_columns": original_columns,
        "cv_results":       cv_results,
        "class_weight":     class_weight,
    }
