"""Experiment history endpoints."""
from __future__ import annotations

from fastapi import APIRouter

from schemas.experiment import DeleteExperimentResponse
from services import experiment_tracker

router = APIRouter()


@router.get("/experiments")
async def list_experiments():
    runs = experiment_tracker.get_all_runs()
    return {"experiments": runs, "total": len(runs)}


@router.get("/experiments/{run_id}")
async def get_experiment(run_id: str):
    return experiment_tracker.get_run(run_id)


@router.delete("/experiments/{run_id}", response_model=DeleteExperimentResponse)
async def delete_experiment(run_id: str):
    experiment_tracker.delete_run(run_id)
    return DeleteExperimentResponse(deleted=True, run_id=run_id)
