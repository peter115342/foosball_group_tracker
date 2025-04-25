from firebase_admin import initialize_app
from firebase_functions import https_fn

from .guest_migration import migrate_guest_to_member

initialize_app()


@https_fn.on_call(enforce_app_check=True)
def migrate_guest_to_member_fn(req: https_fn.CallableRequest):
    """
    Handles the migration of a guest user's data to a registered member account.
    Expects user IDs in req.data.
    """
    return migrate_guest_to_member(req.data, req.auth)
