from django.db import models


class HistoricalEventReference(models.Model):
    class VerificationStatus(models.TextChoices):
        PENDING   = "pending",   "Pending"
        VERIFIED  = "verified",  "Verified"
        FAILED    = "failed",    "Failed"
        UNMATCHED = "unmatched", "Unmatched"

    event = models.ForeignKey(
        "events.Event", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="historical_references"
    )
    original_event_code   = models.CharField(max_length=50)
    normalized_event_code = models.CharField(max_length=50, db_index=True)
    event_year   = models.PositiveIntegerField(db_index=True)
    event_month  = models.CharField(max_length=20)
    event_location = models.CharField(max_length=255, blank=True, default="")
    source_pdf   = models.CharField(max_length=255, default="2023.pdf")
    source_page  = models.PositiveIntegerField(default=1)
    raw_row_data = models.JSONField(default=dict)
    verification_status = models.CharField(
        max_length=20,
        choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
        db_index=True,
    )
    matched_confidence = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "historical_event_references"
        ordering = ["event_year", "event_month", "normalized_event_code"]
        unique_together = [("normalized_event_code", "event_year", "event_month")]


class EventEditionMetrics(models.Model):
    """
    Cached YoY growth metrics per event per year.
    Populated by the calculate_edition_growth management command.
    Acts as a pre-computed cache; live data is always available via growth_service.py.
    """

    event = models.ForeignKey(
        "events.Event",
        on_delete=models.CASCADE,
        related_name="edition_metrics",
    )
    event_year  = models.PositiveIntegerField(db_index=True)
    event_code  = models.CharField(max_length=50, db_index=True)
    location    = models.CharField(max_length=255, blank=True, default="")

    # Booking ownership window
    edition_start_date = models.DateField(null=True, blank=True)
    edition_end_date   = models.DateField(null=True, blank=True)

    # Aggregated booking metrics
    total_sales     = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_bookings  = models.PositiveIntegerField(default=0)
    total_paid      = models.PositiveIntegerField(default=0)
    total_unpaid    = models.PositiveIntegerField(default=0)
    total_delegates = models.PositiveIntegerField(default=0)

    # YoY comparisons
    previous_year_sales     = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    growth_pct              = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    booking_growth_pct      = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    delegate_growth_pct     = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)

    computed_at = models.DateTimeField(auto_now=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "event_edition_metrics"
        ordering = ["event_code", "event_year"]
        unique_together = [("event", "event_year")]
        indexes = [
            models.Index(fields=["event_code", "event_year"]),
        ]

    def __str__(self):
        return f"{self.event_code} {self.event_year}"
