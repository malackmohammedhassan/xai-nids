import io
import pandas as pd
import numpy as np
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.model_loader import load_model
from app.preprocessing import preprocess_input

router = APIRouter()


@router.post("/predict")
async def predict_endpoint(
    file: UploadFile = File(...),
    model_id: str = Form(...),
):
    try:
        bundle = load_model(model_id)
        model = bundle["model"]
        class_names = bundle["class_names"]

        contents = await file.read()
        df = pd.read_csv(io.BytesIO(contents))

        X = preprocess_input(df, bundle)

        predictions = model.predict(X)
        probabilities = None
        if hasattr(model, "predict_proba"):
            probabilities = model.predict_proba(X)

        results = []
        for i in range(len(predictions)):
            pred_idx = int(predictions[i])
            label = class_names[pred_idx] if pred_idx < len(class_names) else str(pred_idx)
            conf = None
            prob_dict = {}
            if probabilities is not None:
                conf = round(float(np.max(probabilities[i])), 4)
                for j, cn in enumerate(class_names):
                    if j < probabilities.shape[1]:
                        prob_dict[cn] = round(float(probabilities[i][j]), 4)
            results.append({
                "index": i,
                "prediction": label,
                "confidence": conf,
                "probabilities": prob_dict,
            })

        return {
            "status": "success",
            "model_id": model_id,
            "total_samples": len(results),
            "predictions": results,
        }
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
