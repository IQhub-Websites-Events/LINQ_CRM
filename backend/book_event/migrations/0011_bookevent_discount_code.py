from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("book_event", "0010_bookevent_website_fields_webhooklog"),
    ]

    operations = [
        migrations.AddField(
            model_name="bookevent",
            name="discount_code",
            field=models.CharField(max_length=100, blank=True, default=""),
        ),
    ]
