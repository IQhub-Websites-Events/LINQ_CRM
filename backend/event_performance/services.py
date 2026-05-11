"""
Event Performance metrics engine.
All metrics are computed live from BookEvent / BookDelegate / Event data.
No denormalization — every number derives from the source of truth.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, Sum, Q, F, DecimalField, IntegerField, Value
from django.db.models.functions import Coalesce

from book_event.models import BookEvent
from book_delegate.models import BookDelegate

PAID_STATUSES    = ["Paid"]
PENDING_STATUSES = ["Pending"]
FREE_STATUSES    = ["Free"]
CANCELLED_STATUSES = ["Cancelled", "Refunded"]

def _date_range(days_back: int) -> tuple[date, date]:
    today = date.today()
    return today - timedelta(days=days_back), today


def bulk_event_metrics(event_codes: list[str]) -> dict:
    """
    Returns a dict keyed by event_code with all computed metrics.
    Uses 2 annotated queries (bookings + delegates) — no N+1.
    """
    today     = date.today()
    yesterday = today - timedelta(days=1)
    d7_start  = today - timedelta(days=7)
    d14_start = today - timedelta(days=14)
    d21_start = today - timedelta(days=21)

    # ── Booking-level metrics ─────────────────────────────────────────────────
    booking_qs = (
        BookEvent.objects
        .filter(event_code__in=event_codes)
        .values("event_code")
        .annotate(
            total_bookings   = Count("id"),
            paid_count       = Count("id", filter=Q(payment_status__in=PAID_STATUSES)),
            pending_count    = Count("id", filter=Q(payment_status__in=PENDING_STATUSES)),
            free_count       = Count("id", filter=Q(payment_status__in=FREE_STATUSES)),
            cancelled_count  = Count("id", filter=Q(payment_status__in=CANCELLED_STATUSES)),

            # Revenue
            total_revenue    = Coalesce(
                Sum("total_amount", filter=Q(payment_status__in=PAID_STATUSES)),
                Value(Decimal("0")), output_field=DecimalField()
            ),
            pending_value    = Coalesce(
                Sum("total_amount", filter=Q(payment_status__in=PENDING_STATUSES)),
                Value(Decimal("0")), output_field=DecimalField()
            ),

            # Payment timeline — paid counts
            today_paid       = Count("id", filter=Q(payment_status__in=PAID_STATUSES, payment_date=today)),
            yesterday_paid   = Count("id", filter=Q(payment_status__in=PAID_STATUSES, payment_date=yesterday)),
            d7_paid          = Count("id", filter=Q(payment_status__in=PAID_STATUSES, payment_date__gte=d7_start,  payment_date__lte=today)),
            d14_paid         = Count("id", filter=Q(payment_status__in=PAID_STATUSES, payment_date__gte=d14_start, payment_date__lte=today)),
            d21_paid         = Count("id", filter=Q(payment_status__in=PAID_STATUSES, payment_date__gte=d21_start, payment_date__lte=today)),

            # Payment timeline — revenue
            today_revenue    = Coalesce(Sum("total_amount", filter=Q(payment_status__in=PAID_STATUSES, payment_date=today)),     Value(Decimal("0")), output_field=DecimalField()),
            yesterday_revenue= Coalesce(Sum("total_amount", filter=Q(payment_status__in=PAID_STATUSES, payment_date=yesterday)), Value(Decimal("0")), output_field=DecimalField()),
            d7_revenue       = Coalesce(Sum("total_amount", filter=Q(payment_status__in=PAID_STATUSES, payment_date__gte=d7_start,  payment_date__lte=today)), Value(Decimal("0")), output_field=DecimalField()),
            d14_revenue      = Coalesce(Sum("total_amount", filter=Q(payment_status__in=PAID_STATUSES, payment_date__gte=d14_start, payment_date__lte=today)), Value(Decimal("0")), output_field=DecimalField()),
            d21_revenue      = Coalesce(Sum("total_amount", filter=Q(payment_status__in=PAID_STATUSES, payment_date__gte=d21_start, payment_date__lte=today)), Value(Decimal("0")), output_field=DecimalField()),

            # Delegate counts
            total_delegates  = Coalesce(Sum("delegate_count"), Value(0), output_field=IntegerField()),
        )
    )

    # ── Delegate-level metrics (attendance) ───────────────────────────────────
    delegate_qs = (
        BookDelegate.objects
        .filter(event_code__in=event_codes)
        .values("event_code")
        .annotate(
            confirmed_delegates = Count("id", filter=Q(attendance="Confirmed")),
            noshow_delegates    = Count("id", filter=Q(attendance="No-show")),
            total_delegate_rows = Count("id"),
        )
    )

    # ── Index results ─────────────────────────────────────────────────────────
    booking_map  = {r["event_code"]: r for r in booking_qs}
    delegate_map = {r["event_code"]: r for r in delegate_qs}

    result = {}
    for ec in event_codes:
        b = booking_map.get(ec, {})
        d = delegate_map.get(ec, {})

        paid_count = b.get("paid_count", 0) or 0
        result[ec] = {
            "total_bookings":    b.get("total_bookings",   0) or 0,
            "paid_count":        paid_count,
            "pending_count":     b.get("pending_count",    0) or 0,
            "free_count":        b.get("free_count",       0) or 0,
            "cancelled_count":   b.get("cancelled_count",  0) or 0,
            "total_revenue":     float(b.get("total_revenue",  0) or 0),
            "pending_value":     float(b.get("pending_value",  0) or 0),
            "today_paid":        b.get("today_paid",       0) or 0,
            "yesterday_paid":    b.get("yesterday_paid",   0) or 0,
            "d7_paid":           b.get("d7_paid",          0) or 0,
            "d14_paid":          b.get("d14_paid",         0) or 0,
            "d21_paid":          b.get("d21_paid",         0) or 0,
            "today_revenue":     float(b.get("today_revenue",     0) or 0),
            "yesterday_revenue": float(b.get("yesterday_revenue", 0) or 0),
            "d7_revenue":        float(b.get("d7_revenue",        0) or 0),
            "d14_revenue":       float(b.get("d14_revenue",       0) or 0),
            "d21_revenue":       float(b.get("d21_revenue",       0) or 0),
            "total_delegates":   b.get("total_delegates",  0) or 0,
            "confirmed_delegates": d.get("confirmed_delegates", 0) or 0,
            "noshow_delegates":    d.get("noshow_delegates",    0) or 0,
        }
    return result


def compute_health(paid_count: int, capacity: int) -> dict:
    """
    Returns benchmark %, priority score, and health colour.
    benchmark = paid_count / capacity * 100
    """
    if not capacity:
        return {"benchmark": 0.0, "health": "unknown", "color": "grey"}

    benchmark = round((paid_count / capacity) * 100, 1)

    if benchmark >= 75:
        health, color = "healthy",  "green"
    elif benchmark >= 50:
        health, color = "on_track", "blue"
    elif benchmark >= 25:
        health, color = "warning",  "amber"
    else:
        health, color = "critical", "red"

    return {"benchmark": benchmark, "health": health, "color": color}


def reps_performance(event_codes: list[str]) -> list[dict]:
    """
    Per-rep breakdown: paid bookings + revenue + pending for a set of events.
    """
    qs = (
        BookEvent.objects
        .filter(event_code__in=event_codes)
        .values(
            rep_id        = F("sales_executive__id"),
            rep_first     = F("sales_executive__first_name"),
            rep_last      = F("sales_executive__last_name"),
            rep_username  = F("sales_executive__username"),
        )
        .annotate(
            paid_bookings    = Count("id", filter=Q(payment_status__in=PAID_STATUSES)),
            pending_bookings = Count("id", filter=Q(payment_status__in=PENDING_STATUSES)),
            total_revenue    = Coalesce(Sum("total_amount", filter=Q(payment_status__in=PAID_STATUSES)),    Value(Decimal("0")), output_field=DecimalField()),
            pending_value    = Coalesce(Sum("total_amount", filter=Q(payment_status__in=PENDING_STATUSES)), Value(Decimal("0")), output_field=DecimalField()),
        )
        .order_by("-paid_bookings")
    )
    rows = []
    for r in qs:
        first = r["rep_first"] or ""
        last  = r["rep_last"]  or ""
        full  = (first + " " + last).strip() or r["rep_username"] or "Unassigned"
        rows.append({
            "rep_id":           r["rep_id"],
            "rep_name":         full,
            "paid_bookings":    r["paid_bookings"],
            "pending_bookings": r["pending_bookings"],
            "total_revenue":    float(r["total_revenue"] or 0),
            "pending_value":    float(r["pending_value"]  or 0),
        })
    return rows
