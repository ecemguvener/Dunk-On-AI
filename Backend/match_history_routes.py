"""
Match history API endpoints.
Saves and retrieves per-user match results (including player snapshots) via Supabase.
"""

from flask import Blueprint, jsonify, request

from Backend.supabaseclient import get_supabase_client
from Backend.utils.errors import bad_request, not_found, internal_server_error
from Backend.utils.validators import validate_user_exists

bp = Blueprint("match_history", __name__, url_prefix="/api")


@bp.get("/users/<int:user_id>/match-history")
def get_match_history(user_id):
    client = get_supabase_client()

    _, error = validate_user_exists(client, user_id)
    if error:
        return not_found(error["code"], error["error"])

    try:
        result = (
            client.table("matchups")
            .select("*")
            .eq("user_id", user_id)
            .order("played_on", desc=True)
            .limit(20)
            .execute()
        )

        games = []
        for row in result.data or []:
            games.append({
                "id": row["id"],
                "date": row["played_on"],
                "yourScore": row["user_score"],
                "aiScore": row["ai_score"],
                "winner": row["result"],
                "yourPlayers": row.get("your_players") or [],
                "aiPlayers": row.get("ai_players") or [],
            })

        return jsonify({"games": games}), 200

    except Exception:
        return internal_server_error("DATABASE_ERROR", "Failed to fetch match history")


@bp.post("/users/<int:user_id>/match-history")
def save_match(user_id):
    if not request.is_json:
        return bad_request("INVALID_REQUEST", "Content-Type must be application/json")

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return bad_request("INVALID_REQUEST", "Request body must be a valid JSON object")

    your_score = data.get("yourScore")
    ai_score = data.get("aiScore")
    winner = data.get("winner")

    if your_score is None or ai_score is None or not winner:
        return bad_request("MISSING_REQUIRED_FIELD", "yourScore, aiScore and winner are required")

    client = get_supabase_client()

    _, error = validate_user_exists(client, user_id)
    if error:
        return not_found(error["code"], error["error"])

    try:
        client.table("matchups").insert({
            "user_id": user_id,
            "user_score": float(your_score),
            "ai_score": float(ai_score),
            "result": winner,
            "your_players": data.get("yourPlayers", []),
            "ai_players": data.get("aiPlayers", []),
        }).execute()

        return jsonify({"message": "Match saved"}), 201

    except Exception:
        return internal_server_error("DATABASE_ERROR", "Failed to save match")