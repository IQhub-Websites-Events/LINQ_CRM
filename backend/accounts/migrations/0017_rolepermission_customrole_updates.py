from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0016_customrole_user_custom_role'),
    ]

    operations = [
        migrations.RemoveField(model_name='customrole', name='base_permission'),
        migrations.AddField(
            model_name='customrole',
            name='is_all_access',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='customrole',
            name='is_system_role',
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name='RolePermission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('module', models.CharField(max_length=50)),
                ('can_view', models.BooleanField(default=False)),
                ('can_create', models.BooleanField(default=False)),
                ('can_update', models.BooleanField(default=False)),
                ('can_delete', models.BooleanField(default=False)),
                ('custom_role', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='permissions',
                    to='accounts.customrole',
                )),
            ],
            options={'db_table': 'role_permissions', 'ordering': ['module'], 'unique_together': {('custom_role', 'module')}},
        ),
    ]
