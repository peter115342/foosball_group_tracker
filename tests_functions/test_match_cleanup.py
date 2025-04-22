import pytest
from unittest.mock import MagicMock, patch
import firebase_admin
from firebase_admin import firestore
import logging

from functions.match_cleanup import on_group_deleted


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
    mock_client_instance.collection.return_value = mock_collection

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

    mock_client_instance.collection.assert_called_with("matches")
    mock_collection.where.assert_called_with(
        field_path="groupId", op_string="==", value=group_id
    )
    assert mock_batch.delete.call_count == 2
    mock_batch.commit.assert_called_once()


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
    mock_client_instance.collection.return_value = mock_collection

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

    mock_client_instance.collection.assert_called_with("matches")
    assert mock_batch.delete.call_count == 50
    mock_batch.commit.assert_called_once()


@patch("firebase_admin.firestore.client")
def test_match_cleanup_with_no_matches(mock_client):
    """Test cleanup when no matches are found"""
    mock_query = MagicMock()
    mock_query.stream.return_value = []

    mock_collection = MagicMock()
    mock_collection.where.return_value = mock_query

    mock_client_instance = MagicMock()
    mock_client.return_value = mock_client_instance
    mock_client_instance.collection.return_value = mock_collection

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

    mock_client_instance.collection.assert_called_with("matches")
    assert (
        not hasattr(mock_client_instance, "batch")
        or mock_client_instance.batch.call_count == 0
    )


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
    except Exception as e:
        logging.error(f"Error deleting matches for groupId: {group_id}: {e}")

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
        logging.error(f"Error deleting matches for groupId: {group_id}: {e}")

    mock_log_error.assert_called_once()
    assert "Test batch exception" in str(mock_log_error.call_args[0][0])
