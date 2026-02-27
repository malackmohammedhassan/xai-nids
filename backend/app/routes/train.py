import io
import pandas as pd
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from sklearn.model_selection import train_test_split
from app.preprocessing import preprocess_dataset
from app.training import train_model
from app.evaluation import evaluate_model
from app.model_loader import save_model
from app.config import RANDOM_STATE, TEST_SIZE, DATASETS_DIR
from app.utils.plot_utils import generate_confusion_matrix_plot, generate_roc_curve_plot, generate_pr_curve_plot

router = APIRouter()


@router.post("/train")
async def train_endpoint(
    file: UploadFile = File(...),
    model_type: str = Form("random_forest"),
    mode: str = Form("binary"),
    model_name: str = Form(""),
):
    try:
        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))

        save_path = DATASETS_DIR / file.filename
        with open(save_path, "wb") as f:
            f.write(contents)

        prep = preprocess_dataset(df, mode=mode)
        X = prep["X"]
        y = prep["y"]

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y
        )

        model, best_params, duration = train_model(X_train, y_train, model_type=model_type, mode=mode)
        eval_result = evaluate_model(model, X_test, y_test, class_names=prep["class_names"])

        cm_plot = generate_confusion_matrix_plot(
            eval_result["confusion_matrix"], prep["class_names"]
        )
        roc_plot = generate_roc_curve_plot(
            eval_result["y_test"], eval_result["y_prob"], prep["class_names"]
        )
        pr_plot = generate_pr_curve_plot(
            eval_result["y_test"], eval_result["y_prob"], prep["class_names"]
        )

        name = model_name.strip() if model_name.strip() else f"{model_type}_{mode}"
        bundle = {
            "model": model,
            "scaler": prep["scaler"],
            "selector": prep["selector"],
            "selected_features": prep["selected_features"],
            "label_encoder": prep["label_encoder"],
            "class_names": prep["class_names"],
            "feature_names": prep["feature_names"],
            "le_dict": prep["le_dict"],
            "original_columns": prep["original_columns"],
            "model_type": model_type,
            "mode": mode,
            "best_params": best_params,
            "training_duration": duration,
            "metrics": eval_result["metrics"],
            "dataset": file.filename,
        }
        save_model(name, bundle)

        return {
            "status": "success",
            "model_id": name,
            "model_type": model_type,
            "mode": mode,
            "training_duration": duration,
            "best_params": best_params,
            "metrics": eval_result["metrics"],
            "confusion_matrix": eval_result["confusion_matrix"],
            "classification_report": eval_result["classification_report"],
            "confusion_matrix_plot": cm_plot,
            "roc_curve_plot": roc_plot,
            "pr_curve_plot": pr_plot,
            "class_names": prep["class_names"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
