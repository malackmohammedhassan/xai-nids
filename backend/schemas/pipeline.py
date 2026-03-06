"""
Pipeline configuration schema.

Every ML preprocessing step is represented as a Pydantic model with
strict Literal types so the API validates choices before they reach
any Python ML code.  Default values reproduce the existing "quick
train" behaviour so passing pipeline_config=None is backward-compatible.
"""
from __future__ import annotations

from typing import List, Literal, Optional
from pydantic import BaseModel, Field


# ── Per-step config models ────────────────────────────────────────────────────

class MissingValueConfig(BaseModel):
    """How to handle NaN / Inf cells."""
    strategy: Literal["drop", "mean", "median", "mode", "zero"] = "drop"


class DuplicateConfig(BaseModel):
    """Whether to remove exact-duplicate rows."""
    remove: bool = True


class OutlierConfig(BaseModel):
    """Optional outlier clipping / removal before training."""
    method: Literal["none", "iqr", "zscore"] = "none"
    threshold: float = Field(
        default=3.0,
        ge=1.0, le=5.0,
        description="IQR multiplier (method=iqr) or Z-score cutoff (method=zscore)",
    )


class LabelModeConfig(BaseModel):
    """Binary (0/1) vs multiclass label encoding."""
    mode: Literal["binary", "multiclass"] = "binary"


class EncodingConfig(BaseModel):
    """How string/categorical feature columns are encoded."""
    strategy: Literal["label", "onehot"] = "label"


class ScalingConfig(BaseModel):
    """Numeric feature scaling applied after encoding."""
    strategy: Literal["minmax", "standard", "robust", "none"] = "minmax"


class FeatureSelectionConfig(BaseModel):
    """Dimensionality reduction applied after scaling."""
    method: Literal["rfe", "kbest", "pca", "none"] = "rfe"
    n_features: int = Field(default=30, ge=5, le=200)


class ClassBalancingConfig(BaseModel):
    """Oversampling / class-weight strategy for imbalanced datasets."""
    method: Literal["smote", "adasyn", "class_weight", "none"] = "smote"


class TrainTestSplitConfig(BaseModel):
    """Train / test split parameters."""
    test_size: float = Field(default=0.2, ge=0.05, le=0.4)
    stratify: bool = True


class CrossValidationConfig(BaseModel):
    """Optional cross-validation run BEFORE the final train / test split."""
    enabled: bool = False
    folds: int = Field(default=5, ge=3, le=10)
    scoring: Literal["f1_weighted", "accuracy", "roc_auc"] = "f1_weighted"


# ── Top-level pipeline config ─────────────────────────────────────────────────

class PipelineConfig(BaseModel):
    """
    Full training pipeline configuration.

    All fields have defaults that replicate the existing Quick-Train
    behaviour, so existing API callers are not broken.
    """
    missing_values:    MissingValueConfig    = Field(default_factory=MissingValueConfig)
    duplicates:        DuplicateConfig       = Field(default_factory=DuplicateConfig)
    outliers:          OutlierConfig         = Field(default_factory=OutlierConfig)
    label_mode:        LabelModeConfig       = Field(default_factory=LabelModeConfig)
    encoding:          EncodingConfig        = Field(default_factory=EncodingConfig)
    scaling:           ScalingConfig         = Field(default_factory=ScalingConfig)
    feature_selection: FeatureSelectionConfig = Field(default_factory=FeatureSelectionConfig)
    class_balancing:   ClassBalancingConfig  = Field(default_factory=ClassBalancingConfig)
    split:             TrainTestSplitConfig  = Field(default_factory=TrainTestSplitConfig)
    cross_validation:  CrossValidationConfig = Field(default_factory=CrossValidationConfig)


# ── Recommendation types (returned by the advisor endpoint) ───────────────────

class StepOption(BaseModel):
    """One selectable option for a pipeline step."""
    value: str
    label: str
    description: str
    disabled: bool = False
    disabled_reason: Optional[str] = None   # shown in UI tooltip when disabled=True
    is_recommended: bool = False             # highlighted in UI


class StepRecommendation(BaseModel):
    """Advisor output for a single pipeline step."""
    step:        str              # e.g. "missing_values"
    title:       str              # human label  e.g. "Missing Value Strategy"
    description: str              # 1-2 sentence explanation of what this step does
    recommended: str              # value of the recommended option
    reason:      str              # why this option is recommended for THIS dataset
    options:     List[StepOption]
    current_value: str            # default / currently selected value


class PipelineRecommendation(BaseModel):
    """Full advisor response — one StepRecommendation per pipeline step."""
    dataset_id:   str
    dataset_name: str
    row_count:    int
    feature_count: int
    class_balance: Optional[str]  # e.g. "78% normal / 22% attack"
    unique_labels: List[str]
    steps:        List[StepRecommendation]
    estimated_duration_seconds: int
