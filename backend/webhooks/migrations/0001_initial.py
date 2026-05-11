from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("book_event", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="WebhookLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("source", models.CharField(blank=True, default="", max_length=100)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("request_method", models.CharField(default="POST", max_length=10)),
                ("payload", models.JSONField(default=dict)),
                ("headers", models.JSONField(default=dict)),
                ("response", models.JSONField(default=dict)),
                ("status", models.CharField(
                    choices=[
                        ("received",   "Received"),
                        ("processing", "Processing"),
                        ("success",    "Success"),
                        ("failed",     "Failed"),
                        ("duplicate",  "Duplicate"),
                    ],
                    default="received",
                    max_length=20,
                )),
                ("http_status", models.PositiveIntegerField(default=202)),
                ("invoice_number", models.CharField(blank=True, db_index=True, default="", max_length=100)),
                ("event_code", models.CharField(blank=True, default="", max_length=50)),
                ("event_name", models.CharField(blank=True, default="", max_length=255)),
                ("error_message", models.TextField(blank=True, default="")),
                ("retry_count", models.PositiveIntegerField(default=0)),
                ("processing_status", models.CharField(
                    choices=[
                        ("pending",   "Pending"),
                        ("processed", "Processed"),
                        ("error",     "Error"),
                    ],
                    default="pending",
                    max_length=20,
                )),
                ("processed_at", models.DateTimeField(blank=True, null=True)),
                ("created_delegates_count", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("created_booking", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="webhook_logs",
                    to="book_event.bookevent",
                )),
            ],
            options={
                "db_table": "webhook_events",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="webhooklog",
            index=models.Index(fields=["status"],            name="wh_ev_status_idx"),
        ),
        migrations.AddIndex(
            model_name="webhooklog",
            index=models.Index(fields=["processing_status"], name="wh_ev_proc_idx"),
        ),
        migrations.AddIndex(
            model_name="webhooklog",
            index=models.Index(fields=["created_at"],        name="wh_ev_created_idx"),
        ),
        migrations.AddIndex(
            model_name="webhooklog",
            index=models.Index(fields=["invoice_number"],    name="wh_ev_invoice_idx"),
        ),
    ]
