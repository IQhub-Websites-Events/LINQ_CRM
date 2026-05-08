from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("book_event", "0011_bookevent_discount_code"),
    ]

    operations = [
        migrations.AlterField(
            model_name="bookevent",
            name="payment_status",
            field=models.CharField(
                choices=[
                    ("Pending", "Pending"),
                    ("Paid", "Paid"),
                    ("Cancelled", "Cancelled"),
                    ("Refunded", "Refunded"),
                    ("Free", "Free"),
                    ("Credit Pending (Free)", "Credit Pending (Free)"),
                    ("Credit Pending (Paid)", "Credit Pending (Paid)"),
                    ("Credit Transferred", "Credit Transferred"),
                    ("Paid (Transferred)", "Paid (Transferred)"),
                ],
                db_index=True,
                default="Pending",
                max_length=30,
            ),
        ),
    ]
