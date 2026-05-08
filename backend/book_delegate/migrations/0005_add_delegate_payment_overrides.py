from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("book_delegate", "0004_bookdelegate_ticket_package_sponsorship_level"),
    ]
    operations = [
        migrations.AddField(
            model_name="bookdelegate",
            name="delegate_payment_status",
            field=models.CharField(max_length=50, blank=True, null=True, default=None),
        ),
        migrations.AddField(
            model_name="bookdelegate",
            name="delegate_payment_type",
            field=models.CharField(max_length=50, blank=True, null=True, default=None),
        ),
        migrations.AddField(
            model_name="bookdelegate",
            name="delegate_payment_date",
            field=models.DateField(blank=True, null=True, default=None),
        ),
    ]
