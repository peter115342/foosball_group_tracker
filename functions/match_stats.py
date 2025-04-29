import logging
from typing import Any, Dict, List, Optional

from firebase_admin import firestore
from firebase_functions import firestore_fn


@firestore_fn.on_document_written(document="matches/{matchId}")
def on_match_update(event: firestore_fn.Event) -> None:
    db = firestore.client()

    match_data_before = None
    match_data_after = None

    if event.data.before and event.data.before.exists:
        match_data_before = event.data.before.to_dict()

    if event.data.after and event.data.after.exists:
        match_data_after = event.data.after.to_dict()

    if not match_data_before and not match_data_after:
        logging.warning(
            f"No match data found for matchId: {event.params.get('matchId')}"
        )
        return

    group_id = (
        match_data_after.get("groupId")
        if match_data_after
        else match_data_before.get("groupId")
    )

    if not group_id:
        logging.error(
            f"No groupId found in match data for matchId: {event.params.get('matchId')}"
        )
        return

    recalculate_group_stats(db, group_id)


@firestore_fn.on_document_written(document="groups/{groupId}")
def on_group_update(event: firestore_fn.Event) -> None:
    db = firestore.client()
    group_id = event.params.get("groupId")

    if event.data.after and event.data.after.exists:
        group_data_before = (
            event.data.before.to_dict()
            if event.data.before and event.data.before.exists
            else {}
        )
        group_data_after = event.data.after.to_dict()

        members_changed = False
        guests_changed = False

        if "members" in group_data_before and "members" in group_data_after:
            if group_data_before["members"] != group_data_after["members"]:
                members_changed = True

        if "guests" in group_data_before and "guests" in group_data_after:
            if group_data_before.get("guests", []) != group_data_after.get(
                "guests", []
            ):
                guests_changed = True

        if members_changed or guests_changed:
            recalculate_group_stats(db, group_id)


def recalculate_group_stats(db: firestore.Client, group_id: str) -> None:
    try:
        group_ref = db.collection("groups").document(group_id)
        group_doc = group_ref.get()

        if not group_doc.exists:
            logging.warning(
                f"Group with ID {group_id} not found, cannot calculate stats"
            )
            return

        group_data = group_doc.to_dict()

        matches_ref = db.collection("matches")
        matches_query = matches_ref.where(
            filter=firestore.FieldFilter("groupId", "==", group_id)
        )
        matches = list(matches_query.stream())

        if not matches:
            logging.info(f"No matches found for group {group_id}")
            create_empty_stats(db, group_id, group_data)
            return

        player_stats: Dict[str, Dict[str, Any]] = {}
        team_color_stats: Dict[str, Dict[str, Any]] = {}
        general_stats = {
            "totalMatches": 0,
            "matchesByGameType": {"1v1": 0, "2v2": 0},
            "highestScore": {"score": 0, "matchId": "", "player": "", "date": None},
            "longestWinStreak": {"player": "", "count": 0, "playerName": ""},
            "recentMatches": [],
        }

        initialize_player_stats(player_stats, group_data)

        if "teamColors" in group_data:
            team_color_stats[group_data["teamColors"].get("teamOne", "#000000")] = (
                create_team_color_stats_object()
            )
            team_color_stats[group_data["teamColors"].get("teamTwo", "#ffffff")] = (
                create_team_color_stats_object()
            )

        for match_doc in matches:
            match_data = match_doc.to_dict()
            match_data["id"] = match_doc.id

            if "playedAt" in match_data:
                general_stats["recentMatches"].append(
                    {
                        "id": match_doc.id,
                        "playedAt": match_data["playedAt"],
                        "team1Score": match_data.get("team1", {}).get("score", 0),
                        "team2Score": match_data.get("team2", {}).get("score", 0),
                        "gameType": match_data.get("gameType", "1v1"),
                        "winner": match_data.get("winner", "draw"),
                    }
                )

            process_match(match_data, player_stats, team_color_stats, general_stats)

        if general_stats["recentMatches"]:
            general_stats["recentMatches"].sort(
                key=lambda x: x["playedAt"].get("seconds", 0)
                if isinstance(x["playedAt"], dict)
                else x["playedAt"].timestamp()
                if hasattr(x["playedAt"], "timestamp")
                else 0,
                reverse=True,
            )
            general_stats["recentMatches"] = general_stats["recentMatches"][:5]

        calculate_derived_stats(player_stats, team_color_stats)

        stats_doc = {
            "groupId": group_id,
            "lastUpdated": firestore.SERVER_TIMESTAMP,
            "playerStats": player_stats,
            "teamColorStats": team_color_stats,
            **general_stats,
        }

        stats_ref = db.collection("groupStats").document(group_id)
        stats_ref.set(stats_doc)

        logging.info(f"Successfully updated stats for group {group_id}")

    except Exception as e:
        logging.error(f"Error calculating stats for group {group_id}: {str(e)}")


