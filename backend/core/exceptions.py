"""
Custom exception hierarchy and global FastAPI exception handler.
"""
from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse


def _cors_headers(request: Request, response: JSONResponse) -> None:
    """Stamp CORS headers so the browser can read error responses."""
    try:
        from core.config import get_settings
        allowed = get_settings().cors_origins
    except Exception:
        allowed = ["http://localhost:5173"]
    origin = request.headers.get("origin", "")
    if origin and ("*" in allowed or origin in allowed):
        response.headers["access-control-allow-origin"] = origin
        response.headers["access-control-allow-credentials"] = "true"


# ── Domain exceptions ─────────────────────────────────────────────────────────

class XAINIDSException(Exception):
    """Base exception for all xai-nids errors."""
    status_code: int = 500
    error_code: str = "internal_error"

    def __init__(self, message: str, **kwargs: object) -> None:
        super().__init__(message)
        self.message = message
        self.detail = kwargs


class DatasetNotFoundError(XAINIDSException):
    status_code = 404
    error_code = "dataset_not_found"


class DatasetValidationError(XAINIDSException):
    status_code = 422
    error_code = "dataset_validation_error"


class DatasetTooLargeError(XAINIDSException):
    status_code = 413
    error_code = "file_too_large"


class ModelNotFoundError(XAINIDSException):
    status_code = 404
    error_code = "model_not_found"


class ModelNotLoadedError(XAINIDSException):
    status_code = 400
    error_code = "model_not_loaded"


class FeatureMismatchError(XAINIDSException):
    status_code = 422
    error_code = "feature_mismatch"


class TrainingInProgressError(XAINIDSException):
    status_code = 409
    error_code = "training_in_progress"


class TrainingError(XAINIDSException):
    status_code = 500
    error_code = "training_error"


class PluginError(XAINIDSException):
    status_code = 500
    error_code = "plugin_error"


class ExplainabilityOOMError(XAINIDSException):
    status_code = 507
    error_code = "out_of_memory"


class ExperimentNotFoundError(XAINIDSException):
    status_code = 404
    error_code = "experiment_not_found"


# ── Global handler ─────────────────────────────────────────────────────────────

async def xai_exception_handler(request: Request, exc: XAINIDSException) -> JSONResponse:
    from core.logger import get_logger

    logger = get_logger("exceptions")
    logger.warning(
        "Handled exception",
        extra={
            "error_code": exc.error_code,
            "error_message": exc.message,
            "path": request.url.path,
            **exc.detail,
        },
    )
    body: dict[str, object] = {
        "error": exc.error_code,
        "message": exc.message,
        **exc.detail,
    }
    resp = JSONResponse(status_code=exc.status_code, content=body)
    _cors_headers(request, resp)
    return resp


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    from core.logger import get_logger

    logger = get_logger("exceptions")
    logger.error("Unhandled exception", extra={"path": request.url.path, "exc": str(exc)})
    resp = JSONResponse(
        status_code=500,
        content={"error": "internal_error", "message": "An unexpected error occurred."},
    )
    _cors_headers(request, resp)
    return resp
