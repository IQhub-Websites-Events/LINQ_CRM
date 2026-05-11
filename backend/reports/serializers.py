"""
reports/serializers.py
"""
from rest_framework import serializers
from .models import GoogleSheetSource, ReportDefinition, ReportRow, ReportSyncLog


# ── Google Sheet Source ────────────────────────────────────────────────────────

class GoogleSheetSourceSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    status_display  = serializers.SerializerMethodField()
    last_sync_log   = serializers.SerializerMethodField()

    class Meta:
        model  = GoogleSheetSource
        fields = [
            "id", "name", "description",
            "sheet_id", "sheet_url", "worksheet_name", "sheet_type",
            "is_active", "sync_enabled", "sync_frequency",
            "column_mappings", "transformation_config",
            "filter_config", "grouping_config", "formula_config",
            "last_synced_at", "last_successful_sync", "last_failed_sync",
            "sync_status", "status_display", "records_count", "last_error",
            "created_by", "created_by_name",
            "created_at", "updated_at", "notes",
            "last_sync_log",
        ]
        read_only_fields = [
            "id", "sync_status", "records_count", "last_error",
            "last_synced_at", "last_successful_sync", "last_failed_sync",
            "created_at", "updated_at",
        ]

    def get_created_by_name(self, obj):
        return obj.created_by.username if obj.created_by_id else None

    def get_status_display(self, obj):
        return obj.get_sync_status_display()

    def get_last_sync_log(self, obj):
        log = obj.sync_logs.order_by("-started_at").first()
        if not log:
            return None
        return {
            "id":                log.id,
            "status":            log.status,
            "started_at":        log.started_at,
            "duration_seconds":  log.duration_seconds,
            "records_processed": log.records_processed,
            "records_created":   log.records_created,
            "records_updated":   log.records_updated,
            "records_failed":    log.records_failed,
            "error_message":     log.error_message,
        }

    def create(self, validated_data):
        # Auto-extract sheet ID from URL if a URL was provided
        sheet_url = validated_data.get("sheet_url", "")
        if sheet_url and not validated_data.get("sheet_id"):
            validated_data["sheet_id"] = GoogleSheetSource.extract_sheet_id(sheet_url)
        elif validated_data.get("sheet_id"):
            validated_data["sheet_id"] = GoogleSheetSource.extract_sheet_id(
                validated_data["sheet_id"]
            )
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)

    def update(self, instance, validated_data):
        # Re-extract if sheet_id or sheet_url is being changed
        if "sheet_id" in validated_data:
            validated_data["sheet_id"] = GoogleSheetSource.extract_sheet_id(
                validated_data["sheet_id"]
            )
        if "sheet_url" in validated_data and not validated_data.get("sheet_id"):
            validated_data["sheet_id"] = GoogleSheetSource.extract_sheet_id(
                validated_data["sheet_url"]
            )
        return super().update(instance, validated_data)


class GoogleSheetSourceListSerializer(serializers.ModelSerializer):
    """Lightweight list serializer — omits large JSON config fields."""
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = GoogleSheetSource
        fields = [
            "id", "name", "sheet_type", "worksheet_name",
            "is_active", "sync_enabled", "sync_frequency",
            "sync_status", "records_count",
            "last_synced_at", "last_error",
            "created_by_name", "created_at",
        ]

    def get_created_by_name(self, obj):
        return obj.created_by.username if obj.created_by_id else None


# ── Report Definition ─────────────────────────────────────────────────────────

class ReportDefinitionSerializer(serializers.ModelSerializer):
    source_names    = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = ReportDefinition
        fields = [
            "id", "name", "slug", "description", "report_type",
            "sources", "source_names",
            "column_config", "filter_config", "grouping_config", "calculation_config",
            "is_active", "created_by", "created_by_name", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_source_names(self, obj):
        return list(obj.sources.values_list("name", flat=True))

    def get_created_by_name(self, obj):
        return obj.created_by.username if obj.created_by_id else None

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


# ── Report Row ────────────────────────────────────────────────────────────────

class ReportRowSerializer(serializers.ModelSerializer):
    source_name = serializers.SerializerMethodField()

    class Meta:
        model  = ReportRow
        fields = [
            "id", "source", "source_name",
            "row_number", "raw_data", "processed_data",
            "is_active", "synced_at",
        ]

    def get_source_name(self, obj):
        return obj.source.name if obj.source_id else None


class ReportRowListSerializer(serializers.ModelSerializer):
    """For list views — returns processed_data only (avoids doubling payload size)."""
    class Meta:
        model  = ReportRow
        fields = ["id", "row_number", "processed_data", "synced_at"]


# ── Report Sync Log ───────────────────────────────────────────────────────────

class ReportSyncLogSerializer(serializers.ModelSerializer):
    source_name    = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()

    class Meta:
        model  = ReportSyncLog
        fields = [
            "id", "source", "source_name",
            "status", "status_display",
            "started_at", "completed_at", "duration_seconds",
            "records_processed", "records_created", "records_updated", "records_failed",
            "error_message", "triggered_by", "trigger_source",
        ]

    def get_source_name(self, obj):
        return obj.source.name if obj.source_id else None

    def get_status_display(self, obj):
        return obj.get_status_display()
