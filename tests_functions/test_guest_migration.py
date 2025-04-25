import pytest
from unittest.mock import MagicMock, patch
import firebase_admin
from firebase_admin import firestore
from firebase_functions import https_fn
from google.cloud.firestore_v1.base_query import FieldFilter

from functions.guest_migration import migrate_guest_to_member


@pytest.fixture
def valid_migrate_data():
    """Create valid migration data for testing"""
    return {"groupId": "test-group-id", "guestId": "123", "memberId": "member-123"}


@pytest.fixture
def mock_group_data():
    """Create mock group data"""
    return {
        "adminUid": "test-admin-uid",
        "members": {
            "test-admin-uid": {"role": "admin", "name": "Admin User"},
            "member-123": {"role": "member", "name": "Test Member"},
        },
        "guests": [{"id": "123", "name": "Guest User"}],
    }


@pytest.fixture
def mock_auth():
    """Mock Firebase auth object"""
    mock_auth = MagicMock()
    mock_auth.uid = "test-admin-uid"
    return mock_auth


@pytest.fixture
def mock_matches_collection():
    """Mock matches collection with query capabilities"""
    mock_query = MagicMock()
    mock_collection = MagicMock()
    mock_collection.where.return_value = mock_query
    return mock_collection, mock_query


@patch("firebase_admin.firestore.client")
def test_migrate_guest_to_member_success(
    mock_client, mock_auth, valid_migrate_data, mock_group_data
):
    """Test successful guest migration"""
    mock_doc_snapshot = MagicMock()
    mock_doc_snapshot.exists = True
    mock_doc_snapshot.to_dict.return_value = mock_group_data

    mock_doc_ref = MagicMock()
    mock_doc_ref.get.return_value = mock_doc_snapshot

    mock_match1 = MagicMock()
    mock_match1.to_dict.return_value = {
        "team1": {"players": [{"uid": "guest_123", "displayName": "Guest User"}]},
        "team2": {"players": [{"uid": "other-user", "displayName": "Other User"}]},
        "groupId": "test-group-id",
    }

    mock_query = MagicMock()
    mock_query.stream.return_value = [mock_match1]

    mock_groups_collection = MagicMock()
    mock_matches_collection = MagicMock()

    mock_batch = MagicMock()

    mock_client_instance = MagicMock()
    mock_client_instance.batch.return_value = mock_batch

    def mock_collection(name):
        if name == "groups":
            mock_groups_collection.document.return_value = mock_doc_ref
            return mock_groups_collection
        elif name == "matches":
            mock_matches_collection.where.return_value = mock_query
            return mock_matches_collection

    mock_client_instance.collection.side_effect = mock_collection
    mock_client.return_value = mock_client_instance

    result = migrate_guest_to_member(valid_migrate_data, mock_auth)

    assert result["success"] is True
    assert "Successfully migrated guest" in result["message"]
    mock_batch.commit.assert_called_once()


@patch("firebase_admin.firestore.client")
def test_migrate_guest_with_different_match_formats(
    mock_client, mock_auth, valid_migrate_data, mock_group_data
):
    """Test migration with different match data formats"""
    mock_doc_snapshot = MagicMock()
    mock_doc_snapshot.exists = True
    mock_doc_snapshot.to_dict.return_value = mock_group_data

    mock_doc_ref = MagicMock()
    mock_doc_ref.get.return_value = mock_doc_snapshot

    mock_match1 = MagicMock()
    mock_match1.to_dict.return_value = {
        "team1": {"players": [{"uid": "guest_123", "displayName": "Guest User"}]},
        "team2": {"players": [{"uid": "other-user", "displayName": "Other User"}]},
        "groupId": "test-group-id",
    }

    mock_match2 = MagicMock()
    mock_match2.to_dict.return_value = {
        "team1": {
            "players": [{"uid": "regular-player", "displayName": "Regular Player"}]
        },
        "team2": {
            "players": {
                "0": {"uid": "guest_123", "displayName": "Guest User"},
                "1": {"uid": "other-user", "displayName": "Other User"},
            }
        },
        "groupId": "test-group-id",
    }

    mock_query = MagicMock()
    mock_query.stream.return_value = [mock_match1, mock_match2]

    mock_groups_collection = MagicMock()
    mock_matches_collection = MagicMock()

    mock_batch = MagicMock()

    mock_client_instance = MagicMock()
    mock_client_instance.batch.return_value = mock_batch

    def mock_collection(name):
        if name == "groups":
            mock_groups_collection.document.return_value = mock_doc_ref
            return mock_groups_collection
        elif name == "matches":
            mock_matches_collection.where.return_value = mock_query
            return mock_matches_collection

    mock_client_instance.collection.side_effect = mock_collection
    mock_client.return_value = mock_client_instance

    result = migrate_guest_to_member(valid_migrate_data, mock_auth)

    assert result["success"] is True
    assert "Successfully migrated guest" in result["message"]
    assert "Updated 2 matches" in result["message"]
    mock_batch.commit.assert_called_once()
    assert mock_batch.update.call_count == 3  # 2 matches + 1 group update


