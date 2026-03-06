"""
Session Router — /api/v2/session
Persists and restores frontend session state (last page, selected dataset/model).
"""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Any, Dict, Optional

from core.logger import get_logger
from services import session_manager

logger = get_logger("router.session")
router = APIRouter()


class SessionUpdateRequest(BaseModel):
    active_page: Optional[str] = None
    selected_dataset_id: Optional[str] = None
    selected_model_id: Optional[str] = None
    ui_state: Optional[Dict[str, Any]] = None


@router.get("/session")
async def get_session():
    """Return the last persisted session state."""
    return session_manager.get_session()


@router.put("/session")
async def update_session(body: SessionUpdateRequest):
    """Save / update session state."""
    updated = session_manager.save_session(
        active_page=body.active_page,
        selected_dataset_id=body.selected_dataset_id,
        selected_model_id=body.selected_model_id,
        ui_state=body.ui_state,
    )
    return updated


@router.delete("/session")
async def clear_session():
    """Reset session to defaults."""
    session_manager.clear_session()
    return {"cleared": True}
