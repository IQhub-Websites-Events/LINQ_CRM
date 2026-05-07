"""
events/models.py
────────────────
Master event catalogue.
"""
from django.db import models
from django.utils import timezone


class Event(models.Model):
    class Status(models.TextChoices):
        DRAFT     = "Draft",     "Draft"
        UPCOMING  = "Upcoming",  "Upcoming"
        LIVE      = "Live",      "Live"
        COMPLETED = "Completed", "Completed"
        CANCELLED = "Cancelled", "Cancelled"

    class SubCompany(models.TextChoices):
        CONFERENCES = "Linq Conferences", "Linq Conferences"
        TRAINING    = "Linq Training",    "Linq Training"
        SUMMITS     = "Linq Summits",     "Linq Summits"
        LIVE        = "Linq Live",        "Linq Live"

    event_code  = models.CharField(max_length=50, unique=True, db_index=True)
    name        = models.CharField(max_length=255)
    sub_company = models.CharField(max_length=50, choices=SubCompany.choices, default=SubCompany.CONFERENCES)
    city        = models.CharField(max_length=100)
    country     = models.CharField(max_length=100, default="")
    venue       = models.CharField(max_length=255, blank=True, default="")
    event_date  = models.DateField()
    end_date    = models.DateField(null=True, blank=True)
    capacity    = models.PositiveIntegerField(default=500)
    expected_revenue = models.DecimalField(max_digits=14, decimal_places=2, default=0.00)

    # ── New fields from Events.csv ──────────────────────────────────────────
    official_name          = models.CharField(max_length=255, blank=True, default="")
    speaker_sales_team     = models.CharField(max_length=255, blank=True, default="")
    spex_team              = models.CharField(max_length=255, blank=True, default="")
    tele_marketing_team    = models.CharField(max_length=255, blank=True, default="")
    market_research_team   = models.CharField(max_length=255, blank=True, default="")
    content_check          = models.CharField(max_length=255, blank=True, default="")
    marketing_check        = models.CharField(max_length=255, blank=True, default="")
    sales_check            = models.CharField(max_length=255, blank=True, default="")
    accepting_web_bookings = models.BooleanField(default=False)

    sales_executive = models.ForeignKey(
        "accounts.User",
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name="assigned_events_list",
    )

    created_at  = models.DateTimeField(default=timezone.now)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "events"
        ordering = ["-event_date"]
        indexes  = [
            models.Index(fields=["event_code"]),
            models.Index(fields=["event_date"]),
            models.Index(fields=["updated_at"]),
        ]

    def __str__(self):
        return f"{self.event_code} — {self.name}"

    @property
    def event_status(self):
        if not self.event_date:
            return "Live"
        from django.utils import timezone
        return "Completed" if self.event_date < timezone.now().date() else "Live"
