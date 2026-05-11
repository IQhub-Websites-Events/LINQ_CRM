from django.contrib import admin
from django.utils.html import format_html
from .models import GoogleSheetSource, ReportDefinition, ReportRow, ReportSyncLog


@admin.register(GoogleSheetSource)
class GoogleSheetSourceAdmin(admin.ModelAdmin):
    list_display  = [
        "id", "name", "worksheet_name", "sheet_type", "status_badge",
        "records_count", "sync_frequency", "last_synced_at", "is_active", "created_at",
    ]
    list_filter   = ["is_active", "sync_enabled", "sheet_type", "sync_status", "sync_frequency"]
    search_fields = ["name", "worksheet_name", "sheet_id", "sheet_url", "notes"]
    readonly_fields = [
        "sync_status", "records_count", "last_synced_at",
        "last_successful_sync", "last_failed_sync", "last_error",
        "created_by", "created_at", "updated_at",
    ]
    fieldsets = (
        ("Identity", {
            "fields": ("name", "description", "sheet_type", "is_active"),
        }),
        ("Google Sheet Connection", {
            "fields": ("sheet_url", "sheet_id", "worksheet_name"),
        }),
        ("Sync Settings", {
            "fields": ("sync_enabled", "sync_frequency"),
        }),
        ("Configuration (JSON)", {
            "classes": ("collapse",),
            "fields": (
                "column_mappings", "transformation_config",
                "filter_config", "grouping_config", "formula_config",
            ),
        }),
        ("Sync Status (read-only)", {
            "fields": (
                "sync_status", "records_count",
                "last_synced_at", "last_successful_sync",
                "last_failed_sync", "last_error",
            ),
        }),
        ("Audit", {
            "fields": ("notes", "created_by", "created_at", "updated_at"),
        }),
    )
    ordering = ["-created_at"]

    def status_badge(self, obj):
        colours = {
            "never":   "#94a3b8",
            "idle":    "#64748b",
            "syncing": "#d97706",
            "success": "#16a34a",
            "partial": "#ea580c",
            "failed":  "#dc2626",
        }
        colour = colours.get(obj.sync_status, "#64748b")
        return format_html(
            '<span style="color:{};font-weight:600">{}</span>',
            colour, obj.get_sync_status_display(),
        )
    status_badge.short_description = "Sync Status"


@admin.register(ReportDefinition)
class ReportDefinitionAdmin(admin.ModelAdmin):
    list_display  = ["id", "name", "slug", "report_type", "is_active", "created_at"]
    list_filter   = ["is_active", "report_type"]
    search_fields = ["name", "slug", "description"]
    filter_horizontal = ["sources"]
    readonly_fields = ["created_by", "created_at", "updated_at"]


@admin.register(ReportRow)
class ReportRowAdmin(admin.ModelAdmin):
    list_display  = ["id", "source", "row_number", "is_active", "synced_at"]
    list_filter   = ["source", "is_active"]
    search_fields = ["source__name"]
    readonly_fields = ["source", "row_number", "raw_data", "processed_data", "row_hash", "synced_at"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(ReportSyncLog)
class ReportSyncLogAdmin(admin.ModelAdmin):
    list_display  = [
        "id", "source", "status_badge", "started_at",
        "duration_seconds", "records_processed", "records_created",
        "records_updated", "records_failed", "triggered_by",
    ]
    list_filter   = ["status", "trigger_source", "source"]
    search_fields = ["source__name", "triggered_by", "error_message"]
    readonly_fields = [
        "source", "status", "started_at", "completed_at", "duration_seconds",
        "records_processed", "records_created", "records_updated", "records_failed",
        "error_message", "triggered_by", "trigger_source",
    ]
    ordering = ["-started_at"]

    def status_badge(self, obj):
        colours = {
            "running": "#d97706",
            "success": "#16a34a",
            "partial": "#ea580c",
            "failed":  "#dc2626",
        }
        colour = colours.get(obj.status, "#64748b")
        return format_html(
            '<span style="color:{};font-weight:600">{}</span>',
            colour, obj.get_status_display(),
        )
    status_badge.short_description = "Status"

    def has_add_permission(self, request):
        return False
