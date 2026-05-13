from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("book_event", "0013_rename_wlog_status_idx_webhook_log_status_58a1da_idx_and_more"),
    ]

    operations = [
        # Add paid_or_free field
        migrations.AddField(
            model_name="bookevent",
            name="paid_or_free",
            field=models.CharField(
                max_length=20,
                choices=[("Paid", "Paid"), ("Free", "Free")],
                blank=True,
                default="",
            ),
        ),
        # Expand payment_status choices (Unpaid + Partial added)
        migrations.AlterField(
            model_name="bookevent",
            name="payment_status",
            field=models.CharField(
                choices=[
                    ("Pending", "Pending"),
                    ("Paid", "Paid"),
                    ("Unpaid", "Unpaid"),
                    ("Partial", "Partial"),
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
        # Expand payment_type choices
        migrations.AlterField(
            model_name="bookevent",
            name="payment_type",
            field=models.CharField(
                choices=[
                    ("Stripe", "Stripe"),
                    ("Bank", "Bank"),
                    ("Bank Transfer", "Bank Transfer"),
                    ("Credit Card", "Credit Card"),
                    ("Cash", "Cash"),
                    ("Complimentary", "Complimentary"),
                    ("Manual", "Manual"),
                    ("Invoice", "Invoice"),
                    ("Wire Transfer", "Wire Transfer"),
                ],
                blank=True,
                default="",
                max_length=30,
            ),
        ),
        # Add TicketTier choices to ticket_tier, increase max_length
        migrations.AlterField(
            model_name="bookevent",
            name="ticket_tier",
            field=models.CharField(
                choices=[
                    ("Standard", "Standard"),
                    ("VIP", "VIP"),
                    ("Speaker", "Speaker"),
                    ("Sponsor", "Sponsor"),
                    ("Delegate", "Delegate"),
                    ("Complimentary", "Complimentary"),
                    ("Student", "Student"),
                    ("Media", "Media"),
                    ("Partner", "Partner"),
                ],
                blank=True,
                default="",
                max_length=50,
            ),
        ),
        # New indexes
        migrations.AddIndex(
            model_name="bookevent",
            index=models.Index(fields=["ticket_tier"], name="book_events_ticket_tier_idx"),
        ),
        migrations.AddIndex(
            model_name="bookevent",
            index=models.Index(fields=["paid_or_free"], name="book_events_paid_or_free_idx"),
        ),
    ]
