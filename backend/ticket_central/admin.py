from django.contrib import admin
from .models import Ticket


@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):
    list_display  = [
        "ticket_number", "event_code", "status", "priority",
        "purpose", "organizer",
        "created_by", "created_at",
    ]
    list_filter   = ["status", "priority", "relationship", "event_code"]
    search_fields = ["ticket_number", "external_id", "event_code", "purpose", "organizer", "competitor_event_name"]
    # assignee fields are CharField now (D4) — no raw_id_fields
    readonly_fields = ["created_by", "mr_submitted_by", "dmd_submitted_by",
                       "mr_submitted_at", "dmd_submitted_at", "created_at", "updated_at"]
