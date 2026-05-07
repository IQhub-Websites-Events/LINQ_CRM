import logging
import time
from django.core.management.base import BaseCommand
from django.core.cache import cache
from sync.events_sync import sync_events
from sync.bookings_sync import sync_bookings

logger = logging.getLogger('book_event')

class Command(BaseCommand):
    help = "Incremental sync of Events and Bookings to Google Sheets"

    def add_arguments(self, parser):
        parser.add_argument(
            '--full',
            action='store_true',
            help='Wipe and reload all data to Google Sheets',
        )

    def handle(self, *args, **options):
        full = options.get('full', False)
        # 3. Add Locking System
        lock_id = "sync_to_sheets_lock"
        # Using cache.add for atomic locking
        acquire_lock = lambda: cache.add(lock_id, "true", 60 * 60) # Lock for 1 hour max
        release_lock = lambda: cache.delete(lock_id)

        if not acquire_lock():
            self.stdout.write(self.style.WARNING("Sync is already running. Skipping."))
            return

        try:
            start_time = time.time()
            self.stdout.write(f"Starting Global Sync (Full={full})...")

            # Sync Events
            self.stdout.write("Processing Events...")
            sync_events(full=full)
            
            # Sync Bookings
            self.stdout.write("Processing Bookings...")
            sync_bookings(full=full)
            
            duration = time.time() - start_time
            self.stdout.write(self.style.SUCCESS(f"Global Sync completed in {duration:.2f}s"))
            logger.info(f"Global Sync completed in {duration:.2f}s")

        finally:
            release_lock()
