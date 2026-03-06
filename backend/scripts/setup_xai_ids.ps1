# ================================
# XAI-IDS PROJECT SETUP SCRIPT
# For Windows PowerShell
# ================================

# -------- 1. BASIC SETTINGS --------
$repoName   = "xai-intrusion-detection-system"
$pythonExe  = "python"   # change to 'py' if you normally use: py -3
$venvName   = "venv"

Write-Host "Creating project folder: $repoName"
New-Item -ItemType Directory -Path $repoName -Force | Out-Null
Set-Location $repoName

# -------- 2. CREATE ROOT FILES --------
Write-Host "Creating root files..."

@"
# XAI-Enhanced Intrusion Detection System

Explainable AI (SHAP + LIME) based Network Intrusion Detection System for
Machine Learning – MDI4001, Winter 2025-2026.

Team:
- MALACK MOHAMMED HASSAN (23MID0355)
- MOHAMMED FARAAZ ISHAQUE M (23MID0129)
- MOHAMMED SAAD R K (23MID0236)
"@ | Out-File -Encoding UTF8 README.md

@"
# Ignore Python stuff
$venvName/
__pycache__/
*.pyc
*.pyo
*.pyd
.env
.env.*
*.sqlite3
.ipynb_checkpoints/
.pytest_cache/
.mypy_cache/
.vscode/
.idea/
.DS_Store
"@ | Out-File -Encoding UTF8 .gitignore

@"
MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
"@ | Out-File -Encoding UTF8 LICENSE

@"
pandas==1.5.3
numpy==1.24.3
scikit-learn==1.3.0
xgboost==1.7.6
shap==0.42.0
lime==0.2.0
flask==2.3.2
streamlit==1.25.0
matplotlib==3.7.1
seaborn==0.12.2
plotly==5.14.0
docker==6.1.3
pytest==7.4.0
jupyter==1.0.0
python-dotenv==1.0.0
"@ | Out-File -Encoding UTF8 requirements.txt

@"
pylint
black
isort
mypy
"@ | Out-File -Encoding UTF8 requirements-dev.txt

New-Item -ItemType File -Name "setup.py" -Force | Out-Null
New-Item -ItemType File -Name "Makefile" -Force | Out-Null
New-Item -ItemType File -Name ".env.example" -Force | Out-Null
New-Item -ItemType File -Name "setup.sh" -Force | Out-Null

# -------- 3. CREATE FOLDER STRUCTURE --------
Write-Host "Creating folder structure..."

# Helper function
function New-Dir($path) {
    New-Item -ItemType Directory -Path $path -Force | Out-Null
}

New-Dir "docs"
New-Dir "docs\images"

New-Dir "data"
New-Dir "data\raw\NSL-KDD"
New-Dir "data\raw\UNSW-NB15"
New-Dir "data\processed"

New-Dir "src"
New-Dir "src\preprocessing"
New-Dir "src\models"
New-Dir "src\explainability"
New-Dir "src\api"
New-Dir "src\dashboard\flask_templates"
New-Dir "src\dashboard\static\css"
New-Dir "src\dashboard\static\js"
New-Dir "src\dashboard\static\images"
New-Dir "src\evaluation"
New-Dir "src\deployment"
New-Dir "src\utils"

New-Dir "notebooks"
New-Dir "tests"
New-Dir "configs"
New-Dir "docker"
New-Dir "models\artifacts"
New-Dir "results\performance_metrics"
New-Dir "results\explanations"
New-Dir "results\reports"
New-Dir "results\logs"
New-Dir "references\supporting_papers"
New-Dir ".github\workflows"

# -------- 4. SEED KEY FILES PER MODULE --------
Write-Host "Seeding Python modules..."

# __init__.py files
@("src","src\preprocessing","src\models","src\explainability","src\api",
  "src\dashboard","src\evaluation","src\deployment","src\utils","tests") |
    ForEach-Object { New-Item -ItemType File -Path "$_\__init__.py" -Force | Out-Null }

# Preprocessing
@"
\"\"\"Dataset loader (Member 1 - Malack).\"\"\"

def load_dataset(name: str):
    \"\"\"Placeholder loader. Implement NSL-KDD / UNSW-NB15 loading here.\"\"\"
    raise NotImplementedError
"@ | Out-File -Encoding UTF8 "src\preprocessing\loader.py"

@"
\"\"\"Data cleaning and validation utilities.\"\"\"
"@ | Out-File -Encoding UTF8 "src\preprocessing\cleaner.py"

@"
\"\"\"Categorical feature encoders.\"\"\"
"@ | Out-File -Encoding UTF8 "src\preprocessing\encoder.py"

@"
\"\"\"Feature scaling and normalization.\"\"\"
"@ | Out-File -Encoding UTF8 "src\preprocessing\normalizer.py"

@"
\"\"\"Feature selection using RFE / correlation.\"\"\"
"@ | Out-File -Encoding UTF8 "src\preprocessing\feature_selector.py"

