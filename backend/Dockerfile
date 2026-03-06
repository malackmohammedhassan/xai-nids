# ── Stage 1: build wheels ─────────────────────────────────────────────────────
# Build tools (gcc, g++) are needed to compile C extensions (numpy, scipy, shap).
# They are NOT copied to the final image — keeps the runtime image lean.
FROM python:3.11-slim AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build
COPY requirements.txt .

# --user installs to /root/.local so we can copy that directory cleanly
RUN pip install --no-cache-dir --user -r requirements.txt

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM python:3.11-slim AS final

# libgomp1 is required at runtime by XGBoost / scikit-learn parallel ops
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy only installed packages — no compiler toolchain in production image
COPY --from=builder /root/.local /root/.local

ENV PATH=/root/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app
COPY . .

RUN mkdir -p /app/models /app/datasets /app/data

EXPOSE 8000

# Production uvicorn: no --reload, warning-level logs, 75 s keep-alive
# (--reload forks a watchdog process and disables SIGTERM graceful shutdown)
HEALTHCHECK --interval=30s --timeout=10s --retries=5 --start-period=90s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health')" || exit 1

CMD ["uvicorn", "main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--no-access-log", \
     "--log-level", "warning", \
     "--timeout-keep-alive", "75"]
