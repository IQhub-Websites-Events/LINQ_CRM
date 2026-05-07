from django.contrib import admin
from .models import BookEvent

@admin.register(BookEvent)
class BookEventAdmin(admin.ModelAdmin):
    list_display    = ["invoice_number", "event_code", "company_name",
                       "currency", "payment_status", "sales_executive", "created_at"]
    list_filter     = ["payment_status", "currency", "event_code"]
    search_fields   = ["invoice_number", "event_code", "company_name", "contact_email"]
    raw_id_fields   = ["sales_executive"]
    readonly_fields = ["created_at", "updated_at"]
    ordering        = ["-created_at"]
