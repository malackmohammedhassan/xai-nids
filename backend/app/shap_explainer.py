import shap
import numpy as np
import pandas as pd
from app.config import SHAP_SAMPLE_SIZE


def compute_shap_values(model, X: pd.DataFrame, feature_names: list = None):
    if X.shape[0] > SHAP_SAMPLE_SIZE:
        X_sample = X.sample(n=SHAP_SAMPLE_SIZE, random_state=42)
    else:
        X_sample = X.copy()

    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_sample)

    if isinstance(shap_values, list):
        shap_array = np.array(shap_values)
        mean_abs = np.mean([np.abs(sv).mean(axis=0) for sv in shap_values], axis=0)
    else:
        shap_array = shap_values
        mean_abs = np.abs(shap_values).mean(axis=0)

    names = feature_names if feature_names else [f"f{i}" for i in range(X_sample.shape[1])]
    feature_importance = sorted(
        [{"feature": names[i], "importance": round(float(mean_abs[i]), 6)} for i in range(len(names))],
        key=lambda x: x["importance"],
        reverse=True,
    )

    return {
        "shap_values": shap_array,
        "X_sample": X_sample,
        "feature_importance": feature_importance,
        "expected_value": explainer.expected_value,
    }


def get_local_shap(model, X: pd.DataFrame, instance_idx: int, feature_names: list = None):
    if instance_idx >= X.shape[0]:
        instance_idx = 0

    instance = X.iloc[[instance_idx]]
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(instance)

    names = feature_names if feature_names else [f"f{i}" for i in range(instance.shape[1])]

    if isinstance(shap_values, list):
        sv = shap_values[1] if len(shap_values) > 1 else shap_values[0]
    else:
        sv = shap_values

    sv_flat = sv.flatten()
    contributions = [
        {"feature": names[i], "value": round(float(instance.iloc[0, i]), 6), "shap_value": round(float(sv_flat[i]), 6)}
        for i in range(len(names))
    ]
    contributions.sort(key=lambda x: abs(x["shap_value"]), reverse=True)

    expected = explainer.expected_value
    if isinstance(expected, (list, np.ndarray)):
        expected = float(expected[1]) if len(expected) > 1 else float(expected[0])
    else:
        expected = float(expected)

    return {
        "instance_idx": instance_idx,
        "contributions": contributions,
        "expected_value": expected,
    }
