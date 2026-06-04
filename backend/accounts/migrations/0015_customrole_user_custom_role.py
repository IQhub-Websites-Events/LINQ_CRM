from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0014_alter_user_role'),
    ]

    operations = [
        migrations.CreateModel(
            name='CustomRole',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=50, unique=True)),
                ('display_label', models.CharField(max_length=50)),
                ('color', models.CharField(default='#6b7280', max_length=20)),
                ('description', models.TextField(blank=True, default='')),
                ('base_permission', models.CharField(
                    choices=[('admin','Admin'),('sales','Sales'),('market_research','Market Research'),('spex','SpEx'),('operations','Operations'),('speaker_sales','Speaker Sales'),('telemarketing','Telemarketing'),('data_mining','Data Mining')],
                    default='sales', max_length=20,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'db_table': 'custom_roles', 'ordering': ['display_label']},
        ),
        migrations.AddField(
            model_name='user',
            name='custom_role',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='users',
                to='accounts.customrole',
            ),
        ),
    ]
