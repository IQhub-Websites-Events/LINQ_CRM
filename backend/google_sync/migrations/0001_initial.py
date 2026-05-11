from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True
    dependencies = []

    operations = [
        migrations.CreateModel(
            name="GoogleSheetSyncLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("sync_type", models.CharField(
                    choices=[
                        ("bookings",  "Bookings"),
                        ("events",    "Events"),
                        ("full_sync", "Full Sync"),
                    ],
                    db_index=True, max_length=20,
                )),
                ("sheet_name",        models.CharField(blank=True, default="", max_length=200)),
                ("status", models.CharField(
                    choices=[
                        ("pending",         "Pending"),
                        ("running",         "Running"),
                        ("success",         "Success"),
                        ("failed",          "Failed"),
                        ("partial_success", "Partial Success"),
                    ],
                    db_index=True, default="pending", max_length=20,
                )),
                ("started_at",        models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ("completed_at",      models.DateTimeField(blank=True, null=True)),
                ("duration_seconds",  models.FloatField(blank=True, null=True)),
                ("records_processed", models.PositiveIntegerField(default=0)),
                ("records_created",   models.PositiveIntegerField(default=0)),
                ("records_updated",   models.PositiveIntegerField(default=0)),
                ("records_failed",    models.PositiveIntegerField(default=0)),
                ("sync_mode", models.CharField(
                    choices=[
                        ("incremental", "Incremental"),
                        ("full",        "Full"),
                    ],
                    default="incremental", max_length=20,
                )),
                ("triggered_by",   models.CharField(blank=True, default="", max_length=150)),
                ("trigger_source", models.CharField(
                    choices=[
                        ("scheduler",    "Scheduler"),
                        ("admin_manual", "Admin Manual"),
                        ("system",       "System"),
                    ],
                    default="system", max_length=20,
                )),
                ("error_message",         models.TextField(blank=True, default="")),
                ("sync_summary",          models.JSONField(blank=True, default=dict)),
                ("last_synced_record_id", models.BigIntegerField(blank=True, null=True)),
                ("last_synced_at",        models.DateTimeField(blank=True, null=True)),
                ("created_at",            models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={
                "db_table": "google_sync_logs",
                "ordering": ["-started_at"],
            },
        ),
        migrations.AddIndex(
            model_name="googlesheetsynclog",
            index=models.Index(fields=["sync_type"],  name="gs_logs_type_idx"),
        ),
        migrations.AddIndex(
            model_name="googlesheetsynclog",
            index=models.Index(fields=["started_at"], name="gs_logs_started_idx"),
        ),
    ]