@patch("firebase_admin.firestore.client")
def test_migrate_guest_with_no_matches(
    mock_client, mock_auth, valid_migrate_data, mock_group_data
):
    """Test migration when no matches need updating"""
    mock_doc_snapshot = MagicMock()
    mock_doc_snapshot.exists = True
    mock_doc_snapshot.to_dict.return_value = mock_group_data

    mock_doc_ref = MagicMock()
    mock_doc_ref.get.return_value = mock_doc_snapshot

    mock_match1 = MagicMock()
    mock_match1.to_dict.return_value = {
        "team1": {"players": [{"uid": "other-user1", "displayName": "Other User 1"}]},
        "team2": {"players": [{"uid": "other-user2", "displayName": "Other User 2"}]},
        "groupId": "test-group-id",
    }

    mock_query = MagicMock()
    mock_query.stream.return_value = [mock_match1]

    mock_groups_collection = MagicMock()
    mock_matches_collection = MagicMock()

    mock_batch = MagicMock()

    mock_client_instance = MagicMock()
    mock_client_instance.batch.return_value = mock_batch

    def mock_collection(name):
        if name == "groups":
            mock_groups_collection.document.return_value = mock_doc_ref
            return mock_groups_collection
        elif name == "matches":
            mock_matches_collection.where.return_value = mock_query
            return mock_matches_collection

    mock_client_instance.collection.side_effect = mock_collection
    mock_client.return_value = mock_client_instance

    result = migrate_guest_to_member(valid_migrate_data, mock_auth)

    assert result["success"] is True
    assert "Successfully migrated guest" in result["message"]
    assert "Updated 0 matches" in result["message"]
    mock_batch.commit.assert_called_once()
    assert mock_batch.update.call_count == 1


@patch("firebase_admin.firestore.client")
def test_migrate_guest_with_multiple_matches(
    mock_client, mock_auth, valid_migrate_data, mock_group_data
):
    """Test migration with multiple matches containing the guest"""
    mock_doc_snapshot = MagicMock()
    mock_doc_snapshot.exists = True
    mock_doc_snapshot.to_dict.return_value = mock_group_data

    mock_doc_ref = MagicMock()
    mock_doc_ref.get.return_value = mock_doc_snapshot

    mock_matches = []
    for i in range(5):
        mock_match = MagicMock()
        if i % 2 == 0:
            mock_match.to_dict.return_value = {
                "team1": {
                    "players": [{"uid": "guest_123", "displayName": "Guest User"}]
                },
                "team2": {
                    "players": [
                        {"uid": f"other-user-{i}", "displayName": f"Other User {i}"}
                    ]
                },
                "groupId": "test-group-id",
            }
        else:
            mock_match.to_dict.return_value = {
                "team1": {
                    "players": [
                        {"uid": f"other-user-{i}", "displayName": f"Other User {i}"}
                    ]
                },
                "team2": {
                    "players": [{"uid": "guest_123", "displayName": "Guest User"}]
                },
                "groupId": "test-group-id",
            }
        mock_matches.append(mock_match)

    mock_query = MagicMock()
    mock_query.stream.return_value = mock_matches

    mock_groups_collection = MagicMock()
    mock_matches_collection = MagicMock()

    mock_batch = MagicMock()

    mock_client_instance = MagicMock()
    mock_client_instance.batch.return_value = mock_batch

    def mock_collection(name):
        if name == "groups":
            mock_groups_collection.document.return_value = mock_doc_ref
            return mock_groups_collection
        elif name == "matches":
            mock_matches_collection.where.return_value = mock_query
            return mock_matches_collection

    mock_client_instance.collection.side_effect = mock_collection
    mock_client.return_value = mock_client_instance

    result = migrate_guest_to_member(valid_migrate_data, mock_auth)

    assert result["success"] is True
    assert "Successfully migrated guest" in result["message"]
    assert "Updated 5 matches" in result["message"]
    mock_batch.commit.assert_called_once()
    assert mock_batch.update.call_count == 6  # 5 matches + 1 group update


@patch("firebase_admin.firestore.client")
def test_migrate_guest_complex_match_structure(
    mock_client, mock_auth, valid_migrate_data, mock_group_data
):
    """Test migration with complex match data structures"""
    mock_doc_snapshot = MagicMock()
    mock_doc_snapshot.exists = True
    mock_doc_snapshot.to_dict.return_value = mock_group_data

    mock_doc_ref = MagicMock()
    mock_doc_ref.get.return_value = mock_doc_snapshot

    mock_match = MagicMock()
    mock_match.to_dict.return_value = {
        "metadata": {"createdAt": "2023-01-01", "location": "Test Location"},
        "teams": {
            "team1": {
                "score": 10,
                "players": {
                    "player1": {
                        "uid": "guest_123",
                        "displayName": "Guest User",
                        "stats": {"goals": 5},
                    },
                    "player2": {
                        "uid": "other-user",
                        "displayName": "Other User",
                        "stats": {"goals": 3},
                    },
                },
            },
            "team2": {
                "score": 8,
                "players": [
                    {
                        "uid": "another-user",
                        "displayName": "Another User",
                        "stats": {"goals": 2},
                    },
                    {
                        "uid": "guest_123",
                        "displayName": "Guest User",
                        "stats": {"goals": 6},
                    },
                ],
            },
        },
        "groupId": "test-group-id",
    }

    mock_query = MagicMock()
    mock_query.stream.return_value = [mock_match]

    mock_groups_collection = MagicMock()
    mock_matches_collection = MagicMock()

    mock_batch = MagicMock()

    mock_client_instance = MagicMock()
    mock_client_instance.batch.return_value = mock_batch

    def mock_collection(name):
        if name == "groups":
            mock_groups_collection.document.return_value = mock_doc_ref
            return mock_groups_collection
        elif name == "matches":
            mock_matches_collection.where.return_value = mock_query
            return mock_matches_collection

    mock_client_instance.collection.side_effect = mock_collection
    mock_client.return_value = mock_client_instance

    result = migrate_guest_to_member(valid_migrate_data, mock_auth)

    assert result["success"] is True
    assert "Successfully migrated guest" in result["message"]
    mock_batch.commit.assert_called_once()
