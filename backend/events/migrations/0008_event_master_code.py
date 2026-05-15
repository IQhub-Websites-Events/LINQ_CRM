from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0007_add_status_field'),
    ]

    operations = [
        migrations.AddField(
            model_name='event',
            name='master_code',
            field=models.CharField(blank=True, db_index=True, default='', max_length=50),
        ),
    ]
