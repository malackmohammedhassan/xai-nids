"""Dataset upload, summary, introspection, delete endpoints."""
from __future__ import annotations

from fastapi import APIRouter, UploadFile, File, Request
from fastapi.responses import JSONResponse

from schemas.dataset import (
    UploadResponse, DatasetSummary, IntrospectResult,
    DeleteDatasetResponse, DatasetMeta,
)
from services import dataset_service

router = APIRouter()


@router.post("/datasets/upload", response_model=UploadResponse)
async def upload_dataset(request: Request, file: UploadFile = File(...)):
    content = await file.read()
    meta = dataset_service.upload_dataset(content, file.filename or "upload.csv")
    from datetime import datetime
    return UploadResponse(
        dataset_id=meta["dataset_id"],
        filename=meta["filename"],
        rows=meta["rows"],
        columns=meta["columns"],
        size_bytes=meta["size_bytes"],
        upload_timestamp=datetime.fromisoformat(meta["upload_timestamp"]),
    )


@router.get("/datasets/list")
async def list_datasets():
    items = dataset_service.list_datasets()
    return {"datasets": items, "total": len(items)}


@router.get("/datasets/{dataset_id}/summary")
async def dataset_summary(dataset_id: str):
    return dataset_service.get_dataset_summary(dataset_id)


@router.get("/datasets/{dataset_id}/introspect")
async def introspect_dataset(dataset_id: str):
    return dataset_service.introspect_dataset(dataset_id)


@router.get("/datasets/{dataset_id}")
async def dataset_meta(dataset_id: str):
    return dataset_service.get_dataset_meta(dataset_id)


@router.delete("/datasets/{dataset_id}", response_model=DeleteDatasetResponse)
async def delete_dataset(dataset_id: str):
    dataset_service.delete_dataset(dataset_id)
    return DeleteDatasetResponse(deleted=True, dataset_id=dataset_id)
