import io
import base64
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import roc_curve, auc, precision_recall_curve, average_precision_score
from sklearn.preprocessing import label_binarize


def _fig_to_base64(fig) -> str:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=120, bbox_inches="tight", facecolor="#1a1a2e")
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode("utf-8")
    plt.close(fig)
    return f"data:image/png;base64,{b64}"


def generate_confusion_matrix_plot(cm, class_names):
    fig, ax = plt.subplots(figsize=(6, 5))
    fig.patch.set_facecolor("#1a1a2e")
    ax.set_facecolor("#1a1a2e")
    cm_array = np.array(cm)
    sns.heatmap(
        cm_array, annot=True, fmt="d", cmap="YlOrRd",
        xticklabels=class_names, yticklabels=class_names, ax=ax,
        cbar_kws={"shrink": 0.8},
    )
    ax.set_xlabel("Predicted", color="white", fontsize=12)
    ax.set_ylabel("Actual", color="white", fontsize=12)
    ax.set_title("Confusion Matrix", color="cyan", fontsize=14, fontweight="bold")
    ax.tick_params(colors="white")
    plt.setp(ax.get_xticklabels(), color="white")
    plt.setp(ax.get_yticklabels(), color="white")
    return _fig_to_base64(fig)


def generate_roc_curve_plot(y_test, y_prob, class_names):
    if y_prob is None:
        return None

    fig, ax = plt.subplots(figsize=(6, 5))
    fig.patch.set_facecolor("#1a1a2e")
    ax.set_facecolor("#1a1a2e")

    y_test = np.array(y_test)
    y_prob = np.array(y_prob)
    n_classes = len(class_names)

    if n_classes == 2:
        if y_prob.ndim == 2:
            fpr, tpr, _ = roc_curve(y_test, y_prob[:, 1])
        else:
            fpr, tpr, _ = roc_curve(y_test, y_prob)
        roc_auc = auc(fpr, tpr)
        ax.plot(fpr, tpr, color="cyan", lw=2, label=f"ROC (AUC={roc_auc:.3f})")
    else:
        y_bin = label_binarize(y_test, classes=list(range(n_classes)))
        colors = plt.cm.Set2(np.linspace(0, 1, n_classes))
        for i in range(n_classes):
            if i < y_prob.shape[1] and i < y_bin.shape[1]:
                fpr, tpr, _ = roc_curve(y_bin[:, i], y_prob[:, i])
                roc_auc = auc(fpr, tpr)
                ax.plot(fpr, tpr, color=colors[i], lw=1.5, label=f"{class_names[i]} (AUC={roc_auc:.2f})")

    ax.plot([0, 1], [0, 1], "w--", lw=1, alpha=0.5)
    ax.set_xlabel("False Positive Rate", color="white")
    ax.set_ylabel("True Positive Rate", color="white")
    ax.set_title("ROC Curve", color="cyan", fontsize=14, fontweight="bold")
    ax.legend(loc="lower right", fontsize=8, facecolor="#1a1a2e", labelcolor="white")
    ax.tick_params(colors="white")
    ax.spines["bottom"].set_color("white")
    ax.spines["left"].set_color("white")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    return _fig_to_base64(fig)


def generate_pr_curve_plot(y_test, y_prob, class_names):
    if y_prob is None:
        return None

    fig, ax = plt.subplots(figsize=(6, 5))
    fig.patch.set_facecolor("#1a1a2e")
    ax.set_facecolor("#1a1a2e")

    y_test = np.array(y_test)
    y_prob = np.array(y_prob)
    n_classes = len(class_names)

    if n_classes == 2:
        if y_prob.ndim == 2:
            prec, rec, _ = precision_recall_curve(y_test, y_prob[:, 1])
        else:
            prec, rec, _ = precision_recall_curve(y_test, y_prob)
        ap = average_precision_score(y_test, y_prob[:, 1] if y_prob.ndim == 2 else y_prob)
        ax.plot(rec, prec, color="lime", lw=2, label=f"PR (AP={ap:.3f})")
    else:
        y_bin = label_binarize(y_test, classes=list(range(n_classes)))
        colors = plt.cm.Set2(np.linspace(0, 1, n_classes))
        for i in range(n_classes):
            if i < y_prob.shape[1] and i < y_bin.shape[1]:
                prec, rec, _ = precision_recall_curve(y_bin[:, i], y_prob[:, i])
                ap = average_precision_score(y_bin[:, i], y_prob[:, i])
                ax.plot(rec, prec, color=colors[i], lw=1.5, label=f"{class_names[i]} (AP={ap:.2f})")

    ax.set_xlabel("Recall", color="white")
    ax.set_ylabel("Precision", color="white")
    ax.set_title("Precision-Recall Curve", color="cyan", fontsize=14, fontweight="bold")
    ax.legend(loc="lower left", fontsize=8, facecolor="#1a1a2e", labelcolor="white")
    ax.tick_params(colors="white")
    ax.spines["bottom"].set_color("white")
    ax.spines["left"].set_color("white")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    return _fig_to_base64(fig)


def generate_shap_summary_plot(shap_values, X_sample, feature_names):
    import shap
    fig, ax = plt.subplots(figsize=(8, 6))
    fig.patch.set_facecolor("#1a1a2e")
    ax.set_facecolor("#1a1a2e")

    if isinstance(shap_values, list):
        sv = shap_values[1] if len(shap_values) > 1 else shap_values[0]
    elif shap_values.ndim == 3:
        sv = shap_values[1] if shap_values.shape[0] > 1 else shap_values[0]
    else:
        sv = shap_values

    shap.summary_plot(
        sv, X_sample, feature_names=feature_names,
        show=False, plot_type="bar", max_display=15,
    )
    fig2 = plt.gcf()
    fig2.patch.set_facecolor("#1a1a2e")
    for a in fig2.axes:
        a.set_facecolor("#1a1a2e")
        a.tick_params(colors="white")
        a.xaxis.label.set_color("white")
        a.yaxis.label.set_color("white")
        for spine in a.spines.values():
            spine.set_color("white")
        a.title.set_color("cyan")
    return _fig_to_base64(fig2)


def generate_shap_waterfall_plot(local_result):
    contributions = local_result["contributions"][:15]
    features = [c["feature"] for c in contributions]
    values = [c["shap_value"] for c in contributions]

    fig, ax = plt.subplots(figsize=(8, 6))
    fig.patch.set_facecolor("#1a1a2e")
    ax.set_facecolor("#1a1a2e")

    colors = ["#ff6b6b" if v > 0 else "#4ecdc4" for v in values]
    y_pos = range(len(features))
    ax.barh(y_pos, values, color=colors, edgecolor="white", linewidth=0.5)
    ax.set_yticks(y_pos)
    ax.set_yticklabels(features, color="white", fontsize=9)
    ax.set_xlabel("SHAP Value", color="white")
    ax.set_title("SHAP Waterfall (Local Explanation)", color="cyan", fontsize=14, fontweight="bold")
    ax.tick_params(colors="white")
    ax.spines["bottom"].set_color("white")
    ax.spines["left"].set_color("white")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.invert_yaxis()
    return _fig_to_base64(fig)
