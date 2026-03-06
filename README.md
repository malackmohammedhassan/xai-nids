# XAI-NIDS — Explainable AI Network Intrusion Detection System

A locally deployable, visualization-first, explainable ML intelligence platform with bounded telemetry, statistical drift detection, persistent background job orchestration, and reproducible containerized deployment.

---

## Features

- **Random Forest** and **XGBoost** classifiers with Optuna hyperparameter tuning
- **Binary** (Normal vs Attack) and **Multi-class** classification modes
- **TreeSHAP** — global summary, feature importance, and local waterfall explanations
- **LIME** — instance-based explanations with stability analysis
- **CSV upload** — supports NSL-KDD, UNSW-NB15, and similar network datasets
- **SMOTE** class balancing + **RFE** feature selection
- **Dark SOC dashboard** UI with animated transitions
- **Model Manager** — list, inspect, activate, and delete saved models
- **Metrics** — Accuracy, Precision, Recall, F1, ROC-AUC, PR Curve, Confusion Matrix
- **Dockerized** — single `docker-compose up` deployment

---

## Architecture

| Layer    | Technology                                |
| -------- | ----------------------------------------- |
| Backend  | FastAPI + Python 3.11                     |
| ML       | scikit-learn, XGBoost, SHAP, LIME, Optuna |
| Frontend | React 18 + Vite + TailwindCSS + Recharts  |
| Proxy    | NGINX reverse proxy                       |
| Deploy   | Docker + docker-compose                   |

For a detailed account of every architectural decision, the engineering tradeoffs made, and the hardening measures applied, see the **[Architectural Whitepaper](docs/ARCHITECTURE_WHITEPAPER.md)**.

---

## Quick Start (Docker)

### Prerequisites

- Docker Desktop installed and running
- At least 4GB RAM available

### Run

```bash
cd xai-nids
docker-compose up --build
```

Open **http://localhost:3000** in your browser.

---

## Local Development

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server runs on `http://localhost:5173`, proxy API calls to `http://localhost:8000`.

---

## Folder Structure

```
xai-nids/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entrypoint
│   │   ├── config.py            # Configuration constants
│   │   ├── model_loader.py      # Model save/load/cache
│   │   ├── preprocessing.py     # Data cleaning, encoding, SMOTE, RFE
│   │   ├── training.py          # Optuna + model training
│   │   ├── evaluation.py        # Metrics computation
│   │   ├── shap_explainer.py    # TreeSHAP global + local
│   │   ├── lime_explainer.py    # LIME + stability analysis
│   │   ├── routes/
│   │   │   ├── train.py         # POST /train
│   │   │   ├── predict.py       # POST /predict
│   │   │   ├── explain.py       # POST /explain/shap, /explain/lime
│   │   │   ├── metrics.py       # GET /metrics
│   │   │   └── models.py        # GET/DELETE /models
│   │   └── utils/
│   │       ├── plot_utils.py    # Server-side plot generation (base64)
│   │       └── model_registry.py
│   ├── models/                  # Saved .joblib model files
│   ├── datasets/                # Uploaded CSV files
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Training.jsx
│   │   │   ├── Prediction.jsx
│   │   │   ├── Explainability.jsx
│   │   │   └── ModelManager.jsx
│   │   ├── components/
│   │   │   ├── MetricsCard.jsx
│   │   │   ├── ConfusionMatrix.jsx
│   │   │   ├── ROCChart.jsx
│   │   │   ├── SHAPSummary.jsx
│   │   │   └── LIMEExplanation.jsx
│   │   ├── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── Dockerfile
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
├── .env
└── README.md
```

---

## API Endpoints

| Method | Path            | Description                 |
| ------ | --------------- | --------------------------- |
| POST   | `/train`        | Upload CSV, train model     |
| POST   | `/predict`      | Upload CSV, get predictions |
| POST   | `/explain/shap` | Generate SHAP explanations  |
| POST   | `/explain/lime` | Generate LIME explanations  |
| GET    | `/metrics`      | Get model metrics           |
| GET    | `/models`       | List all saved models       |
| DELETE | `/models/{id}`  | Delete a saved model        |
| GET    | `/health`       | Health check                |

Interactive API docs: **http://localhost:3000/docs**

---

## Example curl Commands

### Health Check

```bash
curl http://localhost:3000/api/health
```

### Train a Model

```bash
curl -X POST http://localhost:3000/api/train \
  -F "file=@dataset.csv" \
  -F "model_type=random_forest" \
  -F "mode=binary" \
  -F "model_name=my_rf_model"
```

### Run Prediction

```bash
curl -X POST http://localhost:3000/api/predict \
  -F "file=@test_data.csv" \
  -F "model_id=my_rf_model"
```

### SHAP Explanation

```bash
curl -X POST http://localhost:3000/api/explain/shap \
  -F "file=@test_data.csv" \
  -F "model_id=my_rf_model" \
  -F "instance_idx=0"
```

### LIME Explanation

```bash
curl -X POST http://localhost:3000/api/explain/lime \
  -F "file=@test_data.csv" \
  -F "model_id=my_rf_model" \
  -F "instance_idx=0"
```

### List Models

```bash
curl http://localhost:3000/api/models
```

### Delete a Model

```bash
curl -X DELETE http://localhost:3000/api/models/my_rf_model
```

---

## Supported Datasets

- **NSL-KDD** — columns with `label` or `class` as target
- **UNSW-NB15** — columns with `label` and `attack_cat`
- Any CSV with a recognizable label/target column

---

## Troubleshooting

| Issue              | Solution                                                |
| ------------------ | ------------------------------------------------------- |
| Port 3000 in use   | Change port in `docker-compose.yml`: `"3001:80"`        |
| Training timeout   | Reduce `OPTUNA_TRIALS` in `.env`                        |
| SHAP too slow      | Reduce `SHAP_SAMPLE_SIZE` in `.env`                     |
| Docker build fails | Ensure Docker Desktop is running with enough memory     |
| CORS errors        | The NGINX proxy handles routing — all calls via `/api/` |
| Model not found    | Train a model first or check `/models` endpoint         |
| CSV parse error    | Ensure CSV is comma-separated with headers              |

---

## Environment Variables

| Variable            | Default | Description                            |
| ------------------- | ------- | -------------------------------------- |
| `OPTUNA_TRIALS`     | 30      | Number of Bayesian optimization trials |
| `SHAP_SAMPLE_SIZE`  | 500     | Max samples for SHAP computation       |
| `LIME_NUM_FEATURES` | 10      | Number of features in LIME explanation |

---

## License

MIT
