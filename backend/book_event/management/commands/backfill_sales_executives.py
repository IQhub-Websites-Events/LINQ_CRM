import csv
import os
from django.core.management.base import BaseCommand
from django.db import transaction
from book_event.models import BookEvent
from accounts.models import User


def resolve_sales_exec(name: str, cache: dict) -> "User | None":
    """
    Match a full-name string to a User.
    Strategy (in order):
      1. Exact cache hit (already resolved this name)
      2. first_name + last_name exact match (case-insensitive)
      3. get_full_name() icontains the supplied name
      4. username with dots replaced by spaces icontains the name
    """
    if not name:
        return None
    key = name.strip().lower()
    if key in cache:
        return cache[key]

    parts = name.strip().split()
    user = None

    if len(parts) >= 2:
        user = User.objects.filter(
            first_name__iexact=parts[0],
            last_name__iexact=" ".join(parts[1:]),
        ).first()

    if not user:
        user = User.objects.filter(
            first_name__icontains=parts[0]
        ).filter(
            last_name__icontains=parts[-1]
        ).first() if parts else None

    if not user:
        dot_name = name.strip().replace(" ", ".").lower()
        user = User.objects.filter(username__iexact=dot_name).first()

    cache[key] = user
    return user


class Command(BaseCommand):
    help = (
        "Backfill sales_executive on BookEvent records from the original CSV. "
        "Run with --apply to commit changes; default is dry-run."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Commit updates to the database. Without this flag, runs as a dry-run.",
        )
        parser.add_argument(
            "--csv",
            default=r"C:\Users\harrison peck\Downloads\Event Bookings Report (1).csv",
            help="Path to the original bookings CSV export.",
        )

    def handle(self, *args, **options):
        csv_path = options["csv"]
        if not os.path.exists(csv_path):
            self.stdout.write(self.style.ERROR(f"CSV not found: {csv_path}"))
            return

        cache = {}
        mapping = {}   # invoice_number -> User

        # Build invoice → user mapping from CSV
        with open(csv_path, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                inv = row.get("Invoice Number", "").strip()
                se_name = row.get("Sales Executive", "").strip()
                if inv and se_name:
                    user = resolve_sales_exec(se_name, cache)
                    if user:
                        mapping[inv] = user

        self.stdout.write(f"CSV rows matched:    {len(mapping)}")
        self.stdout.write(f"Unique users found:  {len({u.id for u in mapping.values()})}")

        # Report unresolved names
        unresolved = {
            se for se in (
                row.get("Sales Executive", "").strip()
                for row in csv.DictReader(open(csv_path, encoding="utf-8-sig"))
            )
            if se and se.strip().lower() not in cache
        } | {
            se for se, u in ((k, cache[k]) for k in cache) if u is None
        }
        if unresolved:
            self.stdout.write(self.style.WARNING(
                f"Could NOT resolve these names (will leave NULL): {sorted(unresolved)}"
            ))

        # Count current state
        already_set = BookEvent.objects.filter(sales_executive__isnull=False).count()
        total = BookEvent.objects.count()
        self.stdout.write(f"\nInvoices total:      {total}")
        self.stdout.write(f"Already have SE:     {already_set}")
        self.stdout.write(f"Will be updated:     {len(mapping)}")

        if not options["apply"]:
            self.stdout.write(self.style.WARNING(
                "\nDry-run — no changes written. Re-run with --apply to commit."
            ))
            # Show a sample
            sample = list(mapping.items())[:10]
            self.stdout.write("\nSample (invoice -> user):")
            for inv, u in sample:
                self.stdout.write(f"  {inv:30s} -> {u.get_full_name()} ({u.username})")
            return

        # Apply updates in bulk using per-user batch UPDATE
        from django.db.models import Q
        updated_total = 0
        user_batches = {}
        for inv, user in mapping.items():
            user_batches.setdefault(user.id, []).append(inv)

        with transaction.atomic():
            for user_id, inv_numbers in user_batches.items():
                updated = BookEvent.objects.filter(
                    invoice_number__in=inv_numbers
                ).update(sales_executive_id=user_id)
                updated_total += updated

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. Updated {updated_total} BookEvent records with sales_executive."
        ))
