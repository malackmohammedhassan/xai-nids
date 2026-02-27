from fastapi import APIRouter, HTTPException
from app.model_loader import list_available_models, delete_model, get_model_meta

router = APIRouter()


@router.get("/models")
async def get_models():
    models = list_available_models()
    return {"status": "success", "models": models}


@router.delete("/models/{model_id}")
async def remove_model(model_id: str):
    deleted = delete_model(model_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Model '{model_id}' not found")
    return {"status": "success", "message": f"Model '{model_id}' deleted"}


@router.get("/models/{model_id}/meta")
async def model_metadata(model_id: str):
    meta = get_model_meta(model_id)
    if meta is None:
        raise HTTPException(status_code=404, detail=f"Metadata for '{model_id}' not found")
    return {"status": "success", "meta": meta}
