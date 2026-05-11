from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        (settings.AUTH_USER_MODEL.split(".")[0], "0001_initial"),
    ]

    operations = [
        # ── 1. GoogleSheetSource ─────────────────────────────────────────────
        migrations.CreateModel(
            name="GoogleSheetSource",
            fields=[
                ("id",               models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name",             models.CharField(max_length=200)),
                ("description",      models.TextField(blank=True, default="")),
                ("sheet_id",         models.CharField(max_length=200, help_text="Google Sheet ID or full URL")),
                ("sheet_url",        models.URLField(blank=True, default="")),
                ("worksheet_name",   models.CharField(max_length=200, default="Sheet1")),
                ("sheet_type",       models.CharField(
                    max_length=20, default="custom",
                    choices=[
                        ("bookings","Bookings"),("events","Events"),("delegates","Delegates"),
                        ("revenue","Revenue"),("pipeline","Pipeline"),("attendance","Attendance"),("custom","Custom"),
                    ],
                )),
                ("is_active",        models.BooleanField(default=True, db_index=True)),
                ("sync_enabled",     models.BooleanField(default=True)),
                ("sync_frequency",   models.CharField(
                    max_length=20, default="manual",
                    choices=[("manual","Manual Only"),("hourly","Every Hour"),("daily","Daily"),("weekly","Weekly")],
                )),
                ("column_mappings",       models.JSONField(default=dict, blank=True)),
                ("transformation_config", models.JSONField(default=dict, blank=True)),
                ("filter_config",         models.JSONField(default=dict, blank=True)),
                ("grouping_config",       models.JSONField(default=dict, blank=True)),
                ("formula_config",        models.JSONField(default=dict, blank=True)),
                ("last_synced_at",        models.DateTimeField(null=True, blank=True)),
                ("last_successful_sync",  models.DateTimeField(null=True, blank=True)),
                ("last_failed_sync",      models.DateTimeField(null=True, blank=True)),
                ("sync_status",     models.CharField(
                    max_length=20, default="never", db_index=True,
                    choices=[
                        ("never","Never Synced"),("idle","Idle"),("syncing","Syncing"),
                        ("success","Success"),("failed","Failed"),("partial","Partial"),
                    ],
                )),
                ("records_count",   models.PositiveIntegerField(default=0)),
                ("last_error",      models.TextField(blank=True, default="")),
                ("notes",           models.TextField(blank=True, default="")),
                ("created_at",      models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_at",      models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="created_sheet_sources",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"db_table": "report_sheet_sources", "ordering": ["-created_at"]},
        ),

        # ── 2. ReportDefinition ──────────────────────────────────────────────
        migrations.CreateModel(
            name="ReportDefinition",
            fields=[
                ("id",                 models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name",               models.CharField(max_length=200)),
                ("slug",               models.SlugField(unique=True, max_length=200)),
                ("description",        models.TextField(blank=True, default="")),
                ("report_type",        models.CharField(
                    max_length=20, default="table",
                    choices=[("table","Table"),("summary","Summary"),("grouped","Grouped"),("pivot","Pivot")],
                )),
                ("column_config",      models.JSONField(default=list, blank=True)),
                ("filter_config",      models.JSONField(default=dict, blank=True)),
                ("grouping_config",    models.JSONField(default=dict, blank=True)),
                ("calculation_config", models.JSONField(default=dict, blank=True)),
                ("is_active",          models.BooleanField(default=True)),
                ("created_at",         models.DateTimeField(default=django.utils.timezone.now)),
                ("updated_at",         models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="created_reports",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"db_table": "report_definitions", "ordering": ["name"]},
        ),

        # ── 3. ReportDefinition.sources (M2M) ───────────────────────────────
        migrations.AddField(
            model_name="reportdefinition",
            name="sources",
            field=models.ManyToManyField(
                blank=True,
                related_name="report_definitions",
                to="reports.googlesheetsource",
            ),
        ),

        # ── 4. ReportRow ─────────────────────────────────────────────────────
        migrations.CreateModel(
            name="ReportRow",
            fields=[
                ("id",             models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("row_number",     models.PositiveIntegerField(default=0)),
                ("raw_data",       models.JSONField(default=dict)),
                ("processed_data", models.JSONField(default=dict)),
                ("row_hash",       models.CharField(max_length=64, blank=True, default="")),
                ("is_active",      models.BooleanField(default=True, db_index=True)),
                ("synced_at",      models.DateTimeField(default=django.utils.timezone.now)),
                ("source", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="rows",
                    to="reports.googlesheetsource",
                )),
            ],
            options={"db_table": "report_rows", "ordering": ["source", "row_number"]},
        ),
        migrations.AddIndex(
            model_name="reportrow",
            index=models.Index(fields=["source", "is_active"], name="rr_source_active_idx"),
        ),
        migrations.AddIndex(
            model_name="reportrow",
            index=models.Index(fields=["source", "row_number"], name="rr_source_row_idx"),
        ),

        # ── 5. ReportSyncLog ─────────────────────────────────────────────────
        migrations.CreateModel(
            name="ReportSyncLog",
            fields=[
                ("id",                models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status",            models.CharField(
                    max_length=20, default="running", db_index=True,
                    choices=[("running","Running"),("success","Success"),("partial","Partial"),("failed","Failed")],
                )),
                ("started_at",        models.DateTimeField(default=django.utils.timezone.now)),
                ("completed_at",      models.DateTimeField(null=True, blank=True)),
                ("duration_seconds",  models.FloatField(null=True, blank=True)),
                ("records_processed", models.PositiveIntegerField(default=0)),
                ("records_created",   models.PositiveIntegerField(default=0)),
                ("records_updated",   models.PositiveIntegerField(default=0)),
                ("records_failed",    models.PositiveIntegerField(default=0)),
                ("error_message",     models.TextField(blank=True, default="")),
                ("triggered_by",      models.CharField(max_length=150, blank=True, default="")),
                ("trigger_source",    models.CharField(
                    max_length=20, default="manual",
                    choices=[("manual","Manual (Admin)"),("scheduler","Scheduler"),("api","API"),("system","System")],
                )),
                ("source", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="sync_logs",
                    to="reports.googlesheetsource",
                )),
            ],
            options={"db_table": "report_sync_logs", "ordering": ["-started_at"]},
        ),
        migrations.AddIndex(
            model_name="reportsynclog",
            index=models.Index(fields=["source", "-started_at"], name="rsl_source_started_idx"),
        ),
    ]
