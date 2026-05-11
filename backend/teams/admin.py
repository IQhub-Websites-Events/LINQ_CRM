from django.contrib import admin
from .models import Team, TeamActivityLog


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display  = ["name", "slug", "color", "team_lead", "member_count_display", "is_archived", "created_at"]
    list_filter   = ["is_archived"]
    search_fields = ["name", "slug"]
    readonly_fields = ["slug", "created_at", "updated_at"]

    def member_count_display(self, obj):
        return obj.members.count()
    member_count_display.short_description = "Members"


@admin.register(TeamActivityLog)
class TeamActivityLogAdmin(admin.ModelAdmin):
    list_display  = ["action_type", "team", "user", "moved_by", "source_team", "destination_team", "created_at"]
    list_filter   = ["action_type"]
    search_fields = ["team__name", "user__username", "moved_by__username"]
    readonly_fields = ["created_at"]
