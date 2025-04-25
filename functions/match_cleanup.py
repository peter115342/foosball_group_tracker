import logging

import firebase_admin  # noqa: F401
from firebase_admin import firestore
from firebase_functions import firestore_fn


@firestore_fn.on_document_deleted(document="groups/{groupId}")
def on_group_deleted(event: firestore_fn.Event) -> None:
    """Triggers when a group document is deleted.

    Args:
        event: The Firestore event object
    """
    db = firestore.client()

    group_id = event.params["groupId"]
    logging.info(f"Group deleted, starting cleanup for groupId: {group_id}")

    matches_query = db.collection("matches").where(
        field_path="groupId", op_string="==", value=group_id
    )

    try:
        docs = list(matches_query.stream())

        if not docs:
            logging.info(
                f"No matches found for groupId: {group_id}. Nothing to delete."
            )
            return

        logging.info(f"Found {len(docs)} matches to delete for groupId: {group_id}.")

        batch = db.batch()
        for doc in docs:
            batch.delete(doc.reference)

        batch.commit()
        logging.info(
            f"Successfully deleted {len(docs)} matches for groupId: {group_id}."
        )

    except Exception as e:
        logging.error(f"Error deleting matches for groupId: {group_id}: {e}")
