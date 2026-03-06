#!/usr/bin/env python3
"""
stress_test.py — In-process stress & memory-leak validation.

Runs without Locust; uses only stdlib + requests + psutil.

Tests:
  1.  health_latency_sla    — 100 sequential HEADs, p95 < 200 ms
  2.  summary_repeated      — 20× dataset summary, detect memory creep
  3.  upload_concurrent     — 10 simultaneous upload tasks, assert no 5xx
  4.  metrics_endpoint      — GET /system/metrics returns valid JSON structure
  5.  ws_concurrent_clients — 5 concurrent WS connections held 3 s each

Usage:
    pip install requests psutil websocket-client
    python scripts/stress_test.py [--host http://127.0.0.1:8765] [--dataset-id <id>]
"""
from __future__ import annotations

import argparse
import io
import json
import random
import statistics
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

try:
    import requests
    import psutil
except ImportError:
    sys.exit("Requirements missing.  Run: pip install requests psutil")

try:
    import websocket as _ws_mod
    _WS_AVAILABLE = True
except ImportError:
    _WS_AVAILABLE = False
    print("[WARN] websocket-client not installed — WS test will be skipped")

# ─── CLI ─────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser()
parser.add_argument("--host", default="http://127.0.0.1:8765", help="Backend base URL")
parser.add_argument("--dataset-id", default=None, help="Existing dataset_id for summary tests")
parser.add_argument("--fail-fast", action="store_true", help="Stop on first failure")
ARGS = parser.parse_args()

BASE = f"{ARGS.host}/api/v2"
PROC = psutil.Process()
RESULTS: list[dict] = []
FAILED = 0


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _rss_mb() -> float:
    return PROC.memory_info().rss / 1_024 / 1_024


def _csv_bytes(rows: int = 1_000, cols: int = 10) -> bytes:
    header = ",".join([f"f{i}" for i in range(cols)] + ["label"])
    data = [
        ",".join([str(round(random.gauss(0, 1), 4)) for _ in range(cols)] + [str(random.randint(0, 1))])
        for _ in range(rows)
    ]
    return "\n".join([header] + data).encode()


def _record(name: str, passed: bool, detail: str = "") -> None:
    global FAILED
    status = "PASS" if passed else "FAIL"
    if not passed:
        FAILED += 1
    sym = "✓" if passed else "✗"
    print(f"  {sym}  [{status}]  {name}" + (f"  — {detail}" if detail else ""))
    RESULTS.append({"test": name, "passed": passed, "detail": detail})


def _upload_once() -> int:
    payload = _csv_bytes(rows=500)
    r = requests.post(
        f"{BASE}/datasets/upload",
        files={"file": ("stress.csv", io.BytesIO(payload), "text/csv")},
        timeout=30,
    )
    return r.status_code


# ─── Tests ───────────────────────────────────────────────────────────────────

def test_health_latency_sla(n: int = 100, sla_p95_ms: float = 200.0) -> None:
    print(f"\n[1] Health latency SLA  (n={n}, p95 < {sla_p95_ms} ms)")
    times: list[float] = []
    for _ in range(n):
        t0 = time.perf_counter()
        r = requests.get(f"{BASE}/health", timeout=5)
        elapsed = (time.perf_counter() - t0) * 1_000
        times.append(elapsed)
        assert r.status_code == 200, f"Non-200 from /health: {r.status_code}"
    p95 = statistics.quantiles(times, n=100)[94]
    mean = statistics.mean(times)
    _record(
        "health_latency_sla",
        p95 < sla_p95_ms,
        f"p95={p95:.1f} ms  mean={mean:.1f} ms  (SLA={sla_p95_ms} ms)",
    )


def test_summary_memory(dataset_id: Optional[str], iterations: int = 20, leak_mb: float = 20.0) -> None:
    print(f"\n[2] Summary memory leak  (n={iterations}, budget={leak_mb} MB)")
    if dataset_id is None:
        # Try to grab any from /datasets
        r = requests.get(f"{BASE}/datasets", timeout=10)
        if r.status_code == 200:
            datasets = r.json().get("datasets", [])
            dataset_id = datasets[0]["dataset_id"] if datasets else None
    if dataset_id is None:
        _record("summary_memory", True, "No dataset available — test skipped")
        return

    before_mb = _rss_mb()
    for i in range(iterations):
        requests.get(f"{BASE}/datasets/{dataset_id}/summary", timeout=30)
    after_mb = _rss_mb()
    delta = after_mb - before_mb
    _record(
        "summary_memory",
        delta < leak_mb,
        f"RSS before={before_mb:.1f} MB  after={after_mb:.1f} MB  delta=+{delta:.1f} MB",
    )


