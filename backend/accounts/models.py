"""
accounts/models.py
──────────────────
Custom user model with CRM roles and event assignments.
"""
import random
import string
from datetime import timedelta

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN           = "admin",           "Admin"
        SALES           = "sales",           "Sales"
        MARKET_RESEARCH = "market_research", "Market Research"
        SPEX            = "spex",            "SpEx"
        OPERATIONS      = "operations",      "Operations"
        SPEAKER_SALES   = "speaker_sales",   "Speaker Sales"
        TELEMARKETING   = "telemarketing",   "Telemarketing"
        DATA_MINING     = "data_mining",     "Data Mining"

    class Status(models.TextChoices):
        ACTIVE    = "active",    "Active"
        INACTIVE  = "inactive",  "Inactive"
        SUSPENDED = "suspended", "Suspended"

    role = models.CharField(
        max_length=20, choices=Role.choices, default=Role.SALES, db_index=True
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ACTIVE, db_index=True
    )
    is_team_lead = models.BooleanField(default=False, db_index=True)
    mapped_lead = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="team_members",
        db_index=True,
        help_text="The specific team lead this user/member is mapped under."
    )
    team = models.ForeignKey(
        "teams.Team",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="members",
        db_index=True
    )
    assigned_events = models.ManyToManyField(
        "events.Event",
        blank=True,
        related_name="assigned_users",
        help_text="Events accessible by this sales user. Ignored for admin.",
    )
    custom_role = models.ForeignKey(
        "CustomRole",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="users",
        help_text="Optional display-only role label. Does not affect permissions.",
    )

    class Meta:
        db_table = "users"

    def __str__(self):
        return f"{self.username} ({self.role})"

    def save(self, *args, **kwargs):
        update_fields = kwargs.get("update_fields", None)

        # Sync is_active with status
        if self.status == self.Status.ACTIVE:
            self.is_active = True
        else:
            self.is_active = False

        if update_fields is not None:
            update_fields = set(update_fields)
            if "status" in update_fields:
                update_fields.add("is_active")

        # Auto-sync role and permissions based on team assignment
        # If the user explicitly has the ADMIN role, ensure they have superuser/staff rights
        # regardless of their team.
        if self.role == self.Role.ADMIN:
            if not self.is_superuser or not self.is_staff:
                self.is_superuser = True
                self.is_staff = True
        elif self.team:
            team_name = self.team.name.lower().strip()
            
            if "admin" in team_name:
                if not self.is_superuser or not self.is_staff:
                    self.is_superuser = True
                    self.is_staff = True
                if self.role != self.Role.ADMIN:
                    self.role = self.Role.ADMIN
            else:
                # Revoke superuser/staff if they are moved out of the Admin team and are not explicitly Admin role
                if self.is_superuser or self.is_staff:
                    self.is_superuser = False
                    self.is_staff = False
                
                # Assign role based on keywords in the team name
                new_role = None
                if "market research" in team_name:
                    new_role = self.Role.MARKET_RESEARCH
                elif "data mining" in team_name or "dmd" in team_name:
                    new_role = self.Role.DATA_MINING
                elif "spex" in team_name:
                    new_role = self.Role.SPEX
                elif "operation" in team_name or "ops" in team_name:
                    new_role = self.Role.OPERATIONS
                elif "speaker sales" in team_name:
                    new_role = self.Role.SPEAKER_SALES
                elif "telemarketing" in team_name or "tele marketing" in team_name or "tele" in team_name:
                    new_role = self.Role.TELEMARKETING
                elif "sales" in team_name:
                    new_role = self.Role.SALES
                
                if new_role and self.role != new_role:
                    self.role = new_role
                    
            if update_fields is not None:
                update_fields.update(["is_superuser", "is_staff", "role"])

        if update_fields is not None:
            kwargs["update_fields"] = list(update_fields)

        super().save(*args, **kwargs)

    @property
    def is_admin(self):
        return self.role == self.Role.ADMIN

    @property
    def is_sales(self):
        return self.role == self.Role.SALES

    def assigned_event_codes(self):
        """Returns list of event_codes or None (admin = unrestricted)."""
        if self.is_admin:
            return None
        return list(self.assigned_events.values_list("event_code", flat=True))

class ActionLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="action_logs")
    action = models.CharField(max_length=255)
    details = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "action_logs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} - {self.action} at {self.created_at}"


class OTPToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="otp_tokens")
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    attempts = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "otp_tokens"
        indexes = [models.Index(fields=["user", "otp"])]

    def __str__(self):
        return f"OTP for {self.user.email} ({'used' if self.is_used else 'active'})"

    def is_expired(self):
        return timezone.now() > self.expires_at

    @classmethod
    def create_for_user(cls, user):
        cls.objects.filter(user=user, is_used=False).update(is_used=True)
        otp = "".join(random.choices(string.digits, k=6))
        return cls.objects.create(
            user=user,
            otp=otp,
            expires_at=timezone.now() + timedelta(minutes=5),
        )


class CustomRole(models.Model):
    """Admin-defined roles. All permissions are managed via RolePermission entries."""
    name           = models.CharField(max_length=50, unique=True)
    display_label  = models.CharField(max_length=50)
    color          = models.CharField(max_length=20, default="#6b7280")
    description    = models.TextField(blank=True, default="")
    is_all_access  = models.BooleanField(default=False, help_text="If True, grants full access to all modules.")
    is_system_role = models.BooleanField(default=False, help_text="Pre-seeded system role — cannot be deleted.")
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "custom_roles"
        ordering = ["display_label"]

    def __str__(self):
        return self.display_label


CRM_MODULES = [
    "bookings", "ticket_central", "events", "reports",
    "users", "teams", "performance", "webhooks", "roles",
    # Placeholder pipeline modules. Registered so roles can be configured
    # ahead of the real feature; every existing role is backfilled all-False
    # by migration 0020, so nothing is visible until it is granted.
    "paper_review", "proposal_submission",
]

class RolePermission(models.Model):
    """Per-module CRUD permissions for a CustomRole."""
    custom_role = models.ForeignKey(
        CustomRole, on_delete=models.CASCADE, related_name="permissions"
    )
    module      = models.CharField(max_length=50)
    can_view    = models.BooleanField(default=False)
    can_create  = models.BooleanField(default=False)
    can_update  = models.BooleanField(default=False)
    can_delete  = models.BooleanField(default=False)

    class Meta:
        db_table         = "role_permissions"
        unique_together  = [("custom_role", "module")]
        ordering         = ["module"]

    def __str__(self):
        return f"{self.custom_role} · {self.module}"
