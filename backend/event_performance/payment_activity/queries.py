"""
Optimised DB queries for Event Payment Activity.
All headcount metrics use BookDelegate rows (one row = one person).
Invoice-level detail queries use BookEvent directly.
"""
from __future__ import annotations

from datetime import date, timedelta

from django.db.models import Count, Max, Q, F

from book_event.models import BookEvent
from book_delegate.models import BookDelegate

_PAID = ["Paid"]


def event_payment_metrics(event_codes: list[str]) -> dict:
    """
    Bulk-calculates per-event payment activity metrics.
    Returns a dict keyed by event_code.

    Counts are delegate-based (consistent with bulk_event_metrics in services.py).
    """
    if not event_codes:
        return {}

    today = date.today()
    d7    = today - timedelta(days=7)
    d14   = today - timedelta(days=14)   # start of previous 7-day window
    d15   = today - timedelta(days=15)
    d30   = today - timedelta(days=30)

    qs = (
        BookDelegate.objects
        .filter(
            invoice__event_code__in=event_codes,
            invoice__payment_status__in=_PAID,
        )
        .values(event_code=F("invoice__event_code"))
        .annotate(
            total_paid        = Count("id"),
            paid_7d           = Count("id", filter=Q(invoice__payment_date__gte=d7)),
            paid_15d          = Count("id", filter=Q(invoice__payment_date__gte=d15)),
            paid_30d          = Count("id", filter=Q(invoice__payment_date__gte=d30)),
            # Previous 7-day window for trend calculation
            prev_7d           = Count("id", filter=Q(
                invoice__payment_date__gte=d14,
                invoice__payment_date__lt=d7,
            )),
            last_payment_date = Max("invoice__payment_date"),
            last_booking_date = Max("invoice__created_at"),
        )
    )

    result: dict[str, dict] = {}
    for r in qs:
        ec = r["event_code"]
        raw_last_booking = r["last_booking_date"]
        result[ec] = {
            "total_paid":        r["total_paid"] or 0,
            "paid_7d":           r["paid_7d"] or 0,
            "paid_15d":          r["paid_15d"] or 0,
            "paid_30d":          r["paid_30d"] or 0,
            "prev_7d":           r["prev_7d"] or 0,
            "last_payment_date": r["last_payment_date"],
            # DateTimeField aggregate → convert to date
            "last_booking_date": raw_last_booking.date() if raw_last_booking else None,
        }
    return result


def event_paid_bookings(event_code: str, days: int | None = None):
    """
    Returns a queryset of paid BookEvent invoices for one event.
    Optionally filtered to the last `days` days by payment_date.
    Ordered newest-payment first.
    """
    qs = (
        BookEvent.objects
        .filter(event_code=event_code, payment_status__in=_PAID)
        .select_related("sales_executive")
        .order_by("-payment_date", "-created_at")
    )
    if days:
        cutoff = date.today() - timedelta(days=days)
        qs = qs.filter(payment_date__gte=cutoff)
    return qs
