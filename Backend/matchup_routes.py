import os
import joblib
import pandas as pd
from flask import Blueprint, jsonify

bp = Blueprint("matchup", __name__, url_prefix="/api/matchup")

# Paths relative to repo root (where Flask is launched from)
_TRAINING_DIR = os.path.join(os.path.dirname(__file__), "..", "AI-Prod", "training")
_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "AI-Prod", "data_colection", "data")

MODEL_FILES = {
    "Guard":   "model_guard.pkl",
    "Forward": "model_forward.pkl",
    "Center":  "model_center.pkl",
}

LINEUP = {
    "Guard":   2,
    "Forward": 2,
    "Center":  1,
}

FEATURE_COLS = [
    "fantasy_last_game",
    "seconds_last_game",
    "avg_seconds_last5",
    "avg_seconds_last10",
    "std_seconds_last5",
    "avg_points_last5",
    "avg_rebounds_last5",
    "avg_assists_last5",
    "avg_blocks_last5",
    "avg_steals_last5",
    "avg_fantasy_last3",
    "avg_fantasy_last5",
    "avg_fantasy_last10",
    "std_fantasy_last5",
    "max_fantasy_last5",
    "trend_fantasy",
    "season_avg_fantasy",
    "season_avg_seconds",
    "days_since_last_game",
    "is_back_to_back",
    "games_last_7_days",
    "is_home_game",
]


@bp.get("/ai-team")
def get_ai_team():
    master_path = os.path.join(_DATA_DIR, "processed", "master_training.csv")
    players_path = os.path.join(_DATA_DIR, "raw", "players.csv")

    if not os.path.exists(master_path):
        return jsonify({"error": "master_training.csv not found. Run build_training_ready_data.py first."}), 503
    if not os.path.exists(players_path):
        return jsonify({"error": "players.csv not found. Run get_players.py first."}), 503

    master_df = pd.read_csv(master_path)
    master_df["date"] = pd.to_datetime(master_df["date"])

    latest_df = (
        master_df
        .sort_values("date")
        .groupby("player_id", as_index=False)
        .last()
    )

    players_df = pd.read_csv(players_path)[["PLAYER_ID", "PLAYER_NAME"]]
    players_df = players_df.rename(columns={"PLAYER_ID": "player_id", "PLAYER_NAME": "player_name"})

    df = latest_df.merge(players_df, on="player_id", how="left")
    df = df[~(df["position"].isin(["UNKNOWN", None]) | df["position"].isna())].copy()

    team = []

    for position, slots in LINEUP.items():
        model_path = os.path.join(_TRAINING_DIR, MODEL_FILES[position])
        if not os.path.exists(model_path):
            return jsonify({"error": f"Model file not found: {MODEL_FILES[position]}"}), 503

        model = joblib.load(model_path)
        pos_df = df[df["position"] == position].copy()
        pos_df = pos_df.dropna(subset=FEATURE_COLS)

        if pos_df.empty:
            continue

        pos_df["predicted_fantasy_pts"] = model.predict(pos_df[FEATURE_COLS])

        top = (
            pos_df
            .sort_values("predicted_fantasy_pts", ascending=False)
            .head(slots)
        )
        team.append(top)

    if not team:
        return jsonify({"error": "No predictions could be generated."}), 500

    team_df = pd.concat(team, ignore_index=True)

    result = []
    for _, row in team_df.iterrows():
        result.append({
            "id": int(row["player_id"]),
            "name": str(row.get("player_name", "Unknown")),
            "position": str(row["position"]),
            "predicted_pts": round(float(row["predicted_fantasy_pts"]), 1),
            "pts": round(float(row.get("avg_points_last5", 0) or 0), 1),
            "reb": round(float(row.get("avg_rebounds_last5", 0) or 0), 1),
            "ast": round(float(row.get("avg_assists_last5", 0) or 0), 1),
        })

    return jsonify({"team": result})