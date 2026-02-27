import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder, MinMaxScaler
from sklearn.feature_selection import RFE
from sklearn.ensemble import RandomForestClassifier
from imblearn.over_sampling import SMOTE
from app.config import BINARY_LABEL_MAP, RANDOM_STATE


def detect_label_column(df: pd.DataFrame) -> str:
    candidates = ["label", "Label", "attack_cat", "class", "Class", "target"]
    for c in candidates:
        if c in df.columns:
            return c
    return df.columns[-1]


def detect_attack_cat_column(df: pd.DataFrame):
    candidates = ["attack_cat", "attack_category", "Attack_cat"]
    for c in candidates:
        if c in df.columns:
            return c
    return None


def encode_labels_binary(y: pd.Series) -> pd.Series:
    y = y.astype(str).str.strip().str.lower()
    mapping = {}
    for val in y.unique():
        if val in ("normal", "0", "benign"):
            mapping[val] = 0
        else:
            mapping[val] = 1
    return y.map(mapping).astype(int)


def encode_labels_multiclass(y: pd.Series) -> tuple:
    le = LabelEncoder()
    y_enc = le.fit_transform(y.astype(str).str.strip())
    return pd.Series(y_enc, index=y.index), le


def preprocess_dataset(df: pd.DataFrame, mode: str = "binary", max_rfe_features: int = 30):
    df = df.copy()
    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    df.dropna(inplace=True)
    df.drop_duplicates(inplace=True)

    label_col = detect_label_column(df)
    attack_cat_col = detect_attack_cat_column(df)

    if mode == "multiclass" and attack_cat_col and attack_cat_col != label_col:
        y_raw = df[attack_cat_col].copy()
        drop_cols = [label_col, attack_cat_col]
    else:
        y_raw = df[label_col].copy()
        drop_cols = [label_col]
        if attack_cat_col and attack_cat_col in df.columns:
            drop_cols.append(attack_cat_col)

    drop_cols = [c for c in drop_cols if c in df.columns]
    X = df.drop(columns=drop_cols)

    le_dict = {}
    cat_cols = X.select_dtypes(include=["object", "category"]).columns.tolist()
    for col in cat_cols:
        le = LabelEncoder()
        X[col] = le.fit_transform(X[col].astype(str))
        le_dict[col] = le

    label_encoder = None
    class_names = None
    if mode == "binary":
        y = encode_labels_binary(y_raw)
        class_names = ["Normal", "Attack"]
    else:
        y, label_encoder = encode_labels_multiclass(y_raw)
        class_names = list(label_encoder.classes_)

    scaler = MinMaxScaler()
    X_scaled = pd.DataFrame(scaler.fit_transform(X), columns=X.columns, index=X.index)

    n_features = min(max_rfe_features, X_scaled.shape[1])
    selector = RFE(
        estimator=RandomForestClassifier(n_estimators=50, random_state=RANDOM_STATE, n_jobs=-1),
        n_features_to_select=n_features,
        step=5,
    )
    selector.fit(X_scaled, y)
    selected_features = X_scaled.columns[selector.support_].tolist()
    X_selected = X_scaled[selected_features]

    smote = SMOTE(random_state=RANDOM_STATE)
    try:
        X_res, y_res = smote.fit_resample(X_selected, y)
    except ValueError:
        X_res, y_res = X_selected, y

    return {
        "X": X_res,
        "y": y_res,
        "scaler": scaler,
        "selector": selector,
        "selected_features": selected_features,
        "label_encoder": label_encoder,
        "class_names": class_names,
        "feature_names": selected_features,
        "le_dict": le_dict,
        "original_columns": X.columns.tolist(),
    }


def preprocess_input(df: pd.DataFrame, bundle: dict) -> pd.DataFrame:
    df = df.copy()
    df.replace([np.inf, -np.inf], np.nan, inplace=True)
    df.fillna(0, inplace=True)

    label_col_candidates = ["label", "Label", "attack_cat", "class", "Class", "target", "attack_category", "Attack_cat"]
    drop_cols = [c for c in label_col_candidates if c in df.columns]
    if drop_cols:
        df.drop(columns=drop_cols, inplace=True)

    le_dict = bundle.get("le_dict", {})
    original_columns = bundle.get("original_columns", [])

    for col in df.select_dtypes(include=["object", "category"]).columns:
        if col in le_dict:
            le = le_dict[col]
            df[col] = df[col].astype(str).apply(
                lambda x: le.transform([x])[0] if x in le.classes_ else 0
            )
        else:
            df[col] = LabelEncoder().fit_transform(df[col].astype(str))

    for col in original_columns:
        if col not in df.columns:
            df[col] = 0
    df = df[[c for c in original_columns if c in df.columns]]

    scaler = bundle["scaler"]
    X_scaled = pd.DataFrame(scaler.transform(df), columns=df.columns, index=df.index)

    selected_features = bundle["selected_features"]
    for f in selected_features:
        if f not in X_scaled.columns:
            X_scaled[f] = 0
    X_out = X_scaled[selected_features]

    return X_out
