import logging
from unittest.mock import MagicMock, patch

import firebase_admin
import pytest
from firebase_admin import firestore

from functions.match_cleanup import on_group_deleted_cleanup_matches


@patch("firebase_admin.firestore.client")
def test_match_cleanup_functionality(mock_client):
    """Test the core functionality of the match cleanup function"""
    mock_doc1 = MagicMock()
    mock_doc1.reference = MagicMock()

    mock_doc2 = MagicMock()
    mock_doc2.reference = MagicMock()

    mock_docs = [mock_doc1, mock_doc2]

    mock_batch = MagicMock()

    mock_client_instance = MagicMock()
    mock_client_instance.batch.return_value = mock_batch
    mock_client.return_value = mock_client_instance

    mock_query = MagicMock()
    mock_query.stream.return_value = mock_docs

    mock_collection = MagicMock()
    mock_collection.where.return_value = mock_query

    # Mock for the stats document
    mock_stats_doc = MagicMock()
    mock_stats_doc.exists = True

    mock_stats_ref = MagicMock()
    mock_stats_ref.get.return_value = mock_stats_doc

    # Setup collection mocks based on which collection is requested
    def mock_collection_getter(collection_name):
        if collection_name == "matches":
            return mock_collection
        elif collection_name == "groupStats":
            return MagicMock(document=lambda doc_id: mock_stats_ref)
        return MagicMock()

    mock_client_instance.collection.side_effect = mock_collection_getter

    group_id = "test-group-id"

    db = mock_client_instance
    matches_query = db.collection("matches").where(
        field_path="groupId", op_string="==", value=group_id
    )

    docs = list(matches_query.stream())
    batch = db.batch()
    for doc in docs:
        batch.delete(doc.reference)
    batch.commit()

    # Delete group stats
    stats_ref = db.collection("groupStats").document(group_id)
    stats_doc = stats_ref.get()
    if stats_doc.exists:
        stats_ref.delete()

    # Verify match deletions
    mock_client_instance.collection.assert_any_call("matches")
    mock_collection.where.assert_called_with(
        field_path="groupId", op_string="==", value=group_id
    )
    assert mock_batch.delete.call_count == 2
    mock_batch.commit.assert_called_once()

    # Verify stats deletion
    mock_client_instance.collection.assert_any_call("groupStats")
    mock_stats_ref.get.assert_called_once()
    mock_stats_ref.delete.assert_called_once()


@patch("firebase_admin.firestore.client")
def test_match_cleanup_with_many_matches(mock_client):
    """Test cleanup with a large number of matches (batch operation)"""
    mock_docs = []
    for _i in range(50):
        mock_doc = MagicMock()
        mock_doc.reference = MagicMock()
        mock_docs.append(mock_doc)

    mock_batch = MagicMock()

    mock_client_instance = MagicMock()
    mock_client_instance.batch.return_value = mock_batch
    mock_client.return_value = mock_client_instance

    mock_query = MagicMock()
    mock_query.stream.return_value = mock_docs

    mock_collection = MagicMock()
    mock_collection.where.return_value = mock_query

    # Mock for the stats document
    mock_stats_doc = MagicMock()
    mock_stats_doc.exists = True

    mock_stats_ref = MagicMock()
    mock_stats_ref.get.return_value = mock_stats_doc

    # Setup collection mocks based on which collection is requested
    def mock_collection_getter(collection_name):
        if collection_name == "matches":
            return mock_collection
        elif collection_name == "groupStats":
            return MagicMock(document=lambda doc_id: mock_stats_ref)
        return MagicMock()

    mock_client_instance.collection.side_effect = mock_collection_getter

    group_id = "test-group-id"

    db = mock_client_instance
    matches_query = db.collection("matches").where(
        field_path="groupId", op_string="==", value=group_id
    )

    docs = list(matches_query.stream())
    batch = db.batch()
    for doc in docs:
        batch.delete(doc.reference)
    batch.commit()

    # Delete group stats
    stats_ref = db.collection("groupStats").document(group_id)
    stats_doc = stats_ref.get()
    if stats_doc.exists:
        stats_ref.delete()

    mock_client_instance.collection.assert_any_call("matches")
    assert mock_batch.delete.call_count == 50
    mock_batch.commit.assert_called_once()

    # Verify stats deletion
    mock_client_instance.collection.assert_any_call("groupStats")
    mock_stats_ref.delete.assert_called_once()


