import logging
from unittest.mock import MagicMock, patch

import pytest
from firebase_admin import firestore
from firebase_functions import firestore_fn

from functions.rate_limiting import (
    GROUP_COOLDOWN_SECONDS,
    GROUP_LIMIT,
    MATCH_COOLDOWN_SECONDS,
    on_group_created,
    on_group_deleted,
    on_match_created,
)


@pytest.fixture
def mock_event():
    """Create a mock event for Firestore triggers"""
    mock_event = MagicMock()
    mock_event.data = MagicMock()
    return mock_event


@pytest.fixture
def mock_group_data():
    """Create mock group data for testing"""
    return {
        "adminUid": "test-admin-uid",
        "name": "Test Group",
        "inviteCode": "ABC123",
        "members": {
            "test-admin-uid": {"role": "admin", "name": "Admin User"},
        },
    }


@pytest.fixture
def mock_match_data():
    """Create mock match data for testing"""
    return {
        "groupId": "test-group-id",
        "createdBy": "test-user-uid",
        "team1": {"score": 10, "players": []},
        "team2": {"score": 5, "players": []},
    }


@patch("firebase_admin.firestore.client")
@patch("logging.info")
def test_on_group_created_new_user(
    mock_log_info, mock_client, mock_event, mock_group_data
):
    """Test on_group_created when user doesn't have a rate limit doc yet"""
    mock_event.data.to_dict.return_value = mock_group_data

    mock_ratelimit_doc = MagicMock()
    mock_ratelimit_doc.exists = False

    mock_ratelimit_ref = MagicMock()
    mock_ratelimit_ref.get.return_value = mock_ratelimit_doc

    mock_collection = MagicMock()
    mock_collection.document.return_value = mock_ratelimit_ref

    mock_client_instance = MagicMock()
    mock_client_instance.collection.return_value = mock_collection
    mock_client.return_value = mock_client_instance

    on_group_created(mock_event)

    mock_client_instance.collection.assert_called_with("ratelimits")
    mock_collection.document.assert_called_with("test-admin-uid")

    mock_ratelimit_ref.set.assert_called_once()
    set_data = mock_ratelimit_ref.set.call_args[0][0]
    assert set_data["groupCount"] == 1
    assert "lastGroupCreation" in set_data

    mock_log_info.assert_called_once()


@patch("firebase_admin.firestore.client")
@patch("logging.info")
def test_on_group_created_existing_user(
    mock_log_info, mock_client, mock_event, mock_group_data
):
    """Test on_group_created when user already has a rate limit doc"""
    mock_event.data.to_dict.return_value = mock_group_data

    mock_ratelimit_doc = MagicMock()
    mock_ratelimit_doc.exists = True

    mock_ratelimit_ref = MagicMock()
    mock_ratelimit_ref.get.return_value = mock_ratelimit_doc

    mock_collection = MagicMock()
    mock_collection.document.return_value = mock_ratelimit_ref

    mock_client_instance = MagicMock()
    mock_client_instance.collection.return_value = mock_collection
    mock_client.return_value = mock_client_instance

    on_group_created(mock_event)

    mock_ratelimit_ref.update.assert_called_once()
    update_data = mock_ratelimit_ref.update.call_args[0][0]
    assert "groupCount" in update_data
    assert "lastGroupCreation" in update_data

    mock_log_info.assert_called_once()


@patch("firebase_admin.firestore.client")
@patch("logging.error")
def test_on_group_created_missing_admin(mock_log_error, mock_client, mock_event):
    """Test on_group_created when the admin UID is missing"""
    mock_event.data.to_dict.return_value = {"name": "Test Group"}  # Missing adminUid

    on_group_created(mock_event)

    mock_log_error.assert_called_once()
    mock_client.assert_not_called()


@patch("firebase_admin.firestore.client")
@patch("logging.error")
def test_on_group_created_exception(
    mock_log_error, mock_client, mock_event, mock_group_data
):
    """Test on_group_created when an exception occurs"""
    mock_event.data.to_dict.return_value = mock_group_data

    mock_client.side_effect = Exception("Test exception")

    on_group_created(mock_event)

    mock_log_error.assert_called_once()
    assert "Error updating group rate limit" in mock_log_error.call_args[0][0]


