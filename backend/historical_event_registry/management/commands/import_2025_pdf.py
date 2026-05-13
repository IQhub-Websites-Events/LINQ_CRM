"""
Management command: import_2025_pdf
------------------------------------
python manage.py import_2025_pdf
python manage.py import_2025_pdf --pdf /path/to/2025.pdf
python manage.py import_2025_pdf --dry-run
python manage.py import_2025_pdf --generate-reports

Note on 2025 event codes:
  Raw codes are in "DDU - PT" format.
  normalize_event_code() strips the suffix automatically.
  DDU - PT  =>  DDU
"""
from datetime import datetime
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from historical_event_registry.services import Historical2025ImportService


class Command(BaseCommand):
    help = "Import 2025 historical event data from PDF into the CRM."

    def add_arguments(self, parser):
        parser.add_argument("--pdf", type=str, default=None,
                            help="Explicit path to 2025.pdf.")
        parser.add_argument("--dry-run", action="store_true", default=False,
                            help="Parse and match without writing to the database.")
        parser.add_argument("--generate-reports", action="store_true", default=True,
                            help="Write markdown reports to reports/docs/.")

    def handle(self, *args, **options):
        pdf_path    = options.get("pdf")
        dry_run     = options["dry_run"]
        gen_reports = options["generate_reports"]

        self.stdout.write(
            "\n===============================================\n"
            "  2025 Historical Event Import\n"
            "==============================================="
        )
        if dry_run:
            self.stdout.write(self.style.WARNING("  Mode: DRY RUN - no database writes.\n"))

        self.stdout.write(
            "  Note: 2025 codes like 'DDU - PT' normalize to 'DDU'.\n"
        )

        service = Historical2025ImportService(pdf_path=pdf_path, dry_run=dry_run)
        summary = service.run()

        self.stdout.write("\n" + self.style.SUCCESS("  IMPORT SUMMARY"))
        self.stdout.write(f"  Total rows processed : {summary['total']}")
        self.stdout.write(self.style.SUCCESS(f"  Verified (matched)   : {summary['verified']}"))
        self.stdout.write(self.style.WARNING(f"  Unmatched            : {summary['unmatched']}"))
        self.stdout.write(self.style.ERROR(  f"  Failed               : {summary['failed']}"))
        self.stdout.write(f"  Duplicates skipped   : {summary['duplicates']}")

        if summary["successes"]:
            self.stdout.write(self.style.MIGRATE_HEADING("\n  VERIFIED RECORDS"))
            for rec in summary["successes"]:
                crm = rec["matched_event"].event_code if rec.get("matched_event") else "-"
                orig = rec.get("original_code", "")
                self.stdout.write(
                    f"  [OK] {rec['normalized_code']:10s} ({orig:15s}) | "
                    f"{rec['event_month']:10s} | {rec['location'] or '-':35s} | "
                    f"CRM:{crm} | conf:{rec['confidence']:.0%}"
                )

        if summary["errors"]:
            self.stdout.write(self.style.WARNING("\n  UNMATCHED / FAILED RECORDS"))
            for rec in summary["errors"]:
                code = rec["normalized_code"] or rec["original_code"]
                self.stdout.write(
                    f"  [--] {code:10s} | {rec['event_month']:10s} | "
                    f"{rec.get('error_reason', 'Unknown error')}"
                )

        if gen_reports:
            self._write_error_report(summary)
            self._write_success_report(summary)

        self.stdout.write(self.style.SUCCESS(
            "\n===============================================\n"
            "  Import complete.\n"
            "===============================================\n"
        ))

    def _docs_dir(self) -> Path:
        docs = Path(settings.BASE_DIR) / "reports" / "docs"
        docs.mkdir(parents=True, exist_ok=True)
        return docs

    def _write_error_report(self, summary: dict) -> None:
        path = self._docs_dir() / "HISTORICAL_2025_IMPORT_ERRORS.md"
        now  = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
        lines = [
            "# Historical 2025 Import -- Error Report",
            "",
            f"Generated: {now}",
            "Source PDF: 2025.pdf",
            f"Total errors: {len(summary['errors'])}",
            "",
            "---",
            "",
        ]

        if not summary["errors"]:
            lines.append("No errors. All rows imported successfully.")
        else:
            for rec in summary["errors"]:
                norm   = rec.get("normalized_code") or rec.get("original_code", "--")
                orig   = rec.get("original_code", "--")
                loc    = rec.get("location", "--") or "--"
                month  = rec.get("event_month", "--")
                page   = rec.get("source_page", "--")
                conf   = rec.get("confidence", 0.0)
                reason = rec.get("error_reason", "Unknown")
                status = rec.get("verification_status", "failed")

                if status == "failed" and "duplicate" in reason.lower():
                    fix = "Review source PDF for duplicate event codes in the same month."
                elif status == "unmatched":
                    fix = f"Create a CRM Event with code '{norm}' or map it manually."
                elif not norm:
                    fix = "Review PDF row -- event code is empty or unparseable."
                else:
                    fix = "Manual mapping required."

                lines += [
                    "---",
                    "",
                    f"**PDF:** 2025.pdf  ",
                    f"**Page:** {page}  ",
                    f"**Month:** {month}  ",
                    f"**Original Code:** `{orig}`  ",
                    f"**Normalized Code:** `{norm}`  ",
                    f"**Location:** {loc}  ",
                    f"**Status:** {status.upper()}  ",
                    f"**Reason:** {reason}  ",
                    f"**Suggested Fix:** {fix}  ",
                    f"**Confidence:** {conf:.0%}  ",
                    "",
                ]

        path.write_text("\n".join(lines), encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"  Error report   -> {path}"))

    def _write_success_report(self, summary: dict) -> None:
        path = self._docs_dir() / "HISTORICAL_2025_IMPORT_SUCCESS.md"
        now  = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
        lines = [
            "# Historical 2025 Import -- Success Report",
            "",
            f"Generated: {now}",
            "Source PDF: 2025.pdf",
            f"Total verified: {len(summary['successes'])}",
            "",
            "| Normalized Code | Original Code | Month | Location | CRM Event | Confidence |",
            "|-----------------|---------------|-------|----------|-----------|------------|",
        ]

        for rec in summary["successes"]:
            norm    = rec.get("normalized_code", "--")
            orig    = rec.get("original_code", "--")
            month   = rec.get("event_month", "--")
            loc     = rec.get("location", "--") or "--"
            conf    = rec.get("confidence", 0.0)
            event   = rec.get("matched_event")
            crm_lbl = event.event_code if event else "Unlinked"
            lines.append(f"| `{norm}` | `{orig}` | {month} | {loc} | {crm_lbl} | {conf:.0%} |")

        lines += ["", "---", "", "## Timeline", ""]
        months_seen: dict = {}
        for rec in summary["successes"]:
            months_seen.setdefault(rec.get("event_month", "Unknown"), []).append(rec)

        for month in ["January","February","March","April","May","June",
                      "July","August","September","October","November","December"]:
            if month not in months_seen:
                continue
            lines.append(f"### {month} 2025")
            for rec in months_seen[month]:
                norm = rec.get("normalized_code", "--")
                orig = rec.get("original_code", "--")
                loc  = rec.get("location", "--") or "--"
                lines.append(f"- **{norm}** (raw: `{orig}`) -> {loc}")
            lines.append("")

        path.write_text("\n".join(lines), encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"  Success report -> {path}"))
