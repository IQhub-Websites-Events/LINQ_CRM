import os
import sys
import django

# Add backend folder to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from events.models import Event
from book_event.models import BookEvent
from book_delegate.models import BookDelegate

print("--- Event Catalogue ---")
for ev in Event.objects.all()[:15]:
    print(f"Code: '{ev.event_code}' | Name: '{ev.name}' | Date: '{ev.event_date}'")

print("\n--- BookEvents ---")
for be in BookEvent.objects.all()[:15]:
    print(f"Invoice: '{be.invoice_number}' | Code: '{be.event_code}' | Name: '{be.event_name}'")
