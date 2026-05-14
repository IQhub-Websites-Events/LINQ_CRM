from django.core.management.base import BaseCommand
from django.db import transaction
from book_event.models import BookEvent, WebhookLog, SyncLog
from book_delegate.models import BookDelegate
from historical_event_registry.models import HistoricalEventReference, EventEditionMetrics
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = "Removes all booking-related data including invoices, delegates, logs, and historical metrics"

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Starting to clear all booking module data..."))

        try:
            with transaction.atomic():
                # 1. Delegates
                delegates_count = BookDelegate.objects.count()
                BookDelegate.objects.all().delete()
                self.stdout.write(self.style.SUCCESS(f"Deleted {delegates_count} delegates."))

                # 2. Invoices (BookEvent)
                events_count = BookEvent.objects.count()
                BookEvent.objects.all().delete()
                self.stdout.write(self.style.SUCCESS(f"Deleted {events_count} invoice/booking records."))

                # 3. Webhook & Sync Logs
                webhook_count = WebhookLog.objects.count()
                WebhookLog.objects.all().delete()
                self.stdout.write(self.style.SUCCESS(f"Deleted {webhook_count} webhook logs."))

                sync_count = SyncLog.objects.count()
                SyncLog.objects.all().delete()
                self.stdout.write(self.style.SUCCESS(f"Deleted {sync_count} sync logs."))

                # 4. Historical Reference Data
                hist_ref_count = HistoricalEventReference.objects.count()
                HistoricalEventReference.objects.all().delete()
                self.stdout.write(self.style.SUCCESS(f"Deleted {hist_ref_count} historical event references."))

                # 5. Event Edition Metrics (Cached growth data)
                metrics_count = EventEditionMetrics.objects.count()
                EventEditionMetrics.objects.all().delete()
                self.stdout.write(self.style.SUCCESS(f"Deleted {metrics_count} event edition metrics."))

            self.stdout.write(self.style.SUCCESS("\nSuccessfully removed all booking module data."))
            self.stdout.write(self.style.MIGRATE_LABEL("System is now clean for fresh import."))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"An error occurred: {str(e)}"))
