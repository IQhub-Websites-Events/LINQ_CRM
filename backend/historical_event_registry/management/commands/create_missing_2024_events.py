"""
management/commands/create_missing_2024_events.py

Dynamically reads all HistoricalEventReference objects with event_year=2024
and verification_status='unmatched', creates a CRM Event for each unique
unmatched code, then wipes and re-runs the 2024 import service so those
records can now be matched.

Usage:
    python manage.py create_missing_2024_events
    python manage.py create_missing_2024_events --dry-run
"""
import datetime

from django.core.management.base import BaseCommand

from events.models import Event
from historical_event_registry.models import HistoricalEventReference
from historical_event_registry.services import Historical2024ImportService


# ---------------------------------------------------------------------------
# Helper: derive a best-effort Event record from a HistoricalEventReference
# ---------------------------------------------------------------------------

def _derive_event_fields(ref: HistoricalEventReference) -> dict:
    """
    Build Event field values from the historical reference.  We use the
    raw_row_data when available so that date_range, location etc. are used.
    """
    raw = ref.raw_row_data or {}

    # --- date ---
    # Try to parse the first date from "date_range" (e.g. "March 4-5")
    date_range = raw.get("date_range", "")
    event_date, end_date = _parse_date_range(date_range, 2024)

    # --- location split into city/country ---
    location = ref.event_location or raw.get("location", "")
    city, country = _split_location(location)

    # --- name ---
    name = f"{ref.normalized_event_code} 2024"

    return {
        "event_code":             ref.normalized_event_code,
        "name":                   name,
        "status":                 Event.Status.COMPLETED,
        "city":                   city,
        "country":                country,
        "event_date":             event_date,
        "end_date":               end_date,
        "accepting_web_bookings": False,
    }


def _parse_date_range(date_range: str, year: int):
    """
    Parse strings like 'March 4-5', 'September 25', 'October 9-10'.
    Returns (event_date, end_date) as datetime.date objects.
    Falls back to Jan 1 of the given year if unparseable.
    """
    months = {
        "january": 1, "february": 2, "march": 3, "april": 4,
        "may": 5, "june": 6, "july": 7, "august": 8,
        "september": 9, "october": 10, "november": 11, "december": 12,
    }
    fallback = datetime.date(year, 1, 1)
    if not date_range:
        return fallback, fallback

    parts = date_range.strip().split()
    if not parts:
        return fallback, fallback

    month_name = parts[0].lower()
    month_num = months.get(month_name)
    if not month_num:
        return fallback, fallback

    try:
        if len(parts) >= 2:
            day_part = parts[1]
            if "-" in day_part:
                day_parts = day_part.split("-")
                start_day = int(day_parts[0])
                end_day   = int(day_parts[1])
            else:
                start_day = int(day_part.rstrip(","))
                end_day   = start_day
        else:
            start_day = 1
            end_day   = 1

        event_date = datetime.date(year, month_num, start_day)
        end_date   = datetime.date(year, month_num, end_day)
        return event_date, end_date
    except (ValueError, IndexError):
        return fallback, fallback


def _split_location(location: str):
    """
    Split 'City, Country' or 'City, State, Country' into (city, country).
    Returns ('', '') if location is blank.
    """
    if not location:
        return "", ""
    parts = [p.strip() for p in location.split(",")]
    city    = parts[0] if parts else ""
    country = parts[-1] if len(parts) > 1 else ""
    return city, country


