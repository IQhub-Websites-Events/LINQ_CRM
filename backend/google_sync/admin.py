from django.contrib import admin
from django.utils.html import format_html
from .models import GoogleSheetSyncLog


@admin.register(GoogleSheetSyncLog)
class GoogleSheetSyncLogAdmin(admin.ModelAdmin):
    list_display  = [
        "id", "sync_type", "status_badge", "sync_mode",
        "sheet_name", "duration_seconds", "records_processed",
        "trigger_source", "triggered_by", "started_at",
    ]
    list_filter   = ["status", "sync_type", "sync_mode", "trigger_source"]
    search_fields = ["triggered_by", "sheet_name", "error_message"]
    readonly_fields = [
        "sync_type", "sheet_name", "status", "sync_mode",
        "started_at", "completed_at", "duration_seconds",
        "records_processed", "records_created", "records_updated", "records_failed",
        "triggered_by", "trigger_source",
        "error_message", "sync_summary",
        "last_synced_record_id", "last_synced_at", "created_at",
    ]
    ordering = ["-started_at"]

    STATUS_COLOURS = {
        "pending":        "#94a3b8",
        "running":        "#d97706",
        "success":        "#16a34a",
        "failed":         "#dc2626",
        "partial_success": "#ea580c",
    }

    def status_badge(self, obj):
        colour = self.STATUS_COLOURS.get(obj.status, "#64748b")
        return format_html(
            '<span style="color:{};font-weight:600">{}</span>',
            colour, obj.get_status_display(),
        )
    status_badge.short_description = "Status"

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser
