from django.contrib import admin
from .models import Event

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display  = ["event_code", "name", "city", "event_date", "event_status"]
    search_fields = ["event_code", "name", "city"]
    ordering      = ["-event_date"]
