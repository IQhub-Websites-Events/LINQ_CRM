from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import Event

User = get_user_model()


class UserMiniSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model  = User
        fields = ["id", "username", "email", "full_name", "role"]

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class EventListSerializer(serializers.ModelSerializer):
    sales_executive_name = serializers.SerializerMethodField()
    assigned_sales_users = UserMiniSerializer(source="assigned_users", many=True, read_only=True)

    class Meta:
        model  = Event
        fields = [
            "id", "event_code", "master_code", "name", "official_name", "sub_company", "city", "country",
            "event_date", "end_date", "event_status",
            "sales_executive", "sales_executive_name",
            "assigned_sales_users",
            "speaker_sales_team", "spex_team", "tele_marketing_team",
            "market_research_team", "content_check", "marketing_check",
            "sales_check", "accepting_web_bookings",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_sales_executive_name(self, obj):
        if obj.sales_executive_id:
            u = obj.sales_executive
            return u.get_full_name() or u.username
        return None


class EventDetailSerializer(serializers.ModelSerializer):
    sales_executive_name = serializers.SerializerMethodField()
    assigned_sales_users = UserMiniSerializer(source="assigned_users", many=True, read_only=True)
    total_bookings       = serializers.SerializerMethodField()
    pending_bookings     = serializers.SerializerMethodField()

    class Meta:
        model  = Event
        fields = [
            "id", "event_code", "master_code", "name", "official_name", "sub_company", "city", "country",
            "venue", "event_date", "end_date", "event_status",
            "sales_executive", "sales_executive_name",
            "assigned_sales_users",
            "total_bookings", "pending_bookings",
            "speaker_sales_team", "spex_team", "tele_marketing_team",
            "market_research_team", "content_check", "marketing_check",
            "sales_check", "accepting_web_bookings",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_sales_executive_name(self, obj):
        if obj.sales_executive_id:
            u = obj.sales_executive
            return u.get_full_name() or u.username
        return None

    def get_total_bookings(self, obj):
        from book_event.models import BookEvent
        return BookEvent.objects.filter(event_code=obj.event_code).count()

    def get_pending_bookings(self, obj):
        from book_event.models import BookEvent
        return BookEvent.objects.filter(event_code=obj.event_code, payment_status="Pending").count()


class EventWriteSerializer(serializers.ModelSerializer):
    assigned_user_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False, default=list
    )
    city    = serializers.CharField(required=False, allow_blank=True, default="")
    country = serializers.CharField(required=False, allow_blank=True, default="")

    class Meta:
        model  = Event
        fields = [
            "event_code", "master_code", "name", "official_name", "sub_company", "city", "country",
            "venue", "event_date", "end_date",
            "sales_executive",
            "speaker_sales_team", "spex_team", "tele_marketing_team",
            "market_research_team", "content_check", "marketing_check",
            "sales_check", "accepting_web_bookings",
            "assigned_user_ids",
        ]

    def validate_event_code(self, value):
        return value.upper().strip()

    def _sync_assigned_users(self, instance, user_ids):
        users = User.objects.filter(pk__in=user_ids)
        instance.assigned_users.set(users)

    def create(self, validated_data):
        user_ids = validated_data.pop("assigned_user_ids", [])
        instance = super().create(validated_data)
        self._sync_assigned_users(instance, user_ids)
        return instance

    def update(self, instance, validated_data):
        user_ids = validated_data.pop("assigned_user_ids", None)
        instance = super().update(instance, validated_data)
        if user_ids is not None:
            self._sync_assigned_users(instance, user_ids)
        return instance
