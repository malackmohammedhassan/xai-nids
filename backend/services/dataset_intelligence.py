"""
Dataset Intelligence Engine — generates a structured AI quality report for any dataset.

Scores (0–100) are computed for: completeness, imbalance, outliers, redundancy, cardinality.
Output is a DataQualityReport dataclass that can be serialized to JSON and cached.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from core.logger import get_logger

logger = get_logger("dataset_intelligence")


@dataclass
class PreprocessingRecommendation:
    priority: str            # "required" | "recommended" | "optional"
    step: str                # short label
    reason: str              # why this step is needed
    impact: str              # "High" | "Medium" | "Low"


@dataclass
class QualityIssue:
    severity: str            # "critical" | "warning" | "info"
    code: str                # e.g. "HIGH_IMBALANCE"
    message: str             # human-readable description
    affected_columns: List[str] = field(default_factory=list)


@dataclass
class DataQualityReport:
    dataset_id: str
    generated_at: str

    # Headline scores (0–100, higher = better)
    overall_quality_score: float = 0.0
    completeness_score: float = 0.0      # 100 - avg null %
    imbalance_score: float = 100.0       # 0 = severe imbalance
    outlier_score: float = 100.0         # 0 = many outliers
    redundancy_score: float = 100.0      # 0 = highly correlated features
    cardinality_score: float = 100.0     # 0 = high-cardinality columns

    # Text narrative
    summary_paragraph: str = ""
    risk_assessment: str = ""
    recommended_model: str = ""
    risk_level: str = "Unknown"   # "Low" | "Medium" | "High"

    # Actionable lists
    risk_warnings: List[str] = field(default_factory=list)
    preprocessing_steps: List[PreprocessingRecommendation] = field(default_factory=list)
    quality_issues: List[QualityIssue] = field(default_factory=list)

    # Quick stats (echoed for convenience)
    row_count: int = 0
    column_count: int = 0
    numeric_count: int = 0
    categorical_count: int = 0
    null_column_count: int = 0
    suggested_target: Optional[str] = None
    class_distribution: Dict[str, int] = field(default_factory=dict)
    imbalance_ratio: float = 1.0

    def to_dict(self) -> dict:
        d = asdict(self)
        d["preprocessing_steps"] = [asdict(s) for s in self.preprocessing_steps]
        d["quality_issues"] = [asdict(i) for i in self.quality_issues]
        return d


class DatasetIntelligenceEngine:
    """Generates DataQualityReport from a pandas DataFrame."""

    def generate_report(self, df: pd.DataFrame, dataset_id: str, suggested_target: Optional[str] = None) -> DataQualityReport:
        report = DataQualityReport(
            dataset_id=dataset_id,
            generated_at=datetime.utcnow().isoformat(),
            row_count=len(df),
            column_count=len(df.columns),
        )

        numeric_cols = df.select_dtypes(include=np.number).columns.tolist()
        cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
        report.numeric_count = len(numeric_cols)
        report.categorical_count = len(cat_cols)

        # Find target column
        target = suggested_target or self._detect_target(df)
        report.suggested_target = target

        # Score each dimension
        report.completeness_score = self._score_completeness(df)
        report.imbalance_score = self._score_imbalance(df, target)
        report.outlier_score = self._score_outliers(df, numeric_cols)
        report.redundancy_score = self._score_redundancy(df, numeric_cols)
        report.cardinality_score = self._score_cardinality(df, cat_cols)

        # Overall = weighted average
        report.overall_quality_score = round(
            0.30 * report.completeness_score
            + 0.25 * report.imbalance_score
            + 0.20 * report.outlier_score
            + 0.15 * report.redundancy_score
            + 0.10 * report.cardinality_score,
            1,
        )

        # Class distribution
        if target and target in df.columns:
            dist = df[target].value_counts().to_dict()
            report.class_distribution = {str(k): int(v) for k, v in dist.items()}
            if len(dist) >= 2:
                vals = list(dist.values())
                report.imbalance_ratio = round(max(vals) / max(min(vals), 1), 2)

        # Null columns
        null_cols = [c for c in df.columns if df[c].isnull().mean() > 0]
        report.null_column_count = len(null_cols)

        # Build risk warnings and issues
        self._build_warnings(report, df, numeric_cols, cat_cols, target)

        # Build preprocessing recommendations
        self._build_preprocessing(report, df, numeric_cols, cat_cols)

        # Risk level
        if report.overall_quality_score >= 75:
            report.risk_level = "Low"
        elif report.overall_quality_score >= 50:
            report.risk_level = "Medium"
        else:
            report.risk_level = "High"

        # Recommended model
        report.recommended_model = self._recommend_model(df, report)

        # Risk assessment text
        report.risk_assessment = self._build_risk_assessment(report)

        # Summary paragraph
        report.summary_paragraph = self._generate_summary(df, report)

        return report

    # ─── Scoring Methods ──────────────────────────────────────────────────────

    def _score_completeness(self, df: pd.DataFrame) -> float:
        null_mean = df.isnull().mean().mean()
        return round((1.0 - null_mean) * 100, 1)

    def _score_imbalance(self, df: pd.DataFrame, target: Optional[str]) -> float:
        if not target or target not in df.columns:
            return 100.0
        counts = df[target].value_counts()
        if len(counts) < 2:
            return 50.0  # single class is problematic
        ratio = counts.max() / max(counts.min(), 1)
        # ratio 1.0 → 100, ratio 2.0 → 85, ratio 5.0 → 50, ratio 10.0 → 20, ratio 50+ → 0
        score = max(0.0, round(100.0 - (ratio - 1.0) * 8.0, 1))
        return min(100.0, score)

    def _score_outliers(self, df: pd.DataFrame, numeric_cols: list) -> float:
        if not numeric_cols:
            return 100.0
        num = df[numeric_cols].select_dtypes(include=np.number)
        std = num.std().replace(0, np.nan)
        z = (num - num.mean()) / std
        outlier_row_pct = (z.abs() > 3).any(axis=1).mean()
        return round((1.0 - outlier_row_pct) * 100, 1)

    def _score_redundancy(self, df: pd.DataFrame, numeric_cols: list) -> float:
        if len(numeric_cols) < 2:
            return 100.0
        try:
            corr = df[numeric_cols].corr().abs()
            upper = corr.where(np.triu(np.ones(corr.shape), k=1).astype(bool))
            n_high = int((upper > 0.95).sum().sum())
            total_pairs = len(numeric_cols) * (len(numeric_cols) - 1) / 2
            return round((1.0 - n_high / max(total_pairs, 1)) * 100, 1)
        except Exception:
            return 100.0

    def _score_cardinality(self, df: pd.DataFrame, cat_cols: list) -> float:
        if not cat_cols:
            return 100.0
        high_card = [c for c in cat_cols if df[c].nunique() > 50]
        ratio = len(high_card) / len(cat_cols)
        return round((1.0 - ratio) * 100, 1)

    # ─── Helpers ──────────────────────────────────────────────────────────────

    def _detect_target(self, df: pd.DataFrame) -> Optional[str]:
        keywords = ["label", "attack", "class", "target", "category", "anomaly", "intrusion"]
        for col in df.columns:
            if any(kw in col.lower() for kw in keywords):
                return col
        return df.columns[-1] if len(df.columns) > 0 else None

    def _build_warnings(
        self,
        report: DataQualityReport,
        df: pd.DataFrame,
        numeric_cols: list,
        cat_cols: list,
        target: Optional[str],
    ) -> None:
        warnings = []
        issues = []

        # Imbalance
        if report.imbalance_ratio >= 10:
            warnings.append(
                f"⚠ Severe class imbalance — ratio {report.imbalance_ratio}:1. "
                "Model will be biased toward majority class. Use SMOTE or class_weight='balanced'."
            )
            issues.append(QualityIssue(
                severity="critical", code="SEVERE_IMBALANCE",
                message=f"Class imbalance ratio is {report.imbalance_ratio}:1 (threshold: 10:1).",
            ))
        elif report.imbalance_ratio >= 3:
            warnings.append(
                f"⚠ Moderate class imbalance — ratio {report.imbalance_ratio}:1. "
                "Consider stratified train/test split."
            )
            issues.append(QualityIssue(
                severity="warning", code="MODERATE_IMBALANCE",
                message=f"Class imbalance ratio is {report.imbalance_ratio}:1.",
            ))

        # Missing values
        heavy_null = [c for c in df.columns if df[c].isnull().mean() > 0.30]
        if heavy_null:
            warnings.append(
                f"⚠ {len(heavy_null)} column(s) have >30% missing values: {', '.join(heavy_null[:3])}{'...' if len(heavy_null) > 3 else ''}."
            )
            issues.append(QualityIssue(
                severity="warning", code="HIGH_NULL_RATE",
                message=f"{len(heavy_null)} columns with >30% null values.",
                affected_columns=heavy_null[:10],
            ))

        # High cardinality
        high_card = [c for c in cat_cols if df[c].nunique() > 50]
        if high_card:
            warnings.append(
                f"⚠ {len(high_card)} high-cardinality categorical column(s): {', '.join(high_card[:3])}. "
                "May cause overfitting — consider grouping rare values."
            )
            issues.append(QualityIssue(
                severity="warning", code="HIGH_CARDINALITY",
                message=f"{len(high_card)} categorical columns with >50 unique values.",
                affected_columns=high_card[:10],
            ))

        # Constant columns
        constant = [c for c in df.columns if df[c].nunique() <= 1]
        if constant:
            warnings.append(
                f"⚠ {len(constant)} column(s) have a single unique value and provide no information: {', '.join(constant[:3])}."
            )
            issues.append(QualityIssue(
                severity="warning", code="CONSTANT_COLUMNS",
                message=f"{len(constant)} constant columns detected.",
                affected_columns=constant[:10],
            ))

        # Redundancy
        if report.redundancy_score < 70:
            warnings.append(
                "⚠ Many highly-correlated feature pairs detected (r > 0.95). "
                "RFE (Recursive Feature Elimination) will help reduce redundancy."
            )
            issues.append(QualityIssue(
                severity="info", code="HIGH_FEATURE_CORRELATION",
                message="Multiple feature pairs with Pearson r > 0.95.",
            ))

        # Small dataset
        if report.row_count < 1000:
            warnings.append(
                f"⚠ Small dataset ({report.row_count:,} rows). "
                "Model results may not generalize well. Consider cross-validation."
            )

        report.risk_warnings = warnings
        report.quality_issues = issues

    def _build_preprocessing(
        self,
        report: DataQualityReport,
        df: pd.DataFrame,
        numeric_cols: list,
        cat_cols: list,
    ) -> None:
        steps = []

        # Missing values
        null_cols = [c for c in df.columns if df[c].isnull().any()]
        if null_cols:
            steps.append(PreprocessingRecommendation(
                priority="required",
                step="Impute Missing Values",
                reason=f"{len(null_cols)} column(s) contain null values.",
                impact="High",
            ))

        # Categorical encoding
        if cat_cols:
            steps.append(PreprocessingRecommendation(
                priority="required",
                step="Encode Categorical Features",
                reason=f"{len(cat_cols)} string column(s) must be converted to numbers.",
                impact="High",
            ))

        # Scaling
        if numeric_cols:
            steps.append(PreprocessingRecommendation(
                priority="required",
                step="Scale Numeric Features (StandardScaler)",
                reason="Numeric ranges vary widely — scaling prevents large-value features from dominating.",
                impact="High",
            ))

        # Feature selection
        if report.column_count > 15:
            steps.append(PreprocessingRecommendation(
                priority="recommended",
                step="Feature Selection (RFE)",
                reason=f"{report.column_count} features — RFE can improve performance by removing noise.",
                impact="Medium",
            ))

        # Imbalance handling
        if report.imbalance_ratio >= 3:
            steps.append(PreprocessingRecommendation(
                priority="recommended",
                step="Handle Class Imbalance (SMOTE or class_weight)",
                reason=f"Imbalance ratio {report.imbalance_ratio}:1 will bias model toward majority class.",
                impact="High",
            ))

        # Constant column removal
        constant = [c for c in df.columns if df[c].nunique() <= 1]
        if constant:
            steps.append(PreprocessingRecommendation(
                priority="required",
                step="Remove Constant Columns",
                reason=f"{len(constant)} column(s) have a single value and contribute no information.",
                impact="Medium",
            ))

        report.preprocessing_steps = steps

    def _recommend_model(self, df: pd.DataFrame, report: DataQualityReport) -> str:
        has_mixed = report.numeric_count > 0 and report.categorical_count > 0
        is_large = report.row_count > 50_000

        if is_large:
            return "XGBoost — handles large datasets efficiently with gradient boosting."
        if has_mixed:
            return "Random Forest — robust to mixed feature types, handles noise well, requires less tuning."
        return "Random Forest — good default choice for tabular classification tasks."

    def _build_risk_assessment(self, report: DataQualityReport) -> str:
        level = report.risk_level
        score = report.overall_quality_score
        reasons = []
        if report.imbalance_score < 60:
            reasons.append("class imbalance")
        if report.completeness_score < 80:
            reasons.append("missing values")
        if report.redundancy_score < 70:
            reasons.append("feature redundancy")
        if report.cardinality_score < 70:
            reasons.append("high-cardinality categories")

        if not reasons:
            return f"{level} risk — Dataset quality is {score:.0f}/100. Ready for ML with standard preprocessing."
        return (
            f"{level} risk — Dataset quality is {score:.0f}/100. "
            f"Main concerns: {', '.join(reasons)}. "
            "Follow the preprocessing checklist before training."
        )

    def _generate_summary(self, df: pd.DataFrame, report: DataQualityReport) -> str:
        rows = f"{report.row_count:,}"
        cols = report.column_count
        num = report.numeric_count
        cat = report.categorical_count

        # Class distribution summary
        dist_text = ""
        if report.class_distribution:
            total = sum(report.class_distribution.values())
            parts = [
                f"{cls}: {cnt/total*100:.1f}%"
                for cls, cnt in sorted(report.class_distribution.items(), key=lambda x: -x[1])[:3]
            ]
            dist_text = f" Class distribution: {', '.join(parts)}."
            if report.imbalance_ratio >= 3:
                dist_text += f" Imbalance ratio {report.imbalance_ratio}:1."

        # Null summary
        null_text = ""
        if report.null_column_count > 0:
            null_text = f" {report.null_column_count} column(s) contain missing values."

        # Quality descriptor
        if report.overall_quality_score >= 80:
            quality_desc = "Excellent"
        elif report.overall_quality_score >= 65:
            quality_desc = "Good"
        elif report.overall_quality_score >= 50:
            quality_desc = "Moderate"
        else:
            quality_desc = "Poor"

        return (
            f"This dataset contains {rows} rows and {cols} features "
            f"({num} numeric, {cat} categorical)."
            f"{dist_text}"
            f"{null_text}"
            f" Overall data quality is {quality_desc} ({report.overall_quality_score:.0f}/100)."
            f" {report.recommended_model}"
        )


# Singleton engine instance
_engine: Optional[DatasetIntelligenceEngine] = None


def get_intelligence_engine() -> DatasetIntelligenceEngine:
    global _engine
    if _engine is None:
        _engine = DatasetIntelligenceEngine()
    return _engine
