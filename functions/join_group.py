import re

from firebase_admin import firestore
from firebase_functions import https_fn
from google.cloud.firestore_v1.base_query import FieldFilter


def join_group_with_code(data, auth):
    try:
        if not auth or not auth.uid:
            raise ValueError("Authentication required")

        if "inviteCode" not in data:
            raise ValueError("Missing required field: inviteCode")

        invite_code = data["inviteCode"].strip().upper()

        if len(invite_code) != 8:
            raise ValueError("Invite code must be 8 characters")

        if not re.match(r"^[A-Z0-9]+$", invite_code):
            raise ValueError("Invite code must contain only letters and numbers")

        user_id = auth.uid
        user_name = auth.token.get("name", "User")

        db = firestore.client()

        groups_ref = db.collection("groups")
        query = groups_ref.where(filter=FieldFilter("inviteCode", "==", invite_code))
        results = query.stream()

        group_docs = list(results)
        if not group_docs:
            raise ValueError("Invalid invite code. No matching group found.")

        group_doc = group_docs[0]
        group_id = group_doc.id
        group_data = group_doc.to_dict()

        members = group_data.get("members", {})
        if user_id in members:
            return {
                "success": True,
                "message": "You are already a member of this group",
                "groupId": group_id,
                "groupName": group_data.get("name", ""),
                "alreadyMember": True,
            }

        group_ref = db.collection("groups").document(group_id)
        group_ref.update({f"members.{user_id}": {"name": user_name, "role": "viewer"}})

        return {
            "success": True,
            "message": f"Successfully joined group: {group_data.get('name', '')}",
            "groupId": group_id,
            "groupName": group_data.get("name", ""),
            "alreadyMember": False,
        }

    except ValueError as e:
        raise https_fn.HttpsError(  # noqa: B904
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message=str(e)
        )
    except Exception as e:
        print(f"Error in join_group_with_code: {str(e)}")
        raise https_fn.HttpsError(  # noqa: B904
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="Internal server error when trying to join group",
        )
