from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("teams", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="team",
            name="is_archived",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="team",
            name="team_lead",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="led_teams",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.CreateModel(
            name="TeamActivityLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "action_type",
                    models.CharField(
                        choices=[
                            ("member_moved",   "Member Moved"),
                            ("member_removed", "Member Removed"),
                            ("member_added",   "Member Added"),
                            ("lead_assigned",  "Lead Assigned"),
                            ("team_renamed",   "Team Renamed"),
                            ("team_deleted",   "Team Deleted"),
                            ("team_archived",  "Team Archived"),
                            ("team_created",   "Team Created"),
                        ],
                        max_length=30,
                    ),
                ),
                ("notes", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "destination_team",
                    models.ForeignKey(
                        blank=True, null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="activity_as_destination",
                        to="teams.team",
                    ),
                ),
                (
                    "moved_by",
                    models.ForeignKey(
                        blank=True, null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="team_activity_actor",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "source_team",
                    models.ForeignKey(
                        blank=True, null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="activity_as_source",
                        to="teams.team",
                    ),
                ),
                (
                    "team",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="activity_logs",
                        to="teams.team",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        blank=True, null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="team_activity_subject",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "team_activity_logs",
                "ordering": ["-created_at"],
            },
        ),
    ]
