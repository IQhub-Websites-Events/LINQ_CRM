from django.conf import settings
from django.db import models
from django.utils import timezone


class FollowUpRecord(models.Model):
    class Status(models.TextChoices):
        PENDING   = "pending",   "Pending"
        CALLED    = "called",    "Called"
        EMAILED   = "emailed",   "Emailed"
        VOICEMAIL = "voicemail", "Voicemail"
        CONVERTED = "converted", "Converted"
        NO_ANSWER = "no_answer", "No Answer"

    event_code    = models.CharField(max_length=50, db_index=True)
    contact_name  = models.CharField(max_length=255, blank=True, default="")
    company       = models.CharField(max_length=255, blank=True, default="")
    email         = models.EmailField(blank=True, default="")
    phone         = models.CharField(max_length=50, blank=True, default="")
    follow_up_date = models.DateField(default=timezone.now)
    status        = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING, db_index=True)
    notes         = models.TextField(blank=True, default="")
    created_by    = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="follow_ups_created"
    )
    created_at    = models.DateTimeField(default=timezone.now)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "ep_follow_ups"
        ordering = ["-follow_up_date"]


class MailshotRecord(models.Model):
    class MailshotType(models.TextChoices):
        INVITE      = "invite",      "Invite"
        REMINDER    = "reminder",    "Reminder"
        THANK_YOU   = "thank_you",   "Thank You"
        FOLLOW_UP   = "follow_up",   "Follow-Up"
        PROMOTIONAL = "promotional", "Promotional"
        OTHER       = "other",       "Other"

    event_code    = models.CharField(max_length=50, db_index=True)
    mailshot_type = models.CharField(max_length=30, choices=MailshotType.choices, default=MailshotType.INVITE)
    subject       = models.CharField(max_length=255, blank=True, default="")
    sent_at       = models.DateField(default=timezone.now)
    target_count  = models.PositiveIntegerField(default=0)
    opened_count  = models.PositiveIntegerField(default=0)
    clicked_count = models.PositiveIntegerField(default=0)
    notes         = models.TextField(blank=True, default="")
    created_by    = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="mailshots_created"
    )
    created_at    = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "ep_mailshots"
        ordering = ["-sent_at"]


class EventPerformanceNote(models.Model):
    event_code = models.CharField(max_length=50, db_index=True)
    note       = models.TextField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name="ep_notes_created"
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = "ep_notes"
        ordering = ["-created_at"]
