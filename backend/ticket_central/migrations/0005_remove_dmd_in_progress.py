from django.db import migrations, models


def migrate_dmd_in_progress(apps, schema_editor):
    Ticket = apps.get_model("ticket_central", "Ticket")
    Ticket.objects.filter(status="dmd_in_progress").update(status="mr_submitted")


def reverse_migration(apps, schema_editor):
    # No-op — once removed, cannot be restored
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('ticket_central', '0004_ticketsequence_ticket_added_user_text_and_more'),
    ]

    operations = [
        migrations.RunPython(migrate_dmd_in_progress, reverse_migration),
        migrations.AlterField(
            model_name='ticket',
            name='status',
            field=models.CharField(
                choices=[
                    ('draft', 'Draft'),
                    ('mr_submitted', 'MR Submitted'),
                    ('completed', 'Completed'),
                    ('returned', 'Returned')
                ],
                db_index=True,
                default='draft',
                max_length=20
            ),
        ),
    ]