# Models
@"
\"\"\"Base model class for IDS experiments.\"\"\"
class BaseIDSModel:
    def train(self, X, y):
        raise NotImplementedError

    def predict(self, X):
        raise NotImplementedError
"@ | Out-File -Encoding UTF8 "src\models\base_model.py"

@"
\"\"\"Random Forest implementation for IDS.\"\"\"
"@ | Out-File -Encoding UTF8 "src\models\random_forest.py"

@"
\"\"\"XGBoost implementation for IDS.\"\"\"
"@ | Out-File -Encoding UTF8 "src\models\xgboost_model.py"

@"
\"\"\"Hyperparameter tuning (e.g., Bayesian optimization).\"\"\"
"@ | Out-File -Encoding UTF8 "src\models\hyperparameter_tuner.py"

@"
\"\"\"Training pipeline that calls preprocessing + models.\"\"\"
"@ | Out-File -Encoding UTF8 "src\models\model_training.py"

# Explainability
@"
\"\"\"SHAP / TreeSHAP explainability utilities (Member 2 - Faraaz).\"\"\"
"@ | Out-File -Encoding UTF8 "src\explainability\shap_explainer.py"

@"
\"\"\"LIME explainability utilities.\"\"\"
"@ | Out-File -Encoding UTF8 "src\explainability\lime_explainer.py"

@"
\"\"\"Helper utilities for explainability.\"\"\"
"@ | Out-File -Encoding UTF8 "src\explainability\explainability_utils.py"

@"
\"\"\"Visualization helpers for SHAP and LIME plots.\"\"\"
"@ | Out-File -Encoding UTF8 "src\explainability\visualization.py"

@"
\"\"\"Metrics to evaluate explanation quality (fidelity, stability, etc.).\"\"\"
"@ | Out-File -Encoding UTF8 "src\explainability\explanation_quality.py"

# API
@"
from flask import Flask

def create_app():
    app = Flask(__name__)
    from .routes import register_routes
    register_routes(app)
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000)
"@ | Out-File -Encoding UTF8 "src\api\app.py"

@"
\"\"\"Define REST API routes here.\"\"\"

def register_routes(app):
    @app.route('/health', methods=['GET'])
    def health():
        return {'status': 'ok'}
"@ | Out-File -Encoding UTF8 "src\api\routes.py"

New-Item -ItemType File -Path "src\api\models_schema.py" -Force | Out-Null
New-Item -ItemType File -Path "src\api\error_handlers.py" -Force | Out-Null

# Dashboard
@"
\"\"\"Streamlit dashboard entry point.\"\"\"

import streamlit as st

st.title('XAI-Enhanced Intrusion Detection System')
st.write('Dashboard placeholder - implement SHAP/LIME visualizations here.')
"@ | Out-File -Encoding UTF8 "src\dashboard\streamlit_app.py"

New-Item -ItemType File -Path "src\dashboard\flask_templates\base.html" -Force | Out-Null
New-Item -ItemType File -Path "src\dashboard\flask_templates\index.html" -Force | Out-Null
New-Item -ItemType File -Path "src\dashboard\flask_templates\prediction.html" -Force | Out-Null
New-Item -ItemType File -Path "src\dashboard\flask_templates\dashboard.html" -Force | Out-Null
New-Item -ItemType File -Path "src\dashboard\flask_templates\about.html" -Force | Out-Null
New-Item -ItemType File -Path "src\dashboard\static\css\style.css" -Force | Out-Null
New-Item -ItemType File -Path "src\dashboard\static\js\script.js" -Force | Out-Null
New-Item -ItemType File -Path "src\dashboard\utils.py" -Force | Out-Null

# Evaluation
@"
\"\"\"Model performance metrics (Member 3 - Saad).\"\"\"
"@ | Out-File -Encoding UTF8 "src\evaluation\metrics.py"
New-Item -ItemType File -Path "src\evaluation\confusion_matrix.py" -Force | Out-Null
New-Item -ItemType File -Path "src\evaluation\roc_auc.py" -Force | Out-Null
New-Item -ItemType File -Path "src\evaluation\comparator.py" -Force | Out-Null
New-Item -ItemType File -Path "src\evaluation\report_generator.py" -Force | Out-Null

# Deployment
New-Item -ItemType File -Path "src\deployment\docker_build.py" -Force | Out-Null
New-Item -ItemType File -Path "src\deployment\model_registry.py" -Force | Out-Null
New-Item -ItemType File -Path "src\deployment\health_check.py" -Force | Out-Null
New-Item -ItemType File -Path "src\deployment\logging_config.py" -Force | Out-Null

# Utils
New-Item -ItemType File -Path "src\utils\config.py" -Force | Out-Null
New-Item -ItemType File -Path "src\utils\logger.py" -Force | Out-Null
New-Item -ItemType File -Path "src\utils\data_validator.py" -Force | Out-Null
New-Item -ItemType File -Path "src\utils\helpers.py" -Force | Out-Null

