import io
import pandas as pd
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.model_loader import load_model
from app.preprocessing import preprocess_input
from app.shap_explainer import compute_shap_values, get_local_shap
from app.lime_explainer import compute_lime_explanation
from app.utils.plot_utils import generate_shap_summary_plot, generate_shap_waterfall_plot

router = APIRouter()


@router.post("/explain/shap")
async def shap_explanation(
    file: UploadFile = File(...),
    model_id: str = Form(...),
    instance_idx: int = Form(0),
):
    try:
        bundle = load_model(model_id)
        model = bundle["model"]
        feature_names = bundle["feature_names"]

        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        X = preprocess_input(df, bundle)

        global_result = compute_shap_values(model, X, feature_names=feature_names)
        local_result = get_local_shap(model, X, instance_idx, feature_names=feature_names)

        summary_plot = generate_shap_summary_plot(
            global_result["shap_values"], global_result["X_sample"], feature_names
        )
        waterfall_plot = generate_shap_waterfall_plot(local_result)

        return {
            "status": "success",
            "global": {
                "feature_importance": global_result["feature_importance"],
                "summary_plot": summary_plot,
            },
            "local": {
                "instance_idx": local_result["instance_idx"],
                "contributions": local_result["contributions"],
                "expected_value": local_result["expected_value"],
                "waterfall_plot": waterfall_plot,
            },
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/explain/lime")
async def lime_explanation(
    file: UploadFile = File(...),
    model_id: str = Form(...),
    instance_idx: int = Form(0),
):
    try:
        bundle = load_model(model_id)
        model = bundle["model"]
        feature_names = bundle["feature_names"]
        class_names = bundle["class_names"]
        mode = bundle.get("mode", "binary")

        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))
        X = preprocess_input(df, bundle)

        result = compute_lime_explanation(
            model, X, instance_idx,
            feature_names=feature_names,
            class_names=class_names,
            mode=mode,
        )

        return {
            "status": "success",
            "instance_idx": result["instance_idx"],
            "feature_weights": result["feature_weights"],
            "prediction_probabilities": result["prediction_probabilities"],
            "stability_score": result["stability_score"],
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
