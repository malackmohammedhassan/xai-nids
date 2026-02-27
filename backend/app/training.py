import time
import optuna
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from sklearn.model_selection import cross_val_score
from app.config import OPTUNA_TRIALS, RANDOM_STATE

optuna.logging.set_verbosity(optuna.logging.WARNING)


def _rf_objective(trial, X, y):
    params = {
        "n_estimators": trial.suggest_int("n_estimators", 50, 300),
        "max_depth": trial.suggest_int("max_depth", 3, 20),
        "min_samples_split": trial.suggest_int("min_samples_split", 2, 20),
        "min_samples_leaf": trial.suggest_int("min_samples_leaf", 1, 10),
        "max_features": trial.suggest_categorical("max_features", ["sqrt", "log2"]),
        "random_state": RANDOM_STATE,
        "n_jobs": -1,
    }
    clf = RandomForestClassifier(**params)
    score = cross_val_score(clf, X, y, cv=3, scoring="f1_weighted", n_jobs=-1)
    return score.mean()


def _xgb_objective(trial, X, y, num_class):
    params = {
        "n_estimators": trial.suggest_int("n_estimators", 50, 300),
        "max_depth": trial.suggest_int("max_depth", 3, 15),
        "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
        "subsample": trial.suggest_float("subsample", 0.5, 1.0),
        "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
        "reg_alpha": trial.suggest_float("reg_alpha", 1e-8, 10.0, log=True),
        "reg_lambda": trial.suggest_float("reg_lambda", 1e-8, 10.0, log=True),
        "random_state": RANDOM_STATE,
        "use_label_encoder": False,
        "eval_metric": "mlogloss" if num_class > 2 else "logloss",
        "n_jobs": -1,
    }
    if num_class > 2:
        params["objective"] = "multi:softprob"
        params["num_class"] = num_class
    else:
        params["objective"] = "binary:logistic"
    clf = XGBClassifier(**params)
    score = cross_val_score(clf, X, y, cv=3, scoring="f1_weighted", n_jobs=-1)
    return score.mean()


def train_model(X, y, model_type: str = "random_forest", mode: str = "binary"):
    num_class = len(np.unique(y))
    start = time.time()

    if model_type == "random_forest":
        study = optuna.create_study(direction="maximize")
        study.optimize(lambda trial: _rf_objective(trial, X, y), n_trials=OPTUNA_TRIALS)
        best = study.best_params
        best["random_state"] = RANDOM_STATE
        best["n_jobs"] = -1
        model = RandomForestClassifier(**best)
    elif model_type == "xgboost":
        study = optuna.create_study(direction="maximize")
        study.optimize(lambda trial: _xgb_objective(trial, X, y, num_class), n_trials=OPTUNA_TRIALS)
        best = study.best_params
        best["random_state"] = RANDOM_STATE
        best["use_label_encoder"] = False
        best["n_jobs"] = -1
        if num_class > 2:
            best["objective"] = "multi:softprob"
            best["num_class"] = num_class
            best["eval_metric"] = "mlogloss"
        else:
            best["objective"] = "binary:logistic"
            best["eval_metric"] = "logloss"
        model = XGBClassifier(**best)
    else:
        raise ValueError(f"Unsupported model type: {model_type}")

    model.fit(X, y)
    duration = round(time.time() - start, 2)

    return model, best, duration
