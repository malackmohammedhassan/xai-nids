"""
Abstract base class for all ML plugins.
A plugin wraps any ML project and exposes a standard interface to xai-nids.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Callable, Dict, List, Optional, Tuple

import pandas as pd


class BaseMLPlugin(ABC):
    plugin_name: str = ""
    plugin_version: str = "0.0.0"
    supported_models: List[str] = []

    @abstractmethod
    def get_model_config(self, model_type: str) -> Dict[str, Any]:
        """
        Return hyperparameter schema for dynamic form generation.
        Schema: {param_name: {type, default, min, max, options, description}}
        """

    @abstractmethod
    def load_data(
        self,
        filepath: str,
        target_column: str,
    ) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series, List[str], Optional[Any]]:
        """
        Load and split dataset.
        Returns: (X_train, X_test, y_train, y_test, feature_names, label_encoder_or_None)
        """

    @abstractmethod
    def preprocess(
        self,
        X_train: pd.DataFrame,
        X_test: pd.DataFrame,
    ) -> Tuple[pd.DataFrame, pd.DataFrame, Any]:
        """
        Apply preprocessing transforms.
        Returns: (X_train_processed, X_test_processed, preprocessor_artifact)
        """

    @abstractmethod
    def train(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        model_type: str,
        hyperparameters: Dict[str, Any],
        progress_callback: Callable[[str, int, int, dict], None],
    ) -> Tuple[Any, Dict[str, Any]]:
        """
        Train the model.
        progress_callback(step_name, step_number, total_steps, metrics_dict)
        Returns: (trained_model, training_metadata)
        """

    @abstractmethod
    def evaluate(
        self,
        model: Any,
        X_test: pd.DataFrame,
        y_test: pd.Series,
        feature_names: List[str],
    ) -> Dict[str, Any]:
        """
        Evaluate model performance.
        Returns full metrics dict: accuracy, f1, precision, recall,
        confusion_matrix, roc_curve, feature_importance
        """

    @abstractmethod
    def predict(
        self,
        model: Any,
        input_rows: List[Dict[str, Any]],
        feature_names: List[str],
    ) -> List[Dict[str, Any]]:
        """
        Run inference on a list of input rows.
        Returns: list of {prediction, confidence, class_probabilities}
        """

    @abstractmethod
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
        """
        Generate SHAP and/or LIME explanations.
        Returns JSON + base64 plots.
        """
