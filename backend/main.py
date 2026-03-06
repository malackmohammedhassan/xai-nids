"""
XAI-NIDS FastAPI app factory.
Production-grade: CORS, middleware, exception handlers, versioned routers.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings
from core.exceptions import XAINIDSException, xai_exception_handler, generic_exception_handler
from core.logger import get_logger
from core.middleware import RequestTimingMiddleware
from routers import health, datasets, training, models, prediction, explainability, experiments
from routers import intelligence, visualizations, jobs as jobs_router, session as session_router
from routers import system as system_router, validation as validation_router

logger = get_logger("main")


def create_app() -> FastAPI:
    settings = get_settings()
    settings.resolve_dirs()

    app = FastAPI(
        title="XAI-NIDS Backend",
        description=(
            "Production-grade Explainable AI Network Intrusion Detection System API. "
            "Plugin-based ML platform — extensible without code changes."
        ),
        version=settings.app_version,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # ── CORS ─────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Custom middleware ─────────────────────────────────────────────────────
    app.add_middleware(RequestTimingMiddleware)

    # ── Exception handlers ────────────────────────────────────────────────────
    app.add_exception_handler(XAINIDSException, xai_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, generic_exception_handler)  # type: ignore[arg-type]

    # ── Versioned routers ─────────────────────────────────────────────────────
    prefix = "/api/v1"
    app.include_router(health.router, prefix=prefix, tags=["Health"])
    app.include_router(datasets.router, prefix=prefix, tags=["Datasets"])
    app.include_router(training.router, prefix=prefix, tags=["Training"])
    app.include_router(models.router, prefix=prefix, tags=["Models"])
    app.include_router(prediction.router, prefix=prefix, tags=["Prediction"])
    app.include_router(explainability.router, prefix=prefix, tags=["Explainability"])
    app.include_router(experiments.router, prefix=prefix, tags=["Experiments"])
    app.include_router(validation_router.router, prefix=prefix, tags=["Validation"])

    # ── v2 routes (intelligence, visualization, jobs, session) ────────────────
    prefix_v2 = "/api/v2"
    app.include_router(intelligence.router, prefix=prefix_v2, tags=["Intelligence"])
    app.include_router(visualizations.router, prefix=prefix_v2, tags=["Visualizations"])
    app.include_router(jobs_router.router, prefix=prefix_v2, tags=["Jobs"])
    app.include_router(session_router.router, prefix=prefix_v2, tags=["Session"])
    app.include_router(system_router.router, prefix=prefix_v2, tags=["System"])

    # ── Startup events ────────────────────────────────────────────────────────
    @app.on_event("startup")
    async def startup() -> None:
        import asyncio
        from services.training_manager import get_training_manager
        get_training_manager().state.reset()
        logger.info("XAI-NIDS backend started", extra={"version": settings.app_version})
        # Restore background jobs from disk
        try:
            from services.background_job_manager import get_job_manager
            mgr = get_job_manager()
            mgr.restore_from_disk()
            mgr.set_event_loop(asyncio.get_event_loop())
        except Exception as exc:
            logger.warning("Job manager startup warning", extra={"error": str(exc)})
        # Warm-up plugin discovery at startup
        try:
            from plugins import list_plugins
            plugins = list_plugins()
            logger.info("Plugins loaded", extra={"plugins": [p["name"] for p in plugins]})
        except Exception as exc:
            logger.warning("Plugin discovery warning on startup", extra={"error": str(exc)})

    @app.get("/")
    async def root():
        return {"message": "XAI-NIDS API v2", "docs": "/docs", "health": "/api/v1/health"}

    return app


app = create_app()
