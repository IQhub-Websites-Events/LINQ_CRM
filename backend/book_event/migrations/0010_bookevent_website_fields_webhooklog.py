import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("book_event", "0009_remove_bookevent_pre_tax_amount_and_more"),
    ]

    operations = [
        # ── BookEvent new fields ──────────────────────────────────────────────
        migrations.AddField(
            model_name="bookevent",
            name="source",
            field=models.CharField(
                max_length=20,
                choices=[("manual", "Manual"), ("website", "Website")],
                default="manual",
                db_index=True,
            ),
        ),
        migrations.AddField(
            model_name="bookevent",
            name="pre_tax_amount",
            field=models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True),
        ),
        migrations.AddField(
            model_name="bookevent",
            name="tax_amount",
            field=models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True),
        ),
        migrations.AddField(
            model_name="bookevent",
            name="total_amount",
            field=models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True),
        ),
        migrations.AddField(
            model_name="bookevent",
            name="add_ons_total_amount",
            field=models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True),
        ),
        migrations.AddField(
            model_name="bookevent",
            name="form_name",
            field=models.CharField(max_length=255, blank=True, default=""),
        ),
        migrations.AddField(
            model_name="bookevent",
            name="form_url",
            field=models.CharField(max_length=500, blank=True, default=""),
        ),
        migrations.AddField(
            model_name="bookevent",
            name="packages",
            field=models.JSONField(default=list, blank=True),
        ),
        # ── WebhookLog model ──────────────────────────────────────────────────
        migrations.CreateModel(
            name="WebhookLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False)),
                ("source_ip", models.GenericIPAddressField(null=True, blank=True)),
                ("payload", models.JSONField(default=dict)),
                ("headers", models.JSONField(default=dict)),
                ("response", models.JSONField(default=dict)),
                ("status", models.CharField(
                    max_length=20,
                    choices=[("success", "Success"), ("failed", "Failed"), ("duplicate", "Duplicate")],
                    default="success",
                )),
                ("http_status", models.PositiveIntegerField(default=200)),
                ("invoice_number", models.CharField(max_length=100, blank=True, default="")),
                ("event_code", models.CharField(max_length=50, blank=True, default="")),
                ("error_message", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
            ],
            options={
                "db_table": "webhook_logs",
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["status"], name="wlog_status_idx"),
                    models.Index(fields=["created_at"], name="wlog_created_idx"),
                    models.Index(fields=["invoice_number"], name="wlog_invoice_idx"),
                ],
            },
        ),
    ]