@patch("firebase_admin.firestore.client")
def test_on_group_deleted(mock_client, mock_event, mock_group_data):
    """Test on_group_deleted function"""
    mock_event.data.to_dict.return_value = mock_group_data

    mock_ratelimit_doc = MagicMock()
    mock_ratelimit_doc.exists = True
    mock_ratelimit_doc.to_dict.return_value = {"groupCount": 5}

    mock_ratelimit_ref = MagicMock()
    mock_ratelimit_ref.get.return_value = mock_ratelimit_doc

    mock_collection = MagicMock()
    mock_collection.document.return_value = mock_ratelimit_ref

    mock_client_instance = MagicMock()
    mock_client_instance.collection.return_value = mock_collection
    mock_client.return_value = mock_client_instance

    on_group_deleted(mock_event)

    mock_client_instance.collection.assert_called_with("ratelimits")
    mock_collection.document.assert_called_with("test-admin-uid")

    mock_ratelimit_ref.update.assert_called_once()
    update_data = mock_ratelimit_ref.update.call_args[0][0]
    assert update_data["groupCount"] == 4  # 5-1=4


@patch("firebase_admin.firestore.client")
def test_on_group_deleted_count_zero(mock_client, mock_event, mock_group_data):
    """Test on_group_deleted when count would go below zero"""
    mock_event.data.to_dict.return_value = mock_group_data

    mock_ratelimit_doc = MagicMock()
    mock_ratelimit_doc.exists = True
    mock_ratelimit_doc.to_dict.return_value = {"groupCount": 0}  # Already at zero

    mock_ratelimit_ref = MagicMock()
    mock_ratelimit_ref.get.return_value = mock_ratelimit_doc

    mock_collection = MagicMock()
    mock_collection.document.return_value = mock_ratelimit_ref

    mock_client_instance = MagicMock()
    mock_client_instance.collection.return_value = mock_collection
    mock_client.return_value = mock_client_instance

    on_group_deleted(mock_event)

    mock_ratelimit_ref.update.assert_called_once()
    update_data = mock_ratelimit_ref.update.call_args[0][0]
    assert update_data["groupCount"] == 0  # Still 0, not -1


@patch("firebase_admin.firestore.client")
def test_on_match_created(mock_client, mock_event, mock_match_data):
    """Test on_match_created function"""
    mock_event.data.to_dict.return_value = mock_match_data

    mock_ratelimit_doc = MagicMock()
    mock_ratelimit_doc.exists = False

    mock_ratelimit_ref = MagicMock()
    mock_ratelimit_ref.get.return_value = mock_ratelimit_doc

    mock_collection = MagicMock()
    mock_collection.document.return_value = mock_ratelimit_ref

    mock_client_instance = MagicMock()
    mock_client_instance.collection.return_value = mock_collection
    mock_client.return_value = mock_client_instance

    on_match_created(mock_event)

    mock_client_instance.collection.assert_called_with("matchRatelimits")
    mock_collection.document.assert_called_with("test-user-uid")

    mock_ratelimit_ref.set.assert_called_once()
    set_data = mock_ratelimit_ref.set.call_args[0][0]
    assert "lastMatchCreation" in set_data


@patch("firebase_admin.firestore.client")
def test_on_match_created_existing_user(mock_client, mock_event, mock_match_data):
    """Test on_match_created when user already has a rate limit doc"""
    mock_event.data.to_dict.return_value = mock_match_data

    mock_ratelimit_doc = MagicMock()
    mock_ratelimit_doc.exists = True

    mock_ratelimit_ref = MagicMock()
    mock_ratelimit_ref.get.return_value = mock_ratelimit_doc

    mock_collection = MagicMock()
    mock_collection.document.return_value = mock_ratelimit_ref

    mock_client_instance = MagicMock()
    mock_client_instance.collection.return_value = mock_collection
    mock_client.return_value = mock_client_instance

    on_match_created(mock_event)

    mock_ratelimit_ref.update.assert_called_once()
    update_data = mock_ratelimit_ref.update.call_args[0][0]
    assert "lastMatchCreation" in update_data


@patch("firebase_admin.firestore.client")
@patch("logging.error")
def test_on_match_created_missing_creator(mock_log_error, mock_client, mock_event):
    """Test on_match_created when the creator ID is missing"""
    mock_event.data.to_dict.return_value = {"groupId": "test-group-id"}

    on_match_created(mock_event)

    mock_log_error.assert_called_once()
