from unittest.mock import MagicMock, patch

import firebase_admin
import pytest
from firebase_admin import firestore
from firebase_functions import https_fn
from google.cloud.firestore_v1.base_query import FieldFilter

from functions.join_group import join_group_with_code


@pytest.fixture
def valid_join_data():
    """Create valid join group data for testing"""
    return {"inviteCode": "ABC123"}


@pytest.fixture
def mock_auth():
    """Mock Firebase auth object"""
    mock_auth = MagicMock()
    mock_auth.uid = "test-user-uid"
    mock_auth.token = {"name": "Test User"}
    return mock_auth


@pytest.fixture
def mock_group_data():
    """Create mock group data"""
    return {
        "name": "Test Group",
        "adminUid": "admin-uid",
        "inviteCode": "ABC123",
        "members": {
            "admin-uid": {"role": "admin", "name": "Admin User"},
            "member-uid": {"role": "member", "name": "Member User"},
        },
    }


@patch("firebase_admin.firestore.client")
def test_join_group_success(mock_client, mock_auth, valid_join_data, mock_group_data):
    """Test successful join group"""
    mock_group_doc = MagicMock()
    mock_group_doc.id = "test-group-id"
    mock_group_doc.to_dict.return_value = mock_group_data

    mock_query = MagicMock()
    mock_query.stream.return_value = [mock_group_doc]

    mock_groups_ref = MagicMock()
    mock_groups_ref.where.return_value = mock_query

    mock_group_ref = MagicMock()

    mock_client_instance = MagicMock()
    mock_client_instance.collection.side_effect = lambda name: {
        "groups": mock_groups_ref
    }.get(name, MagicMock())
    mock_groups_ref.document.return_value = mock_group_ref

    mock_client.return_value = mock_client_instance

    result = join_group_with_code(valid_join_data, mock_auth)

    mock_groups_ref.where.assert_called_once()
    filter_args = mock_groups_ref.where.call_args[1]
    assert filter_args["filter"].field_path == "inviteCode"
    assert filter_args["filter"].value == "ABC123"

    mock_group_ref.update.assert_called_once()
    update_args = mock_group_ref.update.call_args[0][0]
    assert f"members.{mock_auth.uid}" in update_args
    assert update_args[f"members.{mock_auth.uid}"]["role"] == "viewer"
    assert update_args[f"members.{mock_auth.uid}"]["name"] == "Test User"

    assert result["success"] is True
    assert "Successfully joined group" in result["message"]
    assert result["groupId"] == "test-group-id"
    assert result["groupName"] == "Test Group"
    assert result["alreadyMember"] is False


@patch("firebase_admin.firestore.client")
def test_join_group_already_member(
    mock_client, mock_auth, valid_join_data, mock_group_data
):
    """Test joining a group when already a member"""
    updated_group_data = mock_group_data.copy()
    updated_group_data["members"]["test-user-uid"] = {
        "role": "viewer",
        "name": "Test User",
    }

    mock_group_doc = MagicMock()
    mock_group_doc.id = "test-group-id"
    mock_group_doc.to_dict.return_value = updated_group_data

    mock_query = MagicMock()
    mock_query.stream.return_value = [mock_group_doc]

    mock_groups_ref = MagicMock()
    mock_groups_ref.where.return_value = mock_query

    mock_client_instance = MagicMock()
    mock_client_instance.collection.return_value = mock_groups_ref
    mock_client.return_value = mock_client_instance

    result = join_group_with_code(valid_join_data, mock_auth)

    assert (
        not hasattr(mock_groups_ref, "document")
        or mock_groups_ref.document.call_count == 0
    )

    assert result["success"] is True
    assert "already a member" in result["message"]
    assert result["groupId"] == "test-group-id"
    assert result["groupName"] == "Test Group"
    assert result["alreadyMember"] is True


@patch("firebase_admin.firestore.client")
def test_join_group_invalid_code(mock_client, mock_auth, valid_join_data):
    """Test joining a group with an invalid invite code"""
    mock_query = MagicMock()
    mock_query.stream.return_value = []

    mock_groups_ref = MagicMock()
    mock_groups_ref.where.return_value = mock_query

    mock_client_instance = MagicMock()
    mock_client_instance.collection.return_value = mock_groups_ref
    mock_client.return_value = mock_client_instance

    with pytest.raises(https_fn.HttpsError) as excinfo:
        join_group_with_code(valid_join_data, mock_auth)

    assert "Invalid invite code" in excinfo.value.message
    assert excinfo.value.code == https_fn.FunctionsErrorCode.INVALID_ARGUMENT


@patch("firebase_admin.firestore.client")
def test_join_group_no_auth(mock_client, valid_join_data):
    """Test joining a group without authentication"""
    with pytest.raises(https_fn.HttpsError) as excinfo:
        join_group_with_code(valid_join_data, None)

    assert "Authentication required" in excinfo.value.message
    assert excinfo.value.code == https_fn.FunctionsErrorCode.INVALID_ARGUMENT

    mock_client.assert_not_called()


@patch("firebase_admin.firestore.client")
def test_join_group_missing_invite_code(mock_client, mock_auth):
    """Test joining a group with missing invite code"""
    with pytest.raises(https_fn.HttpsError) as excinfo:
        join_group_with_code({}, mock_auth)

    assert "Missing required field: inviteCode" in excinfo.value.message
    assert excinfo.value.code == https_fn.FunctionsErrorCode.INVALID_ARGUMENT

    mock_client.assert_not_called()


@patch("firebase_admin.firestore.client")
def test_join_group_firestore_error(mock_client, mock_auth, valid_join_data):
    """Test handling a Firestore error during group join"""
    mock_client.side_effect = Exception("Database connection error")

    with pytest.raises(https_fn.HttpsError) as excinfo:
        join_group_with_code(valid_join_data, mock_auth)

    assert excinfo.value.code == https_fn.FunctionsErrorCode.INTERNAL
    assert "Internal server error" in excinfo.value.message
