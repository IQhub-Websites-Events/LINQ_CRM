import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("book_delegate", "0006_delegate_paid_or_free_ticket_tier"),
        ("book_event", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="bookdelegate",
            name="invoice",
            field=models.ForeignKey(
                db_column="invoice_number",
                db_constraint=False,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="delegates",
                to="book_event.bookevent",
                to_field="invoice_number",
            ),
        ),
    ]