# Notebooks
@(
 "01_exploratory_data_analysis",
 "02_data_preprocessing",
 "03_model_training",
 "04_shap_analysis",
 "05_lime_analysis",
 "06_dashboard_prototype",
 "07_model_evaluation",
 "08_comparative_analysis",
 "09_results_summary"
) | ForEach-Object {
    New-Item -ItemType File -Path "notebooks\$_`.ipynb" -Force | Out-Null
}

# Tests
New-Item -ItemType File -Path "tests\test_preprocessing.py" -Force | Out-Null
New-Item -ItemType File -Path "tests\test_models.py" -Force | Out-Null
New-Item -ItemType File -Path "tests\test_explainability.py" -Force | Out-Null
New-Item -ItemType File -Path "tests\test_api.py" -Force | Out-Null
New-Item -ItemType File -Path "tests\test_evaluation.py" -Force | Out-Null
New-Item -ItemType File -Path "tests\conftest.py" -Force | Out-Null

# Configs
@"
dataset: nsl-kdd
"@ | Out-File -Encoding UTF8 "configs\nsl_kdd_config.yaml"
@"
dataset: unsw-nb15
"@ | Out-File -Encoding UTF8 "configs\unsw_nb15_config.yaml"
New-Item -ItemType File -Path "configs\default_config.yaml" -Force | Out-Null
New-Item -ItemType File -Path "configs\hyperparameters.json" -Force | Out-Null

# Docker
@"
FROM python:3.11-slim

WORKDIR /app
COPY . /app

RUN pip install --no-cache-dir -r requirements.txt

CMD [\"python\", \"-m\", \"src.api.app\"]
"@ | Out-File -Encoding UTF8 "docker\Dockerfile"

@"
version: '3.8'
services:
  api:
    build:
      context: .
      dockerfile: docker/Dockerfile
    ports:
      - \"5000:5000\"
    environment:
      - FLASK_ENV=production
    volumes:
      - ./models:/app/models
      - ./data:/app/data

  dashboard:
    build:
      context: .
      dockerfile: docker/Dockerfile
    command: streamlit run src/dashboard/streamlit_app.py
    ports:
      - \"8501:8501\"
"@ | Out-File -Encoding UTF8 "docker\docker-compose.yml"

New-Item -ItemType File -Path "docker\.dockerignore" -Force | Out-Null
New-Item -ItemType File -Path "docker\entrypoint.sh" -Force | Out-Null

# GitHub workflows (empty placeholders)
New-Item -ItemType File -Path ".github\workflows\tests.yml" -Force | Out-Null
New-Item -ItemType File -Path ".github\workflows\documentation.yml" -Force | Out-Null
New-Item -ItemType File -Path ".github\workflows\release.yml" -Force | Out-Null
New-Item -ItemType File -Path ".github\ISSUE_TEMPLATE.md" -Force | Out-Null

# Docs placeholders
New-Item -ItemType File -Path "docs\PROJECT_OVERVIEW.md" -Force | Out-Null
New-Item -ItemType File -Path "docs\INSTALLATION_GUIDE.md" -Force | Out-Null
New-Item -ItemType File -Path "docs\USER_GUIDE.md" -Force | Out-Null
New-Item -ItemType File -Path "docs\API_DOCUMENTATION.md" -Force | Out-Null
New-Item -ItemType File -Path "docs\ARCHITECTURE.md" -Force | Out-Null
New-Item -ItemType File -Path "docs\LITERATURE_REVIEW.md" -Force | Out-Null
New-Item -ItemType File -Path "docs\TEAM_MEMBERS.md" -Force | Out-Null
New-Item -ItemType File -Path "docs\CHANGELOG.md" -Force | Out-Null

# -------- 5. PYTHON VENV & DEPENDENCIES --------
Write-Host "Creating Python virtual environment..."

& $pythonExe -m venv $venvName
if (Test-Path ".\venv\Scripts\Activate.ps1") {
    & ".\venv\Scripts\Activate.ps1"
    Write-Host "Installing dependencies..."
    pip install --upgrade pip
    pip install -r requirements.txt
    pip install -r requirements-dev.txt
} else {
    Write-Host "WARNING: Could not find venv activation script. Activate manually."
}

# -------- 6. GIT INITIALIZATION --------
Write-Host "Initializing git repository..."

git init | Out-Null
git add .
git commit -m "Initial commit: XAI-IDS repository structure and setup script" | Out-Null

Write-Host ""
Write-Host "==============================================="
Write-Host "XAI-IDS repository setup complete!"
Write-Host "Folder: $PWD"
Write-Host "Next steps:"
Write-Host "1) Activate venv: .\venv\Scripts\Activate.ps1"
Write-Host "2) Start Jupyter:  jupyter notebook"
Write-Host "3) Run API:        python -m src.api.app"
Write-Host "4) Run dashboard:  streamlit run src/dashboard/streamlit_app.py"
Write-Host "==============================================="
