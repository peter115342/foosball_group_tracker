import logging
import re

from firebase_admin import firestore
from firebase_functions import firestore_fn

MAX_GUEST_NAME_LENGTH = 20
GUEST_NAME_PATTERN = r"^[a-zA-Z0-9 ]+$"


@firestore_fn.on_document_written(document="groups/{groupId}")
def validate_guest_names(event: firestore_fn.Event) -> None:
    """
    Validates guest names when a group is created or updated.
    Ensures all guest names follow the required format.
    """
    if not event.data.after or not event.data.after.exists:
        return

    group_data = event.data.after.to_dict()
    guests = group_data.get("guests", [])

    if not guests:
        return

    needs_cleaning = False
    valid_guests = []

    for guest in guests:
        if not isinstance(guest, dict):
            continue

        guest_name = guest.get("name", "")
        guest_id = guest.get("id", "")

        if not guest_id or not guest_name:
            continue

        if len(guest_name) > MAX_GUEST_NAME_LENGTH or not re.match(
            GUEST_NAME_PATTERN, guest_name
        ):
            needs_cleaning = True

            sanitized_name = re.sub(r"[^a-zA-Z0-9 ]", "", guest_name)
            sanitized_name = sanitized_name[:MAX_GUEST_NAME_LENGTH].strip()

            if sanitized_name:
                valid_guests.append({"id": guest_id, "name": sanitized_name})
        else:
            valid_guests.append(guest)

    if needs_cleaning:
        try:
            db = firestore.client()
            group_ref = db.collection("groups").document(event.params["groupId"])

            group_ref.update({"guests": valid_guests})

            logging.info(f"Sanitized guest names for group {event.params['groupId']}")
        except Exception as e:
            logging.error(f"Error sanitizing guest names: {str(e)}")
