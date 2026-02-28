# Plugin System

The `xai-nids` backend uses a plugin architecture to decouple ML logic from the API layer. Each plugin provides dataset loading, model training, evaluation, and prediction for a set of model types.

---

## Architecture Overview

```
backend/
├── plugins/
│   ├── __init__.py           # Registry: load_plugin(), get_plugin(), list_plugins()
│   └── xai_ids_plugin.py     # Built-in plugin for Random Forest + XGBoost
├── app/
│   └── config.py             # PLUGIN_NAME env var selects active plugin
```

The active plugin is selected at startup via the `PLUGIN_NAME` environment variable (default: `xai_ids`).

---

## Plugin Interface

Every plugin must implement the `BasePlugin` abstract class:

```python
class BasePlugin(ABC):
    plugin_name: str            # Unique identifier
    version: str                # Semantic version
    supported_models: list[str] # e.g. ["random_forest", "xgboost"]

    def load_data(
        self,
        data_path: str,
        target_column: str,
    ) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, list[str], LabelEncoder]:
        """Load, preprocess, encode, and split data.
        Returns: X_train, X_test, y_train, y_test, feature_names, label_encoder
        """

    def train(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        model_type: str,
        hyperparameters: dict,
        progress_callback: Callable | None = None,
    ) -> tuple[Any, dict]:
        """Train model. Returns: (trained_model, train_meta).
        train_meta keys: scaler, selector, le_dict, class_names,
                         best_params, duration, original_columns
        """

    def evaluate(
        self,
        model: Any,
        X_test: np.ndarray,
        y_test: np.ndarray,
        feature_names: list[str],
    ) -> dict:
        """Evaluate model. Returns metrics, confusion_matrix, roc_curve,
        feature_importance, classification_report.
        """

    def predict(
        self,
        model_bundle: dict,
        input_rows: list[dict],
    ) -> list[dict]:
        """Run inference. Returns list of {prediction, confidence,
        class_probabilities} dicts.
        """

    def explain(
        self,
        model_bundle: dict,
        input_row: dict,
        method: str = "both",
        max_display: int = 10,
    ) -> dict:
        """Generate XAI explanation. Returns SHAP and/or LIME results."""

    def get_model_config(self, model_type: str) -> dict:
        """Return hyperparameter schema for a model type."""
```

---

## Built-in Plugin: `xai_ids`

Located at `backend/plugins/xai_ids_plugin.py`.

| Property           | Value                          |
| ------------------ | ------------------------------ |
| `plugin_name`      | `xai_ids`                      |
| `version`          | `2.0.0`                        |
| `supported_models` | `["random_forest", "xgboost"]` |

### Model Configs

**Random Forest:**
| Parameter | Type | Default | Range |
|-----------|------|---------|-------|
| `n_estimators` | int | 100 | 10–500 |
| `max_depth` | int | 10 | 2–30 |
| `min_samples_split` | int | 2 | 2–20 |
| `min_samples_leaf` | int | 1 | 1–10 |
| `max_features` | categorical | `sqrt` | `sqrt`, `log2` |

**XGBoost:**
| Parameter | Type | Default | Range |
|-----------|------|---------|-------|
| `n_estimators` | int | 100 | 10–500 |
| `max_depth` | int | 6 | 2–15 |
| `learning_rate` | float | 0.1 | 0.01–0.3 |
| `subsample` | float | 0.8 | 0.5–1.0 |
| `colsample_bytree` | float | 0.8 | 0.5–1.0 |

### Pipeline

1. **load_data:** `StandardScaler` → `LabelEncoder` → train/test split
2. **train:** `sklearn.ensemble.RandomForestClassifier` or `xgboost.XGBClassifier`
3. **evaluate:** accuracy, F1, precision, recall, ROC-AUC, confusion matrix, feature importance
4. **predict:** applies stored scaler, handles unknown labels gracefully
5. **explain:** `shap.TreeExplainer` (SHAP), `lime.lime_tabular` (LIME)

---

## Plugin Registry

```python
from plugins import get_plugin, list_plugins, get_all_supported_models

# Get the active plugin
plugin = get_plugin("xai_ids")

# List all available plugins
plugins = list_plugins()
# [{"name": "xai_ids", "version": "2.0.0", "supported_models": ["random_forest", "xgboost"]}]

# Get all supported model types (across all plugins)
models = get_all_supported_models()
# ["random_forest", "xgboost"]
```

---

## Writing a Custom Plugin

1. Create `backend/plugins/my_plugin.py`:

```python
from plugins import BasePlugin

class MyPlugin(BasePlugin):
    plugin_name = "my_plugin"
    version = "1.0.0"
    supported_models = ["my_model"]

    def load_data(self, data_path, target_column):
        # ... your implementation
        pass

    def train(self, X_train, y_train, model_type, hyperparameters, progress_callback=None):
        # ... your implementation
        pass

    # ... implement all abstract methods
```

2. Register in `backend/plugins/__init__.py`:

```python
from plugins.my_plugin import MyPlugin
_REGISTRY["my_plugin"] = MyPlugin()
```

3. Set environment variable: `PLUGIN_NAME=my_plugin`

---

## Model Bundle Format

The plugin saves a model bundle as a joblib file. The bundle dict contains:

| Key                | Type                      | Description                                |
| ------------------ | ------------------------- | ------------------------------------------ |
| `model`            | Any                       | Trained sklearn/xgboost model              |
| `feature_names`    | `list[str]`               | Feature column names (after encoding)      |
| `class_names`      | `list[str]`               | Class labels (e.g. `["Normal", "Attack"]`) |
| `scaler`           | `StandardScaler \| None`  | Fitted scaler (may be None)                |
| `selector`         | `SelectKBest \| None`     | Fitted feature selector (may be None)      |
| `le_dict`          | `dict[str, LabelEncoder]` | Per-column label encoders                  |
| `original_columns` | `list[str]`               | Original column names before encoding      |
| `model_type`       | `str`                     | e.g. `"random_forest"`                     |
