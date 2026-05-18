import os
import sys
import django
import re

# Set stdout/stderr to use utf-8 to prevent windows print crashes
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

# Add backend folder to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from book_event.models import BookEvent
from book_delegate.models import BookDelegate
from events.models import Event

def migrate_database():
    print("--- Starting Full-Stack Booking Database Migration ---")
    
    # 1. Update all BookEvents
    print("\nProcessing BookEvents...")
    events_updated = 0
    for be in BookEvent.objects.all():
        be.save()
        events_updated += 1
        # Safe ASCII prints to prevent crash
        safe_name = be.event_name.encode('ascii', 'replace').decode('ascii')
        print(f"  Invoice {be.invoice_number} saved: Code '{be.event_code}' | Name '{safe_name}' | Edition '{be.edition}'")
            
    print(f"Finished BookEvents. Total updated: {events_updated}")

    # 2. Update all BookDelegates
    print("\nProcessing BookDelegates...")
    delegates_updated = 0
    for bd in BookDelegate.objects.all():
        bd.save()
        delegates_updated += 1
            
    print(f"Finished BookDelegates. Total updated: {delegates_updated}")
    print("\n--- Full-Stack Booking Database Migration Completed Successfully! ---")

if __name__ == "__main__":
    migrate_database()
