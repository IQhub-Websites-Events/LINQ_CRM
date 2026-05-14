"""
accounts/models.py
──────────────────
Custom user model with CRM roles and event assignments.
"""
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN           = "admin",           "Admin"
        SALES           = "sales",           "Sales"
        MARKET_RESEARCH = "market_research", "Market Research"
        SPEX            = "spex",            "SpEx"
        OPERATIONS      = "operations",      "Operations"
        SPEAKER_SALES   = "speaker_sales",   "Speaker Sales"
        TELEMARKETING   = "telemarketing",   "Telemarketing"

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
        if self.team:
            team_name = self.team.name.lower().strip()
            role_changed = False
            perms_changed = False
            
            if "admin" in team_name:
                if not self.is_superuser or not self.is_staff:
                    self.is_superuser = True
                    self.is_staff = True
                    perms_changed = True
                if self.role != self.Role.ADMIN:
                    self.role = self.Role.ADMIN
                    role_changed = True
            else:
                # Revoke superuser/staff if they are moved out of the Admin team
                if self.is_superuser or self.is_staff:
                    self.is_superuser = False
                    self.is_staff = False
                    perms_changed = True
                
                # Assign role based on keywords in the team name
                new_role = None
                if "market research" in team_name:
                    new_role = self.Role.MARKET_RESEARCH
                elif "spex" in team_name:
                    new_role = self.Role.SPEX
                elif "operation" in team_name or "ops" in team_name:
                    new_role = self.Role.OPERATIONS
                elif "speaker sales" in team_name:
                    new_role = self.Role.SPEAKER_SALES
                elif "telemarketing" in team_name:
                    new_role = self.Role.TELEMARKETING
                elif "sales" in team_name:
                    new_role = self.Role.SALES
                
                if new_role and self.role != new_role:
                    self.role = new_role
                    role_changed = True
                    
            if update_fields is not None:
                if perms_changed:
                    update_fields.update(["is_superuser", "is_staff"])
                if role_changed:
                    update_fields.add("role")

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
        
        # Combine ManyToMany assignments and primary sales_executive FK assignments
        m2m_codes = list(self.assigned_events.values_list("event_code", flat=True))
        fk_codes  = list(self.assigned_events_list.values_list("event_code", flat=True))
        
        return list(set(m2m_codes + fk_codes))

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
