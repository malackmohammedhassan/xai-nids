from fastapi import APIRouter, HTTPException
from app.model_loader import load_model
from app.utils.plot_utils import generate_confusion_matrix_plot, generate_roc_curve_plot, generate_pr_curve_plot

router = APIRouter()


@router.get("/metrics")
async def get_metrics(model_id: str):
    try:
        bundle = load_model(model_id)
        metrics = bundle.get("metrics", {})
        return {
            "status": "success",
            "model_id": model_id,
            "model_type": bundle.get("model_type"),
            "mode": bundle.get("mode"),
            "metrics": metrics,
            "class_names": bundle.get("class_names"),
            "training_duration": bundle.get("training_duration"),
            "best_params": bundle.get("best_params"),
            "dataset": bundle.get("dataset"),
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
