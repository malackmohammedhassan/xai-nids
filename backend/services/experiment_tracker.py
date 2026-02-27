"""
SQLite experiment tracker — auto-creates table on first import.
"""
from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional

from core.config import get_settings
from core.exceptions import ExperimentNotFoundError
from core.logger import get_logger

logger = get_logger("experiment_tracker")

_CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS experiments (
    run_id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    model_type TEXT NOT NULL,
    dataset_filename TEXT NOT NULL,
    dataset_row_count INTEGER NOT NULL,
    hyperparameters TEXT NOT NULL,
    accuracy REAL NOT NULL,
    f1_score REAL NOT NULL,
    precision_score REAL NOT NULL,
    recall_score REAL NOT NULL,
    training_duration_seconds REAL NOT NULL,
    roc_auc REAL,
    confusion_matrix TEXT
);
"""


@contextmanager
def _conn() -> Generator[sqlite3.Connection, None, None]:
    db_path = Path(get_settings().experiment_db_path)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(db_path), check_same_thread=False)
    con.row_factory = sqlite3.Row
    try:
        con.execute(_CREATE_TABLE)
        con.commit()
        yield con
    finally:
        con.close()


def save_run(record: Dict[str, Any]) -> str:
    run_id = record.get("run_id") or str(uuid.uuid4())
    try:
        with _conn() as con:
            con.execute(
                """
                INSERT OR REPLACE INTO experiments
                (run_id, timestamp, model_type, dataset_filename, dataset_row_count,
                 hyperparameters, accuracy, f1_score, precision_score, recall_score,
                 training_duration_seconds, roc_auc, confusion_matrix)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    run_id,
                    record.get("timestamp", datetime.now(tz=timezone.utc).isoformat()),
                    record["model_type"],
                    record["dataset_filename"],
                    record["dataset_row_count"],
                    json.dumps(record.get("hyperparameters", {})),
                    float(record["accuracy"]),
                    float(record["f1_score"]),
                    float(record["precision"]),
                    float(record["recall"]),
                    float(record["training_duration_seconds"]),
                    float(record["roc_auc"]) if record.get("roc_auc") is not None else None,
                    json.dumps(record["confusion_matrix"]) if record.get("confusion_matrix") else None,
                ),
            )
            con.commit()
    except Exception as exc:
        logger.error("Failed to save experiment run", extra={"error": str(exc), "run_id": run_id})
        # Do NOT crash training — just log
    return run_id


def _row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["hyperparameters"] = json.loads(d["hyperparameters"])
    if d.get("confusion_matrix"):
        d["confusion_matrix"] = json.loads(d["confusion_matrix"])
    d["precision"] = d.pop("precision_score")
    d["recall"] = d.pop("recall_score")
    return d


def get_all_runs() -> List[dict]:
    with _conn() as con:
        rows = con.execute(
            "SELECT * FROM experiments ORDER BY timestamp DESC"
        ).fetchall()
    return [_row_to_dict(r) for r in rows]


def get_run(run_id: str) -> dict:
    with _conn() as con:
        row = con.execute(
            "SELECT * FROM experiments WHERE run_id = ?", (run_id,)
        ).fetchone()
    if row is None:
        raise ExperimentNotFoundError(f"Experiment {run_id} not found", run_id=run_id)
    return _row_to_dict(row)


def delete_run(run_id: str) -> None:
    with _conn() as con:
        result = con.execute(
            "DELETE FROM experiments WHERE run_id = ?", (run_id,)
        )
        con.commit()
    if result.rowcount == 0:
        raise ExperimentNotFoundError(f"Experiment {run_id} not found", run_id=run_id)
