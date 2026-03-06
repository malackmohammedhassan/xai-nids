"""
ASGI middleware: request timing, request-ID injection, slow-request warning.
"""
from __future__ import annotations

import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from core.logger import get_logger

logger = get_logger("middleware")
SLOW_THRESHOLD_MS = 5000


class RequestTimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:  # type: ignore[override]
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        start = time.perf_counter()
        response: Response = await call_next(request)
        duration_ms = int((time.perf_counter() - start) * 1000)

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Duration-Ms"] = str(duration_ms)

        log_extra = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": duration_ms,
        }

        # Record in telemetry registry
        try:
            from core.telemetry import get_registry
            reg = get_registry()
            reg.record_request(request.url.path, float(duration_ms))
            if response.status_code >= 400:
                reg.record_error(f"http_{response.status_code}")
        except Exception:
            pass  # telemetry must never break requests

        if duration_ms > SLOW_THRESHOLD_MS:
            logger.warning("Slow request detected", extra=log_extra)
        else:
            logger.info("Request handled", extra=log_extra)

        return response
