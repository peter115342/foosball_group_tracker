import logging

import firebase_admin
from firebase_admin import credentials, firestore  # noqa: F401
from firebase_functions import firestore_fn


@firestore_fn.on_document_deleted(document="groups/{groupId}")
def on_group_deleted_cleanup_matches(event: firestore_fn.Event) -> None:
    if not firebase_admin._apps:
        firebase_admin.initialize_app()

    db = firestore.client()

    group_id = event.params["groupId"]
    logging.info(f"Group deleted, starting cleanup for groupId: {group_id}")

    matches_query = db.collection("matches").where(
        filter=firestore.FieldFilter("groupId", "==", group_id)
    )

    try:
        docs = list(matches_query.stream())

        if not docs:
            logging.info(
                f"No matches found for groupId: {group_id}. Nothing to delete."
            )
        else:
            logging.info(
                f"Found {len(docs)} matches to delete for groupId: {group_id}."
            )

            batch_size = 500
            for i in range(0, len(docs), batch_size):
                batch = db.batch()
                batch_docs = docs[i : i + batch_size]

                for doc in batch_docs:
                    batch.delete(doc.reference)

                batch.commit()
                logging.info(
                    f"Successfully deleted batch of {len(batch_docs)} matches for groupId: {group_id}."  # noqa: E501
                )

        stats_ref = db.collection("groupStats").document(group_id)
        stats_doc = stats_ref.get()

        if stats_doc.exists:
            stats_ref.delete()
            logging.info(f"Successfully deleted stats for groupId: {group_id}.")
        else:
            logging.info(f"No stats found for groupId: {group_id}. Nothing to delete.")

    except Exception as e:
        logging.error(f"Error during cleanup for groupId: {group_id}: {e}")
        raise
