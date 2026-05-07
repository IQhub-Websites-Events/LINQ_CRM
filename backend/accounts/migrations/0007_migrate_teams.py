from django.db import migrations

def migrate_teams(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    Team = apps.get_model('teams', 'Team')

    # Default teams mapping
    team_names = {
        "sales": "Sales Team",
        "speaker_sales": "Speaker Sales Team",
        "spex": "SpEx Team",
        "tele_market": "Tele Marketing Team",
        "market_research": "Market Research Team"
    }

    # Create teams
    team_objects = {}
    for slug, name in team_names.items():
        team, _ = Team.objects.get_or_create(slug=slug, defaults={'name': name})
        team_objects[slug] = team

    # Link users
    for user in User.objects.all():
        if user.team_legacy in team_objects:
            user.team = team_objects[user.team_legacy]
            user.save()

class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0006_user_team_alter_user_team_legacy'),
        ('teams', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(migrate_teams),
    ]
