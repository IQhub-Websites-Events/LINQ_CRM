from rest_framework import serializers
from .models import FollowUpRecord, MailshotRecord, EventPerformanceNote


class FollowUpSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = FollowUpRecord
        fields = [
            "id", "event_code", "contact_name", "company", "email", "phone",
            "follow_up_date", "status", "notes",
            "created_by", "created_by_name", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_by", "created_by_name", "created_at", "updated_at"]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None


class MailshotSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    open_rate = serializers.SerializerMethodField()

    class Meta:
        model  = MailshotRecord
        fields = [
            "id", "event_code", "mailshot_type", "subject", "sent_at",
            "target_count", "opened_count", "clicked_count", "notes",
            "created_by", "created_by_name", "open_rate", "created_at",
        ]
        read_only_fields = ["id", "created_by", "created_by_name", "open_rate", "created_at"]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_open_rate(self, obj):
        if obj.target_count:
            return round((obj.opened_count / obj.target_count) * 100, 1)
        return 0.0


class EventPerformanceNoteSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model  = EventPerformanceNote
        fields = ["id", "event_code", "note", "created_by", "created_by_name", "created_at"]
        read_only_fields = ["id", "created_by", "created_by_name", "created_at"]

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None


class EventMetricsSerializer(serializers.Serializer):
    """Read-only serializer — data comes from services.bulk_event_metrics()."""
    event_code          = serializers.CharField()
    event_name          = serializers.CharField()
    event_date          = serializers.DateField()
    status              = serializers.CharField()
    sub_company         = serializers.CharField()
    city                = serializers.CharField()
    # Delegate counts
    total_delegates     = serializers.IntegerField()
    paid_count          = serializers.IntegerField()
    pending_count       = serializers.IntegerField()
    free_count          = serializers.IntegerField()
    cancelled_count     = serializers.IntegerField()

    # Revenue
    total_revenue       = serializers.FloatField()
    pending_value       = serializers.FloatField()

    # Payment timeline
    today_paid          = serializers.IntegerField()
    yesterday_paid      = serializers.IntegerField()
    d7_paid             = serializers.IntegerField()
    d14_paid            = serializers.IntegerField()
    d21_paid            = serializers.IntegerField()
    today_revenue       = serializers.FloatField()
    yesterday_revenue   = serializers.FloatField()
    d7_revenue          = serializers.FloatField()
    d14_revenue         = serializers.FloatField()
    d21_revenue         = serializers.FloatField()

    # Invoice reference
    total_invoices      = serializers.IntegerField()
    confirmed_delegates = serializers.IntegerField()
    noshow_delegates    = serializers.IntegerField()

    # Health
    benchmark           = serializers.FloatField()
    health              = serializers.CharField()
    health_color        = serializers.CharField()
