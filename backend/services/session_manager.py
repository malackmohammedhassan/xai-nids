"""
Session Manager — persists and restores frontend session state.
Stores: active_page, selected_dataset_id, selected_model_id, ui_state.
Backed by backend/session.json (tiny file, ~200 bytes).
"""
from __future__ import annotations

import json
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from core.logger import get_logger

logger = get_logger("session_manager")

_SESSION_FILE = Path(__file__).parent.parent / "session.json"


def get_session() -> dict:
    """Return the last persisted session or an empty default."""
    if not _SESSION_FILE.exists():
        return _default_session()
    try:
        data = json.loads(_SESSION_FILE.read_text())
        return data
    except Exception as exc:
        logger.warning("Failed to read session", extra={"error": str(exc)})
        return _default_session()


def save_session(
    active_page: Optional[str] = None,
    selected_dataset_id: Optional[str] = None,
    selected_model_id: Optional[str] = None,
    ui_state: Optional[Dict[str, Any]] = None,
) -> dict:
    """Upsert session state. Only provided fields are updated."""
    current = get_session()

    if active_page is not None:
        current["active_page"] = active_page
    if selected_dataset_id is not None:
        current["selected_dataset_id"] = selected_dataset_id
    if selected_model_id is not None:
        current["selected_model_id"] = selected_model_id
    if ui_state is not None:
        current["ui_state"] = ui_state

    current["updated_at"] = datetime.utcnow().isoformat()

    try:
        _SESSION_FILE.write_text(json.dumps(current, indent=2))
    except Exception as exc:
        logger.warning("Failed to save session", extra={"error": str(exc)})

    return current


def clear_session() -> None:
    if _SESSION_FILE.exists():
        _SESSION_FILE.unlink()


def _default_session() -> dict:
    return {
        "active_page": "/",
        "selected_dataset_id": None,
        "selected_model_id": None,
        "ui_state": {},
        "updated_at": datetime.utcnow().isoformat(),
    }
