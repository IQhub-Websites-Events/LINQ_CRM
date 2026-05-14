"""
book_event/management/commands/audit_event_code_mapping.py

Scans every BookEvent record, attempts to find the matching Event using the
3-char base-prefix + year strategy, and writes a markdown report of all
entries that could NOT be matched.

Usage:
    python manage.py audit_event_code_mapping
    python manage.py audit_event_code_mapping --output my_report.md
"""
import re
from collections import defaultdict

from django.core.management.base import BaseCommand

from book_event.models import BookEvent
from events.models import Event


# ── Helpers ───────────────────────────────────────────────────────────────────

def parse_event_code(code: str):
    """
    Extract (base, year) from a booking event_code.

    Examples:
        "ACU - RS26"    → ("ACU", 2026)
        "ACU25"         → ("ACU", 2025)
        "MMU/GS - JS26" → ("MMU", 2026)
        "BIC - PM"      → ("BIC", None)
        "BIC26"         → ("BIC", 2026)
    """
    base_match = re.match(r'^([A-Za-z]{2,4})', code)
    base = base_match.group(1).upper() if base_match else None
    year_match = re.search(r'(\d{2,4})$', code)
    year = None
    if year_match:
        raw = year_match.group(1)
        year = 2000 + int(raw) if len(raw) == 2 else int(raw)
    return base, year


def strip_year(code: str) -> str:
    return re.sub(r'\s*\d{2,4}$', '', code).strip()


def find_event(booking_code: str, event_qs):
    """
    Attempt to find a matching Event using the priority strategy:
      1. base + year  (most precise)
      2. baseCode (year-stripped)
      3. base only

    Returns the best matching Event or None.
    """
    base, year = parse_event_code(booking_code)
    if not base:
        return None

    base_code = strip_year(booking_code)

    strategies = []
    if year:
        strategies.append(
            event_qs.filter(event_code__icontains=base, event_date__year=year)
        )
    if base_code and base_code != booking_code and base_code != base:
        strategies.append(
            event_qs.filter(event_code__icontains=base_code)
        )
    strategies.append(
        event_qs.filter(event_code__icontains=base)
    )

    for qs in strategies:
        # Prefer event whose code STARTS WITH base (iexact on first chars)
        exact_start = [ev for ev in qs if ev.event_code.upper().startswith(base)]
        if exact_start:
            return exact_start[0]
        first = qs.first()
        if first:
            return first

    return None


# ── Command ───────────────────────────────────────────────────────────────────

class Command(BaseCommand):
    help = "Audit BookEvent → Event mapping; write a markdown report of failures."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            default="booking_event_mapping_issues.md",
            help="Output markdown file path (default: booking_event_mapping_issues.md)",
        )

    def handle(self, *args, **options):
        out_path = options["output"]

        all_events = list(Event.objects.all().only("id", "event_code", "name", "event_date", "city"))
        event_qs = Event.objects.all().only("id", "event_code", "name", "event_date", "city")

        self.stdout.write(f"Loaded {len(all_events)} events from DB.")

        # Gather distinct booking codes
        booking_codes = (
            BookEvent.objects
            .values_list("event_code", flat=True)
            .distinct()
            .order_by("event_code")
        )

        failed_by_code = defaultdict(list)   # code → list of invoice numbers
        ok_count = 0
        fail_count = 0

        for code in booking_codes:
            if not code:
                continue
            matched = find_event(code, event_qs)
            if matched:
                ok_count += 1
                self.stdout.write(
                    self.style.SUCCESS(f"  OK   {code!r:35s} -> {matched.event_code}")
                )
            else:
                fail_count += 1
                # Collect invoice numbers for this code
                invoices = list(
                    BookEvent.objects
                    .filter(event_code=code)
                    .values_list("invoice_number", flat=True)
                    .order_by("invoice_number")
                )
                failed_by_code[code] = invoices
                self.stdout.write(
                    self.style.WARNING(f"  FAIL {code!r:35s} -- no match ({len(invoices)} invoices)")
                )

        # ── Write markdown report ─────────────────────────────────────────────
        lines = [
            "# Booking → Event Code Mapping Issues",
            "",
            f"**Total distinct booking codes scanned:** {ok_count + fail_count}  ",
            f"**Mapped OK:** {ok_count}  ",
            f"**Could NOT be mapped:** {fail_count}",
            "",
            "> These booking codes have no matching Event in the Events table using the",
            "> 3-initial + year strategy. Please update the event_code on each booking,",
            "> or create the missing Event record.",
            "",
        ]

        for i, (code, invoices) in enumerate(sorted(failed_by_code.items()), 1):
            base, year = parse_event_code(code)
            lines += [
                f"## {i}. `{code}`",
                "",
                f"- **Extracted base:** `{base}`  ",
                f"- **Extracted year:** `{year}`  ",
                f"- **Invoice count:** {len(invoices)}",
                "",
                "| # | Invoice Number |",
                "|---|----------------|",
            ]
            for j, inv in enumerate(invoices, 1):
                lines.append(f"| {j} | {inv} |")
            lines.append("")
            lines.append("**Suggested fix:** *(please specify the correct event_code)*")
            lines.append("")
            lines.append("---")
            lines.append("")

        report = "\n".join(lines)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(report)

        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(f"Report written -> {out_path}")
        )
        self.stdout.write(
            f"Summary: {ok_count} mapped, {fail_count} failed."
        )
