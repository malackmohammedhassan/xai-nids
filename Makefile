.PHONY: help dev dev-backend dev-frontend build test test-backend test-frontend \
        lint install clean logs stop restart health

PYTHON ?= python
NPM    ?= npm

# ── Defaults ──────────────────────────────────────────────────────────────────
help:
	@echo "XAI-NIDS Development Targets"
	@echo "──────────────────────────────────────────"
	@echo "  dev            Start both backend and frontend in dev mode"
	@echo "  dev-backend    Start FastAPI backend only (uvicorn --reload)"
	@echo "  dev-frontend   Start Vite dev server only"
	@echo "  build          Build frontend for production"
	@echo "  test           Run all tests (backend + frontend)"
	@echo "  test-backend   Run backend pytest suite"
	@echo "  test-frontend  Run frontend Vitest suite"
	@echo "  lint           Run TypeScript and Python type checks"
	@echo "  install        Install all dependencies"
	@echo "  docker-up      Build and start all Docker services"
	@echo "  docker-down    Stop all Docker services"
	@echo "  docker-logs    Tail Docker logs"
	@echo "  clean          Remove build artifacts"
	@echo "  health         Check API health endpoint"

# ── Development ───────────────────────────────────────────────────────────────
dev:
	@echo "Starting backend & frontend …"
	$(MAKE) dev-backend &
	$(MAKE) dev-frontend

dev-backend:
	cd backend && $(PYTHON) -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	cd frontend && $(NPM) run dev

# ── Build ─────────────────────────────────────────────────────────────────────
build:
	cd frontend && $(NPM) run build

# ── Tests ─────────────────────────────────────────────────────────────────────
test: test-backend test-frontend

test-backend:
	cd backend && $(PYTHON) -m pytest tests/ -v --tb=short

test-frontend:
	cd frontend && $(NPM) run test

test-coverage:
	cd frontend && $(NPM) run test:coverage
	cd backend && $(PYTHON) -m pytest tests/ --cov=. --cov-report=html

# ── Lint / Type-check ─────────────────────────────────────────────────────────
lint:
	cd frontend && $(NPM) run typecheck
	cd backend && $(PYTHON) -m mypy main.py services/ routers/ plugins/ --ignore-missing-imports

# ── Install ───────────────────────────────────────────────────────────────────
install:
	cd backend && pip install -r requirements.txt
	cd frontend && $(NPM) install

# ── Docker ────────────────────────────────────────────────────────────────────
docker-up:
	docker compose up --build -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

docker-restart:
	docker compose restart

docker-rebuild:
	docker compose down --volumes
	docker compose up --build -d

# ── Utilities ─────────────────────────────────────────────────────────────────
clean:
	rm -rf frontend/dist frontend/node_modules/.vite
	find backend -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find backend -name "*.pyc" -delete 2>/dev/null || true

health:
	@curl -s http://localhost:8000/api/v1/health | python -m json.tool

DB_PATH ?= backend/data/experiments.db
db-shell:
	sqlite3 $(DB_PATH)