class Command(BaseCommand):
    help = (
        "Dynamically create CRM Event records for all 2024 unmatched historical "
        "references, then wipe unmatched rows and re-run the 2024 import."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Show what would be created/deleted without touching the database.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write("[create_missing_2024_events] DRY-RUN mode -- no DB writes.")

        # ------------------------------------------------------------------
        # 1. Find all unique unmatched 2024 codes
        # ------------------------------------------------------------------
        self.stdout.write("")
        self.stdout.write("=== Step 1: Reading unmatched 2024 HistoricalEventReference rows ===")

        unmatched_refs = (
            HistoricalEventReference.objects
            .filter(event_year=2024, verification_status=HistoricalEventReference.VerificationStatus.UNMATCHED)
            .order_by("normalized_event_code", "event_month")
        )

        total_unmatched = unmatched_refs.count()
        self.stdout.write(f"  Found {total_unmatched} unmatched 2024 reference(s).")

        if total_unmatched == 0:
            self.stdout.write(
                "  No unmatched 2024 references found.  "
                "Run 'import_2024_pdf' first to populate the table."
            )

        # Deduplicate by normalized_event_code — keep the first ref per code
        seen_codes: dict[str, HistoricalEventReference] = {}
        for ref in unmatched_refs:
            if ref.normalized_event_code not in seen_codes:
                seen_codes[ref.normalized_event_code] = ref

        self.stdout.write(f"  Unique unmatched codes : {len(seen_codes)}")

        # ------------------------------------------------------------------
        # 2. Create an Event for each unique code
        # ------------------------------------------------------------------
        self.stdout.write("")
        self.stdout.write("=== Step 2: Creating missing 2024 Event records ===")
        created_count = 0
        skipped_count = 0

        for code, ref in seen_codes.items():
            if Event.objects.filter(event_code=code).exists():
                self.stdout.write(f"  [SKIP]    {code:<10} already exists in CRM.")
                skipped_count += 1
                continue

            fields = _derive_event_fields(ref)

            if dry_run:
                self.stdout.write(
                    f"  [DRY-RUN] Would create Event: {code:<10} | {fields['name']} "
                    f"({fields['city']}, {fields['country']}) "
                    f"date={fields['event_date']}"
                )
                created_count += 1
                continue

            Event.objects.create(**fields)
            self.stdout.write(
                f"  [CREATED] {code:<10} | {fields['name']} "
                f"({fields['city']}, {fields['country']}) "
                f"date={fields['event_date']}"
            )
            created_count += 1

        self.stdout.write(
            f"\n  Created: {created_count}  |  Skipped (already existed): {skipped_count}"
        )

        # ------------------------------------------------------------------
        # 3. Wipe all unmatched 2024 HistoricalEventReference rows
        # ------------------------------------------------------------------
        self.stdout.write("")
        self.stdout.write("=== Step 3: Wiping unmatched 2024 HistoricalEventReference rows ===")

        wipe_qs = HistoricalEventReference.objects.filter(
            event_year=2024,
            verification_status=HistoricalEventReference.VerificationStatus.UNMATCHED,
        )
        wipe_count = wipe_qs.count()

        if dry_run:
            self.stdout.write(
                f"  [DRY-RUN] Would delete {wipe_count} unmatched 2024 reference(s)."
            )
        else:
            deleted, _ = wipe_qs.delete()
            self.stdout.write(f"  Deleted {deleted} unmatched 2024 reference(s).")

        # ------------------------------------------------------------------
        # 4. Re-run 2024 import service
        # ------------------------------------------------------------------
        self.stdout.write("")
        self.stdout.write("=== Step 4: Re-running 2024 historical import service ===")

        service = Historical2024ImportService(dry_run=dry_run)
        summary = service.run()

        self.stdout.write("")
        self.stdout.write("--- 2024 Re-import Summary ---")
        self.stdout.write(f"  Total rows processed : {summary['total']}")
        self.stdout.write(f"  Verified             : {summary['verified']}")
        self.stdout.write(f"  Unmatched            : {summary['unmatched']}")
        self.stdout.write(f"  Failed               : {summary['failed']}")
        self.stdout.write(f"  Duplicates skipped   : {summary['duplicates']}")

        still_unmatched = summary.get("errors", [])
        if still_unmatched:
            self.stdout.write("")
            self.stdout.write(
                f"  WARNING: {len(still_unmatched)} row(s) still unmatched after re-import:"
            )
            for rec in still_unmatched:
                code   = rec.get("original_code") or rec.get("normalized_code") or "(empty)"
                month  = rec.get("event_month", "")
                reason = rec.get("error_reason", "")
                self.stdout.write(f"    {code:<10} {month:<12}  {reason}")

        self.stdout.write("")
        self.stdout.write("[create_missing_2024_events] Done.")
