import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("historical_event_registry", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="EventEditionMetrics",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="edition_metrics",
                    to="events.event",
                )),
                ("event_year",  models.PositiveIntegerField(db_index=True)),
                ("event_code",  models.CharField(db_index=True, max_length=50)),
                ("location",    models.CharField(blank=True, default="", max_length=255)),
                ("edition_start_date", models.DateField(blank=True, null=True)),
                ("edition_end_date",   models.DateField(blank=True, null=True)),
                ("total_sales",     models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ("total_bookings",  models.PositiveIntegerField(default=0)),
                ("total_paid",      models.PositiveIntegerField(default=0)),
                ("total_unpaid",    models.PositiveIntegerField(default=0)),
                ("total_delegates", models.PositiveIntegerField(default=0)),
                ("previous_year_sales",  models.DecimalField(blank=True, decimal_places=2, max_digits=14, null=True)),
                ("growth_pct",           models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True)),
                ("booking_growth_pct",   models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True)),
                ("delegate_growth_pct",  models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True)),
                ("computed_at", models.DateTimeField(auto_now=True)),
                ("created_at",  models.DateTimeField(auto_now_add=True)),
            ],
            options={
                "db_table": "event_edition_metrics",
                "ordering": ["event_code", "event_year"],
                "indexes": [
                    models.Index(fields=["event_code", "event_year"], name="eem_code_year_idx"),
                ],
            },
        ),
        migrations.AddConstraint(
            model_name="eventeditionmetrics",
            constraint=models.UniqueConstraint(
                fields=["event", "event_year"],
                name="unique_event_edition_metrics",
            ),
        ),
    ]
