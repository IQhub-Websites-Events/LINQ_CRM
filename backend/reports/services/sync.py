"""
reports/services/sync.py
──────────────────────────
ReportSyncOrchestrator: coordinate sync across one or all sheet sources.

Designed to support 40–50 sheets:
- Reuses a single GoogleSheetsConnector instance per batch (avoids re-auth overhead)
- Runs sources sequentially to respect Google API rate limits
- Each source gets its own ReportSyncLog
- Fully independent of the existing google_sync app
"""
import logging

from reports.models import GoogleSheetSource, ReportSyncLog
from .connector import GoogleSheetsConnector, ConnectorError
from .importer import GoogleSheetReportImporter

logger = logging.getLogger(__name__)


class ReportSyncOrchestrator:

    # ── Public entry points ────────────────────────────────────────────────────

    @classmethod
    def sync_source(
        cls,
        source: GoogleSheetSource,
        triggered_by: str = "",
        trigger_source: str = ReportSyncLog.TriggerSource.MANUAL,
    ) -> ReportSyncLog:
        """Sync a single source. Returns the completed ReportSyncLog."""
        try:
            connector = GoogleSheetsConnector()
        except ConnectorError as exc:
            logger.error("Cannot initialise connector for source '%s': %s", source.name, exc)
            return cls._fail_log(source, str(exc), triggered_by, trigger_source)

        importer = GoogleSheetReportImporter(source, connector)
        return importer.run(triggered_by=triggered_by, trigger_source=trigger_source)

    @classmethod
    def sync_all(
        cls,
        triggered_by: str = "",
        trigger_source: str = ReportSyncLog.TriggerSource.MANUAL,
    ) -> list[ReportSyncLog]:
        """
        Sync all active, sync-enabled sources in creation order.
        One connector instance is shared across all sources to minimise auth overhead.
        Returns list of completed ReportSyncLog objects.
        """
        sources = GoogleSheetSource.objects.filter(is_active=True, sync_enabled=True).order_by("created_at")
        if not sources.exists():
            logger.info("ReportSyncOrchestrator.sync_all: no active sources to sync")
            return []

        try:
            connector = GoogleSheetsConnector()
        except ConnectorError as exc:
            logger.error("Cannot initialise connector for sync_all: %s", exc)
            return [
                cls._fail_log(src, str(exc), triggered_by, trigger_source)
                for src in sources
            ]

        logs = []
        for source in sources:
            logger.info("Syncing source: %s", source.name)
            importer = GoogleSheetReportImporter(source, connector)
            log = importer.run(triggered_by=triggered_by, trigger_source=trigger_source)
            logs.append(log)

        success = sum(1 for l in logs if l.status == ReportSyncLog.Status.SUCCESS)
        failed  = sum(1 for l in logs if l.status == ReportSyncLog.Status.FAILED)
        logger.info(
            "sync_all complete: %d synced, %d succeeded, %d failed",
            len(logs), success, failed,
        )
        return logs

    @classmethod
    def detect_columns(cls, source: GoogleSheetSource) -> dict:
        """
        Detect column headers and row count from a source's Google Sheet.
        Returns {"columns": [...], "sample_count": int} or {"error": str}.
        """
        try:
            connector = GoogleSheetsConnector()
            rows = connector.read_worksheet(
                sheet_id=GoogleSheetSource.extract_sheet_id(
                    source.sheet_url or source.sheet_id
                ),
                worksheet_name=source.worksheet_name,
            )
        except ConnectorError as exc:
            return {"error": str(exc)}

        if not rows:
            return {"columns": [], "sample_count": 0}

        headers = [str(h).strip() for h in rows[0]]
        return {
            "columns":      headers,
            "sample_count": max(0, len(rows) - 1),
        }

    @classmethod
    def list_worksheets(cls, sheet_id_or_url: str) -> dict:
        """
        Return the worksheet/tab names for a given spreadsheet.
        Returns {"worksheets": [...]} or {"error": str}.
        """
        try:
            connector = GoogleSheetsConnector()
            sheet_id  = GoogleSheetSource.extract_sheet_id(sheet_id_or_url)
            worksheets = connector.list_worksheets(sheet_id)
            return {"worksheets": worksheets}
        except ConnectorError as exc:
            return {"error": str(exc)}

    # ── Internal ───────────────────────────────────────────────────────────────

    @staticmethod
    def _fail_log(
        source: GoogleSheetSource,
        error: str,
        triggered_by: str,
        trigger_source: str,
    ) -> ReportSyncLog:
        from django.utils import timezone

        source.sync_status      = GoogleSheetSource.SyncStatus.FAILED
        source.last_failed_sync = timezone.now()
        source.last_error       = error
        source.save(update_fields=["sync_status", "last_failed_sync", "last_error"])

        return ReportSyncLog.objects.create(
            source         = source,
            status         = ReportSyncLog.Status.FAILED,
            completed_at   = timezone.now(),
            error_message  = error,
            triggered_by   = triggered_by,
            trigger_source = trigger_source,
        )