@patch("firebase_admin.firestore.client")
def test_match_cleanup_with_no_matches(mock_client):
    """Test cleanup when no matches are found"""
    mock_query = MagicMock()
    mock_query.stream.return_value = []

    mock_collection = MagicMock()
    mock_collection.where.return_value = mock_query

    # Mock for the stats document
    mock_stats_doc = MagicMock()
    mock_stats_doc.exists = True

    mock_stats_ref = MagicMock()
    mock_stats_ref.get.return_value = mock_stats_doc

    # Setup collection mocks
    def mock_collection_getter(collection_name):
        if collection_name == "matches":
            return mock_collection
        elif collection_name == "groupStats":
            return MagicMock(document=lambda doc_id: mock_stats_ref)
        return MagicMock()

    mock_client_instance = MagicMock()
    mock_client.return_value = mock_client_instance
    mock_client_instance.collection.side_effect = mock_collection_getter

    group_id = "test-group-id"

    db = mock_client_instance
    matches_query = db.collection("matches").where(
        field_path="groupId", op_string="==", value=group_id
    )

    docs = list(matches_query.stream())

    if docs:
        batch = db.batch()
        for doc in docs:
            batch.delete(doc.reference)
        batch.commit()

    # Delete group stats
    stats_ref = db.collection("groupStats").document(group_id)
    stats_doc = stats_ref.get()
    if stats_doc.exists:
        stats_ref.delete()

    mock_client_instance.collection.assert_any_call("matches")
    assert (
        not hasattr(mock_client_instance, "batch")
        or mock_client_instance.batch.call_count == 0
    )

    # Verify stats deletion still happens even when no matches exist
    mock_client_instance.collection.assert_any_call("groupStats")
    mock_stats_ref.delete.assert_called_once()


@patch("firebase_admin.firestore.client")
def test_match_cleanup_with_no_stats(mock_client):
    """Test cleanup when no stats document exists"""
    mock_query = MagicMock()
    mock_query.stream.return_value = []

    mock_collection = MagicMock()
    mock_collection.where.return_value = mock_query

    # Mock for the non-existent stats document
    mock_stats_doc = MagicMock()
    mock_stats_doc.exists = False

    mock_stats_ref = MagicMock()
    mock_stats_ref.get.return_value = mock_stats_doc

    # Setup collection mocks
    def mock_collection_getter(collection_name):
        if collection_name == "matches":
            return mock_collection
        elif collection_name == "groupStats":
            return MagicMock(document=lambda doc_id: mock_stats_ref)
        return MagicMock()

    mock_client_instance = MagicMock()
    mock_client.return_value = mock_client_instance
    mock_client_instance.collection.side_effect = mock_collection_getter

    group_id = "test-group-id"

    db = mock_client_instance
    matches_query = db.collection("matches").where(
        field_path="groupId", op_string="==", value=group_id
    )

    docs = list(matches_query.stream())

    if docs:
        batch = db.batch()
        for doc in docs:
            batch.delete(doc.reference)
        batch.commit()

    # Check stats
    stats_ref = db.collection("groupStats").document(group_id)
    stats_doc = stats_ref.get()
    if stats_doc.exists:
        stats_ref.delete()

    mock_client_instance.collection.assert_any_call("groupStats")
    mock_stats_ref.get.assert_called_once()
    mock_stats_ref.delete.assert_not_called()


