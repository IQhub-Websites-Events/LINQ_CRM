"""
reports/services/importer.py
─────────────────────────────
GoogleSheetReportImporter: full-lifecycle row import pipeline.

Pipeline steps per sync run:
1. Fetch all rows from Google Sheet via connector
2. Parse headers from row 0
3. Build raw_data dict per row (keyed by header)
4. Apply column_mappings  → processed_data
5. Apply transformation_config → transformed values
6. Hash raw_data for change detection
7. Upsert ReportRow records inside a transaction
8. Soft-delete rows no longer present in the sheet
9. Update GoogleSheetSource counters
10. Write a completed ReportSyncLog
"""
import hashlib
import json
import logging
import re
import time
import traceback

from django.db import transaction
from django.utils import timezone

from reports.models import GoogleSheetSource, ReportRow, ReportSyncLog
from .connector import GoogleSheetsConnector, ConnectorError

logger = logging.getLogger(__name__)


class GoogleSheetReportImporter:
    """
    Import one GoogleSheetSource.

    Usage:
        connector = GoogleSheetsConnector()
        importer  = GoogleSheetReportImporter(source, connector)
        log       = importer.run(triggered_by="admin", trigger_source="manual")
    """

    def __init__(self, source: GoogleSheetSource, connector: GoogleSheetsConnector | None = None):
        self.source    = source
        self.connector = connector or GoogleSheetsConnector()

    # ── Public ─────────────────────────────────────────────────────────────────

    def run(
        self,
        triggered_by: str = "",
        trigger_source: str = ReportSyncLog.TriggerSource.MANUAL,
    ) -> ReportSyncLog:
        """Execute the full import pipeline. Always returns a completed log."""
        log = ReportSyncLog.objects.create(
            source=self.source,
            status=ReportSyncLog.Status.RUNNING,
            triggered_by=triggered_by,
            trigger_source=trigger_source,
        )
        start = time.monotonic()

        # Mark source as syncing
        self.source.sync_status = GoogleSheetSource.SyncStatus.SYNCING
        self.source.save(update_fields=["sync_status"])

        try:
            rows = self.connector.read_worksheet(
                sheet_id=GoogleSheetSource.extract_sheet_id(
                    self.source.sheet_url or self.source.sheet_id
                ),
                worksheet_name=self.source.worksheet_name,
            )

            if not rows:
                self._finish_success(log, start, 0, 0, 0, 0)
                return log

            headers   = [str(h).strip() for h in rows[0]]
            data_rows = rows[1:]

            created = updated = unchanged = failed = 0

            with transaction.atomic():
                # Soft-delete all existing rows; we re-activate matched ones below
                ReportRow.objects.filter(source=self.source, is_active=True).update(is_active=False)

                for i, row in enumerate(data_rows):
                    if not any(row):   # skip completely empty rows
                        continue
                    try:
                        raw  = self._build_raw(headers, row)
                        proc = self._apply_mappings_and_transforms(raw)
                        h    = self._hash_row(raw)

                        existing = ReportRow.objects.filter(
                            source=self.source, row_number=i + 2
                        ).first()

                        if existing:
                            existing.is_active = True
                            if existing.row_hash != h:
                                existing.raw_data       = raw
                                existing.processed_data = proc
                                existing.row_hash       = h
                                existing.synced_at      = timezone.now()
                                existing.save()
                                updated += 1
                            else:
                                existing.save(update_fields=["is_active"])
                                unchanged += 1
                        else:
                            ReportRow.objects.create(
                                source         = self.source,
                                row_number     = i + 2,
                                raw_data       = raw,
                                processed_data = proc,
                                row_hash       = h,
                                is_active      = True,
                            )
                            created += 1

                    except Exception as exc:
                        failed += 1
                        logger.warning("Row %d import failed for source %s: %s", i + 2, self.source.name, exc)

                total_active = ReportRow.objects.filter(source=self.source, is_active=True).count()

            self.source.records_count        = total_active
            self.source.last_synced_at       = timezone.now()
            self.source.last_successful_sync = timezone.now()
            self.source.last_error           = ""
            self.source.sync_status = (
                GoogleSheetSource.SyncStatus.PARTIAL
                if failed > 0
                else GoogleSheetSource.SyncStatus.SUCCESS
            )
            self.source.save(update_fields=[
                "records_count", "last_synced_at", "last_successful_sync",
                "last_error", "sync_status",
            ])

            self._finish_success(log, start, len(data_rows), created, updated, failed)

        except (ConnectorError, Exception) as exc:
            trace = traceback.format_exc()
            logger.error("Import failed for source '%s': %s", self.source.name, exc, exc_info=True)

            duration = round(time.monotonic() - start, 2)
            log.status           = ReportSyncLog.Status.FAILED
            log.completed_at     = timezone.now()
            log.duration_seconds = duration
            log.error_message    = f"{exc}\n\n{trace}"
            log.save()

            self.source.sync_status      = GoogleSheetSource.SyncStatus.FAILED
            self.source.last_failed_sync = timezone.now()
            self.source.last_error       = str(exc)
            self.source.save(update_fields=["sync_status", "last_failed_sync", "last_error"])

        return log

    # ── Private helpers ────────────────────────────────────────────────────────

    def _build_raw(self, headers: list[str], row: list) -> dict:
        """Build {header: value} dict. Pads short rows with empty strings."""
        return {headers[j]: (str(row[j]) if j < len(row) else "") for j in range(len(headers))}

    def _apply_mappings_and_transforms(self, raw: dict) -> dict:
        """Apply column_mappings then transformation_config to produce processed_data."""
        mappings        = self.source.column_mappings or {}
        transforms_cfg  = self.source.transformation_config or {}
        result = {}

        for sheet_col, value in raw.items():
            crm_field = mappings.get(sheet_col, sheet_col)   # default: keep original name
            transforms = transforms_cfg.get(sheet_col, [])
            result[crm_field] = self._transform(value, transforms)

        return result

    def _transform(self, value: str, transforms: list[str]) -> str:
        """Apply a sequence of named transformation rules to a string value."""
        for t in transforms:
            try:
                if t == "trim":
                    value = str(value).strip()
                elif t == "upper":
                    value = str(value).upper()
                elif t == "lower":
                    value = str(value).lower()
                elif t == "title":
                    value = str(value).title()
                elif t == "strip_currency":
                    value = re.sub(r"[£$€,\s]", "", str(value)).strip()
                elif t == "strip_html":
                    value = re.sub(r"<[^>]+>", "", str(value)).strip()
                elif t == "date_iso":
                    from dateutil import parser as dp
                    value = dp.parse(str(value)).date().isoformat()
                elif t == "to_int":
                    value = str(int(float(str(value).replace(",", "")))) if value else ""
                elif t == "to_float":
                    value = str(round(float(str(value).replace(",", "")), 2)) if value else ""
                elif t == "bool_yes_no":
                    value = "true" if str(value).strip().lower() in ("yes", "true", "1", "y") else "false"
            except Exception:
                pass  # leave value unchanged on transformation error
        return value

    @staticmethod
    def _hash_row(raw: dict) -> str:
        return hashlib.sha256(json.dumps(raw, sort_keys=True).encode()).hexdigest()

    def _finish_success(
        self,
        log: ReportSyncLog,
        start: float,
        processed: int,
        created: int,
        updated: int,
        failed: int,
    ):
        duration = round(time.monotonic() - start, 2)
        log.status            = (
            ReportSyncLog.Status.PARTIAL
            if failed > 0
            else ReportSyncLog.Status.SUCCESS
        )
        log.completed_at      = timezone.now()
        log.duration_seconds  = duration
        log.records_processed = processed
        log.records_created   = created
        log.records_updated   = updated
        log.records_failed    = failed
        log.save()

        logger.info(
            "Import complete: source='%s' status=%s processed=%d "
            "created=%d updated=%d failed=%d duration=%.2fs",
            self.source.name, log.status, processed, created, updated, failed, duration,
        )
