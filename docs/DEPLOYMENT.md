# Deployment Guide

---

## Docker Compose (Recommended)

```bash
cd xai-nids/
docker compose up --build
```

Services:

- `backend` → http://localhost:8000
- `frontend` → http://localhost:3000 (nginx serving Vite build)
- `nginx` → http://localhost:80 (reverse proxy, optional)

---

## Manual Local Setup

### Backend

```bash
cd xai-nids/backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # Edit as needed
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

API docs available at: http://localhost:8000/docs

### Frontend

```bash
cd xai-nids/frontend
npm install
cp .env.example .env.local      # Set VITE_API_BASE_URL
npm run dev                     # Dev server: http://localhost:5173
```

### Build for Production

```bash
npm run build   # Output: dist/
npm run preview # Preview production build locally
```

---

## Environment Variables

### Backend (`.env`)

| Variable         | Default                                       | Description                          |
| ---------------- | --------------------------------------------- | ------------------------------------ |
| `PLUGIN_NAME`    | `xai_ids`                                     | Active ML plugin                     |
| `MODEL_SAVE_DIR` | `data/models`                                 | Directory for saved model files      |
| `UPLOAD_DIR`     | `data/uploads`                                | Directory for uploaded datasets      |
| `MAX_UPLOAD_MB`  | `50`                                          | Max upload file size (MB)            |
| `MIN_ROWS`       | `50`                                          | Minimum rows required for datasets   |
| `CORS_ORIGINS`   | `http://localhost:5173,http://localhost:3000` | Allowed CORS origins                 |
| `API_VERSION`    | `2.0.0`                                       | API version string                   |
| `DEFAULT_PLUGIN` | `xai_ids`                                     | Default plugin to load at startup    |
| `RANDOM_STATE`   | `42`                                          | Random seed for reproducibility      |
| `TEST_SIZE`      | `0.2`                                         | Train/test split ratio               |
| `LOG_LEVEL`      | `INFO`                                        | Python logging level                 |
| `LOG_FORMAT`     | `json`                                        | Log output format (`json` or `text`) |
| `LOG_FILE`       | _(none)_                                      | Log file path (empty = stdout only)  |
| `SECRET_KEY`     | _(required)_                                  | App secret key                       |
| `DEBUG`          | `false`                                       | Enable debug mode                    |
| `HOST`           | `0.0.0.0`                                     | Bind host                            |
| `PORT`           | `8000`                                        | Bind port                            |

### Frontend (`.env.local`)

| Variable            | Default                        | Description          |
| ------------------- | ------------------------------ | -------------------- |
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | Backend API base URL |

---

## Docker Configuration

### `backend/Dockerfile`

- Base: `python:3.11-slim`
- Working directory: `/app`
- Installs `requirements.txt`
- Runs: `uvicorn main:app --host 0.0.0.0 --port 8000`

### `frontend/Dockerfile`

- Stage 1 (build): `node:20-alpine`, runs `npm run build`
- Stage 2 (serve): `nginx:alpine`, copies `dist/` to nginx

### `docker-compose.yml`

```yaml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: ./backend/.env
    volumes:
      - ./backend/data:/app/data # Persistent model/upload storage

  frontend:
    build: ./frontend
    ports: ["3000:80"]
    depends_on: [backend]

  nginx: # Optional reverse proxy
    build: ./nginx
    ports: ["80:80"]
    depends_on: [backend, frontend]
```

---

## Health Check

```bash
curl http://localhost:8000/api/v1/health
# {"status": "ok", "version": "2.0.0", "backend_ready": true, ...}
```

---

## Data Persistence

Models and datasets are stored on disk:

- `backend/data/models/` — joblib model bundles + JSON metadata
- `backend/data/uploads/` — uploaded datasets (UUID-named subdirectories)
- `backend/data/experiments/` — experiment run records (JSON)

Mount these as Docker volumes for persistence across container restarts.

---

## Production Checklist

- [ ] Set a strong `SECRET_KEY` in `.env`
- [ ] Set `DEBUG=false`
- [ ] Set `CORS_ORIGINS` to your actual frontend URL (not `*`)
- [ ] Mount `backend/data/` as a persistent volume
- [ ] Enable HTTPS via nginx reverse proxy with TLS certificate
- [ ] Set `LOG_FORMAT=json` and route logs to a collector (e.g. Fluentd, Loki)
- [ ] Set resource limits in `docker-compose.yml` (`mem_limit`, `cpus`)
