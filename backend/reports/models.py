"""
reports/models.py
──────────────────
GoogleSheetSource  — configures one Google Sheet tab as a CRM data source
ReportDefinition   — named report composed of one or more sheet sources
ReportRow          — normalized, deduplicated row from a synced sheet
ReportSyncLog      — per-run audit log for every import/sync operation
"""
import secrets
from django.conf import settings
from django.db import models
from django.utils import timezone


class GoogleSheetSource(models.Model):
    """Represents a single Google Sheet worksheet configured as a data source."""

    class SheetType(models.TextChoices):
        BOOKINGS   = "bookings",   "Bookings"
        EVENTS     = "events",     "Events"
        DELEGATES  = "delegates",  "Delegates"
        REVENUE    = "revenue",    "Revenue"
        PIPELINE   = "pipeline",   "Pipeline"
        ATTENDANCE = "attendance", "Attendance"
        CUSTOM     = "custom",     "Custom"

    class SyncStatus(models.TextChoices):
        NEVER    = "never",    "Never Synced"
        IDLE     = "idle",     "Idle"
        SYNCING  = "syncing",  "Syncing"
        SUCCESS  = "success",  "Success"
        FAILED   = "failed",   "Failed"
        PARTIAL  = "partial",  "Partial"

    class SyncFrequency(models.TextChoices):
        MANUAL  = "manual",  "Manual Only"
        HOURLY  = "hourly",  "Every Hour"
        DAILY   = "daily",   "Daily"
        WEEKLY  = "weekly",  "Weekly"

    # ── Identity ──────────────────────────────────────────────────────────────
    name             = models.CharField(max_length=200)
    description      = models.TextField(blank=True, default="")
    sheet_id         = models.CharField(
        max_length=200,
        help_text="Google Sheet ID extracted from URL, or the full URL itself",
    )
    sheet_url        = models.URLField(blank=True, default="",
                                       help_text="Full Google Sheets URL (optional, for reference)")
    worksheet_name   = models.CharField(max_length=200, default="Sheet1",
                                        help_text="Exact tab/worksheet name to read")
    sheet_type       = models.CharField(max_length=20, choices=SheetType.choices,
                                        default=SheetType.CUSTOM)

    # ── Control flags ─────────────────────────────────────────────────────────
    is_active        = models.BooleanField(default=True, db_index=True)
    sync_enabled     = models.BooleanField(default=True)
    sync_frequency   = models.CharField(max_length=20, choices=SyncFrequency.choices,
                                        default=SyncFrequency.MANUAL)

    # ── Column & processing configuration (JSON) ──────────────────────────────
    column_mappings       = models.JSONField(
        default=dict, blank=True,
        help_text='Map sheet column headers to CRM field names. e.g. {"Invoice No": "invoice_number"}',
    )
    transformation_config = models.JSONField(
        default=dict, blank=True,
        help_text='Per-column transformation rules. e.g. {"Date": ["date_iso"], "Amount": ["strip_currency"]}',
    )
    filter_config    = models.JSONField(default=dict, blank=True,
                                        help_text="Default filter rules for this source")
    grouping_config  = models.JSONField(default=dict, blank=True,
                                        help_text="Column grouping and aggregation config")
    formula_config   = models.JSONField(default=dict, blank=True,
                                        help_text="Formula definitions reproduced from Google Sheets")

    # ── Sync tracking ─────────────────────────────────────────────────────────
    last_synced_at        = models.DateTimeField(null=True, blank=True)
    last_successful_sync  = models.DateTimeField(null=True, blank=True)
    last_failed_sync      = models.DateTimeField(null=True, blank=True)
    sync_status           = models.CharField(max_length=20, choices=SyncStatus.choices,
                                             default=SyncStatus.NEVER, db_index=True)
    records_count         = models.PositiveIntegerField(default=0)
    last_error            = models.TextField(blank=True, default="")

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="created_sheet_sources",
    )
    created_at  = models.DateTimeField(default=timezone.now)
    updated_at  = models.DateTimeField(auto_now=True)
    notes       = models.TextField(blank=True, default="")

    class Meta:
        db_table = "report_sheet_sources"
        ordering = ["-created_at"]
        verbose_name = "Google Sheet Source"
        verbose_name_plural = "Google Sheet Sources"

    def __str__(self):
        return f"{self.name} ({self.worksheet_name})"

    @staticmethod
    def extract_sheet_id(url_or_id: str) -> str:
        """Parse a Google Sheets URL and return just the spreadsheet ID."""
        if "/" in url_or_id:
            parts = url_or_id.split("/")
            for i, part in enumerate(parts):
                if part == "d" and i + 1 < len(parts):
                    candidate = parts[i + 1]
                    # Remove any query string or hash
                    return candidate.split("?")[0].split("#")[0]
        return url_or_id.strip()


