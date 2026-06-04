"""
Seed TicketSequence rows from imported ticket_numbers so the overnight backfill
continues from the highest imported number rather than 10000.

Run once immediately after the full migration import:
    python manage.py seed_ticket_sequences
    python manage.py seed_ticket_sequences --dry-run   # preview only
"""
import logging
from django.core.management.base import BaseCommand
from django.db import transaction
from ticket_central.models import Ticket, TicketSequence
from ticket_central.utils import extract_purpose_code

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Seed TicketSequence counters from imported ticket_numbers."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Show what would be seeded without writing.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        candidates = (
            Ticket.objects
            .exclude(ticket_number="")
            .exclude(ticket_number__iexact="delete")
            .only("ticket_number", "purpose")
        )

        seq_max = {}
        skipped = 0

        for ticket in candidates.iterator(chunk_size=2000):
            tn = ticket.ticket_number.strip()
            parts = tn.rsplit(" ", 1)
            if len(parts) != 2:
                skipped += 1
                continue
            try:
                number = int(parts[1])
            except ValueError:
                skipped += 1
                continue

            purpose_key = extract_purpose_code(ticket.purpose)
            if not purpose_key:
                skipped += 1
                continue

            if purpose_key not in seq_max or number > seq_max[purpose_key]:
                seq_max[purpose_key] = number

        if dry_run:
            self.stdout.write(self.style.WARNING(
                f"DRY RUN: would seed {len(seq_max)} purpose keys, skip {skipped} tickets"
            ))
            for pk, last in sorted(seq_max.items())[:20]:
                self.stdout.write(f"  {pk} → {last}")
            if len(seq_max) > 20:
                self.stdout.write(f"  … and {len(seq_max) - 20} more")
            return

        new_count = 0
        updated_count = 0
        with transaction.atomic():
            for purpose_key, last_number in seq_max.items():
                _, created = TicketSequence.objects.update_or_create(
                    purpose_key=purpose_key,
                    defaults={"last_number": last_number},
                )
                if created:
                    new_count += 1
                else:
                    updated_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Seeded {new_count + updated_count} purpose keys "
            f"({new_count} new, {updated_count} updated). "
            f"Skipped {skipped} tickets (no parseable number)."
        ))
        logger.info(
            "seed_ticket_sequences: total=%d new=%d updated=%d skipped=%d",
            new_count + updated_count, new_count, updated_count, skipped,
        )
