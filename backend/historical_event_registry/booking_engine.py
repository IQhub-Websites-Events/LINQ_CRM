"""
historical_event_registry/booking_engine.py

EditionWindowCalculator   — builds edition windows from multi-source dates
BookingEditionMapper      — assigns bookings to editions via invoice_date
EventEditionBookingEngine — orchestrates per-edition metrics + booking lists
EditionBookingValidator   — validates windows, detects orphaned bookings
"""
import logging
import re
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from django.db.models import DecimalField, Max, Sum
from django.db.models.functions import Coalesce, ExtractYear

from .utils import normalize_event_code, booking_code_regex

logger = logging.getLogger(__name__)

PAID_STATUSES      = frozenset({"Paid", "Paid (Transferred)", "Credit Transferred", "Free"})
CANCELLED_STATUSES = frozenset({"Cancelled", "Refunded"})
_ZERO    = Decimal("0.00")
_DEC_FLD = DecimalField(max_digits=14, decimal_places=2)

_MONTH_MAP = {
    "January": 1, "February": 2, "March": 3, "April": 4,
    "May": 5, "June": 6, "July": 7, "August": 8,
    "September": 9, "October": 10, "November": 11, "December": 12,
}


def _last_day_of_month(year: int, month: int) -> date:
    if month == 12:
        return date(year, 12, 31)
    return date(year, month + 1, 1) - timedelta(days=1)


# ─────────────────────────────────────────────────────────────────────────────
# Edition Window Calculator
# ─────────────────────────────────────────────────────────────────────────────

class EditionWindowCalculator:
    """
    Builds chronological edition windows using multi-source date data.

    Source priority per year (higher wins):
      1. Event.event_date  — most authoritative (current/upcoming edition)
      2. BookEvent max(event_date) per year
      3. HistoricalEventReference event_year + event_month → last day of month

    Window rule:
      Edition N owns bookings whose invoice_date is in (prev_end + 1d, edition_N_date].
      The first edition has no lower bound (owns all earlier bookings).
    """

    def __init__(self, event_code: str, current_event_date: Optional[date] = None):
        self.event_code         = normalize_event_code(event_code)
        self.current_event_date = current_event_date

    def get_windows(self) -> List[Dict[str, Any]]:
        from book_event.models import BookEvent
        from historical_event_registry.models import HistoricalEventReference

        year_dates: Dict[int, Tuple[date, str]] = {}   # year → (date, source_label)
        year_locations: Dict[int, str] = {}

        # Source 3 (lowest priority): HistoricalEventReference month → last day of month
        for ref in (
            HistoricalEventReference.objects
            .filter(normalized_event_code=self.event_code)
            .values("event_year", "event_month", "event_location")
            .order_by("event_year")
        ):
            yr = ref["event_year"]
            m  = _MONTH_MAP.get((ref["event_month"] or "").strip().capitalize())
            if yr not in year_dates and m:
                year_dates[yr] = (_last_day_of_month(yr, m), "historical_reference")
            if ref["event_location"] and yr not in year_locations:
                year_locations[yr] = ref["event_location"]

        # Source 2: BookEvent max(event_date) per year
        for row in (
            BookEvent.objects
            .filter(event_code__iregex=booking_code_regex(self.event_code))
            .exclude(event_date__isnull=True)
            .annotate(yr=ExtractYear("event_date"))
            .values("yr")
            .annotate(ed=Max("event_date"))
            .order_by("yr")
        ):
            yr, ed = row["yr"], row["ed"]
            if yr not in year_dates or ed > year_dates[yr][0]:
                year_dates[yr] = (ed, "booking_event_date")

        # Source 1 (highest priority): current Event.event_date
        if self.current_event_date:
            yr = self.current_event_date.year
            year_dates[yr] = (self.current_event_date, "event_record")

        if not year_dates:
            return []

        sorted_years = sorted(year_dates.keys())
        windows: List[Dict[str, Any]] = []
        prev_end: Optional[date] = None

        for yr in sorted_years:
            ed_date, source = year_dates[yr]
            window_start = (prev_end + timedelta(days=1)) if prev_end else None
            windows.append({
                "year":         yr,
                "edition_date": ed_date.isoformat(),
                "window_start": window_start.isoformat() if window_start else None,
                "window_end":   ed_date.isoformat(),
                "location":     year_locations.get(yr, ""),
                "source":       source,
            })
            prev_end = ed_date

        return windows


# ─────────────────────────────────────────────────────────────────────────────
# Booking Edition Mapper
# ─────────────────────────────────────────────────────────────────────────────

