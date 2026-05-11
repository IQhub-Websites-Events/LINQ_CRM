from django.contrib import admin
from django.utils.html import format_html
from .models import WebhookApiKey, WebhookLog


@admin.register(WebhookApiKey)
class WebhookApiKeyAdmin(admin.ModelAdmin):
    list_display  = [
        "id", "name", "event", "key_preview", "active_badge",
        "usage_count", "last_used_at", "created_by", "created_at",
    ]
    list_filter   = ["is_active", "event"]
    search_fields = ["name", "event", "notes"]
    readonly_fields = ["api_key", "created_at", "last_used_at", "usage_count", "created_by"]
    ordering = ["-created_at"]

    def key_preview(self, obj):
        k = obj.api_key or ""
        preview = (k[:10] + "…" + k[-4:]) if len(k) > 12 else k
        return format_html('<code style="font-size:11px">{}</code>', preview)
    key_preview.short_description = "API Key"

    def active_badge(self, obj):
        colour = "#16a34a" if obj.is_active else "#dc2626"
        label  = "Active"  if obj.is_active else "Disabled"
        return format_html('<span style="color:{};font-weight:600">{}</span>', colour, label)
    active_badge.short_description = "Status"

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


@admin.register(WebhookLog)
class WebhookLogAdmin(admin.ModelAdmin):
    list_display  = [
        "id", "status_badge", "processing_status", "db_insert_status",
        "invoice_number", "event_code", "source", "ip_address",
        "retry_count", "created_delegates_count", "processing_duration", "created_at",
    ]
    list_filter   = ["status", "processing_status", "db_insert_status", "event_code"]
    search_fields = ["invoice_number", "event_code", "source", "ip_address", "error_message"]
    readonly_fields = [
        "api_key", "source", "ip_address", "request_method",
        "payload", "headers", "response",
        "status", "http_status", "invoice_number", "event_code", "event_name",
        "error_message", "stack_trace", "processing_notes",
        "retry_count", "processing_status", "processed_at",
        "created_booking", "created_delegates_count",
        "db_insert_status", "records_inserted", "records_updated", "records_failed",
        "received_at", "processing_started_at", "processing_duration",
        "created_at",
    ]
    ordering = ["-created_at"]

    def status_badge(self, obj):
        colours = {
            "received":   "#64748b",
            "processing": "#d97706",
            "success":    "#16a34a",
            "failed":     "#dc2626",
            "duplicate":  "#7c3aed",
        }
        colour = colours.get(obj.status, "#64748b")
        return format_html(
            '<span style="color:{};font-weight:600">{}</span>',
            colour, obj.get_status_display(),
        )
    status_badge.short_description = "Status"

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser
