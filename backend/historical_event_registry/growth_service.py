"""
historical_event_registry/growth_service.py

EventEditionWindowCalculator  — computes per-edition booking ownership windows
EventEditionBookingMapper      — maps bookings to their correct yearly edition
HistoricalBookingEditionAssigner — orchestrates assignment without touching DB rows
YearOnYearGrowthCalculator    — assembles full YoY growth data for an event
"""
import logging
from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional

from django.db.models import Count, Max, Sum
from django.db.models.functions import Coalesce, ExtractYear

from .utils import normalize_event_code, booking_code_regex

logger = logging.getLogger(__name__)

PAID_STATUSES = frozenset({"Paid", "Paid (Transferred)", "Credit Transferred", "Free"})
_ZERO = Decimal("0.00")


# ─────────────────────────────────────────────────────────────────────────────
# Edition Window Calculator
# ─────────────────────────────────────────────────────────────────────────────

class EventEditionWindowCalculator:
    """
    For a given event_code, determines the booking ownership window for each
    yearly edition.

    Business rule:
      - An edition "owns" bookings whose event_date belongs to that year.
      - The window spans from (previous edition event_date + 1 day) to
        (current edition event_date inclusive).
      - The first edition has no window_start (owns all older bookings).
    """

    def __init__(self, event_code: str, current_event_date: Optional[date] = None):
        self.event_code = normalize_event_code(event_code)
        self.current_event_date = current_event_date

    def get_edition_windows(self) -> List[Dict[str, Any]]:
        """
        Returns edition window dicts sorted ascending by year.
        Each dict: {year, edition_date, window_start, window_end, location}
        """
        from book_event.models import BookEvent
        from historical_event_registry.models import HistoricalEventReference

        # Aggregate the max event_date per year from actual booking records
        year_dates: Dict[int, date] = {}
        rows = (
            BookEvent.objects
            .filter(event_code__iregex=booking_code_regex(self.event_code))
            .exclude(event_date__isnull=True)
            .annotate(yr=ExtractYear("event_date"))
            .values("yr")
            .annotate(edition_date=Max("event_date"))
            .order_by("yr")
        )
        for row in rows:
            year_dates[row["yr"]] = row["edition_date"]

        # Include current Event.event_date for the active/upcoming edition
        if self.current_event_date:
            yr = self.current_event_date.year
            if yr not in year_dates or self.current_event_date > year_dates[yr]:
                year_dates[yr] = self.current_event_date

        # Collect best-known locations from historical references
        year_locations: Dict[int, str] = {}
        for ref in (
            HistoricalEventReference.objects
            .filter(normalized_event_code=self.event_code)
            .values("event_year", "event_location")
            .order_by("event_year")
        ):
            yr = ref["event_year"]
            if ref["event_location"] and yr not in year_locations:
                year_locations[yr] = ref["event_location"]

        # Build windows in ascending year order
        sorted_years = sorted(year_dates.keys())
        windows = []
        prev_end: Optional[date] = None

        for yr in sorted_years:
            ed_date = year_dates[yr]
            window_start = (prev_end + timedelta(days=1)) if prev_end else None
            windows.append({
                "year":         yr,
                "edition_date": ed_date.isoformat() if ed_date else None,
                "window_start": window_start.isoformat() if window_start else None,
                "window_end":   ed_date.isoformat() if ed_date else None,
                "location":     year_locations.get(yr, ""),
            })
            prev_end = ed_date

        return windows


# ─────────────────────────────────────────────────────────────────────────────
# Edition Booking Mapper
# ─────────────────────────────────────────────────────────────────────────────

class EventEditionBookingMapper:
    """
    Maps each booking for an event_code to the correct yearly edition using the
    event_date on the booking (primary) with window-based fallback for edge cases.

    Primary:  booking.event_date.year == edition year
    Fallback: booking.invoice_date or booking.created_at falls within the edition window
    """

    def __init__(self, event_code: str, current_event_date: Optional[date] = None):
        self.event_code = normalize_event_code(event_code)
        self.windows = EventEditionWindowCalculator(
            self.event_code, current_event_date
        ).get_edition_windows()
        # Map year -> {window_start, window_end}
        self.window_map: Dict[int, Dict] = {w["year"]: w for w in self.windows}
        self.sorted_years = sorted(self.window_map.keys())

    def edition_year_for_booking(self, event_date: Optional[date],
                                  booking_date: Optional[date]) -> Optional[int]:
        """
        Returns the edition year this booking belongs to.
        Uses event_date.year when available (most reliable).
        Falls back to window matching on booking_date.
        """
        # Primary: event_date year tells us exactly which occurrence was booked
        if event_date:
            yr = event_date.year
            if yr in self.window_map:
                return yr

        # Fallback: find which window the booking_date falls into
        if booking_date:
            for yr in reversed(self.sorted_years):
                w = self.window_map[yr]
                end = date.fromisoformat(w["window_end"]) if w["window_end"] else None
                start = date.fromisoformat(w["window_start"]) if w["window_start"] else None
                if end and booking_date <= end:
                    if start is None or booking_date >= start:
                        return yr

        return None


