from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("webhooks",  "0001_initial"),
        (settings.AUTH_USER_MODEL.split(".")[0], "0001_initial"),
    ]

    operations = [
        # ── 1. WebhookApiKey table ────────────────────────────────────────────
        migrations.CreateModel(
            name="WebhookApiKey",
            fields=[
                ("id",       models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name",     models.CharField(max_length=100)),
                ("api_key",  models.CharField(db_index=True, max_length=80, unique=True)),
                ("event",    models.CharField(blank=True, default="", max_length=50,
                                              help_text="Optional: restrict to this event code")),
                ("is_active",       models.BooleanField(db_index=True, default=True)),
                ("allowed_domains", models.JSONField(blank=True, default=list,
                                                     help_text="List of allowed origin domains; empty = unrestricted")),
                ("notes",           models.TextField(blank=True, default="")),
                ("created_at",      models.DateTimeField(default=django.utils.timezone.now)),
                ("last_used_at",    models.DateTimeField(blank=True, null=True)),
                ("usage_count",     models.PositiveIntegerField(default=0)),
                ("created_by", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="created_webhook_keys",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"db_table": "webhook_api_keys", "ordering": ["-created_at"]},
        ),

        # ── 2. New fields on WebhookLog ───────────────────────────────────────
        migrations.AddField(
            model_name="webhooklog",
            name="api_key",
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="logs",
                to="webhooks.webhookapikey",
            ),
        ),
        migrations.AddField(
            model_name="webhooklog",
            name="db_insert_status",
            field=models.CharField(blank=True, default="", max_length=20),
        ),
        migrations.AddField(
            model_name="webhooklog",
            name="stack_trace",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="webhooklog",
            name="processing_notes",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="webhooklog",
            name="processing_duration",
            field=models.FloatField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="webhooklog",
            name="received_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="webhooklog",
            name="processing_started_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="webhooklog",
            name="records_inserted",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="webhooklog",
            name="records_updated",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="webhooklog",
            name="records_failed",
            field=models.PositiveIntegerField(default=0),
        ),
    ]
