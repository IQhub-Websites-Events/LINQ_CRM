"""
accounts/serializers.py
"""
from django.contrib.auth import get_user_model
from rest_framework import serializers
from events.models import Event

User = get_user_model()


class EventMiniSerializer(serializers.ModelSerializer):
    status = serializers.ReadOnlyField(source="event_status")

    class Meta:
        model  = Event
        fields = ["id", "event_code", "name", "status"]


class UserListSerializer(serializers.ModelSerializer):
    assigned_events = EventMiniSerializer(many=True, read_only=True)
    full_name       = serializers.SerializerMethodField()
    team_name       = serializers.ReadOnlyField(source='team.name')
    team_id         = serializers.ReadOnlyField(source='team.id')
    assigned_events_count = serializers.IntegerField(source='assigned_events.count', read_only=True)

    class Meta:
        model  = User
        fields = [
            "id", "username", "email", "first_name", "last_name", "full_name",
            "role", "status", "is_active", "assigned_events", "assigned_events_count",
            "date_joined", "last_login", "team_id", "team_name"
        ]
        read_only_fields = ["id", "date_joined", "last_login"]

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class UserWriteSerializer(serializers.ModelSerializer):
    password            = serializers.CharField(write_only=True, min_length=8, required=False)
    assigned_event_ids  = serializers.ListField(
        child=serializers.IntegerField(), required=False, write_only=True
    )
    team_id = serializers.IntegerField(required=False, write_only=True, allow_null=True)

    class Meta:
        model  = User
        fields = [
            "username", "email", "first_name", "last_name",
            "password", "role", "status", "assigned_event_ids", "team_id"
        ]

    def create(self, validated_data):
        event_ids = validated_data.pop("assigned_event_ids", [])
        team_id = validated_data.pop("team_id", None)
        password  = validated_data.pop("password", None)
        user = User(**validated_data)
        if team_id:
            from teams.models import Team
            user.team = Team.objects.filter(id=team_id).first()
        if password:
            user.set_password(password)
        user.save()
        if event_ids:
            user.assigned_events.set(Event.objects.filter(id__in=event_ids))
        return user

    def update(self, instance, validated_data):
        event_ids = validated_data.pop("assigned_event_ids", None)
        team_id = validated_data.pop("team_id", None)
        password  = validated_data.pop("password", None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        if team_id is not None:
            from teams.models import Team
            instance.team = Team.objects.filter(id=team_id).first() if team_id else None
            
        if password:
            instance.set_password(password)
            
        instance.save()
        
        if event_ids is not None:
            instance.assigned_events.set(Event.objects.filter(id__in=event_ids))
            
        return instance


class AssignEventsSerializer(serializers.Serializer):
    event_ids = serializers.ListField(child=serializers.IntegerField(), min_length=1)

    def validate_event_ids(self, value):
        if Event.objects.filter(id__in=value).count() != len(value):
            raise serializers.ValidationError("One or more event IDs not found.")
        return value
