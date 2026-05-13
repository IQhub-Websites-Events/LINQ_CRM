from django.contrib import admin
from .models import HistoricalEventReference


@admin.register(HistoricalEventReference)
class HistoricalEventReferenceAdmin(admin.ModelAdmin):
    list_display = [
        "normalized_event_code", "event_year", "event_month",
        "event_location", "verification_status", "matched_confidence", "source_pdf",
    ]
    list_filter = ["event_year", "event_month", "verification_status", "source_pdf"]
    search_fields = ["normalized_event_code", "original_event_code", "event_location"]
    readonly_fields = ["created_at", "updated_at"]
