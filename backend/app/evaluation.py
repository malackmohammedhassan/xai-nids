import numpy as np
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    classification_report,
)


def evaluate_model(model, X_test, y_test, class_names=None):
    y_pred = model.predict(X_test)
    average = "binary" if len(np.unique(y_test)) <= 2 else "weighted"
    is_binary = len(np.unique(y_test)) <= 2

    metrics = {
        "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
        "precision": round(float(precision_score(y_test, y_pred, average=average, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, y_pred, average=average, zero_division=0)), 4),
        "f1_score": round(float(f1_score(y_test, y_pred, average=average, zero_division=0)), 4),
    }

    try:
        if is_binary:
            if hasattr(model, "predict_proba"):
                y_prob = model.predict_proba(X_test)[:, 1]
            else:
                y_prob = y_pred.astype(float)
            metrics["roc_auc"] = round(float(roc_auc_score(y_test, y_prob)), 4)
        else:
            if hasattr(model, "predict_proba"):
                y_prob = model.predict_proba(X_test)
                metrics["roc_auc"] = round(
                    float(roc_auc_score(y_test, y_prob, multi_class="ovr", average="weighted")), 4
                )
            else:
                metrics["roc_auc"] = None
    except Exception:
        metrics["roc_auc"] = None

    cm = confusion_matrix(y_test, y_pred).tolist()
    report = classification_report(y_test, y_pred, target_names=class_names, output_dict=True, zero_division=0)

    y_prob_all = None
    if hasattr(model, "predict_proba"):
        y_prob_all = model.predict_proba(X_test)

    return {
        "metrics": metrics,
        "confusion_matrix": cm,
        "classification_report": report,
        "y_test": y_test.tolist() if hasattr(y_test, "tolist") else list(y_test),
        "y_pred": y_pred.tolist() if hasattr(y_pred, "tolist") else list(y_pred),
        "y_prob": y_prob_all.tolist() if y_prob_all is not None else None,
        "class_names": class_names,
    }
