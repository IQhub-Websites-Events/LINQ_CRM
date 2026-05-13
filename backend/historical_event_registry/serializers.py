from rest_framework import serializers
from .models import HistoricalEventReference


class HistoricalEventReferenceSerializer(serializers.ModelSerializer):
    event_code = serializers.SerializerMethodField()
    event_name = serializers.SerializerMethodField()

    class Meta:
        model = HistoricalEventReference
        fields = [
            "id", "event_code", "event_name",
            "original_event_code", "normalized_event_code",
            "event_year", "event_month", "event_location",
            "source_pdf", "source_page",
            "verification_status", "matched_confidence",
            "created_at", "updated_at",
        ]
        read_only_fields = fields

    def get_event_code(self, obj):
        return obj.event.event_code if obj.event else None

    def get_event_name(self, obj):
        return obj.event.name if obj.event else None
