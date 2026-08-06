"""
accounts/ordering.py
─────────────────────
Stable ordering for paginated list endpoints.

THE BUG THIS FIXES
Every list endpoint sorts by a non-unique column — Bookings by
`-_sort_request_date` (invoice__request_date, heavily tied), Ticket Central by
`-created_at`, Events by `-event_date`. SQL guarantees no particular order
among rows that tie, and Postgres is free to return them differently for each
query. With LIMIT/OFFSET pagination that means consecutive pages can overlap
and, worse, SKIP rows entirely.

Measured on Bookings before this change: page 1 and page 2 shared 10 rows
unfiltered and 2 filtered. Ten shared rows means ten other rows were never
returned at all — a rep scrolling through work would never see them and would
have no way to tell.

THE FIX
Append the primary key as a final tiebreaker to whatever ordering is in effect,
default or user-selected. The visible sort is unchanged; ties simply resolve
deterministically instead of arbitrarily.

Applied by swapping this in for rest_framework.filters.OrderingFilter, so it
covers every list endpoint rather than only the three that prompted it.
"""
from rest_framework.filters import OrderingFilter

_PK_ALIASES = {"pk", "id"}


class StableOrderingFilter(OrderingFilter):
    """OrderingFilter that always ends with a unique tiebreaker."""

    def get_ordering(self, request, queryset, view):
        ordering = list(super().get_ordering(request, queryset, view) or [])

        # Already deterministic if the caller (or the default) sorts by the pk.
        if any(term.lstrip("-") in _PK_ALIASES for term in ordering):
            return ordering

        ordering.append("pk")
        return ordering
