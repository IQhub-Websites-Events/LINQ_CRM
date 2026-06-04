"""
accounts/crm_permissions.py
────────────────────────────
Factory that returns a DRF permission class for a given CRM module.

Usage in ViewSets:
    from accounts.crm_permissions import crm_permission
    permission_classes = [crm_permission("events")]
"""
from rest_framework.permissions import BasePermission

# Actions that only need can_view
_VIEW_ACTIONS = frozenset({
    "list", "retrieve", "stats", "role_stats", "years",
    "edition_growth", "historical_editions", "edition_bookings",
    "all_edition_growth", "my_permissions", "activity", "by_invoice",
    "logs", "events_stats",
})

# Actions that need can_create
_CREATE_ACTIONS = frozenset({
    "create", "bulk_import", "submit_mr", "run_backfill",
})

# Actions that need can_update
_UPDATE_ACTIONS = frozenset({
    "update", "partial_update", "update_attendance",
    "submit_dmd", "return_to_mr", "move_member", "bulk_move",
    "assign_lead", "toggle_status", "reset_password", "move_team",
    "assign_events", "add_event", "remove_event", "archive",
    "sync_roles",
})

# Actions that need can_delete
_DELETE_ACTIONS = frozenset({
    "destroy", "bulk_delete", "clear_all",
})


def crm_permission(module: str):
    """Return a DRF permission class for the given CRM module."""

    class _CRMPermission(BasePermission):
        crm_module = module

        def has_permission(self, request, view):
            if not request.user or not request.user.is_authenticated:
                return False

            # HP username bypasses all permission checks
            if request.user.username == "HP":
                return True

            # User must have a custom role assigned
            custom_role = getattr(request.user, "custom_role", None)
            if custom_role is None:
                return False

            # Admin override — is_all_access grants everything
            if custom_role.is_all_access:
                return True

            # Fetch the module permission row
            try:
                perm = custom_role.permissions.get(module=self.crm_module)
            except Exception:
                return False

            # View is a prerequisite for all other permissions
            if not perm.can_view:
                return False

            action = getattr(view, "action", None)

            if action in _VIEW_ACTIONS:
                return True
            if action in _CREATE_ACTIONS:
                return perm.can_create
            if action in _UPDATE_ACTIONS:
                return perm.can_update
            if action in _DELETE_ACTIONS:
                return perm.can_delete

            # Map by HTTP method for unknown / custom actions
            method = request.method.upper()
            if method == "GET":
                return True
            if method == "POST":
                return perm.can_create
            if method in ("PUT", "PATCH"):
                return perm.can_update
            if method == "DELETE":
                return perm.can_delete

            return True

    _CRMPermission.__name__ = f"CRMPermission_{module}"
    return _CRMPermission
