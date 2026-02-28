import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"
DATASETS_DIR = BASE_DIR / "datasets"
MODELS_DIR.mkdir(parents=True, exist_ok=True)
DATASETS_DIR.mkdir(parents=True, exist_ok=True)

SUPPORTED_MODELS = ["random_forest", "xgboost"]
CLASSIFICATION_MODES = ["binary", "multiclass"]

BINARY_LABEL_MAP = {
    "normal": 0,
    "attack": 1,
}

MULTICLASS_LABEL_MAP = {
    "Normal": 0,
    "DoS": 1,
    "Probe": 2,
    "R2L": 3,
    "U2R": 4,
    "Reconnaissance": 5,
    "Exploits": 6,
    "Fuzzers": 7,
    "Generic": 8,
    "Analysis": 9,
    "Backdoor": 10,
    "Shellcode": 11,
    "Worms": 12,
}

OPTUNA_TRIALS = int(os.getenv("OPTUNA_TRIALS", "30"))
SHAP_SAMPLE_SIZE = int(os.getenv("SHAP_SAMPLE_SIZE", "500"))
LIME_NUM_FEATURES = int(os.getenv("LIME_NUM_FEATURES", "10"))
RANDOM_STATE = int(os.getenv("RANDOM_STATE", "42"))
TEST_SIZE = float(os.getenv("TEST_SIZE", "0.2"))
