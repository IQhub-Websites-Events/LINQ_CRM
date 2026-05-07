from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display    = ["username", "email", "role", "is_active", "date_joined"]
    list_filter     = ["role", "is_active"]
    search_fields   = ["username", "email"]
    filter_horizontal = ["assigned_events", "groups", "user_permissions"]
    fieldsets = BaseUserAdmin.fieldsets + (
        ("CRM", {"fields": ("role", "assigned_events")}),
    )
