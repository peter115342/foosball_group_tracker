from unittest.mock import MagicMock

import pytest


@pytest.fixture
def mock_firestore_client():
    """Mock Firestore client with common operations"""
    mock_client = MagicMock()

    mock_collection = MagicMock()
    mock_client.collection.return_value = mock_collection

    mock_batch = MagicMock()
    mock_client.batch.return_value = mock_batch

    mock_doc_ref = MagicMock()
    mock_collection.document.return_value = mock_doc_ref

    mock_doc_snapshot = MagicMock()
    mock_doc_ref.get.return_value = mock_doc_snapshot

    mock_query = MagicMock()
    mock_collection.where.return_value = mock_query

    return mock_client


@pytest.fixture
def mock_auth():
    """Mock Firebase auth object"""
    mock_auth = MagicMock()
    mock_auth.uid = "test-admin-uid"
    return mock_auth


@pytest.fixture
def mock_callable_request(mock_auth):
    """Mock Firebase callable request"""
    mock_request = MagicMock()
    mock_request.auth = mock_auth
    return mock_request


@pytest.fixture
def mock_firestore_event():
    """Mock Firestore event with data and params"""
    mock_event = MagicMock()
    mock_event.data = MagicMock()
    mock_event.params = {"groupId": "test-group-id"}
    return mock_event
