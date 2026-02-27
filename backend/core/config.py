"""
Pydantic-settings configuration — reads from .env, never hardcodes paths or values.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Directories ──────────────────────────────────────────────────────────
    dataset_upload_dir: str = "./uploaded_datasets"
    model_save_dir: str = "./saved_models"
    experiment_db_path: str = "./experiments.db"

    # ── Limits ───────────────────────────────────────────────────────────────
    max_dataset_size_mb: int = 200
    shap_max_rows: int = 5000
    optuna_trials: int = 30
    lime_num_features: int = 10
    test_size: float = 0.2
    random_state: int = 42

    # ── CORS ─────────────────────────────────────────────────────────────────
    cors_origins: List[str] = ["http://localhost:5173", "http://localhost:80"]

    # ── Logging ──────────────────────────────────────────────────────────────
    log_level: str = "INFO"

    # ── Plugin ───────────────────────────────────────────────────────────────
    plugin_dir: str = "./plugins"

    # ── ML Core ──────────────────────────────────────────────────────────────
    ml_core_path: str = "../../xai-intrusion-detection-system"

    # ── App meta ─────────────────────────────────────────────────────────────
    app_version: str = "2.0.0"
    default_plugin: str = "xai_ids"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors(cls, v: object) -> List[str]:
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                return json.loads(v)
            return [o.strip() for o in v.split(",")]
        return v  # type: ignore[return-value]

    def resolve_dirs(self) -> None:
        """Create all required directories on startup."""
        for attr in ("dataset_upload_dir", "model_save_dir"):
            path = Path(getattr(self, attr))
            path.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
