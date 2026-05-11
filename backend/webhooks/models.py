"""
webhooks/models.py
───────────────────
WebhookApiKey  — per-integration API keys with usage tracking
WebhookLog     — full lifecycle audit log for every inbound request
"""
import secrets
from django.conf import settings
from django.db import models
from django.utils import timezone


class WebhookApiKey(models.Model):
    """Per-integration API key stored in the database."""

    name            = models.CharField(max_length=100)
    api_key         = models.CharField(max_length=80, unique=True, db_index=True)
    event           = models.CharField(max_length=50, blank=True, default="",
                                       help_text="Optional: restrict to this event code")
    is_active       = models.BooleanField(default=True, db_index=True)
    allowed_domains = models.JSONField(default=list, blank=True,
                                       help_text="List of allowed origin domains; empty = unrestricted")
    notes           = models.TextField(blank=True, default="")

    created_by  = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="created_webhook_keys",
    )
    created_at   = models.DateTimeField(default=timezone.now)
    last_used_at = models.DateTimeField(null=True, blank=True)
    usage_count  = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "webhook_api_keys"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.name} ({'active' if self.is_active else 'inactive'})"

    @staticmethod
    def generate_key() -> str:
        return "crm_live_" + secrets.token_urlsafe(36)

    def record_usage(self):
        self.last_used_at = timezone.now()
        self.usage_count  += 1
        self.save(update_fields=["last_used_at", "usage_count"])

    def regenerate(self) -> str:
        self.api_key = WebhookApiKey.generate_key()
        self.save(update_fields=["api_key"])
        return self.api_key


class WebhookLog(models.Model):
    """Full lifecycle audit record for a single inbound webhook request."""

    class Status(models.TextChoices):
        RECEIVED   = "received",   "Received"
        PROCESSING = "processing", "Processing"
        SUCCESS    = "success",    "Success"
        FAILED     = "failed",     "Failed"
        DUPLICATE  = "duplicate",  "Duplicate"

    class ProcessingStatus(models.TextChoices):
        PENDING   = "pending",   "Pending"
        PROCESSED = "processed", "Processed"
        ERROR     = "error",     "Error"

    class DbInsertStatus(models.TextChoices):
        INSERTED  = "inserted",  "Inserted"
        UPDATED   = "updated",   "Updated"
        DUPLICATE = "duplicate", "Duplicate"
        FAILED    = "failed",    "Failed"
        PARTIAL   = "partial",   "Partial"

    # ── Auth ──────────────────────────────────────────────────────────────────
    api_key = models.ForeignKey(
        WebhookApiKey,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="logs",
    )

    # ── Request metadata ──────────────────────────────────────────────────────
    source         = models.CharField(max_length=100, blank=True, default="")
    ip_address     = models.GenericIPAddressField(null=True, blank=True)
    request_method = models.CharField(max_length=10, default="POST")

    # ── Payload ───────────────────────────────────────────────────────────────
    payload  = models.JSONField(default=dict)
    headers  = models.JSONField(default=dict)
    response = models.JSONField(default=dict)

    # ── Outcome ───────────────────────────────────────────────────────────────
    status      = models.CharField(max_length=20, choices=Status.choices, default=Status.RECEIVED, db_index=True)
    http_status = models.PositiveIntegerField(default=202)

    # ── Booking identifiers (denormalised for fast filtering) ─────────────────
    invoice_number = models.CharField(max_length=100, blank=True, default="", db_index=True)
    event_code     = models.CharField(max_length=50, blank=True, default="")
    event_name     = models.CharField(max_length=255, blank=True, default="")

    # ── Error detail ──────────────────────────────────────────────────────────
    error_message = models.TextField(blank=True, default="")
    stack_trace   = models.TextField(blank=True, default="")

    # ── Retry tracking ────────────────────────────────────────────────────────
    retry_count = models.PositiveIntegerField(default=0)

    # ── Processing state ──────────────────────────────────────────────────────
    processing_status = models.CharField(
        max_length=20, choices=ProcessingStatus.choices,
        default=ProcessingStatus.PENDING, db_index=True,
    )
    processing_notes = models.TextField(blank=True, default="")

    # ── DB operation outcome ──────────────────────────────────────────────────
    db_insert_status = models.CharField(
        max_length=20, choices=DbInsertStatus.choices, blank=True, default="",
    )
    records_inserted = models.PositiveIntegerField(default=0)
    records_updated  = models.PositiveIntegerField(default=0)
    records_failed   = models.PositiveIntegerField(default=0)

    # ── Timing ────────────────────────────────────────────────────────────────
    received_at           = models.DateTimeField(null=True, blank=True)
    processing_started_at = models.DateTimeField(null=True, blank=True)
    processed_at          = models.DateTimeField(null=True, blank=True)
    processing_duration   = models.FloatField(null=True, blank=True)

    # ── Booking link ──────────────────────────────────────────────────────────
    created_booking = models.ForeignKey(
        "book_event.BookEvent",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="webhook_logs",
    )
    created_delegates_count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "webhook_events"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"],            name="wh_ev_status_idx"),
            models.Index(fields=["processing_status"], name="wh_ev_proc_idx"),
            models.Index(fields=["created_at"],        name="wh_ev_created_idx"),
            models.Index(fields=["invoice_number"],    name="wh_ev_invoice_idx"),
        ]

    def __str__(self):
        return f"[{self.status}] {self.invoice_number or '—'} @ {self.created_at:%Y-%m-%d %H:%M}"
