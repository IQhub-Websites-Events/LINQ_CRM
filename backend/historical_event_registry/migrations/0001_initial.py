import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("events", "0007_add_status_field"),
    ]

    operations = [
        migrations.CreateModel(
            name="HistoricalEventReference",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event", models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="historical_references",
                    to="events.event",
                )),
                ("original_event_code",   models.CharField(max_length=50)),
                ("normalized_event_code", models.CharField(db_index=True, max_length=50)),
                ("event_year",            models.PositiveIntegerField(db_index=True)),
                ("event_month",           models.CharField(max_length=20)),
                ("event_location",        models.CharField(blank=True, default="", max_length=255)),
                ("source_pdf",            models.CharField(default="2023.pdf", max_length=255)),
                ("source_page",           models.PositiveIntegerField(default=1)),
                ("raw_row_data",          models.JSONField(default=dict)),
                ("verification_status",   models.CharField(
                    choices=[
                        ("pending",   "Pending"),
                        ("verified",  "Verified"),
                        ("failed",    "Failed"),
                        ("unmatched", "Unmatched"),
                    ],
                    db_index=True, default="pending", max_length=20,
                )),
                ("matched_confidence", models.FloatField(default=0.0)),
                ("created_at",         models.DateTimeField(auto_now_add=True)),
                ("updated_at",         models.DateTimeField(auto_now=True)),
            ],
            options={
                "db_table":  "historical_event_references",
                "ordering":  ["event_year", "event_month", "normalized_event_code"],
            },
        ),
        migrations.AlterUniqueTogether(
            name="historicaleventreference",
            unique_together={("normalized_event_code", "event_year", "event_month")},
        ),
    ]
