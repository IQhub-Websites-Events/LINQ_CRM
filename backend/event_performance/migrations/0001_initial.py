from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="FollowUpRecord",
            fields=[
                ("id",             models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_code",     models.CharField(db_index=True, max_length=50)),
                ("contact_name",   models.CharField(blank=True, default="", max_length=255)),
                ("company",        models.CharField(blank=True, default="", max_length=255)),
                ("email",          models.EmailField(blank=True, default="")),
                ("phone",          models.CharField(blank=True, default="", max_length=50)),
                ("follow_up_date", models.DateField(default=django.utils.timezone.now)),
                ("status",         models.CharField(
                    choices=[
                        ("pending",   "Pending"),
                        ("called",    "Called"),
                        ("emailed",   "Emailed"),
                        ("voicemail", "Voicemail"),
                        ("converted", "Converted"),
                        ("no_answer", "No Answer"),
                    ],
                    db_index=True, default="pending", max_length=20,
                )),
                ("notes",       models.TextField(blank=True, default="")),
                ("created_by",  models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="follow_ups_created",
                    to=settings.AUTH_USER_MODEL,
                )),
                ("created_at",  models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_at",  models.DateTimeField(auto_now=True)),
            ],
            options={"db_table": "ep_follow_ups", "ordering": ["-follow_up_date"]},
        ),
        migrations.CreateModel(
            name="MailshotRecord",
            fields=[
                ("id",            models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_code",    models.CharField(db_index=True, max_length=50)),
                ("mailshot_type", models.CharField(
                    choices=[
                        ("invite",      "Invite"),
                        ("reminder",    "Reminder"),
                        ("thank_you",   "Thank You"),
                        ("follow_up",   "Follow-Up"),
                        ("promotional", "Promotional"),
                        ("other",       "Other"),
                    ],
                    default="invite", max_length=30,
                )),
                ("subject",       models.CharField(blank=True, default="", max_length=255)),
                ("sent_at",       models.DateField(default=django.utils.timezone.now)),
                ("target_count",  models.PositiveIntegerField(default=0)),
                ("opened_count",  models.PositiveIntegerField(default=0)),
                ("clicked_count", models.PositiveIntegerField(default=0)),
                ("notes",         models.TextField(blank=True, default="")),
                ("created_by",    models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="mailshots_created",
                    to=settings.AUTH_USER_MODEL,
                )),
                ("created_at",    models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={"db_table": "ep_mailshots", "ordering": ["-sent_at"]},
        ),
        migrations.CreateModel(
            name="EventPerformanceNote",
            fields=[
                ("id",         models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_code", models.CharField(db_index=True, max_length=50)),
                ("note",       models.TextField()),
                ("created_by", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="ep_notes_created",
                    to=settings.AUTH_USER_MODEL,
                )),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={"db_table": "ep_notes", "ordering": ["-created_at"]},
        ),
    ]
