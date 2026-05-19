from rest_framework import serializers
from .models import Team, TeamActivityLog


class TeamSerializer(serializers.ModelSerializer):
    member_count   = serializers.IntegerField(read_only=True, source="members.count")
    team_lead_id   = serializers.SerializerMethodField()
    team_lead_name = serializers.SerializerMethodField()
    team_leads     = serializers.SerializerMethodField()

    class Meta:
        model  = Team
        fields = [
            "id", "name", "slug", "color", "description",
            "member_count", "team_lead_id", "team_lead_name", "team_leads",
            "is_archived", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "slug", "created_at", "updated_at"]

    def get_team_lead_id(self, obj):
        return obj.team_lead_id

    def get_team_lead_name(self, obj):
        if not obj.team_lead:
            return None
        return obj.team_lead.get_full_name() or obj.team_lead.username

    def get_team_leads(self, obj):
        leads = obj.members.filter(is_team_lead=True)
        return [{"id": u.id, "name": u.get_full_name() or u.username} for u in leads]


class TeamActivityLogSerializer(serializers.ModelSerializer):
    user_name   = serializers.SerializerMethodField()
    actor_name  = serializers.SerializerMethodField()
    source_name = serializers.CharField(source="source_team.name", read_only=True, allow_null=True)
    dest_name   = serializers.CharField(source="destination_team.name", read_only=True, allow_null=True)

    class Meta:
        model  = TeamActivityLog
        fields = [
            "id", "action_type", "user_name", "actor_name",
            "source_name", "dest_name", "notes", "created_at",
        ]

    def get_user_name(self, obj):
        if not obj.user:
            return None
        return obj.user.get_full_name() or obj.user.username

    def get_actor_name(self, obj):
        if not obj.moved_by:
            return None
        return obj.moved_by.get_full_name() or obj.moved_by.username
