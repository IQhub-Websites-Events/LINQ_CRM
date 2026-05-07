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


class RBACMixin:
    """
    Mixin for ViewSets.
    Adds rbac_filter() and rbac_filter_invoice() helpers that
    transparently scope querysets based on user role.
    """
    permission_classes = [IsSalesOrAdmin]

    def rbac_filter(self, qs, event_code_field="event_code"):
        user = self.request.user
        if user.is_admin:
            return qs

        # 1. If the model has a sales_executive field, filter by it directly.
        # This is the most accurate way to bifurcate data.
        if hasattr(qs.model, "sales_executive"):
            return qs.filter(sales_executive=user)

        # 2. Fallback: Filter by event_code if assigned.
        codes = user.assigned_event_codes() or []
        if not codes:
            return qs.none()

        from django.db.models import Q
        query = Q()
        for code in codes:
            query |= Q(**{f"{event_code_field}__icontains": code})
        
        return qs.filter(query)

    def rbac_filter_invoice(self, qs):
        return self.rbac_filter(qs, event_code_field="event_code")