class ReportDefinition(models.Model):
    """A named report composed of one or more GoogleSheetSource records."""

    class ReportType(models.TextChoices):
        TABLE   = "table",   "Table"
        SUMMARY = "summary", "Summary"
        GROUPED = "grouped", "Grouped"
        PIVOT   = "pivot",   "Pivot"

    name         = models.CharField(max_length=200)
    slug         = models.SlugField(unique=True, max_length=200)
    description  = models.TextField(blank=True, default="")
    report_type  = models.CharField(max_length=20, choices=ReportType.choices,
                                    default=ReportType.TABLE)
    sources      = models.ManyToManyField(
        GoogleSheetSource,
        blank=True,
        related_name="report_definitions",
    )

    # Display & calculation configuration
    column_config      = models.JSONField(default=list, blank=True,
                                          help_text="Ordered list of column definitions")
    filter_config      = models.JSONField(default=dict, blank=True)
    grouping_config    = models.JSONField(default=dict, blank=True)
    calculation_config = models.JSONField(default=dict, blank=True)

    is_active   = models.BooleanField(default=True)
    created_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="created_reports",
    )
    created_at  = models.DateTimeField(default=timezone.now)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "report_definitions"
        ordering = ["name"]
        verbose_name = "Report Definition"

    def __str__(self):
        return self.name


class ReportRow(models.Model):
    """One data row imported from a synced Google Sheet."""

    source          = models.ForeignKey(
        GoogleSheetSource,
        on_delete=models.CASCADE,
        related_name="rows",
    )
    row_number      = models.PositiveIntegerField(default=0,
                                                  help_text="Original row index in the sheet (1-based, after header)")
    raw_data        = models.JSONField(default=dict,
                                       help_text="Verbatim column data keyed by sheet header")
    processed_data  = models.JSONField(default=dict,
                                       help_text="After column mapping and transformations applied")
    row_hash        = models.CharField(max_length=64, blank=True, default="",
                                       help_text="SHA-256 of raw_data for change detection")
    is_active       = models.BooleanField(default=True, db_index=True)
    synced_at       = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "report_rows"
        ordering = ["source", "row_number"]
        indexes = [
            models.Index(fields=["source", "is_active"],  name="rr_source_active_idx"),
            models.Index(fields=["source", "row_number"], name="rr_source_row_idx"),
        ]

    def __str__(self):
        return f"Row {self.row_number} — {self.source.name}"


class ReportSyncLog(models.Model):
    """Per-run audit log for every import/sync operation on a GoogleSheetSource."""

    class Status(models.TextChoices):
        RUNNING = "running", "Running"
        SUCCESS = "success", "Success"
        PARTIAL = "partial", "Partial"
        FAILED  = "failed",  "Failed"

    class TriggerSource(models.TextChoices):
        MANUAL    = "manual",    "Manual (Admin)"
        SCHEDULER = "scheduler", "Scheduler"
        API       = "api",       "API"
        SYSTEM    = "system",    "System"

    source             = models.ForeignKey(
        GoogleSheetSource,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="sync_logs",
    )
    status             = models.CharField(max_length=20, choices=Status.choices,
                                          default=Status.RUNNING, db_index=True)
    started_at         = models.DateTimeField(default=timezone.now)
    completed_at       = models.DateTimeField(null=True, blank=True)
    duration_seconds   = models.FloatField(null=True, blank=True)
    records_processed  = models.PositiveIntegerField(default=0)
    records_created    = models.PositiveIntegerField(default=0)
    records_updated    = models.PositiveIntegerField(default=0)
    records_failed     = models.PositiveIntegerField(default=0)
    error_message      = models.TextField(blank=True, default="")
    triggered_by       = models.CharField(max_length=150, blank=True, default="")
    trigger_source     = models.CharField(max_length=20, choices=TriggerSource.choices,
                                          default=TriggerSource.MANUAL)

    class Meta:
        db_table = "report_sync_logs"
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["source", "-started_at"], name="rsl_source_started_idx"),
        ]

    def __str__(self):
        src = self.source.name if self.source_id else "unknown"
        return f"[{self.status}] {src} @ {self.started_at:%Y-%m-%d %H:%M}"