# ─────────────────────────────────────────────────────────────────────────────
# Historical Booking Edition Assigner
# ─────────────────────────────────────────────────────────────────────────────

class HistoricalBookingEditionAssigner:
    """
    For an event_code, builds a complete edition → bookings mapping.
    Does NOT write to BookEvent records — returns a read-only mapping.
    The booking_event_edition reference is stored in the returned structure only.
    """

    def __init__(self, event_code: str, current_event_date: Optional[date] = None):
        self.event_code = normalize_event_code(event_code)
        self.mapper = EventEditionBookingMapper(self.event_code, current_event_date)

    def assign(self) -> Dict[int, List[str]]:
        """
        Returns {edition_year: [invoice_numbers]} for all bookings.
        Bookings that cannot be mapped are in key None.
        """
        from book_event.models import BookEvent

        assignment: Dict[Optional[int], List[str]] = {}
        qs = (
            BookEvent.objects
            .filter(event_code__iregex=booking_code_regex(self.event_code))
            .values("invoice_number", "event_date", "invoice_date", "created_at")
        )
        for row in qs:
            ev_date = row["event_date"]
            bk_date = row["invoice_date"] or (row["created_at"].date() if row["created_at"] else None)
            yr = self.mapper.edition_year_for_booking(ev_date, bk_date)
            assignment.setdefault(yr, []).append(row["invoice_number"])

        return assignment


# ─────────────────────────────────────────────────────────────────────────────
# Year-on-Year Growth Calculator
# ─────────────────────────────────────────────────────────────────────────────

class YearOnYearGrowthCalculator:
    """
    Computes YoY growth metrics for all editions of a given event.
    Uses live DB aggregations — no cached values required.
    """

    def __init__(self, event_code: str, event=None):
        self.event_code = normalize_event_code(event_code)
        self.event = event  # events.Event instance (optional, for metadata)

    def calculate(self) -> Dict[str, Any]:
        """
        Returns full growth data dict:
        {
            event_id, event_code, event_name, current_city, current_event_date,
            total_historical_years, latest_growth_pct, total_sales_all_years,
            editions: [...]
        }
        """
        current_event_date = self.event.event_date if self.event else None
        windows = EventEditionWindowCalculator(
            self.event_code, current_event_date
        ).get_edition_windows()

        if not windows:
            return self._empty_result()

        editions = []
        prev_metrics: Optional[Dict] = None

        for w in windows:
            yr = w["year"]
            m  = self._aggregate_year(yr)

            # Compute growth vs previous year
            growth_pct    = None
            bk_growth_pct = None
            dl_growth_pct = None
            prev_sales    = None

            if prev_metrics is not None:
                prev_sales = prev_metrics["total_sales"]
                if prev_sales and prev_sales > 0:
                    growth_pct = round(
                        float((m["total_sales"] - prev_sales) / prev_sales * 100), 2
                    )
                prev_bk = prev_metrics["total_bookings"]
                if prev_bk > 0:
                    bk_growth_pct = round(
                        (m["total_bookings"] - prev_bk) / prev_bk * 100, 2
                    )
                prev_dl = prev_metrics["total_delegates"]
                if prev_dl > 0:
                    dl_growth_pct = round(
                        (m["total_delegates"] - prev_dl) / prev_dl * 100, 2
                    )

            editions.append({
                "year":                 yr,
                "location":             w["location"],
                "edition_date":         w["edition_date"],
                "window_start":         w["window_start"],
                "window_end":           w["window_end"],
                "total_sales":          float(m["total_sales"]),
                "total_bookings":       m["total_bookings"],
                "total_paid":           m["total_paid"],
                "total_unpaid":         m["total_unpaid"],
                "total_delegates":      m["total_delegates"],
                "previous_year_sales":  float(prev_sales) if prev_sales is not None else None,
                "growth_pct":           growth_pct,
                "booking_growth_pct":   bk_growth_pct,
                "delegate_growth_pct":  dl_growth_pct,
            })
            prev_metrics = m

        # Summary-level values
        editions_desc = list(reversed(editions))
        latest = editions_desc[0] if editions_desc else {}
        total_sales_all = sum(e["total_sales"] for e in editions)

        return {
            "event_id":              self.event.id if self.event else None,
            "event_code":            self.event_code,
            "event_name":            self.event.name if self.event else self.event_code,
            "current_city":          self.event.city if self.event else "",
            "current_event_date":    current_event_date.isoformat() if current_event_date else None,
            "total_historical_years": len(editions),
            "latest_growth_pct":     latest.get("growth_pct"),
            "total_sales_all_years": round(total_sales_all, 2),
            "editions":              editions_desc,  # newest first for the UI
        }

    def _aggregate_year(self, year: int) -> Dict[str, Any]:
        from book_event.models import BookEvent
        from book_delegate.models import BookDelegate

        code_pattern = booking_code_regex(self.event_code, year=year)
        bookings_qs = BookEvent.objects.filter(
            event_code__iregex=code_pattern,
        )
        total_bookings = bookings_qs.count()
        total_paid     = bookings_qs.filter(payment_status__in=PAID_STATUSES).count()
        total_sales    = bookings_qs.aggregate(
            s=Coalesce(Sum("total_amount", output_field=__import__("django.db.models", fromlist=["DecimalField"]).DecimalField(max_digits=14, decimal_places=2)), _ZERO)
        )["s"] or _ZERO

        total_delegates = BookDelegate.objects.filter(
            event_code__iregex=code_pattern,
        ).count()

        return {
            "total_sales":      total_sales,
            "total_bookings":   total_bookings,
            "total_paid":       total_paid,
            "total_unpaid":     total_bookings - total_paid,
            "total_delegates":  total_delegates,
        }

    def _empty_result(self) -> Dict[str, Any]:
        return {
            "event_id":              self.event.id if self.event else None,
            "event_code":            self.event_code,
            "event_name":            self.event.name if self.event else self.event_code,
            "current_city":          self.event.city if self.event else "",
            "current_event_date":    None,
            "total_historical_years": 0,
            "latest_growth_pct":     None,
            "total_sales_all_years": 0.0,
            "editions":              [],
        }


