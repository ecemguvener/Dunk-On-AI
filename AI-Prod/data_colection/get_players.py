"""
Script to fetch all NBA players who played in the defined period.

This file:
- Fetches regular season game logs from the NBA API
- Filters players within the configured date range
- Saves unique players to data/raw/players.csv

If any step fails, the script prints a clear error message and exits safely.
"""


# Import required libraries
import sys
import os
import time
import pandas as pd
import configparser
from datetime import datetime
from nba_api.stats.endpoints import leaguegamelog
from nba_api.stats.endpoints import commonplayerinfo


# Function to fetch all players and save to CSV
def get_players():
    """
    Returns:
        dict: A dictionary containing:
            - fatal_error (bool): True if a fatal exception occurred.
            - warnings (int): Number of non-fatal issues encountered.
            - error_code (int):
                0   -> Success
                -1  -> Unexpected fatal exception
                -12 -> Invalid season format
                -13 -> No season data returned from API.
    """

    # Track warnings used for better logging
    warning_count = 0

    try:
        print("[INFO] Fetching players for regular seasons in given period...")

        # Load configuration
        config = configparser.ConfigParser()
        config.read("settings.cfg")

        start_date = pd.to_datetime(config["API"]["start_date"])
        end_date = pd.to_datetime(config["API"]["end_date"])
        api_delay = float(config["API"]["api_delay"])
        season_str = config["API"]["season"]

        # Get all seasons in correct format
        if "-" in season_str:
            try:
                parts = season_str.split("-")

                if len(parts) != 2:
                    raise ValueError

                start_year = int(parts[0])
                end_year = int(parts[1])

                if start_year > end_year:
                    raise ValueError

                seasons = [f"{y}-{str(y+1)[-2:]}" for y in range(start_year, end_year)]

            except ValueError:
                print(f"[ERROR] Invalid season format '{season_str}'; Expected format: 'YYYY-YYYY'.")
                return {
                    "fatal_error": True,
                    "warnings": warning_count,
                    "error_code": -12
                }
        else:
            print(f"[ERROR] Invalid season format '{season_str}'; Expected format: 'YYYY-YYYY'.")
            return {
                "fatal_error": True,
                "warnings": warning_count,
                "error_code": -12
            }

        # Fetch all league game logs
        all_seasons_data = []

        print(f"[INFO] Seasons to fetch: {len(seasons)}")
        for index, season in enumerate(seasons, start=1):
            print(f"[PROGRESS] {index}/{len(seasons)} Fetching season {season}")

            gamelog = leaguegamelog.LeagueGameLog(
                season=season,
                season_type_all_star="Regular Season",
                player_or_team_abbreviation="P"
            )

            time.sleep(api_delay)
            season_df = gamelog.get_data_frames()[0]
            if not season_df.empty:
                all_seasons_data.append(season_df)

        if not all_seasons_data:
            print("[ERROR] No season data returned from API.")
            return {
                "fatal_error": False, 
                "warnings": 0, 
                "error_code": -13
            }

        df = pd.concat(all_seasons_data, ignore_index=True)

        # Convert GAME_DATE column to datetime for filtering
        df["GAME_DATE"] = pd.to_datetime(df["GAME_DATE"])

        # Filter games within the specified period
        df = df[(df["GAME_DATE"] >= start_date) & (df["GAME_DATE"] <= end_date)]

        # Check if we have any valid data
        if df.empty:
            print("[ERROR] No games found in selected period.")
            return {
                "fatal_error": False,
                "warnings": 0,
                "error_code": -14
            }

        # Keep only unique players
        players_df = df[["PLAYER_ID", "PLAYER_NAME"]].drop_duplicates()

        # Remove commas from player names
        players_df["PLAYER_NAME"] = players_df["PLAYER_NAME"].str.replace(",", "", regex=False)

        total_players = len(players_df)

        # Add POSITION column
        positions = []

        print("[INFO] Fetching player positions...")
        print(f"[INFO] Total players to process: {total_players}")

        for index, player_id in enumerate(players_df["PLAYER_ID"], start=1):
            print(f"[PROGRESS] {index}/{total_players} processing player {player_id}")
            try:
                info = commonplayerinfo.CommonPlayerInfo(player_id=player_id)
                time.sleep(api_delay)

                info_df = info.get_data_frames()[0]
                raw_position = str(info_df.loc[0, "POSITION"]).strip()

                # Bucket into Guard / Forward / Center
                first = raw_position.split("-")[0].strip()
                if first in ("Guard", "G"):
                    position = "Guard"
                elif first in ("Forward", "F"):
                    position = "Forward"
                elif first in ("Center", "C"):
                    position = "Center"
                else:
                    position = "UNKNOWN"
                    warning_count += 1

                positions.append(position)

            except Exception as e:
                print(f"[WARN] Failed fetching position for {player_id}")
                print(e)
                positions.append("UNKNOWN")
                warning_count += 1

        players_df["POSITION"] = positions

        # Ensure data/raw directory exists
        data_folder = os.path.join("data", "raw")

        if not os.path.exists(data_folder):
            os.makedirs(data_folder)

        # Save players to CSV
        output_path = os.path.join(data_folder, "players.csv")
        players_df.to_csv(output_path, index=False)
        
        # Success info message
        print(f"[INFO] Players fetched: {total_players} | Processed: {total_players-warning_count} | Failed: {warning_count}")

        # Return structured result
        return {
            "fatal_error": False,
            "warnings": warning_count,
            "error_code": 0
        }

    except Exception as e:
        # Fatal error for the function
        print("[WARN] Failed to fetch players.")
        print(f"[ERROR] {e}", file=sys.stderr)
        return {
            "fatal_error": True,
            "warnings": warning_count,
            "error_code": -1
        }


# Used for terminal calls
if __name__ == "__main__":
    print(get_players())