"""
ticket_central/permissions.py
──────────────────────────────
Role-based access for ticket operations.
"""
from rest_framework.permissions import BasePermission


class IsMarketResearchOrAdmin(BasePermission):
    message = "Market Research or Admin role required."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return request.user.role in ("market_research", "admin")


class IsDataMiningOrAdmin(BasePermission):
    message = "Data Mining or Admin role required."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return request.user.role in ("data_mining", "admin")


class IsTicketTeamOrAdmin(BasePermission):
    """Either MR or DMD can view tickets; admin sees all."""
    message = "You do not have access to Ticket Central."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        return request.user.role in ("market_research", "data_mining", "admin")
