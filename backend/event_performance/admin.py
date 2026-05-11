from django.contrib import admin
from .models import FollowUpRecord, MailshotRecord, EventPerformanceNote


@admin.register(FollowUpRecord)
class FollowUpAdmin(admin.ModelAdmin):
    list_display  = ["event_code", "contact_name", "company", "follow_up_date", "status", "created_by", "created_at"]
    list_filter   = ["status", "follow_up_date"]
    search_fields = ["event_code", "contact_name", "company", "email"]
    ordering      = ["-follow_up_date"]


@admin.register(MailshotRecord)
class MailshotAdmin(admin.ModelAdmin):
    list_display  = ["event_code", "mailshot_type", "subject", "sent_at", "target_count", "opened_count", "created_by"]
    list_filter   = ["mailshot_type", "sent_at"]
    search_fields = ["event_code", "subject"]
    ordering      = ["-sent_at"]


@admin.register(EventPerformanceNote)
class EventPerformanceNoteAdmin(admin.ModelAdmin):
    list_display  = ["event_code", "note", "created_by", "created_at"]
    search_fields = ["event_code", "note"]
    ordering      = ["-created_at"]
