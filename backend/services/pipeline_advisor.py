"""
Pipeline Advisor Service
========================
Analyses a dataset and returns per-step recommendations so the UI can:
  - Pre-select the best option for every pipeline step
  - Grey out options that cannot be used with this dataset (with a reason)
  - Explain WHY a particular option is recommended

All logic is deterministic and cheap (no model training).
"""
from __future__ import annotations

import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

from core.logger import get_logger
from schemas.pipeline import (
    PipelineRecommendation,
    StepOption,
    StepRecommendation,
)

logger = get_logger("pipeline_advisor")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _pct(count: int, total: int) -> str:
    return f"{count / total * 100:.1f}%"


def _balance_ratio(counts: Dict[str, int]) -> float:
    """Returns minority / majority ratio (0–1).  1.0 = perfectly balanced."""
    if len(counts) < 2:
        return 1.0
    vals = sorted(counts.values())
    return vals[0] / vals[-1]


def _has_categoricals(df: pd.DataFrame, target: str) -> bool:
    drop = [target] if target in df.columns else []
    X = df.drop(columns=drop, errors="ignore")
    return bool(X.select_dtypes(include=["object", "category"]).shape[1] > 0)


def _missing_fraction(df: pd.DataFrame) -> float:
    total = df.shape[0] * df.shape[1]
    return df.isnull().sum().sum() / total if total > 0 else 0.0


def _has_infinites(df: pd.DataFrame) -> bool:
    num = df.select_dtypes(include=[np.number])
    return bool(np.isinf(num.values).any())


def _numeric_feature_count(df: pd.DataFrame, target: str) -> int:
    X = df.drop(columns=[target], errors="ignore")
    return X.select_dtypes(include=[np.number]).shape[1]


def _detect_label_column(df: pd.DataFrame, hint: Optional[str] = None) -> str:
    if hint and hint in df.columns:
        return hint
    candidates = ["label", "Label", "attack_cat", "class", "Class", "target"]
    for c in candidates:
        if c in df.columns:
            return c
    return df.columns[-1]


def _is_likely_pre_scaled(df: pd.DataFrame, target: str) -> bool:
    """Heuristic: if all numeric features are in [0, 1] the data may already be scaled."""
    X = df.drop(columns=[target], errors="ignore").select_dtypes(include=[np.number])
    if X.empty:
        return False
    return bool((X.min().min() >= 0.0) and (X.max().max() <= 1.0))


def _has_outliers(df: pd.DataFrame, target: str) -> bool:
    """Detect if any numeric column has values > 5 IQR from Q3."""
    X = df.drop(columns=[target], errors="ignore").select_dtypes(include=[np.number])
    for col in X.columns:
        q1, q3 = X[col].quantile(0.25), X[col].quantile(0.75)
        iqr = q3 - q1
        if iqr > 0 and ((X[col] > q3 + 5 * iqr) | (X[col] < q1 - 5 * iqr)).any():
            return True
    return False


def _estimate_duration(
    row_count: int,
    feature_count: int,
    use_optuna: bool,
    cv_enabled: bool,
    cv_folds: int,
) -> int:
    """Very rough seconds estimate shown to the user before training starts."""
    base = max(5, int(row_count / 1000) * 2)
    if use_optuna:
        base *= 8
    if cv_enabled:
        base *= cv_folds // 2
    return min(base, 3600)


# ── Main advisor function ─────────────────────────────────────────────────────