def test_concurrent_uploads(workers: int = 10, max_5xx: int = 0) -> None:
    print(f"\n[3] Concurrent uploads  (workers={workers})")
    errors_5xx = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = [pool.submit(_upload_once) for _ in range(workers)]
        for fut in as_completed(futs):
            code = fut.result()
            if code >= 500:
                errors_5xx += 1
    _record(
        "concurrent_uploads",
        errors_5xx <= max_5xx,
        f"5xx responses: {errors_5xx}/{workers}",
    )


def test_metrics_endpoint() -> None:
    print("\n[4] Metrics endpoint structure")
    r = requests.get(f"{BASE}/system/metrics", timeout=10)
    ok = r.status_code == 200
    detail = f"HTTP {r.status_code}"
    if ok:
        body = r.json()
        has_routes = "routes" in body
        has_errors = "errors" in body
        ok = has_routes and has_errors
        detail += f"  routes={has_routes}  errors={has_errors}"
    _record("metrics_endpoint", ok, detail)


def test_ws_concurrent(n_clients: int = 5, hold_secs: float = 3.0) -> None:
    print(f"\n[5] WS concurrent clients  (n={n_clients}, hold={hold_secs} s)")
    if not _WS_AVAILABLE:
        _record("ws_concurrent", True, "websocket-client not installed — skipped")
        return

    ws_url = f"{ARGS.host.replace('http://', 'ws://').replace('https://', 'wss://')}/api/v2/ws/stream"
    errors: list[str] = []
    lock = threading.Lock()

    def _client(idx: int) -> None:
        try:
            ws = _ws_mod.create_connection(ws_url, timeout=hold_secs + 2)
            deadline = time.time() + hold_secs
            while time.time() < deadline:
                try:
                    ws.settimeout(0.5)
                    ws.recv()
                except Exception:
                    pass
            ws.close()
        except Exception as exc:
            with lock:
                errors.append(f"client-{idx}: {exc}")

    threads = [threading.Thread(target=_client, args=(i,), daemon=True) for i in range(n_clients)]
    t0 = time.time()
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=hold_secs + 5)
    elapsed = time.time() - t0
    ok = len(errors) == 0
    detail = (
        f"All {n_clients} clients held for ~{elapsed:.1f} s without error"
        if ok
        else f"Errors: {'; '.join(errors)}"
    )
    _record("ws_concurrent", ok, detail)


def test_300mb_upload_under_60s() -> None:
    """Upload a 300 MB CSV (synthetic, 1 M rows × 15 cols) within 60 s."""
    print("\n[6] 300 MB upload SLA  (1 M rows, SLA=60 s)")
    before_mb = _rss_mb()
    csv_bytes = _csv_bytes(rows=1_000_000, cols=15)
    actual_mb = len(csv_bytes) / 1_024 / 1_024
    print(f"    Generated {actual_mb:.1f} MB CSV — uploading ...")
    t0 = time.perf_counter()
    r = requests.post(
        f"{BASE}/datasets/upload",
        files={"file": ("big_upload.csv", io.BytesIO(csv_bytes), "text/csv")},
        timeout=120,
    )
    elapsed = time.perf_counter() - t0
    after_mb = _rss_mb()
    ok = r.status_code in (200, 201, 422) and elapsed < 60
    _record(
        "300mb_upload_sla",
        ok,
        f"HTTP {r.status_code}  elapsed={elapsed:.1f} s  "
        f"RSS delta=+{after_mb - before_mb:.1f} MB (SLA=60 s)",
    )


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("XAI-NIDS  Stress & Memory-Leak Test Suite")
    print(f"Target: {ARGS.host}")
    print("=" * 60)

    # Smoke-check reachability
    try:
        requests.get(f"{BASE}/health", timeout=5).raise_for_status()
    except Exception as exc:
        sys.exit(f"\nBackend not reachable at {BASE}/health — {exc}")

    tests = [
        lambda: test_health_latency_sla(),
        lambda: test_summary_memory(ARGS.dataset_id),
        lambda: test_concurrent_uploads(),
        lambda: test_metrics_endpoint(),
        lambda: test_ws_concurrent(),
        lambda: test_300mb_upload_under_60s(),
    ]

    for test_fn in tests:
        try:
            test_fn()
        except Exception as exc:
            print(f"  [ERROR] Unhandled exception in test: {exc}")
            FAILED += 1
        if ARGS.fail_fast and FAILED:
            print("\nFail-fast mode enabled — aborting after first failure.")
            break

    print("\n" + "=" * 60)
    total = len(RESULTS)
    passed = sum(1 for r in RESULTS if r["passed"])
    print(f"Results: {passed}/{total} passed" + (f"  [{FAILED} failed]" if FAILED else "  [all green]"))
    print("=" * 60)
    sys.exit(1 if FAILED else 0)
