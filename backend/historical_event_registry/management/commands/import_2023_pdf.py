"""
management/commands/import_2023_pdf.py

Imports 2023 historical event data from a PDF (or hardcoded dataset) into
HistoricalEventReference records, then optionally writes Markdown reports.

Usage:
    python manage.py import_2023_pdf
    python manage.py import_2023_pdf --pdf /path/to/2023.pdf
    python manage.py import_2023_pdf --dry-run
    python manage.py import_2023_pdf --generate-reports
"""
import os
from pathlib import Path

from django.core.management.base import BaseCommand

from historical_event_registry.services import Historical2023ImportService


REPORT_DIR = Path(__file__).resolve().parents[6] / "reports" / "docs"


def _write_report(path: Path, lines: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")


class Command(BaseCommand):
    help = "Import 2023 historical event data and match against CRM events."

    def add_arguments(self, parser):
        parser.add_argument(
            "--pdf",
            dest="pdf_path",
            default=None,
            help="Absolute path to the 2023 PDF file. If omitted the hardcoded dataset is used.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Parse and match but do NOT write to the database.",
        )
        parser.add_argument(
            "--generate-reports",
            action="store_true",
            default=False,
            help="Write Markdown error/success reports to reports/docs/.",
        )

    def handle(self, *args, **options):
        pdf_path = options["pdf_path"]
        dry_run  = options["dry_run"]
        gen_rpts = options["generate_reports"]

        self.stdout.write("[import_2023_pdf] Starting 2023 historical event import.")
        if dry_run:
            self.stdout.write("[import_2023_pdf] DRY-RUN mode -- no DB writes.")

        service = Historical2023ImportService(pdf_path=pdf_path, dry_run=dry_run)
        summary = service.run()

        self.stdout.write("")
        self.stdout.write("=== 2023 Import Summary ===")
        self.stdout.write(f"  Total rows processed : {summary['total']}")
        self.stdout.write(f"  Verified             : {summary['verified']}")
        self.stdout.write(f"  Unmatched            : {summary['unmatched']}")
        self.stdout.write(f"  Failed               : {summary['failed']}")
        self.stdout.write(f"  Duplicates skipped   : {summary['duplicates']}")
        self.stdout.write(f"  Dry-run              : {summary['dry_run']}")

        # ---- print errors to stdout ----
        errors = summary.get("errors", [])
        if errors:
            self.stdout.write("")
            self.stdout.write(f"--- Unmatched / Failed rows ({len(errors)}) ---")
            for rec in errors:
                status = rec.get("verification_status", "unknown")
                code   = rec.get("original_code") or rec.get("normalized_code") or "(empty)"
                month  = rec.get("event_month", "")
                reason = rec.get("error_reason", "")
                self.stdout.write(f"  [{status.upper():9s}] {code:<10} {month:<12}  {reason}")

        # ---- optional reports ----
        if gen_rpts:
            self._write_error_report(summary)
            self._write_success_report(summary)

        self.stdout.write("")
        self.stdout.write("[import_2023_pdf] Done.")

    # ------------------------------------------------------------------
    def _write_error_report(self, summary):
        errors = summary.get("errors", [])
        lines = [
            "# HISTORICAL 2023 IMPORT ERRORS",
            "",
            f"Total rows processed : {summary['total']}",
            f"Verified             : {summary['verified']}",
            f"Unmatched / Failed   : {len(errors)}",
            f"Dry-run              : {summary['dry_run']}",
            "",
            "## Unmatched / Failed Rows",
            "",
            "| Status    | Code       | Month      | Location                      | Reason                                          |",
            "|-----------|------------|------------|-------------------------------|-------------------------------------------------|",
        ]
        for rec in errors:
            status   = rec.get("verification_status", "unknown")
            code     = rec.get("original_code") or rec.get("normalized_code") or "(empty)"
            month    = rec.get("event_month", "")
            location = rec.get("location", "")
            reason   = rec.get("error_reason", "")
            lines.append(
                f"| {status:<9} | {code:<10} | {month:<10} | {location:<29} | {reason:<47} |"
            )

        out_path = REPORT_DIR / "HISTORICAL_2023_IMPORT_ERRORS.md"
        _write_report(out_path, lines)
        self.stdout.write(f"[import_2023_pdf] Error report written to: {out_path}")

    def _write_success_report(self, summary):
        successes = summary.get("successes", [])
        lines = [
            "# HISTORICAL 2023 IMPORT SUCCESSES",
            "",
            f"Total rows processed : {summary['total']}",
            f"Verified             : {summary['verified']}",
            f"Dry-run              : {summary['dry_run']}",
            "",
            "## Verified Rows",
            "",
            "| Code       | Month      | Location                      | Confidence |",
            "|------------|------------|-------------------------------|------------|",
        ]
        for rec in successes:
            code       = rec.get("original_code") or rec.get("normalized_code") or "(empty)"
            month      = rec.get("event_month", "")
            location   = rec.get("location", "")
            confidence = rec.get("confidence", 0.0)
            lines.append(
                f"| {code:<10} | {month:<10} | {location:<29} | {confidence:<10.2f} |"
            )

        out_path = REPORT_DIR / "HISTORICAL_2023_IMPORT_SUCCESS.md"
        _write_report(out_path, lines)
        self.stdout.write(f"[import_2023_pdf] Success report written to: {out_path}")