class BookingEditionMapper:
    """
    Maps a booking date to the correct edition year using window ranges.

    Walks windows newest-to-oldest: booking belongs to edition N when
    window_start <= booking_date <= window_end.
    First edition has no window_start — captures all earlier bookings.
    Bookings after the last window_end are assigned to the latest edition.
    """

    def __init__(self, windows: List[Dict[str, Any]]):
        self.windows = windows  # sorted ascending by year

    def year_for(
        self, invoice_date: Optional[date], created_at_date: Optional[date]
    ) -> Optional[int]:
        booking_date = invoice_date or created_at_date
        if not booking_date or not self.windows:
            return None

        for w in reversed(self.windows):
            end   = date.fromisoformat(w["window_end"])   if w["window_end"]   else None
            start = date.fromisoformat(w["window_start"]) if w["window_start"] else None
            if end is None:
                continue
            if booking_date <= end:
                if start is None or booking_date >= start:
                    return w["year"]

        # Booking date is before the earliest window — assign to earliest edition
        return self.windows[0]["year"]


# ─────────────────────────────────────────────────────────────────────────────
# Event Edition Booking Engine
# ─────────────────────────────────────────────────────────────────────────────

class EventEditionBookingEngine:
    """
    Assigns all bookings for an event_code to yearly editions via invoice_date windows.
    Returns per-edition metrics (get_summary) or a full booking list (get_edition_bookings).
    """

    def __init__(self, event_code: str, event=None):
        self.event_code    = normalize_event_code(event_code)
        self.event         = event
        self._current_date = event.event_date if event else None

    # ── Public API ────────────────────────────────────────────────────────────

    def get_summary(self) -> Dict[str, Any]:
        """All editions with aggregate metrics, newest first."""
        windows = EditionWindowCalculator(self.event_code, self._current_date).get_windows()
        if not windows:
            return self._empty()

        assignments = self._assign(windows)

        editions = []
        for w in reversed(windows):
            ids = assignments.get(w["year"], [])
            editions.append({**w, **self._aggregate(ids)})

        orphaned = assignments.get(None, [])

        return {
            "event_id":       self.event.id   if self.event else None,
            "event_code":     self.event_code,
            "event_name":     self.event.name  if self.event else self.event_code,
            "total_editions": len(windows),
            "total_bookings": sum(e["total_bookings"] for e in editions),
            "orphaned_count": len(orphaned),
            "editions":       editions,
        }

    def get_edition_bookings(self, year: int) -> Dict[str, Any]:
        """Full booking list for one edition year."""
        from book_event.models import BookEvent
        from book_delegate.models import BookDelegate

        windows     = EditionWindowCalculator(self.event_code, self._current_date).get_windows()
        assignments = self._assign(windows) if windows else {}
        booking_ids = assignments.get(year, [])
        w           = next((x for x in windows if x["year"] == year), None)

        base = {
            "year":         year,
            "edition_date": w["edition_date"] if w else None,
            "window_start": w["window_start"] if w else None,
            "window_end":   w["window_end"]   if w else None,
            "location":     w["location"]     if w else "",
            "source":       w["source"]       if w else "",
        }

        if not booking_ids:
            return {**base, **self._aggregate([]), "bookings": [], "total": 0}

        rows = []
        for b in (
            BookEvent.objects
            .filter(id__in=booking_ids)
            .order_by("-invoice_date", "-created_at")
            .values(
                "id", "invoice_number", "company_name", "contact_name",
                "contact_email", "event_code", "event_date", "invoice_date",
                "payment_status", "total_amount", "currency", "delegate_count",
                "created_at", "payment_date",
            )
        ):
            dl = BookDelegate.objects.filter(invoice_id=b["id"]).count()
            rows.append({
                "id":               b["id"],
                "invoice_number":   b["invoice_number"],
                "company_name":     b["company_name"],
                "contact_name":     b["contact_name"],
                "contact_email":    b["contact_email"],
                "event_code":       b["event_code"],
                "event_date":       b["event_date"].isoformat()   if b["event_date"]   else None,
                "invoice_date":     b["invoice_date"].isoformat() if b["invoice_date"] else None,
                "payment_status":   b["payment_status"],
                "total_amount":     float(b["total_amount"])      if b["total_amount"] is not None else None,
                "currency":         b["currency"],
                "delegate_count":   b["delegate_count"],
                "actual_delegates": dl,
                "created_at":       b["created_at"].isoformat()   if b["created_at"]   else None,
                "payment_date":     b["payment_date"].isoformat() if b["payment_date"] else None,
            })

        return {**base, **self._aggregate(booking_ids), "bookings": rows, "total": len(rows)}

    # ── Internals ─────────────────────────────────────────────────────────────

    def _assign(self, windows: List[Dict]) -> Dict[Optional[int], List[int]]:
        from book_event.models import BookEvent

        mapper: BookingEditionMapper = BookingEditionMapper(windows)
        window_years = {w["year"] for w in windows}
        result: Dict[Optional[int], List[int]] = {}

        for row in (
            BookEvent.objects
            .filter(event_code__iregex=booking_code_regex(self.event_code))
            .values("id", "invoice_date", "created_at", "event_date", "event_code")
        ):
            # Priority 1: year encoded in the booking's event_code (e.g. "DDU26" → 2026).
            # This is the most direct signal — the code itself names the edition.
            code_yr = self._year_from_booking_code(row.get("event_code") or "")
            if code_yr and code_yr in window_years:
                yr = code_yr
            else:
                # Priority 2: booking's own event_date year
                event_yr = row["event_date"].year if row["event_date"] else None
                if event_yr and event_yr in window_years:
                    yr = event_yr
                else:
                    # Priority 3: invoice_date / created_at window matching
                    inv = row["invoice_date"]
                    cr  = row["created_at"].date() if row["created_at"] else None
                    yr  = mapper.year_for(inv, cr)

            result.setdefault(yr, []).append(row["id"])

        return result

    @staticmethod
    def _year_from_booking_code(code: str) -> Optional[int]:
        """Extract 2- or 4-digit year suffix from event_code (e.g. 'DDU26' → 2026, 'DDU - RS26' → 2026)."""
        if not code:
            return None
        m = re.search(r"(\d{2,4})$", code.strip())
        if m:
            raw = m.group(1)
            if len(raw) == 2:
                return 2000 + int(raw)
            if len(raw) == 4:
                return int(raw)
        return None

    def _aggregate(self, ids: List[int]) -> Dict[str, Any]:
        from book_event.models import BookEvent
        from book_delegate.models import BookDelegate

        if not ids:
            return {
                "total_bookings":  0,
                "total_paid":      0,
                "total_pending":   0,
                "total_cancelled": 0,
                "total_unpaid":    0,
                "total_sales":     0.0,
                "total_delegates": 0,
            }

        qs    = BookEvent.objects.filter(id__in=ids)
        total = qs.count()
        paid  = qs.filter(payment_status__in=PAID_STATUSES).count()
        canc  = qs.filter(payment_status__in=CANCELLED_STATUSES).count()
        pend  = qs.filter(payment_status="Pending").count()
        sales = qs.aggregate(
            s=Coalesce(Sum("total_amount", output_field=_DEC_FLD), _ZERO)
        )["s"] or _ZERO
        dels  = BookDelegate.objects.filter(invoice_id__in=ids).count()

        return {
            "total_bookings":  total,
            "total_paid":      paid,
            "total_pending":   pend,
            "total_cancelled": canc,
            "total_unpaid":    total - paid - canc,
            "total_sales":     float(sales),
            "total_delegates": dels,
        }

    def _empty(self) -> Dict[str, Any]:
        return {
            "event_id":       self.event.id   if self.event else None,
            "event_code":     self.event_code,
            "event_name":     self.event.name  if self.event else self.event_code,
            "total_editions": 0,
            "total_bookings": 0,
            "orphaned_count": 0,
            "editions":       [],
        }


