"""
Event Performance metrics engine.
All metrics are computed live from BookEvent / BookDelegate / Event data.
No denormalization — every number derives from the source of truth.
"""
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, Sum, Q, F, DecimalField, Value
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


def _build_code_cross_ref(event_codes: list[str]) -> tuple[dict, dict, list]:
    """
    Builds a mapping between canonical Event event_codes and all BookEvent
    event_codes that refer to the same edition by (master_code, year) pair.

    Returns:
        canonical_to_booking  — {event_code: [booking_code, ...]}
        reverse_map           — {booking_code: canonical_event_code}
        all_booking_codes     — flat de-duped list for DB queries
    """
    from event_performance.active_edition_service import normalize_master_code, extract_year_from_code

    # Index every distinct BookEvent code by (master, year)
    bk_by_key: dict = {}
    for bc in BookEvent.objects.values_list("event_code", flat=True).distinct():
        mc = normalize_master_code(bc)
        yr = extract_year_from_code(bc)
        if mc:
            bk_by_key.setdefault((mc, yr), []).append(bc)

    canonical_to_booking: dict[str, list[str]] = {}
    reverse_map: dict[str, str] = {}

    for ec in event_codes:
        mc = normalize_master_code(ec)
        yr = extract_year_from_code(ec)
        # Collect all booking codes for this (master, year) pair + the canonical code itself
        matches = list(set(bk_by_key.get((mc, yr), []) + [ec]))
        canonical_to_booking[ec] = matches
        for bc in matches:
            if bc not in reverse_map:           # first canonical wins if ambiguous
                reverse_map[bc] = ec

    all_booking_codes = list(reverse_map.keys())
    return canonical_to_booking, reverse_map, all_booking_codes


def _merge_rows(rows, code_field: str, reverse_map: dict) -> dict:
    """
    Collapses annotated queryset rows (keyed by booking code) into
    canonical-code buckets by summing all numeric/Decimal fields.
    """
    merged: dict[str, dict] = {}
    for row in rows:
        bc = row[code_field]
        cc = reverse_map.get(bc, bc)
        if cc not in merged:
            merged[cc] = {k: v for k, v in row.items() if k != code_field}
        else:
            for k, v in row.items():
                if k == code_field:
                    continue
                existing = merged[cc].get(k, 0) or 0
                merged[cc][k] = existing + (v or 0)
    return merged


