from rest_framework import serializers
from .models import GoogleSheetSyncLog


class GoogleSheetSyncLogSerializer(serializers.ModelSerializer):
    duration_display = serializers.ReadOnlyField()

    class Meta:
        model = GoogleSheetSyncLog
        fields = [
            "id", "sync_type", "sheet_name",
            "status", "sync_mode",
            "started_at", "completed_at", "duration_seconds", "duration_display",
            "records_processed", "records_created", "records_updated", "records_failed",
            "triggered_by", "trigger_source",
            "error_message", "sync_summary",
            "last_synced_record_id", "last_synced_at",
            "created_at",
        ]
