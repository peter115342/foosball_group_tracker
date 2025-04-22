from firebase_admin import firestore
from firebase_functions import https_fn
from google.cloud.firestore_v1.base_query import FieldFilter


def migrate_guest_to_member(data, auth):
    try:
        if not auth or not auth.uid:
            raise ValueError("Authentication required")

        requesting_user_id = auth.uid

        required_fields = ["groupId", "guestId", "memberId"]
        for field in required_fields:
            if field not in data:
                raise ValueError(f"Missing required field: {field}")

        group_id = data["groupId"]
        guest_id = data["guestId"]
        member_id = data["memberId"]
        guest_uid_prefix = f"guest_{guest_id}"

        db = firestore.client()

        group_ref = db.collection("groups").document(group_id)
        group_doc = group_ref.get()

        if not group_doc.exists:
            raise ValueError(f"Group with ID {group_id} does not exist")

        group_data = group_doc.to_dict()

        if group_data.get("adminUid") != requesting_user_id:
            members = group_data.get("members", {})
            if (
                requesting_user_id not in members
                or members[requesting_user_id].get("role") != "admin"
            ):
                raise ValueError("Only group admins can migrate guest data")

        guests = group_data.get("guests", [])
        guest_exists = False
        guest_name = ""

        for guest in guests:
            if isinstance(guest, dict) and guest.get("id") == guest_id:
                guest_exists = True
                guest_name = guest.get("name", "")
                break

        if not guest_exists:
            raise ValueError(
                f"Guest with ID {guest_id} does not exist in group {group_id}"
            )

        members = group_data.get("members", {})
        if member_id not in members:
            raise ValueError(
                f"Member with ID {member_id} does not exist in group {group_id}"
            )

        member_name = members[member_id].get("name", "")
        if not member_name:
            member_name = guest_name

        batch = db.batch()

        matches_ref = db.collection("matches")
        matches_query = matches_ref.where(filter=FieldFilter("groupId", "==", group_id))
        matches_stream = matches_query.stream()

        updated_matches_count = 0

        for match in matches_stream:
            match_data = match.to_dict()
            match_updates = {}
            match_modified_overall = False

            for team_key in ["team1", "team2"]:
                if team_key in match_data and "players" in match_data[team_key]:
                    players_data = match_data[team_key]["players"]
                    updated_players_list = []
                    team_modified = False

                    player_iterator = []
                    if isinstance(players_data, list):
                        player_iterator = players_data
                    elif isinstance(players_data, dict):
                        player_iterator = [
                            players_data[k]
                            for k in sorted(players_data.keys())
                            if isinstance(players_data[k], dict)
                        ]
                    else:
                        continue

                    for player in player_iterator:
                        if isinstance(player, dict):
                            player_uid = player.get("uid", "")
                            if player_uid == guest_id or player_uid == guest_uid_prefix:
                                updated_player = player.copy()
                                updated_player["uid"] = member_id
                                updated_player["displayName"] = member_name
                                updated_players_list.append(updated_player)
                                team_modified = True
                            else:
                                updated_players_list.append(player)
                        else:
                            updated_players_list.append(player)

                    if team_modified:
                        match_updates[f"{team_key}.players"] = updated_players_list
                        match_modified_overall = True

            if match_updates:
                batch.update(match.reference, match_updates)
                if match_modified_overall:
                    updated_matches_count += 1

        updated_guests = [
            guest
            for guest in guests
            if not (isinstance(guest, dict) and guest.get("id") == guest_id)
        ]
        batch.update(group_ref, {"guests": updated_guests})

        batch.commit()

        return {
            "success": True,
            "message": f"Successfully migrated guest '{guest_name}' to member '{member_name}'. Updated {updated_matches_count} matches.",  # noqa: E501
        }

    except ValueError as e:
        raise https_fn.HttpsError(  # noqa: B904
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message=str(e)
        )
    except Exception as e:
        print(f"Error in migrate_guest_to_member: {str(e)}")
        raise https_fn.HttpsError(  # noqa: B904
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error during migration",
        )
