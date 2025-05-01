from firebase_admin import initialize_app
from firebase_functions import https_fn
from guest_migration import migrate_guest_to_member
from match_cleanup import on_group_deleted_cleanup_matches  # noqa: F401
from match_stats import on_group_update, on_match_update  # noqa: F401
from rate_limiting import (
    on_group_created,  # noqa: F401
    on_group_deleted,  # noqa: F401, F811
    on_match_created,  # noqa: F401
)

initialize_app()


@https_fn.on_call(enforce_app_check=True)
def migrate_guest_to_member_fn(req: https_fn.CallableRequest):
    """
    Handles the migration of a guest user's data to a registered member account.
    Expects user IDs in req.data.
    """
    return migrate_guest_to_member(req.data, req.auth)
