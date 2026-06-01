"""
accounts/permissions.py
────────────────────────
DRF permission classes and RBAC queryset mixin.
"""
from rest_framework.permissions import BasePermission


class IsAdminRole(BasePermission):
    message = "Admin role required."

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.is_admin
        )
    

class IsSalesOrAdmin(BasePermission):
    message = "Authentication required."

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated


class IsSalesOrAdminOrReadOnly(BasePermission):
    message = "Only sales teams and admins are allowed to edit bookings."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        from rest_framework.permissions import SAFE_METHODS
        if request.method in SAFE_METHODS:
            return True
        return request.user.role in ("admin", "sales")


class RBACMixin:
    """
    Mixin for ViewSets.
    Adds rbac_filter() and rbac_filter_invoice() helpers that
    transparently scope querysets based on user role.
    """
    permission_classes = [IsSalesOrAdminOrReadOnly]

    def rbac_filter(self, qs, event_code_field="event_code"):
        user = self.request.user
        if user.is_admin:
            return qs

        from django.db.models import Q

        codes = user.assigned_event_codes() or []

        # Build event_code OR clause (used as either primary or secondary filter).
        ec_query = Q()
        for code in codes:
            ec_query |= Q(**{f"{event_code_field}__icontains": code})

        # For models with a sales_executive FK, allow access if the user is the
        # assigned executive OR the event is in their assigned events.
        # This keeps the invoice retrieve consistent with the delegate list view,
        # which is filtered by event_code only (BookDelegate has no sales_executive).
        if hasattr(qs.model, "sales_executive"):
            combined = Q(sales_executive=user)
            if ec_query:
                combined |= ec_query
            return qs.filter(combined)

        # For models without sales_executive, use event_code only.
        if not ec_query:
            return qs.none()
        return qs.filter(ec_query)

    def rbac_filter_invoice(self, qs):
        return self.rbac_filter(qs, event_code_field="event_code")
