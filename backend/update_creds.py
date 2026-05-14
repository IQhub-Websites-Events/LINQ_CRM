import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from accounts.models import User

users = User.objects.all().order_by('username')

lines = [
    "# Account Credentials",
    "",
    "| Name | Username | Password |",
    "| :--- | :--- | :--- |"
]

count = 0
for u in users:
    if u.username == 'admin':
        password = '123@hubHP'
    else:
        first = (u.first_name or '').strip().capitalize()
        last = (u.last_name or '').strip().capitalize()
        if not first and not last:
            name_part = u.username.capitalize()
        else:
            name_part = f"{first}{last}"
        
        password = f"{name_part}!2026"
        u.set_password(password)
        u.save(update_fields=['password'])
        count += 1
        
    name_display = f"{u.first_name} {u.last_name}".strip()
    if not name_display:
        name_display = "Administrator" if u.username == 'admin' else u.username
        
    lines.append(f"| {name_display} | `{u.username}` | `{password}` |")

with open('CREDENTIALS.md', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

print(f"Updated {count} passwords and rewrote CREDENTIALS.md with {users.count()} total users.")
