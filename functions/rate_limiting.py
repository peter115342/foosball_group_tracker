import logging

from firebase_admin import firestore
from firebase_functions import firestore_fn

GROUP_LIMIT = 20  # Maximum per user
GROUP_COOLDOWN_SECONDS = 60
MATCH_COOLDOWN_SECONDS = 10


@firestore_fn.on_document_created(document="groups/{groupId}")
def on_group_created(event: firestore_fn.Event) -> None:
    """Manages rate limiting when a group document is created.

    Creates or updates the rate limit document for the user who created the group.
    """
    try:
        group_data = event.data.to_dict()
        if not group_data or "adminUid" not in group_data:
            logging.warning("Group document missing required fields for rate limiting")
            return

        admin_uid = group_data["adminUid"]

        db = firestore.client()
        ratelimit_ref = db.collection("ratelimits").document(admin_uid)

        ratelimit_doc = ratelimit_ref.get()

        if ratelimit_doc.exists:
            db.collection("ratelimits").document(admin_uid).update(
                {
                    "groupCount": firestore.Increment(1),
                    "lastGroupCreation": firestore.SERVER_TIMESTAMP,
                }
            )
        else:
            db.collection("ratelimits").document(admin_uid).set(
                {"groupCount": 1, "lastGroupCreation": firestore.SERVER_TIMESTAMP}
            )

        logging.info(f"Updated group rate limit for user {admin_uid}")
    except Exception as e:
        logging.error(f"Error updating group rate limit: {e}")


@firestore_fn.on_document_deleted(document="groups/{groupId}")
def on_group_deleted(event: firestore_fn.Event) -> None:
    """Decrements the group count when a group is deleted."""
    try:
        group_data = event.data.to_dict()
        if not group_data or "adminUid" not in group_data:
            logging.warning("Group document missing required fields for rate limiting")
            return

        admin_uid = group_data["adminUid"]

        db = firestore.client()
        ratelimit_ref = db.collection("ratelimits").document(admin_uid)

        ratelimit_doc = ratelimit_ref.get()

        if ratelimit_doc.exists:
            current_count = ratelimit_doc.to_dict().get("groupCount", 0)
            new_count = max(0, current_count - 1)

            db.collection("ratelimits").document(admin_uid).update(
                {"groupCount": new_count}
            )

        logging.info(f"Decremented group count for user {admin_uid}")
    except Exception as e:
        logging.error(f"Error decrementing group count: {e}")


@firestore_fn.on_document_created(document="matches/{matchId}")
def on_match_created(event: firestore_fn.Event) -> None:
    """Manages rate limiting when a match document is created."""
    try:
        match_data = event.data.to_dict()
        if not match_data or "createdBy" not in match_data:
            logging.warning("Match document missing required fields for rate limiting")
            return

        user_uid = match_data["createdBy"]

        db = firestore.client()
        ratelimit_ref = db.collection("matchRatelimits").document(user_uid)

        ratelimit_doc = ratelimit_ref.get()

        if ratelimit_doc.exists:
            db.collection("matchRatelimits").document(user_uid).update(
                {"lastMatchCreation": firestore.SERVER_TIMESTAMP}
            )
        else:
            db.collection("matchRatelimits").document(user_uid).set(
                {"lastMatchCreation": firestore.SERVER_TIMESTAMP}
            )

        logging.info(f"Updated match rate limit for user {user_uid}")
    except Exception as e:
        logging.error(f"Error updating match rate limit: {e}")