def initialize_player_stats(
    player_stats: Dict[str, Dict[str, Any]], group_data: Dict[str, Any]
) -> None:
    if "members" in group_data:
        for member_id, member_data in group_data["members"].items():
            player_stats[member_id] = create_player_stats_object(
                display_name=member_data.get("name", "Unknown"), is_guest=False
            )

    if "guests" in group_data and isinstance(group_data["guests"], list):
        for guest in group_data["guests"]:
            if isinstance(guest, dict) and "id" in guest and "name" in guest:
                guest_id = f"guest_{guest['id']}"
                player_stats[guest_id] = create_player_stats_object(
                    display_name=guest.get("name", "Unknown Guest"), is_guest=True
                )


def create_player_stats_object(display_name: str, is_guest: bool) -> Dict[str, Any]:
    return {
        "displayName": display_name,
        "isGuest": is_guest,
        "totalMatches": 0,
        "wins": 0,
        "draws": 0,
        "losses": 0,
        "winRate": 0.0,
        "rating": 1000,
        "streak": 0,
        "currentStreak": 0,
        "longestWinStreak": 0,
        "longestLossStreak": 0,
        "teamPartners": {},
        "lastPlayed": None,
        "goalsScored": 0,
        "goalsConceded": 0,
        "averageGoalsScored": 0.0,
        "averageGoalsConceded": 0.0,
    }


def create_team_color_stats_object() -> Dict[str, Any]:
    return {
        "totalMatches": 0,
        "wins": 0,
        "draws": 0,
        "losses": 0,
        "winRate": 0.0,
        "goalsScored": 0,
        "goalsConceded": 0,
    }


def create_empty_stats(
    db: firestore.Client, group_id: str, group_data: Dict[str, Any]
) -> None:
    player_stats = {}
    team_color_stats = {}

    initialize_player_stats(player_stats, group_data)

    if "teamColors" in group_data:
        team_color_stats[group_data["teamColors"].get("teamOne", "#000000")] = (
            create_team_color_stats_object()
        )
        team_color_stats[group_data["teamColors"].get("teamTwo", "#ffffff")] = (
            create_team_color_stats_object()
        )

    stats_doc = {
        "groupId": group_id,
        "lastUpdated": firestore.SERVER_TIMESTAMP,
        "playerStats": player_stats,
        "teamColorStats": team_color_stats,
        "totalMatches": 0,
        "matchesByGameType": {"1v1": 0, "2v2": 0},
        "highestScore": {"score": 0, "matchId": "", "player": "", "date": None},
        "longestWinStreak": {"player": "", "count": 0, "playerName": ""},
        "recentMatches": [],
    }

    stats_ref = db.collection("groupStats").document(group_id)
    stats_ref.set(stats_doc)
    logging.info(f"Created empty stats document for group {group_id}")


def process_match(
    match_data: Dict[str, Any],
    player_stats: Dict[str, Dict[str, Any]],
    team_color_stats: Dict[str, Dict[str, Any]],
    general_stats: Dict[str, Any],
) -> None:
    general_stats["totalMatches"] += 1

    game_type = match_data.get("gameType", "1v1")
    general_stats["matchesByGameType"][game_type] = (
        general_stats["matchesByGameType"].get(game_type, 0) + 1
    )

    winner = match_data.get("winner", "draw")
    team1_data = match_data.get("team1", {})
    team2_data = match_data.get("team2", {})
    team1_color = team1_data.get("color", "#000000")
    team2_color = team2_data.get("color", "#ffffff")
    team1_score = team1_data.get("score", 0)
    team2_score = team2_data.get("score", 0)

    team1_players = extract_players_from_team(team1_data)
    team2_players = extract_players_from_team(team2_data)

    check_highest_score(general_stats, team1_score, team1_players, match_data)
    check_highest_score(general_stats, team2_score, team2_players, match_data)

    update_team_color_stats(
        team_color_stats, team1_color, team2_color, team1_score, team2_score, winner
    )

    match_timestamp = get_match_timestamp(match_data)
    update_player_stats(
        player_stats,
        team1_players,
        team2_players,
        team1_score,
        team2_score,
        winner,
        match_timestamp,
        general_stats,
        game_type,
    )


