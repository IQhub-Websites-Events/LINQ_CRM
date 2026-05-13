"""
management/commands/validate_historical_metrics.py

Validates historical edition metrics across all (or one specific) event codes.
Generates: reports/docs/HISTORICAL_EVENT_METRICS_VALIDATION.md

Usage:
    python manage.py validate_historical_metrics
    python manage.py validate_historical_metrics --event-code DDU
"""
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from historical_event_registry.models import HistoricalEventReference
from historical_event_registry.edition_service import HistoricalMetricsAggregator


class Command(BaseCommand):
    help = "Validate historical event edition metrics and generate a validation report."

    def add_arguments(self, parser):
        parser.add_argument(
            "--event-code",
            type=str,
            default=None,
            help="Validate a single event code only (e.g. DDU).",
        )

    def handle(self, *args, **options):
        specific_code = options.get("event_code")

        if specific_code:
            codes = [specific_code.strip().upper()]
        else:
            codes = sorted(
                HistoricalEventReference.objects
                .values_list("normalized_event_code", flat=True)
                .distinct()
            )

        self.stdout.write(
            "\n===============================================\n"
            "  Historical Metrics Validation\n"
            "==============================================="
        )
        self.stdout.write(f"  Validating {len(codes)} event code(s)...\n")

        all_results = []
        total_issues = 0
        pass_count   = 0

        for code in codes:
            agg    = HistoricalMetricsAggregator(code)
            result = agg.validate_and_aggregate()
            all_results.append(result)

            if result["validation_passed"]:
                pass_count += 1
                self.stdout.write(f"  [OK]     {code:<12} {len(result['editions'])} edition(s)")
            else:
                n = len(result["issues"])
                total_issues += n
                self.stdout.write(
                    self.style.WARNING(f"  [ISSUES] {code:<12} {n} issue(s) after {result['iterations']} iteration(s)")
                )
                for issue in result["issues"]:
                    self.stdout.write(self.style.WARNING(
                        f"           -- {issue['type']} ({issue['year']}): {issue['detail']}"
                    ))

        self.stdout.write(
            f"\n  Passed: {pass_count} / {len(codes)}  |  Total issues: {total_issues}"
        )

        report_path = self._write_report(all_results, total_issues)
        self.stdout.write(self.style.SUCCESS(f"\n  Report -> {report_path}"))
        self.stdout.write(
            "===============================================\n"
            "  Validation complete.\n"
            "===============================================\n"
        )

    def _write_report(self, results: list, total_issues: int) -> Path:
        docs = Path(settings.BASE_DIR) / "reports" / "docs"
        docs.mkdir(parents=True, exist_ok=True)
        path = docs / "HISTORICAL_EVENT_METRICS_VALIDATION.md"

        now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
        lines = [
            "# Historical Event Metrics Validation Report",
            "",
            f"Generated: {now}",
            f"Total event codes validated: {len(results)}",
            f"Total issues found: {total_issues}",
            "",
            "---",
            "",
        ]

        for result in results:
            code     = result["event_code"]
            editions = result["editions"]
            passed   = result["validation_passed"]
            icon     = "OK" if passed else "ISSUES"

            lines += [
                f"## [{icon}] {code}",
                "",
                f"Editions found: {len(editions)}  "
                f"| Iterations: {result['iterations']}  "
                f"| Validation: {'PASSED' if passed else 'FAILED'}",
                "",
                "### Yearly Metrics",
                "",
                "| Year | Location | Bookings | Paid | Unpaid | Delegates "
                "| Last Booking | B-7d | B-15d | B-30d | P-7d | P-15d | P-30d |",
                "|------|----------|----------|------|--------|-----------|"
                "--------------|------|-------|-------|------|-------|-------|",
            ]

            for ed in editions:
                m   = ed["metrics"]
                loc = (ed["location"] or "--")[:30]
                lb  = (m["last_booking_date"] or "--")[:10]
                lines.append(
                    f"| {ed['year']} | {loc} | {m['total_bookings']} | "
                    f"{m['paid_entries']} | {m['unpaid_entries']} | {m['total_delegates']} | "
                    f"{lb} | {m['booking_activity_7_days']} | {m['booking_activity_15_days']} | "
                    f"{m['booking_activity_30_days']} | {m['payment_activity_7_days']} | "
                    f"{m['payment_activity_15_days']} | {m['payment_activity_30_days']} |"
                )

            if result["issues"]:
                lines += ["", "### Validation Issues", ""]
                for issue in result["issues"]:
                    lines += [
                        "---",
                        "",
                        f"**Event Code:** `{issue['event_code']}`  ",
                        f"**Year:** {issue['year']}  ",
                        f"**Issue Type:** {issue['type']}  ",
                        f"**Metric:** {issue['metric']}  ",
                        f"**Detail:** {issue['detail']}  ",
                        f"**Aggregation Source:** {issue['aggregation_source']}  ",
                        f"**Suggested Fix:** {issue['suggested_fix']}  ",
                        "",
                    ]
            else:
                lines += ["", "_No issues detected._", ""]

            lines += ["---", ""]

        path.write_text("\n".join(lines), encoding="utf-8")
        return path
