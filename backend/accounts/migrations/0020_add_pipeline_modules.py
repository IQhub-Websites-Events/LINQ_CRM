"""
Register the two placeholder pipeline modules on every existing role.

`CRM_MODULES` gained "paper_review" and "proposal_submission". A role with no
RolePermission row for a module is treated as no-access by
`crm_permission()` and by `my-permissions`, so strictly speaking a backfill is
not required for safety. It IS required for the roles UI: RolesPage renders one
checkbox row per module and reads its initial state from the role's stored
permissions, so without these rows the two new modules would render unticked
but save back a full permission set anyway. Materialising them all-False keeps
what the admin sees and what the database holds identical.

All-access roles (and the hardcoded HP account) are unaffected either way —
their matrix is generated from CRM_MODULES at request time, so they pick up
both new modules automatically.
"""
from django.db import migrations

NEW_MODULES = ["paper_review", "proposal_submission"]


def add_modules(apps, schema_editor):
    CustomRole = apps.get_model("accounts", "CustomRole")
    RolePerm   = apps.get_model("accounts", "RolePermission")

    for role in CustomRole.objects.all():
        for module in NEW_MODULES:
            RolePerm.objects.get_or_create(
                custom_role=role,
                module=module,
                defaults={
                    "can_view":   False,
                    "can_create": False,
                    "can_update": False,
                    "can_delete": False,
                },
            )


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0019_alter_customrole_is_all_access_and_more"),
    ]

    operations = [
        # Reverse is a deliberate no-op rather than a delete. The rows this
        # creates are all-False and `module` has no referential constraint, so
        # leaving them behind after an unapply is inert — an unrecognised
        # module key surfaces as a no-access entry and nothing reads it. Not
        # worth shipping a queryset delete over role data to tidy up.
        migrations.RunPython(add_modules, migrations.RunPython.noop),
    ]
