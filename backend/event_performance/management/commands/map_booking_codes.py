"""
management command: map_booking_codes

Scans every distinct event_code in BookEvent, parses it to (master_code, year)
using the rule: first 3 alphabetic characters = master, last 2 trailing digits = year.

For each booking code it finds the matching Event record and — if the codes
differ — rewrites BookEvent.event_code to the canonical Event.event_code so the
performance module's exact-match queries work correctly.

Anything it cannot confidently match is written to unmappable_event_codes.md
for manual review.

Usage:
    python manage.py map_booking_codes
    python manage.py map_booking_codes --dry-run   # preview without writing
"""
from collections import defaultdict
from pathlib import Path

from django.core.management.base import BaseCommand

from book_event.models import BookEvent
from events.models import Event
from event_performance.active_edition_service import normalize_master_code, extract_year_from_code


class Command(BaseCommand):
    help = "Maps BookEvent event_codes to canonical Event event_codes."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would change without writing to the database.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        # ── Build Event lookup: (master, year) → [Event] ──────────────────────
        event_lookup: dict[tuple, list] = defaultdict(list)
        for ev in Event.objects.all():
            mc = normalize_master_code(ev.event_code)
            yr = extract_year_from_code(ev.event_code)
            # Also index by event_date.year as a secondary year signal
            date_yr = ev.event_date.year if ev.event_date else None
            event_lookup[(mc, yr)].append(ev)
            if date_yr and date_yr != yr:
                event_lookup[(mc, date_yr)].append(ev)

        # ── Scan all distinct BookEvent codes ─────────────────────────────────
        booking_codes = list(
            BookEvent.objects.values_list("event_code", flat=True)
            .distinct()
            .order_by("event_code")
        )

        updated   = []   # {from, to, event_name, count}
        already   = []   # already matches Event.event_code exactly
        unmapped  = []   # no Event found

        for bc in booking_codes:
            mc = normalize_master_code(bc)
            yr = extract_year_from_code(bc)

            # Skip blank codes
            if not mc:
                unmapped.append({
                    "booking_code": bc,
                    "master": "",
                    "year": None,
                    "reason": "Cannot extract master code",
                    "total_bookings": BookEvent.objects.filter(event_code=bc).count(),
                    "sample_invoices": list(
                        BookEvent.objects.filter(event_code=bc)
                        .values_list("invoice_number", flat=True)[:5]
                    ),
                })
                continue

            candidates = event_lookup.get((mc, yr), [])
            # De-duplicate (an Event can appear under multiple keys)
            seen_ids = set()
            unique_candidates = []
            for ev in candidates:
                if ev.pk not in seen_ids:
                    seen_ids.add(ev.pk)
                    unique_candidates.append(ev)
            candidates = unique_candidates

            if len(candidates) == 1:
                target = candidates[0]
                count = BookEvent.objects.filter(event_code=bc).count()
                if bc == target.event_code:
                    already.append({"code": bc, "event_name": target.name, "count": count})
                else:
                    if not dry_run:
                        BookEvent.objects.filter(event_code=bc).update(
                            event_code=target.event_code
                        )
                    updated.append({
                        "from": bc,
                        "to": target.event_code,
                        "event_name": target.name,
                        "count": count,
                    })

            elif len(candidates) == 0:
                unmapped.append({
                    "booking_code": bc,
                    "master": mc,
                    "year": yr,
                    "reason": f"No Event found for master={mc}, year={yr}",
                    "total_bookings": BookEvent.objects.filter(event_code=bc).count(),
                    "sample_invoices": list(
                        BookEvent.objects.filter(event_code=bc)
                        .values_list("invoice_number", flat=True)[:5]
                    ),
                })

            else:
                unmapped.append({
                    "booking_code": bc,
                    "master": mc,
                    "year": yr,
                    "reason": (
                        f"Ambiguous — {len(candidates)} Events match "
                        f"({mc}, {yr}): "
                        + ", ".join(f"{e.event_code} [{e.name}]" for e in candidates)
                    ),
                    "total_bookings": BookEvent.objects.filter(event_code=bc).count(),
                    "sample_invoices": list(
                        BookEvent.objects.filter(event_code=bc)
                        .values_list("invoice_number", flat=True)[:5]
                    ),
                })

        # ── Write unmapped markdown ────────────────────────────────────────────
        md_path = (
            Path(__file__).resolve()
            .parent.parent.parent.parent.parent  # repo root
            / "unmappable_event_codes.md"
        )

        if unmapped:
            lines = [
                "# Unmappable Booking Event Codes\n\n",
                f"> Generated by `map_booking_codes`. "
                f"**{len(unmapped)} code(s)** require manual mapping.\n\n",
                "| Booking Code | Master | Year | Total Bookings | Reason | Sample Invoices |\n",
                "|---|---|---|---|---|---|\n",
            ]
            for u in unmapped:
                invoices = " · ".join(u.get("sample_invoices", []))
                lines.append(
                    f"| `{u['booking_code']}` "
                    f"| {u.get('master') or '—'} "
                    f"| {u.get('year') or '—'} "
                    f"| {u.get('total_bookings', 0)} "
                    f"| {u['reason']} "
                    f"| {invoices} |\n"
                )
            md_path.write_text("".join(lines), encoding="utf-8")
            self.stdout.write(
                self.style.WARNING(
                    f"Wrote {len(unmapped)} unmapped entries -> {md_path}"
                )
            )
        elif md_path.exists():
            md_path.unlink()  # clean up if everything is now mapped

        # ── Summary ───────────────────────────────────────────────────────────
        prefix = "[DRY RUN] " if dry_run else ""
        self.stdout.write(self.style.SUCCESS(
            f"{prefix}Updated : {len(updated)} codes "
            f"({sum(u['count'] for u in updated)} booking records)"
        ))
        self.stdout.write(
            f"Already OK: {len(already)} codes "
            f"({sum(a['count'] for a in already)} booking records)"
        )
        self.stdout.write(self.style.WARNING(
            f"Unmapped  : {len(unmapped)} codes — see unmappable_event_codes.md"
        ))

        if updated:
            self.stdout.write("\nUpdated mappings:")
            for u in updated:
                flag = " (dry run)" if dry_run else ""
                safe_name = u['event_name'].encode('ascii', errors='replace').decode('ascii')
                self.stdout.write(
                    f"  {u['from']:30s} -> {u['to']:20s}  [{safe_name}]"
                    f"  ({u['count']} records){flag}"
                )
