"""
management/commands/calculate_edition_growth.py

Calculates YoY growth metrics for all (or one specific) event code,
saves results to EventEditionMetrics, and writes:
  reports/docs/EVENT_EDITION_GROWTH_ENGINE.md

Usage:
    python manage.py calculate_edition_growth
    python manage.py calculate_edition_growth --event-code DDU
    python manage.py calculate_edition_growth --dry-run
"""
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Calculate YoY edition growth metrics and cache them in EventEditionMetrics."

    def add_arguments(self, parser):
        parser.add_argument("--event-code", type=str, default=None,
                            help="Compute for one event code only.")
        parser.add_argument("--dry-run", action="store_true", default=False,
                            help="Compute but do not write to EventEditionMetrics.")

    def handle(self, *args, **options):
        from historical_event_registry.models import HistoricalEventReference, EventEditionMetrics
        from historical_event_registry.growth_service import (
            YearOnYearGrowthCalculator, EditionGrowthValidator
        )
        from events.models import Event
        from book_event.models import BookEvent
        from django.db.models.functions import ExtractYear
        from django.db.models import Count

        dry_run      = options["dry_run"]
        specific_code = options.get("event_code")

        self.stdout.write(
            "\n===============================================\n"
            "  Edition Growth Calculator\n"
            "==============================================="
        )

        if specific_code:
            codes = [specific_code.strip().upper()]
        else:
            hist_codes = set(
                HistoricalEventReference.objects
                .values_list("normalized_event_code", flat=True)
                .distinct()
            )
            multi_codes = set(
                BookEvent.objects.exclude(event_date__isnull=True)
                .annotate(yr=ExtractYear("event_date"))
                .values("event_code")
                .annotate(yc=Count("yr", distinct=True))
                .filter(yc__gte=2)
                .values_list("event_code", flat=True)
            )
            codes = sorted(hist_codes | multi_codes)

        self.stdout.write(f"  Processing {len(codes)} event code(s){'  [DRY RUN]' if dry_run else ''}...\n")

        event_map = {e.event_code: e for e in Event.objects.filter(event_code__in=codes)}
        all_results = []
        total_editions = 0
        total_issues   = 0

        for code in codes:
            event  = event_map.get(code)
            result = EditionGrowthValidator(event_code=code, event=event).validate_and_fix()
            all_results.append(result)

            editions = result.get("editions", [])
            total_editions += len(editions)

            passed = result["validation_passed"]
            icon   = "[OK]" if passed else "[!]"
            self.stdout.write(
                f"  {icon} {code:<12} {len(editions)} edition(s)"
                + (f"  growth={result['latest_growth_pct']}%" if result["latest_growth_pct"] is not None else "")
            )

            if result["validation_issues"]:
                n = len(result["validation_issues"])
                total_issues += n
                for iss in result["validation_issues"]:
                    self.stdout.write(self.style.WARNING(f"      -- {iss['type']} ({iss['years']}): {iss['detail']}"))

            # Save to EventEditionMetrics cache
            if not dry_run and event:
                self._persist(event, result)

        self.stdout.write(
            f"\n  Total editions: {total_editions}  |  Validation issues: {total_issues}"
        )
        doc_path = self._write_report(all_results)
        self.stdout.write(self.style.SUCCESS(f"\n  Report -> {doc_path}"))
        self.stdout.write(
            "===============================================\n"
            "  Done.\n"
            "===============================================\n"
        )

    def _persist(self, event, result):
        from historical_event_registry.models import EventEditionMetrics

        editions = list(reversed(result.get("editions", [])))  # ascending order
        for ed in editions:
            defaults = {
                "event_code":        result["event_code"],
                "location":          ed.get("location", ""),
                "edition_start_date": ed.get("window_start"),
                "edition_end_date":   ed.get("window_end"),
                "total_sales":       Decimal(str(ed.get("total_sales", 0))),
                "total_bookings":    ed.get("total_bookings", 0),
                "total_paid":        ed.get("total_paid", 0),
                "total_unpaid":      ed.get("total_unpaid", 0),
                "total_delegates":   ed.get("total_delegates", 0),
                "previous_year_sales": (
                    Decimal(str(ed["previous_year_sales"]))
                    if ed.get("previous_year_sales") is not None else None
                ),
                "growth_pct":         (
                    Decimal(str(ed["growth_pct"]))
                    if ed.get("growth_pct") is not None else None
                ),
                "booking_growth_pct": (
                    Decimal(str(ed["booking_growth_pct"]))
                    if ed.get("booking_growth_pct") is not None else None
                ),
                "delegate_growth_pct": (
                    Decimal(str(ed["delegate_growth_pct"]))
                    if ed.get("delegate_growth_pct") is not None else None
                ),
            }
            obj, created = EventEditionMetrics.objects.update_or_create(
                event=event,
                event_year=ed["year"],
                defaults=defaults,
            )
            action = "Created" if created else "Updated"
            self.stdout.write(f"      {action} EventEditionMetrics: {result['event_code']} {ed['year']}")

    def _write_report(self, results: list) -> Path:
        docs = Path(settings.BASE_DIR) / "reports" / "docs"
        docs.mkdir(parents=True, exist_ok=True)
        path = docs / "EVENT_EDITION_GROWTH_ENGINE.md"

        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

        lines = [
            "# Event Edition Growth Engine",
            "",
            f"Generated: {now}",
            f"Total events processed: {len(results)}",
            "",
            "---",
            "",
            "## Overview",
            "",
            "The Event Edition Growth Engine maps bookings to their correct yearly",
            "event edition and calculates year-on-year growth metrics for each master event.",
            "",
            "### Edition Window Logic",
            "",
            "Each edition owns bookings where `BookEvent.event_date.year == edition_year`.",
            "The booking *window* describes the period during which bookings were sold:",
            "",
            "```",
            "Edition 2023:  window = [earliest] → 2023 event date",
            "Edition 2024:  window = (2023 event date + 1 day) → 2024 event date",
            "Edition 2025:  window = (2024 event date + 1 day) → 2025 event date",
            "```",
            "",
            "### YoY Growth Formula",
            "",
            "```",
            "growth_pct = (current_year_sales - previous_year_sales)",
            "             / previous_year_sales * 100",
            "```",
            "",
            "The same formula applies to bookings and delegates.",
            "",
            "---",
            "",
            "## Per-Event Growth Data",
            "",
        ]

        for result in results:
            code    = result["event_code"]
            name    = result.get("event_name", code)
            passed  = result.get("validation_passed", True)
            editions = result.get("editions", [])
            icon    = "OK" if passed else "ISSUES"

            lines += [
                f"## [{icon}] {code} — {name}",
                "",
                f"City: {result.get('current_city', '--')}  ",
                f"Total historical editions: {len(editions)}  ",
                f"Total sales (all years): ${result.get('total_sales_all_years', 0):,.2f}  ",
                f"Latest growth: {result.get('latest_growth_pct', '--')}%",
                "",
                "### Edition Timeline & Growth",
                "",
                "| Year | Location | Event Date | Booking Window | Sales | Bookings | Paid | Delegates | Growth % | Booking Growth % |",
                "|------|----------|------------|----------------|-------|----------|------|-----------|----------|-----------------|",
            ]

            for ed in reversed(editions):  # ascending
                ws  = ed.get("window_start") or "--"
                we  = ed.get("window_end") or "--"
                window = f"{ws} → {we}"
                sales  = f"${ed['total_sales']:,.0f}"
                gpct   = f"{ed['growth_pct']:+.1f}%" if ed.get("growth_pct") is not None else "--"
                bkpct  = f"{ed['booking_growth_pct']:+.1f}%" if ed.get("booking_growth_pct") is not None else "--"
                lines.append(
                    f"| {ed['year']} | {ed['location'] or '--'} | {ed.get('edition_date') or '--'} "
                    f"| {window} | {sales} | {ed['total_bookings']} | {ed['total_paid']} "
                    f"| {ed['total_delegates']} | {gpct} | {bkpct} |"
                )

            if result.get("validation_issues"):
                lines += ["", "### Validation Issues", ""]
                for iss in result["validation_issues"]:
                    lines += [
                        f"- **{iss['type']}** ({iss.get('years', '--')}): {iss['detail']}",
                        f"  Suggested fix: {iss['suggested_fix']}",
                    ]

            lines += ["", "---", ""]

        path.write_text("\n".join(lines), encoding="utf-8")
        return path
