from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("book_delegate", "0005_add_delegate_payment_overrides"),
    ]

    operations = [
        migrations.AddField(
            model_name="bookdelegate",
            name="delegate_paid_or_free",
            field=models.CharField(max_length=20, blank=True, null=True, default=None),
        ),
        migrations.AddField(
            model_name="bookdelegate",
            name="delegate_ticket_tier",
            field=models.CharField(max_length=50, blank=True, null=True, default=None),
        ),
    ]
