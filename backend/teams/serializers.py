from rest_framework import serializers
from .models import Team

class TeamSerializer(serializers.ModelSerializer):
    member_count = serializers.IntegerField(read_only=True, source='members.count')

    class Meta:
        model = Team
        fields = ['id', 'name', 'slug', 'color', 'description', 'member_count', 'created_at', 'updated_at']
        read_only_fields = ['id', 'slug', 'created_at', 'updated_at']