def extract_players_from_team(team_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    players = []
    if "players" in team_data:
        players_data = team_data["players"]

        if isinstance(players_data, list):
            players = players_data
        elif isinstance(players_data, dict):
            players = [
                players_data[k]
                for k in sorted(players_data.keys())
                if isinstance(players_data[k], dict)
            ]

    return players


def check_highest_score(
    general_stats: Dict[str, Any],
    score: int,
    players: List[Dict[str, Any]],
    match_data: Dict[str, Any],
) -> None:
    if score > general_stats["highestScore"]["score"] and players:
        general_stats["highestScore"]["score"] = score
        general_stats["highestScore"]["matchId"] = match_data.get("id", "")
        general_stats["highestScore"]["player"] = players[0].get("displayName", "")
        general_stats["highestScore"]["date"] = match_data.get("playedAt")


def update_team_color_stats(
    team_color_stats: Dict[str, Dict[str, Any]],
    team1_color: str,
    team2_color: str,
    team1_score: int,
    team2_score: int,
    winner: str,
) -> None:
    if team1_color not in team_color_stats:
        team_color_stats[team1_color] = create_team_color_stats_object()
    if team2_color not in team_color_stats:
        team_color_stats[team2_color] = create_team_color_stats_object()

    team_color_stats[team1_color]["totalMatches"] += 1
    team_color_stats[team1_color]["goalsScored"] += team1_score
    team_color_stats[team1_color]["goalsConceded"] += team2_score

    team_color_stats[team2_color]["totalMatches"] += 1
    team_color_stats[team2_color]["goalsScored"] += team2_score
    team_color_stats[team2_color]["goalsConceded"] += team1_score

    if winner == "team1":
        team_color_stats[team1_color]["wins"] += 1
        team_color_stats[team2_color]["losses"] += 1
    elif winner == "team2":
        team_color_stats[team1_color]["losses"] += 1
        team_color_stats[team2_color]["wins"] += 1
    else:
        team_color_stats[team1_color]["draws"] += 1
        team_color_stats[team2_color]["draws"] += 1


def get_match_timestamp(match_data: Dict[str, Any]) -> Optional[Any]:
    if "playedAt" in match_data:
        return match_data["playedAt"]
    return None


def update_player_stats(
    player_stats: Dict[str, Dict[str, Any]],
    team1_players: List[Dict[str, Any]],
    team2_players: List[Dict[str, Any]],
    team1_score: int,
    team2_score: int,
    winner: str,
    timestamp: Any,
    general_stats: Dict[str, Any],
    game_type: str,
) -> None:
    for player in team1_players:
        player_id = player.get("uid", "")
        if not player_id or player_id not in player_stats:
            continue

        player_stats[player_id]["totalMatches"] += 1
        player_stats[player_id]["goalsScored"] += team1_score
        player_stats[player_id]["goalsConceded"] += team2_score
        player_stats[player_id]["lastPlayed"] = timestamp

        if winner == "team1":
            player_stats[player_id]["wins"] += 1
            update_player_streak(
                player_stats[player_id], "win", general_stats, player_id
            )
        elif winner == "team2":
            player_stats[player_id]["losses"] += 1
            update_player_streak(
                player_stats[player_id], "loss", general_stats, player_id
            )
        else:
            player_stats[player_id]["draws"] += 1
            update_player_streak(
                player_stats[player_id], "draw", general_stats, player_id
            )

        if game_type == "2v2" and len(team1_players) > 1:
            update_team_partnerships(
                player_stats, player_id, team1_players, winner == "team1"
            )

    for player in team2_players:
        player_id = player.get("uid", "")
        if not player_id or player_id not in player_stats:
            continue

        player_stats[player_id]["totalMatches"] += 1
        player_stats[player_id]["goalsScored"] += team2_score
        player_stats[player_id]["goalsConceded"] += team1_score
        player_stats[player_id]["lastPlayed"] = timestamp

        if winner == "team2":
            player_stats[player_id]["wins"] += 1
            update_player_streak(
                player_stats[player_id], "win", general_stats, player_id
            )
        elif winner == "team1":
            player_stats[player_id]["losses"] += 1
            update_player_streak(
                player_stats[player_id], "loss", general_stats, player_id
            )
        else:
            player_stats[player_id]["draws"] += 1
            update_player_streak(
                player_stats[player_id], "draw", general_stats, player_id
            )

        if game_type == "2v2" and len(team2_players) > 1:
            update_team_partnerships(
                player_stats, player_id, team2_players, winner == "team2"
            )


def update_player_streak(
    player_stat: Dict[str, Any],
    result: str,
    general_stats: Dict[str, Any],
    player_id: str,
) -> None:
    if result == "draw":
        player_stat["currentStreak"] = 0
        return

    if result == "win":
        if player_stat["currentStreak"] < 0:
            player_stat["currentStreak"] = 1
        else:
            player_stat["currentStreak"] += 1

        if player_stat["currentStreak"] > player_stat["longestWinStreak"]:
            player_stat["longestWinStreak"] = player_stat["currentStreak"]

        if player_stat["currentStreak"] > general_stats["longestWinStreak"]["count"]:
            general_stats["longestWinStreak"]["count"] = player_stat["currentStreak"]
            general_stats["longestWinStreak"]["player"] = player_id
            general_stats["longestWinStreak"]["playerName"] = player_stat["displayName"]

    elif result == "loss":
        if player_stat["currentStreak"] > 0:
            player_stat["currentStreak"] = -1
        else:
            player_stat["currentStreak"] -= 1

        loss_streak_magnitude = abs(player_stat["currentStreak"])
        if loss_streak_magnitude > player_stat["longestLossStreak"]:
            player_stat["longestLossStreak"] = loss_streak_magnitude


def update_team_partnerships(
    player_stats: Dict[str, Dict[str, Any]],
    player_id: str,
    team_players: List[Dict[str, Any]],
    is_win: bool,
) -> None:
    for teammate in team_players:
        teammate_id = teammate.get("uid", "")
        if teammate_id and teammate_id != player_id:
            if "teamPartners" not in player_stats[player_id]:
                player_stats[player_id]["teamPartners"] = {}

            if teammate_id not in player_stats[player_id]["teamPartners"]:
                player_stats[player_id]["teamPartners"][teammate_id] = {
                    "displayName": teammate.get("displayName", "Unknown"),
                    "matches": 0,
                    "wins": 0,
                    "winRate": 0.0,
                }

            player_stats[player_id]["teamPartners"][teammate_id]["matches"] += 1
            if is_win:
                player_stats[player_id]["teamPartners"][teammate_id]["wins"] += 1


def calculate_derived_stats(
    player_stats: Dict[str, Dict[str, Any]], team_color_stats: Dict[str, Dict[str, Any]]
) -> None:
    for _player_id, stats in player_stats.items():
        total_matches = stats["totalMatches"]
        if total_matches > 0:
            stats["winRate"] = round(stats["wins"] / total_matches, 3)

            stats["averageGoalsScored"] = round(stats["goalsScored"] / total_matches, 2)
            stats["averageGoalsConceded"] = round(
                stats["goalsConceded"] / total_matches, 2
            )

            win_factor = stats["winRate"] * 500
            goal_diff_factor = (
                stats["averageGoalsScored"] - stats["averageGoalsConceded"]
            ) * 10
            stats["rating"] = round(1000 + win_factor + goal_diff_factor)

            if "teamPartners" in stats:
                for _partner_id, partner_stats in stats["teamPartners"].items():
                    if partner_stats["matches"] > 0:
                        partner_stats["winRate"] = round(
                            partner_stats["wins"] / partner_stats["matches"], 3
                        )

    for _color, stats in team_color_stats.items():
        total_matches = stats["totalMatches"]
        if total_matches > 0:
            stats["winRate"] = round(stats["wins"] / total_matches, 3)