# ─────────────────────────────────────────────────────────────────────────────
# Edition Booking Validator
# ─────────────────────────────────────────────────────────────────────────────

class EditionBookingValidator:
    """
    Validates edition windows (non-overlapping) and booking assignment completeness.
    Runs up to MAX_ITERATIONS retry loops.
    """

    MAX_ITERATIONS = 3

    def __init__(self, event_code: str, event=None):
        self.event_code = normalize_event_code(event_code)
        self.event      = event

    def validate(self) -> Dict[str, Any]:
        engine     = EventEditionBookingEngine(self.event_code, self.event)
        result     = engine.get_summary()
        all_issues: List[Dict] = []
        iteration  = 0

        while iteration < self.MAX_ITERATIONS:
            iteration += 1
            found = self._check(result)
            if not found:
                break
            all_issues.extend(found)
            result = engine.get_summary()

        result["validation_issues"]     = all_issues
        result["validation_passed"]     = len(all_issues) == 0
        result["validation_iterations"] = iteration
        return result

    def _check(self, result: Dict) -> List[Dict]:
        issues: List[Dict] = []
        editions_asc = list(reversed(result.get("editions", [])))

        for i in range(1, len(editions_asc)):
            prev, curr = editions_asc[i - 1], editions_asc[i]
            if prev["window_end"] and curr["window_start"]:
                pe = date.fromisoformat(prev["window_end"])
                cs = date.fromisoformat(curr["window_start"])
                if cs <= pe:
                    issues.append({
                        "type":   "overlapping_windows",
                        "years":  f"{prev['year']}–{curr['year']}",
                        "detail": f"Window {curr['year']} starts {cs} ≤ {prev['year']} ends {pe}.",
                    })

        if result.get("orphaned_count", 0) > 0:
            issues.append({
                "type":   "orphaned_bookings",
                "detail": f"{result['orphaned_count']} booking(s) could not be mapped to any edition.",
            })

        return issues