def bulk_event_metrics(event_codes: list[str]) -> dict:
    """
    Returns a dict keyed by event_code.

    BookEvent records whose event_code variant normalises to the same
    (master_code, year) as a canonical Event event_code are automatically
    included — handles formats like 'ACU - RS26', 'ACU25', 'MMU/GS - JS26'.

    Headcount metrics are delegate-based; revenue metrics are invoice-based.
    """
    if not event_codes:
        return {}

    _, reverse_map, all_booking_codes = _build_code_cross_ref(event_codes)

    today     = date.today()
    yesterday = today - timedelta(days=1)
    d7_start  = today - timedelta(days=7)
    d14_start = today - timedelta(days=14)
    d21_start = today - timedelta(days=21)

    # ── Query 1: Revenue from invoices ────────────────────────────────────────
    revenue_qs = (
        BookEvent.objects
        .filter(event_code__in=all_booking_codes)
        .values("event_code")
        .annotate(
            total_invoices   = Count("id"),
            total_revenue    = Coalesce(Sum("total_amount", filter=Q(payment_status__in=PAID_STATUSES)),    Value(Decimal("0")), output_field=DecimalField()),
            pending_value    = Coalesce(Sum("total_amount", filter=Q(payment_status__in=PENDING_STATUSES)), Value(Decimal("0")), output_field=DecimalField()),
            today_revenue    = Coalesce(Sum("total_amount", filter=Q(payment_status__in=PAID_STATUSES, payment_date=today)),                                   Value(Decimal("0")), output_field=DecimalField()),
            yesterday_revenue= Coalesce(Sum("total_amount", filter=Q(payment_status__in=PAID_STATUSES, payment_date=yesterday)),                               Value(Decimal("0")), output_field=DecimalField()),
            d7_revenue       = Coalesce(Sum("total_amount", filter=Q(payment_status__in=PAID_STATUSES, payment_date__gte=d7_start,  payment_date__lte=today)), Value(Decimal("0")), output_field=DecimalField()),
            d14_revenue      = Coalesce(Sum("total_amount", filter=Q(payment_status__in=PAID_STATUSES, payment_date__gte=d14_start, payment_date__lte=today)), Value(Decimal("0")), output_field=DecimalField()),
            d21_revenue      = Coalesce(Sum("total_amount", filter=Q(payment_status__in=PAID_STATUSES, payment_date__gte=d21_start, payment_date__lte=today)), Value(Decimal("0")), output_field=DecimalField()),
        )
    )

    # ── Query 2: All headcounts from delegates ────────────────────────────────
    delegate_qs = (
        BookDelegate.objects
        .filter(invoice__event_code__in=all_booking_codes)
        .values(base_code=F("invoice__event_code"))
        .annotate(
            total_delegates     = Count("id"),
            paid_count          = Count("id", filter=Q(invoice__payment_status__in=PAID_STATUSES)),
            pending_count       = Count("id", filter=Q(invoice__payment_status__in=PENDING_STATUSES)),
            free_count          = Count("id", filter=Q(invoice__payment_status__in=FREE_STATUSES)),
            cancelled_count     = Count("id", filter=Q(invoice__payment_status__in=CANCELLED_STATUSES)),
            confirmed_delegates = Count("id", filter=Q(attendance="Confirmed")),
            noshow_delegates    = Count("id", filter=Q(attendance="No-show")),
            vip_count           = Count("id", filter=Q(invoice__ticket_tier="VIP")),
            speaker_count       = Count("id", filter=Q(invoice__ticket_tier="Speaker")),
            sponsor_count       = Count("id", filter=Q(invoice__ticket_tier="Sponsor")),
            complimentary_count = Count("id", filter=Q(invoice__ticket_tier="Complimentary")),
            paid_pof_count      = Count("id", filter=Q(invoice__paid_or_free="Paid")),
            free_pof_count      = Count("id", filter=Q(invoice__paid_or_free="Free")),
            today_paid     = Count("id", filter=Q(invoice__payment_status__in=PAID_STATUSES, invoice__payment_date=today)),
            yesterday_paid = Count("id", filter=Q(invoice__payment_status__in=PAID_STATUSES, invoice__payment_date=yesterday)),
            d7_paid        = Count("id", filter=Q(invoice__payment_status__in=PAID_STATUSES, invoice__payment_date__gte=d7_start,  invoice__payment_date__lte=today)),
            d14_paid       = Count("id", filter=Q(invoice__payment_status__in=PAID_STATUSES, invoice__payment_date__gte=d14_start, invoice__payment_date__lte=today)),
            d21_paid       = Count("id", filter=Q(invoice__payment_status__in=PAID_STATUSES, invoice__payment_date__gte=d21_start, invoice__payment_date__lte=today)),
        )
    )

    # ── Merge results back to canonical codes ─────────────────────────────────
    revenue_map  = _merge_rows(revenue_qs,  "event_code", reverse_map)
    delegate_map = _merge_rows(delegate_qs, "base_code",  reverse_map)

    result = {}
    for ec in event_codes:
        r = revenue_map.get(ec, {})
        d = delegate_map.get(ec, {})

        result[ec] = {
            "total_delegates":     d.get("total_delegates",     0) or 0,
            "paid_count":          d.get("paid_count",          0) or 0,
            "pending_count":       d.get("pending_count",       0) or 0,
            "free_count":          d.get("free_count",          0) or 0,
            "cancelled_count":     d.get("cancelled_count",     0) or 0,
            "confirmed_delegates": d.get("confirmed_delegates", 0) or 0,
            "noshow_delegates":    d.get("noshow_delegates",    0) or 0,
            "vip_count":           d.get("vip_count",           0) or 0,
            "speaker_count":       d.get("speaker_count",       0) or 0,
            "sponsor_count":       d.get("sponsor_count",       0) or 0,
            "complimentary_count": d.get("complimentary_count", 0) or 0,
            "paid_pof_count":      d.get("paid_pof_count",      0) or 0,
            "free_pof_count":      d.get("free_pof_count",      0) or 0,
            "today_paid":          d.get("today_paid",    0) or 0,
            "yesterday_paid":      d.get("yesterday_paid",0) or 0,
            "d7_paid":             d.get("d7_paid",       0) or 0,
            "d14_paid":            d.get("d14_paid",      0) or 0,
            "d21_paid":            d.get("d21_paid",      0) or 0,
            "total_revenue":       float(r.get("total_revenue",    0) or 0),
            "pending_value":       float(r.get("pending_value",    0) or 0),
            "today_revenue":       float(r.get("today_revenue",    0) or 0),
            "yesterday_revenue":   float(r.get("yesterday_revenue",0) or 0),
            "d7_revenue":          float(r.get("d7_revenue",       0) or 0),
            "d14_revenue":         float(r.get("d14_revenue",      0) or 0),
            "d21_revenue":         float(r.get("d21_revenue",      0) or 0),
            "total_invoices":      r.get("total_invoices", 0) or 0,
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
