from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("book_event", "0015_add_request_date"),
    ]

    operations = [
        migrations.AddField(
            model_name="bookevent",
            name="attendance",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
    ]
