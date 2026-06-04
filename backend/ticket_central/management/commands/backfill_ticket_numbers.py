"""
backfill_ticket_numbers
───────────────────────
Assigns ticket_numbers to tickets that don't have one yet.
Mirrors the Zoho Deluge BackfillTicketNumbers_Batch job.

Run daily at 07:00 IST (01:30 UTC) via cron, or on demand by admin.
Sequence updates happen once per run, at the end, inside one transaction (D6).
"""
import logging

from django.core.management.base import BaseCommand
from django.db import transaction

from ticket_central.models import Ticket, TicketSequence
from ticket_central.utils import (
    extract_type_code, extract_purpose_code, build_ticket_number,
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Assign ticket_numbers to tickets that don't have one yet."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true",
            help="Compute what would happen but don't save.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        # ── STEP 1: pre-load all sequences into memory ──
        seq_map = {}
        for seq in TicketSequence.objects.all():
            seq_map[seq.purpose_key.strip()] = seq.last_number or 10000

        # ── STEP 2: tickets needing a number ──
        pending = Ticket.objects.filter(ticket_number__exact="").order_by("created_at")

        total_found = 0
        total_skipped = 0
        tickets_to_update = []
        modified_purposes = set()

        for ticket in pending:
            purpose_code = extract_purpose_code(ticket.purpose)
            if not purpose_code:
                total_skipped += 1
                logger.info("Skipped ticket id=%s — no Purpose", ticket.id)
                continue

            type_code = extract_type_code(ticket.type_of_ticket)  # may be ""

            next_num = seq_map.get(purpose_code, 10000) + 1
            seq_map[purpose_code] = next_num
            modified_purposes.add(purpose_code)

            ticket.ticket_number = build_ticket_number(type_code, purpose_code, next_num)
            tickets_to_update.append(ticket)
            total_found += 1

        # ── STEP 3: atomic batch save ──
        if dry_run:
            self.stdout.write(self.style.WARNING(
                f"DRY RUN: would number {total_found} tickets, "
                f"skip {total_skipped}, update {len(modified_purposes)} sequences"
            ))
            return

        if tickets_to_update:
            with transaction.atomic():
                Ticket.objects.bulk_update(tickets_to_update, ["ticket_number"])
                for purpose_key in modified_purposes:
                    TicketSequence.objects.update_or_create(
                        purpose_key=purpose_key,
                        defaults={"last_number": seq_map[purpose_key]},
                    )

        self.stdout.write(self.style.SUCCESS(
            f"Done. Numbered: {total_found}. "
            f"Skipped (no Purpose): {total_skipped}. "
            f"Sequences updated: {len(modified_purposes)}."
        ))
        logger.info(
            "backfill_ticket_numbers complete: found=%s skipped=%s sequences_updated=%s",
            total_found, total_skipped, len(modified_purposes),
        )
