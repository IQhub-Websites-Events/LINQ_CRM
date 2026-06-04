from django.db import migrations

CRM_MODULES = [
    "bookings", "ticket_central", "events", "reports",
    "users", "teams", "performance", "webhooks", "roles",
]

# Default permissions for each system role
# Format: module -> (can_view, can_create, can_update, can_delete)
ROLE_DEFAULTS = {
    "admin": {"is_all_access": True, "modules": {}},
    "sales": {
        "is_all_access": False,
        "modules": {
            "bookings":       (True,  True,  True,  True),
            "ticket_central": (False, False, False, False),
            "events":         (True,  False, False, False),
            "reports":        (True,  False, False, False),
            "users":          (False, False, False, False),
            "teams":          (False, False, False, False),
            "performance":    (True,  False, False, False),
            "webhooks":       (False, False, False, False),
            "roles":          (False, False, False, False),
        },
    },
    "market_research": {
        "is_all_access": False,
        "modules": {
            "bookings":       (False, False, False, False),
            "ticket_central": (True,  True,  True,  False),
            "events":         (True,  False, False, False),
            "reports":        (True,  False, False, False),
            "users":          (False, False, False, False),
            "teams":          (False, False, False, False),
            "performance":    (True,  False, False, False),
            "webhooks":       (False, False, False, False),
            "roles":          (False, False, False, False),
        },
    },
    "data_mining": {
        "is_all_access": False,
        "modules": {
            "bookings":       (False, False, False, False),
            "ticket_central": (True,  False, True,  False),
            "events":         (True,  False, False, False),
            "reports":        (True,  False, False, False),
            "users":          (False, False, False, False),
            "teams":          (False, False, False, False),
            "performance":    (True,  False, False, False),
            "webhooks":       (False, False, False, False),
            "roles":          (False, False, False, False),
        },
    },
    "telemarketing": {
        "is_all_access": False,
        "modules": {
            "bookings":       (True,  False, False, False),
            "ticket_central": (False, False, False, False),
            "events":         (True,  False, False, False),
            "reports":        (True,  False, False, False),
            "users":          (False, False, False, False),
            "teams":          (False, False, False, False),
            "performance":    (True,  False, False, False),
            "webhooks":       (False, False, False, False),
            "roles":          (False, False, False, False),
        },
    },
    "spex": {
        "is_all_access": False,
        "modules": {
            "bookings":       (True,  False, False, False),
            "ticket_central": (False, False, False, False),
            "events":         (True,  False, False, False),
            "reports":        (True,  False, False, False),
            "users":          (False, False, False, False),
            "teams":          (False, False, False, False),
            "performance":    (True,  False, False, False),
            "webhooks":       (False, False, False, False),
            "roles":          (False, False, False, False),
        },
    },
    "operations": {
        "is_all_access": False,
        "modules": {
            "bookings":       (True,  True,  True,  False),
            "ticket_central": (False, False, False, False),
            "events":         (True,  False, False, False),
            "reports":        (True,  False, False, False),
            "users":          (False, False, False, False),
            "teams":          (False, False, False, False),
            "performance":    (True,  False, False, False),
            "webhooks":       (False, False, False, False),
            "roles":          (False, False, False, False),
        },
    },
    "speaker_sales": {
        "is_all_access": False,
        "modules": {
            "bookings":       (True,  True,  True,  False),
            "ticket_central": (False, False, False, False),
            "events":         (True,  False, False, False),
            "reports":        (True,  False, False, False),
            "users":          (False, False, False, False),
            "teams":          (False, False, False, False),
            "performance":    (True,  False, False, False),
            "webhooks":       (False, False, False, False),
            "roles":          (False, False, False, False),
        },
    },
}

SYSTEM_ROLE_META = {
    "admin":           {"display_label": "Admin",          "color": "#dc3545"},
    "sales":           {"display_label": "Sales",          "color": "#405189"},
    "market_research": {"display_label": "Market Research","color": "#f0ad4e"},
    "data_mining":     {"display_label": "Data Mining",    "color": "#6f42c1"},
    "telemarketing":   {"display_label": "Telemarketing",  "color": "#20c997"},
    "speaker_sales":   {"display_label": "Speaker Sales",  "color": "#0dcaf0"},
    "spex":            {"display_label": "SpEx",           "color": "#fd7e14"},
    "operations":      {"display_label": "Operations",     "color": "#6c757d"},
}

TEAM_ROLE_MAP = [
    (["admin"],                                       "admin"),
    (["market research"],                             "market_research"),
    (["data mining", "dmd"],                          "data_mining"),
    (["spex"],                                        "spex"),
    (["operation", "ops"],                            "operations"),
    (["speaker sales"],                               "speaker_sales"),
    (["telemarketing", "tele marketing", "tele"],     "telemarketing"),
    (["sales"],                                       "sales"),
]


def _derive_role_from_team(team_name):
    t = team_name.lower().strip()
    for keywords, role in TEAM_ROLE_MAP:
        if any(kw in t for kw in keywords):
            return role
    return None


def seed_forward(apps, schema_editor):
    User       = apps.get_model("accounts", "User")
    CustomRole = apps.get_model("accounts", "CustomRole")
    RolePerm   = apps.get_model("accounts", "RolePermission")

    # Step 1: sync all User.role values from their current team name
    for user in User.objects.filter(team__isnull=False).select_related("team"):
        derived = _derive_role_from_team(user.team.name)
        if derived and derived != user.role:
            User.objects.filter(pk=user.pk).update(role=derived)

    # Step 2: create 8 system CustomRoles
    role_objs = {}
    for role_key, defaults in ROLE_DEFAULTS.items():
        meta = SYSTEM_ROLE_META[role_key]
        cr, _ = CustomRole.objects.get_or_create(
            name=role_key,
            defaults={
                "display_label":  meta["display_label"],
                "color":          meta["color"],
                "is_all_access":  defaults["is_all_access"],
                "is_system_role": True,
            },
        )
        # Ensure fields are set even if the role already existed
        cr.is_all_access  = defaults["is_all_access"]
        cr.is_system_role = True
        cr.save()
        role_objs[role_key] = cr

        # Step 3: create RolePermission entries
        for module, perms in defaults["modules"].items():
            RolePerm.objects.get_or_create(
                custom_role=cr,
                module=module,
                defaults={
                    "can_view":   perms[0],
                    "can_create": perms[1],
                    "can_update": perms[2],
                    "can_delete": perms[3],
                },
            )
        # Ensure all modules are represented even with all-False defaults
        for module in CRM_MODULES:
            if module not in defaults["modules"]:
                RolePerm.objects.get_or_create(
                    custom_role=cr, module=module,
                    defaults={"can_view": False, "can_create": False, "can_update": False, "can_delete": False},
                )

    # Step 4: assign custom_role to every user based on their (now-updated) User.role
    for user in User.objects.all():
        cr = role_objs.get(user.role)
        if cr:
            User.objects.filter(pk=user.pk).update(custom_role_id=cr.pk)


def seed_reverse(apps, schema_editor):
    CustomRole = apps.get_model("accounts", "CustomRole")
    CustomRole.objects.filter(is_system_role=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0017_rolepermission_customrole_updates'),
    ]

    operations = [
        migrations.RunPython(seed_forward, seed_reverse),
    ]