# ─────────────────────────────────────────────────────────────────────────────
# Validation helper
# ─────────────────────────────────────────────────────────────────────────────

class EditionGrowthValidator:
    """
    Validates that edition windows don't overlap and that growth calculations
    are mathematically consistent. Implements the retry loop from the spec.
    """

    MAX_ITERATIONS = 3

    def __init__(self, event_code: str, event=None):
        self.event_code = normalize_event_code(event_code)
        self.event = event

    def validate_and_fix(self) -> Dict[str, Any]:
        calc    = YearOnYearGrowthCalculator(self.event_code, self.event)
        result  = calc.calculate()
        issues  = []
        iteration = 0

        while iteration < self.MAX_ITERATIONS:
            iteration += 1
            found = self._validate(result)
            if not found:
                break
            issues.extend(found)
            result = calc.calculate()  # recompute

        result["validation_issues"]   = issues
        result["validation_passed"]   = len(issues) == 0
        result["validation_iterations"] = iteration
        return result

    def _validate(self, result: Dict) -> List[Dict]:
        issues = []
        editions = result.get("editions", [])

        # Check windows are non-overlapping (editions are sorted desc, reverse for check)
        sorted_asc = list(reversed(editions))
        for i in range(1, len(sorted_asc)):
            prev = sorted_asc[i - 1]
            curr = sorted_asc[i]
            if prev["window_end"] and curr["window_start"]:
                prev_end  = date.fromisoformat(prev["window_end"])
                curr_start = date.fromisoformat(curr["window_start"])
                if curr_start <= prev_end:
                    issues.append({
                        "type":   "overlapping_windows",
                        "years":  f"{prev['year']}–{curr['year']}",
                        "detail": f"Window {curr['year']} starts {curr_start} before {prev['year']} ends {prev_end}.",
                        "suggested_fix": "Check event_date values on BookEvent records.",
                    })

        # Check growth formula: if both sales values exist, growth must be accurate
        for ed in editions:
            if ed["previous_year_sales"] is not None and ed["previous_year_sales"] > 0:
                expected = round(
                    (ed["total_sales"] - ed["previous_year_sales"]) / ed["previous_year_sales"] * 100, 2
                )
                if ed["growth_pct"] is not None and abs(ed["growth_pct"] - expected) > 0.01:
                    issues.append({
                        "type":   "growth_formula_mismatch",
                        "years":  str(ed["year"]),
                        "detail": f"Stored growth {ed['growth_pct']} != computed {expected}.",
                        "suggested_fix": "Re-run calculate_edition_growth command.",
                    })

        return issues
