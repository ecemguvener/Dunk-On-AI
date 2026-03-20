import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib

# Position buckets and their output model filenames
POSITION_MODELS = {
    "Guard":   "model_guard.pkl",
    "Forward": "model_forward.pkl",
    "Center":  "model_center.pkl",
}

DROP_COLS = [
    "game_id",
    "player_id",
    "position",
    "date",
    "opponent"
]


def train_position_model(train_df, control_df, position):
    X_train = train_df.drop(columns=["target_fantasy_points_game"])
    y_train = train_df["target_fantasy_points_game"]

    X_control = control_df.drop(columns=["target_fantasy_points_game"])
    y_control = control_df["target_fantasy_points_game"]

    model = RandomForestRegressor(
        n_estimators=75,
        max_depth=8,
        min_samples_split=10,
        min_samples_leaf=5,
        random_state=42,
        n_jobs=-1,
        verbose=1
    )

    print(f"\n[{position}] Training rows : {len(X_train)}")
    print(f"[{position}] Features      : {len(X_train.columns)}")
    print(f"[{position}] Training model...")
    model.fit(X_train, y_train)

    preds = model.predict(X_control)
    mae  = mean_absolute_error(y_control, preds)
    rmse = np.sqrt(mean_squared_error(y_control, preds))
    r2   = r2_score(y_control, preds)

    print(f"\n===== [{position}] CONTROL SET PERFORMANCE =====")
    print(f"MAE  : {mae:.3f}")
    print(f"RMSE : {rmse:.3f}")
    print(f"R2   : {r2:.3f}")

    importance = pd.DataFrame({
        "feature":    X_train.columns,
        "importance": model.feature_importances_
    }).sort_values("importance", ascending=False)

    print(f"\n===== [{position}] FEATURE IMPORTANCE =====")
    print(importance.head(15).to_string(index=False))

    return model


# 1. Load master dataset and split into train / control
master_df = pd.read_csv("../data_colection/data/processed/master_training.csv")
master_df["date"] = pd.to_datetime(master_df["date"])

# Use last 10% of rows (by date) as the control set
split_idx  = int(len(master_df) * 0.90)
train_df   = master_df.iloc[:split_idx].copy()
control_df = master_df.iloc[split_idx:].copy()

print(f"Train rows: {len(train_df)} | Control rows: {len(control_df)}")

# 2. Drop unused columns (keep position for splitting, drop after)
train_df   = train_df.drop(columns=[c for c in DROP_COLS if c != "position"])
control_df = control_df.drop(columns=[c for c in DROP_COLS if c != "position"])

# 3. Train a model per position bucket
for position, model_filename in POSITION_MODELS.items():
    pos_train   = train_df[train_df["position"] == position].drop(columns=["position"])
    pos_control = control_df[control_df["position"] == position].drop(columns=["position"])

    if pos_train.empty or pos_control.empty:
        print(f"\n[WARN] No data for position '{position}' — skipping.")
        continue

    model = train_position_model(pos_train, pos_control, position)
    joblib.dump(model, model_filename)
    print(f"[{position}] Model saved as {model_filename}")
