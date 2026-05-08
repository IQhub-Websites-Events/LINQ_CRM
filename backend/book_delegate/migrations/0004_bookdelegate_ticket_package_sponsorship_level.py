from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("book_delegate", "0003_alter_bookdelegate_options"),
    ]

    operations = [
        migrations.AddField(
            model_name="bookdelegate",
            name="ticket_package",
            field=models.CharField(max_length=100, blank=True, default=""),
        ),
        migrations.AddField(
            model_name="bookdelegate",
            name="sponsorship_level",
            field=models.CharField(max_length=100, blank=True, default=""),
        ),
    ]
