"""
Script to generate an optimal fantasy team using per-position models.

This file:
- Loads master_training.csv and takes each player's most recent row
  (which already contains their rolling averages from the last 3/5/10 games)
- Loads player positions from players.csv
- Runs each player through their position's trained model
- Selects the best lineup: 3 Guards, 1 Forward, 1 Center

Usage:
    python build_team.py
"""

import os
import sys
import pandas as pd
import joblib

# Lineup slots per position bucket
LINEUP = {
    "Guard":   3,
    "Forward": 1,
    "Center":  1,
}

MODEL_FILES = {
    "Guard":   "model_guard.pkl",
    "Forward": "model_forward.pkl",
    "Center":  "model_center.pkl",
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


def build_team():
    # 1. Load master training data
    master_path = os.path.join("..", "data_colection", "data", "processed", "master_training.csv")
    if not os.path.exists(master_path):
        print("[ERROR] master_training.csv not found. Run build_training_ready_data.py first.")
        sys.exit(1)

    master_df = pd.read_csv(master_path)
    master_df["date"] = pd.to_datetime(master_df["date"])

    # 2. Take the most recent row per player
    # Each row already contains rolling averages (avg_fantasy_last3/5/10 etc.)
    # so the latest row encodes the player's current form over the last 3 weeks
    latest_df = (
        master_df
        .sort_values("date")
        .groupby("player_id", as_index=False)
        .last()
    )

    # 3. Load player names and positions
    players_path = os.path.join("..", "data_colection", "data", "raw", "players.csv")
    if not os.path.exists(players_path):
        print("[ERROR] players.csv not found. Run get_players.py first.")
        sys.exit(1)

    players_df = pd.read_csv(players_path)[["PLAYER_ID", "PLAYER_NAME"]]
    players_df = players_df.rename(columns={
        "PLAYER_ID":   "player_id",
        "PLAYER_NAME": "player_name",
    })

    # 4. Join positions onto latest stats
    df = latest_df.merge(players_df, on="player_id", how="left")

    # Drop players with no known position
    unknown = df["position"].isin(["UNKNOWN", None]) | df["position"].isna()
    if unknown.sum() > 0:
        print(f"[INFO] Dropping {unknown.sum()} players with UNKNOWN position")
    df = df[~unknown].copy()

    # 5. Load models
    models = {}
    for position, model_file in MODEL_FILES.items():
        if not os.path.exists(model_file):
            print(f"[WARN] Model not found for {position}: {model_file} — skipping that position")
            continue
        models[position] = joblib.load(model_file)
        print(f"[INFO] Loaded {model_file}")

    if not models:
        print("[ERROR] No models loaded. Run train_model.py first.")
        sys.exit(1)

    # 6. Predict fantasy points per player using their position's model
    results = []

    for position, model in models.items():
        pos_df = df[df["position"] == position].copy()

        if pos_df.empty:
            print(f"[WARN] No players found for position: {position}")
            continue

        # Drop any players missing required features
        pos_df = pos_df.dropna(subset=FEATURE_COLS)

        if pos_df.empty:
            print(f"[WARN] All {position} players dropped due to missing features")
            continue

        X = pos_df[FEATURE_COLS]
        pos_df = pos_df.copy()
        pos_df["predicted_fantasy_pts"] = model.predict(X)

        results.append(pos_df[["player_id", "player_name", "position", "predicted_fantasy_pts"]])

    if not results:
        print("[ERROR] No predictions generated.")
        sys.exit(1)

    all_predictions = pd.concat(results, ignore_index=True)

    # 7. Select best lineup per position slot
    team = []

    for position, slots in LINEUP.items():
        if position not in models:
            print(f"[WARN] Skipping {position} — no model available")
            continue

        candidates = (
            all_predictions[all_predictions["position"] == position]
            .sort_values("predicted_fantasy_pts", ascending=False)
            .head(slots)
        )

        if len(candidates) < slots:
            print(f"[WARN] Only {len(candidates)} {position}(s) available, needed {slots}")

        team.append(candidates)

    team_df = pd.concat(team, ignore_index=True)
    team_df = team_df.sort_values("predicted_fantasy_pts", ascending=False).reset_index(drop=True)

    # 8. Print result
    print("\n===== FANTASY TEAM =====")
    print(team_df.to_string(index=False))
    print(f"\nTotal predicted points: {team_df['predicted_fantasy_pts'].sum():.2f}")

    return team_df


if __name__ == "__main__":
    build_team()