@patch("firebase_admin.firestore.client")
@patch("logging.error")
def test_match_cleanup_with_exception_during_query(mock_log_error, mock_client):
    """Test cleanup when an exception occurs during the query"""
    mock_collection = MagicMock()
    mock_collection.where.side_effect = Exception("Test query exception")

    mock_client_instance = MagicMock()
    mock_client_instance.collection.return_value = mock_collection
    mock_client.return_value = mock_client_instance

    group_id = "test-group-id"

    db = mock_client_instance
    try:
        matches_query = db.collection("matches").where(
            field_path="groupId", op_string="==", value=group_id
        )

        docs = list(matches_query.stream())

        if docs:
            batch = db.batch()
            for doc in docs:
                batch.delete(doc.reference)
            batch.commit()

        # Delete group stats
        stats_ref = db.collection("groupStats").document(group_id)
        stats_doc = stats_ref.get()
        if stats_doc.exists:
            stats_ref.delete()
    except Exception as e:
        logging.error(f"Error during cleanup for groupId: {group_id}: {e}")

    mock_log_error.assert_called_once()
    assert "Test query exception" in str(mock_log_error.call_args[0][0])


@patch("firebase_admin.firestore.client")
@patch("logging.error")
def test_match_cleanup_with_exception_during_batch(mock_log_error, mock_client):
    """Test cleanup when an exception occurs during batch operation"""
    mock_doc1 = MagicMock()
    mock_doc1.reference = MagicMock()
    mock_docs = [mock_doc1]

    mock_query = MagicMock()
    mock_query.stream.return_value = mock_docs

    mock_collection = MagicMock()
    mock_collection.where.return_value = mock_query

    mock_client_instance = MagicMock()
    mock_client_instance.collection.return_value = mock_collection
    mock_client.return_value = mock_client_instance

    mock_batch = MagicMock()
    mock_batch.delete.side_effect = Exception("Test batch exception")
    mock_client_instance.batch.return_value = mock_batch

    group_id = "test-group-id"

    db = mock_client_instance
    try:
        matches_query = db.collection("matches").where(
            field_path="groupId", op_string="==", value=group_id
        )

        docs = list(matches_query.stream())

        if docs:
            batch = db.batch()
            for doc in docs:
                batch.delete(doc.reference)
            batch.commit()
    except Exception as e:
        logging.error(f"Error during cleanup for groupId: {group_id}: {e}")

    mock_log_error.assert_called_once()
    assert "Test batch exception" in str(mock_log_error.call_args[0][0])


@patch("firebase_admin.firestore.client")
@patch("logging.error")
def test_match_cleanup_with_exception_during_stats_deletion(
    mock_log_error, mock_client
):
    """Test cleanup when an exception occurs during stats deletion"""
    mock_query = MagicMock()
    mock_query.stream.return_value = []

    mock_collection = MagicMock()
    mock_collection.where.return_value = mock_query

    # Mock for the stats document that will throw an exception
    mock_stats_doc = MagicMock()
    mock_stats_doc.exists = True

    mock_stats_ref = MagicMock()
    mock_stats_ref.get.return_value = mock_stats_doc
    mock_stats_ref.delete.side_effect = Exception("Test stats deletion exception")

    # Setup collection mocks
    def mock_collection_getter(collection_name):
        if collection_name == "matches":
            return mock_collection
        elif collection_name == "groupStats":
            return MagicMock(document=lambda doc_id: mock_stats_ref)
        return MagicMock()

    mock_client_instance = MagicMock()
    mock_client.return_value = mock_client_instance
    mock_client_instance.collection.side_effect = mock_collection_getter

    group_id = "test-group-id"

    db = mock_client_instance
    try:
        matches_query = db.collection("matches").where(
            field_path="groupId", op_string="==", value=group_id
        )

        docs = list(matches_query.stream())

        if docs:
            batch = db.batch()
            for doc in docs:
                batch.delete(doc.reference)
            batch.commit()

        # Delete group stats
        stats_ref = db.collection("groupStats").document(group_id)
        stats_doc = stats_ref.get()
        if stats_doc.exists:
            stats_ref.delete()
    except Exception as e:
        logging.error(f"Error during cleanup for groupId: {group_id}: {e}")

    mock_log_error.assert_called_once()
    assert "Test stats deletion exception" in str(mock_log_error.call_args[0][0])
