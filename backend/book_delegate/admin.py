from django.contrib import admin
from .models import BookDelegate

@admin.register(BookDelegate)
class BookDelegateAdmin(admin.ModelAdmin):
    list_display    = ["full_name", "email", "company_display", "event_code", "attendance"]
    list_filter     = ["attendance", "event_code"]
    search_fields   = ["first_name", "last_name", "email", "invoice__invoice_number"]
    raw_id_fields   = ["company"]
    readonly_fields = ["created_at", "updated_at"]