def advise_pipeline(
    df: pd.DataFrame,
    dataset_id: str,
    dataset_name: str,
    target_column: Optional[str] = None,
) -> PipelineRecommendation:
    """
    Analyse *df* and return a full PipelineRecommendation.

    Parameters
    ----------
    df           : Raw dataframe (just uploaded, not yet preprocessed)
    dataset_id   : Used in the response for correlation with the frontend
    dataset_name : Human-readable filename
    target_column: If None, we auto-detect it the same way preprocessing does
    """
    label_col = _detect_label_column(df, target_column)

    # ── Dataset-level statistics ──────────────────────────────────────────────
    row_count      = len(df)
    feature_count  = df.shape[1] - 1          # minus label
    missing_frac   = _missing_fraction(df)
    has_inf        = _has_infinites(df)
    has_cat        = _has_categoricals(df, label_col)
    pre_scaled     = _is_likely_pre_scaled(df, label_col) and not has_inf
    has_outliers   = _has_outliers(df, label_col)
    num_features   = _numeric_feature_count(df, label_col)

    # ── Label statistics ──────────────────────────────────────────────────────
    raw_labels     = df[label_col].astype(str).str.strip()
    unique_labels  = sorted(raw_labels.unique().tolist())
    n_classes      = len(unique_labels)
    label_counts   = raw_labels.value_counts().to_dict()
    balance_ratio  = _balance_ratio(label_counts)

    is_multiclass  = n_classes > 2
    is_imbalanced  = balance_ratio < 0.35     # < 35% minority share

    # Class balance string
    sorted_labels  = sorted(label_counts.items(), key=lambda x: -x[1])
    class_balance  = " / ".join(
        f"{v} ({_pct(c, row_count)})"
        for v, c in sorted_labels[:4]
    )

    # ── Recommended n_features ────────────────────────────────────────────────
    rec_n_features = min(30, max(10, num_features // 2))

    steps: List[StepRecommendation] = []

    # ── Step 1: Missing Values ─────────────────────────────────────────────────
    if missing_frac == 0.0 and not has_inf:
        mv_rec    = "drop"
        mv_reason = "No missing or infinite values detected — 'Drop Rows' is a safe no-op here."
    elif missing_frac < 0.02:
        mv_rec    = "drop"
        mv_reason = f"Only {missing_frac * 100:.1f}% of cells are missing — safe to drop the few affected rows."
    elif missing_frac < 0.10:
        mv_rec    = "median"
        mv_reason = f"{missing_frac * 100:.1f}% missing cells. Median imputation preserves scale and is robust to outliers."
    else:
        mv_rec    = "median"
        mv_reason = f"High missingness ({missing_frac * 100:.1f}%). Dropping rows would lose too much data — median imputation recommended."

    steps.append(StepRecommendation(
        step        = "missing_values",
        title       = "Missing Value Strategy",
        description = "What to do when a cell is blank, NaN, or Infinity. 'Drop' removes the entire row; imputation fills the gap with a computed value.",
        recommended = mv_rec,
        reason      = mv_reason,
        current_value = mv_rec,
        options     = [
            StepOption(value="drop",   label="Drop Rows",      is_recommended=(mv_rec=="drop"),
                       description="Remove any row that contains a missing/Inf value. Best when < 2% rows affected."),
            StepOption(value="mean",   label="Fill with Mean",  is_recommended=(mv_rec=="mean"),
                       description="Replace missing value with the column average. Sensitive to outliers."),
            StepOption(value="median", label="Fill with Median",is_recommended=(mv_rec=="median"),
                       description="Replace with the column median. Robust to outliers — preferred for network traffic data."),
            StepOption(value="mode",   label="Fill with Mode",  is_recommended=False,
                       description="Replace with the most common value. Good for categorical features."),
            StepOption(value="zero",   label="Fill with Zero",  is_recommended=False,
                       description="Replace missing values with 0. Use only if 0 is semantically meaningful (e.g. 'no activity')."),
        ],
    ))

    # ── Step 2: Duplicate Removal ──────────────────────────────────────────────
    steps.append(StepRecommendation(
        step        = "duplicates",
        title       = "Duplicate Row Removal",
        description = "Remove exact-duplicate rows. Duplicates inflate accuracy metrics and cause data leakage between train and test.",
        recommended = "true",
        reason      = "Always recommended — duplicates artificially inflate metrics and are never useful information.",
        current_value = "true",
        options     = [
            StepOption(value="true",  label="Remove Duplicates", is_recommended=True,
                       description="Drop rows that are 100% identical to another row (recommended for all datasets)."),
            StepOption(value="false", label="Keep Duplicates",   is_recommended=False,
                       description="Preserve all rows including exact copies. Only use if you know duplicates are intentional."),
        ],
    ))

    # ── Step 3: Outlier Handling ───────────────────────────────────────────────
    if has_outliers:
        out_rec    = "iqr"
        out_reason = "Extreme outliers detected in numeric columns. IQR clipping caps them at 1.5×IQR without removing rows."
    elif pre_scaled:
        out_rec    = "none"
        out_reason = "Data appears pre-scaled (all values 0–1) — outlier clipping would have minimal effect."
    else:
        out_rec    = "none"
        out_reason = "No extreme outliers detected — skipping this step keeps data integrity intact."

    steps.append(StepRecommendation(
        step        = "outliers",
        title       = "Outlier Handling",
        description = "Extreme values can distort model learning. IQR clips values beyond 1.5× the interquartile range; Z-score removes rows where any feature exceeds N standard deviations.",
        recommended = out_rec,
        reason      = out_reason,
        current_value = out_rec,
        options     = [
            StepOption(value="none",   label="No Outlier Handling", is_recommended=(out_rec=="none"),
                       description="Leave all values as-is. Use when data is already clean or pre-processed."),
            StepOption(value="iqr",    label="IQR Clipping",         is_recommended=(out_rec=="iqr"),
                       description="Clip values outside 1.5× IQR range. Safe — no rows are removed, just capped."),
            StepOption(value="zscore", label="Z-Score Removal",      is_recommended=False,
                       description="Remove rows where any feature exceeds the Z-score threshold. Can remove a lot of data if applied aggressively."),
        ],
    ))

    # ── Step 4: Label Mode ────────────────────────────────────────────────────
    if is_multiclass:
        lm_rec    = "multiclass"
        lm_reason = f"{n_classes} unique label values detected — multiclass encoding is required."
        multiclass_disabled = False
        binary_disabled     = False
        binary_reason       = f"Binary only works for 2-class problems. Your dataset has {n_classes} classes — forcing binary would merge all non-normal classes together."
    else:
        lm_rec    = "binary"
        lm_reason = f"Only {n_classes} unique labels detected — binary (0/1) encoding is perfect here."
        multiclass_disabled = False  # still usable even for binary
        binary_disabled     = False
        binary_reason       = None

    steps.append(StepRecommendation(
        step        = "label_mode",
        title       = "Label Encoding Mode",
        description = "How to encode the target column. Binary maps all non-normal values to 1 (attack). Multiclass preserves attack categories as separate classes.",
        recommended = lm_rec,
        reason      = lm_reason,
        current_value = lm_rec,
        options     = [
            StepOption(value="binary",     label="Binary (Normal / Attack)",
                       is_recommended=(lm_rec=="binary"),
                       description="All attack types → class 1; normal → class 0. Simplest and most common for IDS.",
                       disabled=binary_disabled, disabled_reason=binary_reason),
            StepOption(value="multiclass", label="Multiclass (Per-Attack Type)",
                       is_recommended=(lm_rec=="multiclass"),
                       description="Each attack category gets its own class. More informative but harder to train on unbalanced data.",
                       disabled=False),
        ],
    ))

    # ── Step 5: Categorical Encoding ─────────────────────────────────────────
    if not has_cat:
        enc_rec    = "label"
        enc_reason = "No string/categorical feature columns detected — this step has no effect on this dataset."
        onehot_disabled        = True
        onehot_disabled_reason = "No categorical columns exist in this dataset — One-Hot Encoding would produce no additional features."
    else:
        cat_cols   = [c for c in df.drop(columns=[label_col], errors="ignore").select_dtypes(include=["object","category"]).columns]
        max_cats   = max(df[c].nunique() for c in cat_cols) if cat_cols else 0
        if max_cats > 15:
            enc_rec    = "label"
            enc_reason = f"Highest cardinality categorical column has {max_cats} unique values. One-Hot would create too many columns — Label Encoding is more efficient."
            onehot_disabled        = True
            onehot_disabled_reason = f"One-Hot Encoding would create {max_cats}+ new columns, greatly increasing dimensionality. Label Encoding is recommended."
        else:
            enc_rec    = "onehot"
            enc_reason = f"Categorical columns have ≤ {max_cats} unique values each — One-Hot Encoding avoids implying false ordinal relationships."
            onehot_disabled        = False
            onehot_disabled_reason = None

    steps.append(StepRecommendation(
        step        = "encoding",
        title       = "Categorical Feature Encoding",
        description = "String/categorical columns must be converted to numbers before training. Label Encoding assigns integers; One-Hot creates a new binary column per category.",
        recommended = enc_rec,
        reason      = enc_reason,
        current_value = enc_rec,
        options     = [
            StepOption(value="label",  label="Label Encoding",  is_recommended=(enc_rec=="label"),
                       description="Assign each category an integer (A→0, B→1, …). Fast and memory-efficient for high-cardinality columns."),
            StepOption(value="onehot", label="One-Hot Encoding", is_recommended=(enc_rec=="onehot"),
                       description="Create one binary column per category value. Removes ordinal bias but multiplies column count.",
                       disabled=onehot_disabled, disabled_reason=onehot_disabled_reason),
        ],
    ))

    # ── Step 6: Scaling ───────────────────────────────────────────────────────
    if pre_scaled:
        sc_rec    = "none"
        sc_reason = "All numeric features appear to be in the [0, 1] range — re-scaling is redundant."
    elif has_outliers:
        sc_rec    = "robust"
        sc_reason = "Outliers detected in numeric features. RobustScaler uses median/IQR instead of min/max, making it resistant to extreme values."
    else:
        sc_rec    = "minmax"
        sc_reason = "No extreme outliers — MinMax scaling (0–1) is ideal for Random Forest / XGBoost with this data distribution."

    steps.append(StepRecommendation(
        step        = "scaling",
        title       = "Feature Scaling",
        description = "Normalise numeric feature ranges so no single column dominates. Tree-based models (RF, XGBoost) don't require scaling but it can prevent numeric issues with large ranges.",
        recommended = sc_rec,
        reason      = sc_reason,
        current_value = sc_rec,
        options     = [
            StepOption(value="minmax",   label="MinMax (0 → 1)",      is_recommended=(sc_rec=="minmax"),
                       description="Scale each column to [0, 1]. Best when there are no extreme outliers."),
            StepOption(value="standard", label="Standard (Z-score)",  is_recommended=(sc_rec=="standard"),
                       description="Subtract mean, divide by std deviation. Useful if downstream steps expect Gaussian-like distributions."),
            StepOption(value="robust",   label="Robust Scaler",       is_recommended=(sc_rec=="robust"),
                       description="Use median and IQR instead of mean and std. Best when outliers are present."),
            StepOption(value="none",     label="No Scaling",          is_recommended=(sc_rec=="none"),
                       description="Leave features as-is. Only use if data is already properly scaled."),
        ],
    ))

    # ── Step 7: Feature Selection ─────────────────────────────────────────────
    if num_features <= 15:
        fs_rec               = "none"
        fs_reason            = f"Only {num_features} features — feature selection would likely remove useful signal. Keeping all features."
        rfe_disabled         = False
        pca_warning          = "Warning: PCA replaces feature names with PC1, PC2, … — SHAP explanations will lose meaningful labels."
    elif num_features > 50:
        fs_rec               = "rfe"
        fs_reason            = f"High dimensionality ({num_features} features). RFE selects the most informative features, reduces training time, and improves explainability."
        rfe_disabled         = False
        pca_warning          = "Warning: PCA replaces feature names with PC1, PC2, … — SHAP explanations will lose meaningful labels."
    else:
        fs_rec               = "rfe"
        fs_reason            = f"{num_features} features detected. RFE trims noise features and produces cleaner SHAP explanations."
        rfe_disabled         = False
        pca_warning          = "Warning: PCA replaces feature names with PC1, PC2, … — SHAP explanations will lose meaningful labels."

    steps.append(StepRecommendation(
        step        = "feature_selection",
        title       = "Feature Selection",
        description = f"Reduce the number of input features ({num_features} detected) by keeping only the most predictive ones. Improves training speed and SHAP explanation quality.",
        recommended = fs_rec,
        reason      = fs_reason,
        current_value = fs_rec,
        options     = [
            StepOption(value="rfe",    label=f"RFE (Recursive Feature Elimination)", is_recommended=(fs_rec=="rfe"),
                       description="Iteratively removes the least important features using a fast Random Forest as the selector. Best for IDS."),
            StepOption(value="kbest",  label="SelectKBest (χ² / ANOVA)",            is_recommended=(fs_rec=="kbest"),
                       description="Ranks features by statistical test score. Faster than RFE but less accurate for tree-based models."),
            StepOption(value="pca",    label="PCA (Principal Components)",           is_recommended=False,
                       description=pca_warning,
                       disabled=False, disabled_reason=pca_warning),
            StepOption(value="none",   label="No Feature Selection",                 is_recommended=(fs_rec=="none"),
                       description=f"Use all {num_features} features as-is. Only recommended for small feature sets."),
        ],
    ))

    # ── Step 8: Class Balancing ───────────────────────────────────────────────
    smote_min_samples = 6  # SMOTE needs at least k+1 (default k=5) minority samples

    minority_count = min(label_counts.values()) if label_counts else 0
    smote_not_enough_samples = minority_count < smote_min_samples

    if smote_not_enough_samples:
        cb_rec    = "none"
        cb_reason = f"Minority class has only {minority_count} samples — SMOTE requires at least {smote_min_samples}. Use 'class_weight' instead."
        smote_dis = True
        smote_dis_reason = f"SMOTE needs ≥ {smote_min_samples} samples in the minority class to generate synthetic points. Your minority class has only {minority_count}."
        adasyn_dis = True
        adasyn_dis_reason = smote_dis_reason
    elif balance_ratio >= 0.80:
        cb_rec    = "none"
        cb_reason = f"Classes are well-balanced ({_pct(int(balance_ratio * 100), 100)} ratio) — oversampling would introduce unnecessary synthetic data and may inflate accuracy."
        smote_dis = False
        smote_dis_reason = None
        adasyn_dis = False
        adasyn_dis_reason = None
    elif is_imbalanced:
        cb_rec    = "smote"
        cb_reason = f"Significant class imbalance detected (minority share ≈ {balance_ratio * 100:.1f}%). SMOTE generates synthetic minority-class samples to prevent the model from ignoring attacks."
        smote_dis = False
        smote_dis_reason = None
        adasyn_dis = False
        adasyn_dis_reason = None
    else:
        cb_rec    = "smote"
        cb_reason = f"Mild imbalance detected — SMOTE is a safe default to ensure the model sees enough attack samples."
        smote_dis = False
        smote_dis_reason = None
        adasyn_dis = False
        adasyn_dis_reason = None

    steps.append(StepRecommendation(
        step        = "class_balancing",
        title       = "Class Balancing",
        description = "Network intrusion datasets often have many more normal packets than attacks. Without balancing, models learn to predict 'normal' for everything and still reach high accuracy.",
        recommended = cb_rec,
        reason      = cb_reason,
        current_value = cb_rec,
        options     = [
            StepOption(value="smote",        label="SMOTE",                  is_recommended=(cb_rec=="smote"),
                       description="Generate synthetic minority-class rows by interpolation. Gold-standard for imbalanced IDS data.",
                       disabled=smote_dis, disabled_reason=smote_dis_reason),
            StepOption(value="adasyn",       label="ADASYN",                 is_recommended=False,
                       description="Adaptive variant of SMOTE — generates more samples near the decision boundary. Slightly more aggressive.",
                       disabled=adasyn_dis, disabled_reason=adasyn_dis_reason),
            StepOption(value="class_weight", label="Class Weight Adjustment", is_recommended=(cb_rec=="class_weight" or smote_not_enough_samples),
                       description="Penalise misclassifying minority-class samples more heavily during training. No new rows are created — works even with very few samples."),
            StepOption(value="none",         label="No Balancing",            is_recommended=(cb_rec=="none" and not smote_not_enough_samples),
                       description="Train on raw class distribution. Only use when classes are already balanced or you want to measure real-world precision."),
        ],
    ))

    # ── Step 9: Train / Test Split ────────────────────────────────────────────
    if row_count < 500:
        tts_rec    = "0.3"
        tts_reason = f"Small dataset ({row_count} rows) — use a 30% test split to ensure the test set has enough samples for reliable metrics."
    elif row_count > 100_000:
        tts_rec    = "0.1"
        tts_reason = f"Large dataset ({row_count:,} rows) — 10% test split gives excellent metric estimates while maximising training data."
    else:
        tts_rec    = "0.2"
        tts_reason = "Standard 80/20 split — well-established default for datasets of this size."

    steps.append(StepRecommendation(
        step        = "split",
        title       = "Train / Test Split",
        description = "What fraction of data is held out for evaluation. Training data is used to fit the model; test data measures how well it generalises.",
        recommended = tts_rec,
        reason      = tts_reason,
        current_value = tts_rec,
        options     = [
            StepOption(value="0.1",  label="90 / 10 split", is_recommended=(tts_rec=="0.1"),
                       description="Keep 90% for training. Best for large datasets (> 100k rows)."),
            StepOption(value="0.2",  label="80 / 20 split", is_recommended=(tts_rec=="0.2"),
                       description="Standard split. Balanced between training size and evaluation reliability."),
            StepOption(value="0.25", label="75 / 25 split", is_recommended=False,
                       description="Slightly larger test set for more stable metric estimates."),
            StepOption(value="0.3",  label="70 / 30 split", is_recommended=(tts_rec=="0.3"),
                       description="Larger test set. Recommended for small datasets to get reliable metrics."),
        ],
    ))

    # ── Step 10: Cross-Validation ─────────────────────────────────────────────
    if row_count < 500:
        cv_rec    = "false"
        cv_reason = f"Dataset too small ({row_count} rows) — with 5-fold CV each fold would have fewer than {row_count // 5} samples. Use a simple train/test split instead."
        cv_10fold_disabled        = True
        cv_10fold_disabled_reason = f"Each fold would have only ~{row_count // 10} samples — too few for reliable results."
        cv_5fold_disabled         = row_count < 250
        cv_5fold_disabled_reason  = f"Each fold would have only ~{row_count // 5} samples." if cv_5fold_disabled else None
    elif row_count > 50_000:
        cv_rec    = "false"
        cv_reason = f"Large dataset ({row_count:,} rows) — cross-validation would multiply training time by {5}×. A single 80/20 split gives reliable metrics here."
        cv_10fold_disabled        = False
        cv_10fold_disabled_reason = None
        cv_5fold_disabled         = False
        cv_5fold_disabled_reason  = None
    else:
        cv_rec    = "true"
        cv_reason = f"Medium dataset ({row_count:,} rows) — 5-fold stratified CV gives more reliable metric estimates than a single split."
        cv_10fold_disabled        = row_count < 5000
        cv_10fold_disabled_reason = "10-fold CV needs at least 5000 rows for each fold to be statistically meaningful." if cv_10fold_disabled else None
        cv_5fold_disabled         = False
        cv_5fold_disabled_reason  = None

    steps.append(StepRecommendation(
        step        = "cross_validation",
        title       = "Cross-Validation",
        description = "Train and evaluate K times on different data splits. Gives more reliable metric estimates but multiplies training time by K. Optional — runs before the final train.",
        recommended = cv_rec,
        reason      = cv_reason,
        current_value = cv_rec,
        options     = [
            StepOption(value="false",   label="Disabled (single split)", is_recommended=(cv_rec=="false"),
                       description="Skip cross-validation. Fastest option — fine for large datasets."),
            StepOption(value="5fold",   label="5-Fold Stratified CV",    is_recommended=(cv_rec=="true"),
                       description="Train 5 models on different 80/20 splits. ~5× slower but much more reliable metrics.",
                       disabled=cv_5fold_disabled, disabled_reason=cv_5fold_disabled_reason),
            StepOption(value="10fold",  label="10-Fold Stratified CV",   is_recommended=False,
                       description="Train 10 models. Most reliable estimates — only practical on mid-size datasets.",
                       disabled=cv_10fold_disabled, disabled_reason=cv_10fold_disabled_reason),
        ],
    ))

    # ── Duration estimate ─────────────────────────────────────────────────────
    cv_folds_n    = 5 if cv_rec == "true" else 1
    est_duration  = _estimate_duration(row_count, num_features, use_optuna=True,
                                       cv_enabled=(cv_rec=="true"), cv_folds=cv_folds_n)

    return PipelineRecommendation(
        dataset_id     = dataset_id,
        dataset_name   = dataset_name,
        row_count      = row_count,
        feature_count  = feature_count,
        class_balance  = class_balance,
        unique_labels  = unique_labels,
        steps          = steps,
        estimated_duration_seconds = est_duration,
    )
