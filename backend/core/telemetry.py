"""
Telemetry Registry — bounded in-memory metrics aggregation.

Memory guarantees
-----------------
- Per-route:  fixed deque(maxlen=500) for percentiles + histogram buckets
- Route cap:  at most MAX_ROUTES distinct paths (oldest evicted)
- Inference:  deque(maxlen=500) per model, at most MAX_MODELS
- Training:   deque(maxlen=50)
- Uploads:    deque(maxlen=100)

Thread-safety: single threading.Lock across all writes and reads.
Export: GET /api/v2/system/metrics -> summary()
"""
from __future__ import annotations

import re
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Deque, Dict, Optional, Tuple

_lock = threading.Lock()

MAX_ROUTES = 200
MAX_MODELS = 100
_BUCKETS: Tuple[int, ...] = (50, 100, 200, 500, 1000)


def _bucket_label(upper: Optional[int]) -> str:
    return f"<{upper}ms" if upper else ">=1000ms"


@dataclass
class RouteMetrics:
    """Per-route bounded stats."""
    _recent: Deque[float] = field(default_factory=lambda: deque(maxlen=500))
    _histogram: Dict[str, int] = field(default_factory=dict)
    total_count: int = 0
    total_error_count: int = 0

    def __post_init__(self) -> None:
        for b in _BUCKETS:
            self._histogram[_bucket_label(b)] = 0
        self._histogram[_bucket_label(None)] = 0

    def record(self, ms: float, is_error: bool = False) -> None:
        self._recent.append(ms)
        self.total_count += 1
        if is_error:
            self.total_error_count += 1
        for b in _BUCKETS:
            if ms < b:
                self._histogram[_bucket_label(b)] += 1
                return
        self._histogram[_bucket_label(None)] += 1

    def snapshot(self) -> Dict:
        samples = sorted(self._recent)
        n = len(samples)
        if n == 0:
            p50 = p95 = p99 = mean_ms = max_ms = 0.0
        else:
            p50 = samples[int(n * 0.50)]
            p95 = samples[min(int(n * 0.95), n - 1)]
            p99 = samples[min(int(n * 0.99), n - 1)]
            mean_ms = sum(samples) / n
            max_ms = samples[-1]
        return {
            "count": self.total_count,
            "error_count": self.total_error_count,
            "p50_ms": round(p50, 1),
            "p95_ms": round(p95, 1),
            "p99_ms": round(p99, 1),
            "mean_ms": round(mean_ms, 1),
            "max_ms": round(max_ms, 1),
            "histogram": dict(self._histogram),
        }


@dataclass
class InferenceMetrics:
    """Per-model inference tracking."""
    _recent: Deque[float] = field(default_factory=lambda: deque(maxlen=500))
    total_count: int = 0

    def record(self, ms: float) -> None:
        self._recent.append(ms)
        self.total_count += 1

    def snapshot(self) -> Dict:
        samples = sorted(self._recent)
        n = len(samples)
        if n == 0:
            return {"count": self.total_count, "p50_ms": 0, "p95_ms": 0}
        return {
            "count": self.total_count,
            "p50_ms": round(samples[int(n * 0.50)], 1),
            "p95_ms": round(samples[min(int(n * 0.95), n - 1)], 1),
        }


class TelemetryRegistry:
    """Singleton -- all data memory-bounded."""

    def __init__(self) -> None:
        self._routes: Dict[str, RouteMetrics] = {}
        self._route_insert_order: Deque[str] = deque()
        self._error_counts: Dict[str, int] = defaultdict(int)
        self._inference: Dict[str, InferenceMetrics] = {}
        self._inference_insert_order: Deque[str] = deque()
        self._training_runs: Deque[dict] = deque(maxlen=50)
        self._dataset_sizes: Deque[int] = deque(maxlen=100)
        self._start_time = time.time()

    def _get_route(self, key: str) -> RouteMetrics:
        if key not in self._routes:
            if len(self._routes) >= MAX_ROUTES:
                oldest = self._route_insert_order.popleft()
                self._routes.pop(oldest, None)
            self._routes[key] = RouteMetrics()
            self._route_insert_order.append(key)
        return self._routes[key]

    def _get_inference(self, model_id: str) -> InferenceMetrics:
        if model_id not in self._inference:
            if len(self._inference) >= MAX_MODELS:
                oldest = self._inference_insert_order.popleft()
                self._inference.pop(oldest, None)
            self._inference[model_id] = InferenceMetrics()
            self._inference_insert_order.append(model_id)
        return self._inference[model_id]

    def record_request(self, path: str, duration_ms: float, is_error: bool = False) -> None:
        with _lock:
            self._get_route(_normalize_path(path)).record(duration_ms, is_error)

    def record_error(self, error_code: str) -> None:
        with _lock:
            self._error_counts[error_code] += 1

    def record_inference(self, model_id: str, duration_ms: float) -> None:
        with _lock:
            self._get_inference(model_id).record(duration_ms)

    def record_training(
        self,
        model_type: str,
        duration_s: float,
        accuracy: Optional[float],
        row_count: int,
    ) -> None:
        with _lock:
            self._training_runs.append({
                "model_type": model_type,
                "duration_s": round(duration_s, 2),
                "accuracy": round(accuracy, 4) if accuracy is not None else None,
                "row_count": row_count,
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            })

    def record_dataset_upload(self, size_bytes: int) -> None:
        with _lock:
            self._dataset_sizes.append(size_bytes)

    def summary(self) -> dict:
        with _lock:
            uptime = round(time.time() - self._start_time, 1)
            routes = {
                path: m.snapshot()
                for path, m in sorted(
                    self._routes.items(), key=lambda kv: kv[1].total_count, reverse=True
                )
            }
            errors = dict(
                sorted(self._error_counts.items(), key=lambda kv: kv[1], reverse=True)
            )
            inference = {mid: m.snapshot() for mid, m in self._inference.items()}
            sizes = list(self._dataset_sizes)
            total_requests = sum(m.total_count for m in self._routes.values())
            total_errors = sum(errors.values())
            error_rate = round(total_errors / max(total_requests, 1) * 100, 2)
            return {
                "uptime_seconds": uptime,
                "total_requests": total_requests,
                "total_errors": total_errors,
                "error_rate_pct": error_rate,
                "routes": routes,
                "errors": errors,
                "inference": inference,
                "training": list(self._training_runs),
                "dataset_upload_sizes_bytes": sizes,
                "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }

    def reset(self) -> None:
        """Reset all counters -- for test isolation."""
        with _lock:
            self._routes.clear()
            self._route_insert_order.clear()
            self._error_counts.clear()
            self._inference.clear()
            self._inference_insert_order.clear()
            self._training_runs.clear()
            self._dataset_sizes.clear()


_UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I)
_MODEL_ID_RE = re.compile(r"[a-z_]+_\d{8}_\d{6}_[a-z0-9]+")
_HEX_ID_RE = re.compile(r"\b[0-9a-f]{8,}\b")
_INT_SEGMENT_RE = re.compile(r"/\d+(?=/|$)")


def _normalize_path(path: str) -> str:
    """Collapse dynamic segments so distinct route keys stay bounded."""
    path = _UUID_RE.sub("{id}", path)
    path = _MODEL_ID_RE.sub("{model_id}", path)
    path = _HEX_ID_RE.sub("{id}", path)
    path = _INT_SEGMENT_RE.sub("/{n}", path)
    return path


_registry: Optional[TelemetryRegistry] = None


def get_registry() -> TelemetryRegistry:
    global _registry
    if _registry is None:
        with _lock:
            if _registry is None:
                _registry = TelemetryRegistry()
    return _registry
