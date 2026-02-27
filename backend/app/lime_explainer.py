import numpy as np
import pandas as pd
import lime
import lime.lime_tabular
from app.config import LIME_NUM_FEATURES


def compute_lime_explanation(
    model, X: pd.DataFrame, instance_idx: int, feature_names: list = None,
    class_names: list = None, mode: str = "binary"
):
    if instance_idx >= X.shape[0]:
        instance_idx = 0

    names = feature_names if feature_names else X.columns.tolist()
    c_names = class_names if class_names else ["Normal", "Attack"]

    explainer = lime.lime_tabular.LimeTabularExplainer(
        training_data=X.values,
        feature_names=names,
        class_names=c_names,
        mode="classification",
        discretize_continuous=True,
        random_state=42,
    )

    instance = X.iloc[instance_idx].values

    predict_fn = model.predict_proba
    explanation = explainer.explain_instance(
        instance,
        predict_fn,
        num_features=LIME_NUM_FEATURES,
        num_samples=1000,
    )

    feature_weights = []
    for feat, weight in explanation.as_list():
        feature_weights.append({
            "feature": feat,
            "weight": round(float(weight), 6),
        })

    probabilities = {}
    probs = explanation.predict_proba
    for i, cn in enumerate(c_names):
        if i < len(probs):
            probabilities[cn] = round(float(probs[i]), 4)

    stability = compute_stability(model, X, instance_idx, explainer, names)

    return {
        "instance_idx": instance_idx,
        "feature_weights": feature_weights,
        "prediction_probabilities": probabilities,
        "stability_score": stability,
    }


def compute_stability(model, X, instance_idx, explainer, names, n_runs=5):
    instance = X.iloc[instance_idx].values
    all_weights = []
    for _ in range(n_runs):
        exp = explainer.explain_instance(
            instance, model.predict_proba,
            num_features=LIME_NUM_FEATURES, num_samples=500,
        )
        weights = dict(exp.as_list())
        all_weights.append(weights)

    all_features = set()
    for w in all_weights:
        all_features.update(w.keys())
    all_features = sorted(all_features)

    if len(all_features) == 0:
        return 1.0

    vectors = []
    for w in all_weights:
        vec = [w.get(f, 0.0) for f in all_features]
        vectors.append(vec)

    vectors = np.array(vectors)
    std_per_feature = np.std(vectors, axis=0)
    mean_std = float(np.mean(std_per_feature))
    stability = max(0.0, 1.0 - mean_std)
    return round(stability, 4)
