from django.core.management.base import BaseCommand
from book_event.models import BookEvent


class Command(BaseCommand):
    help = "Fix BookEvent records where edition is an Excel date serial number instead of a year."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Actually apply the fix. Without this flag, runs as a dry-run.",
        )

    def handle(self, *args, **options):
        qs = BookEvent.objects.filter(edition__gt=9999)
        count = qs.count()

        if count == 0:
            self.stdout.write(self.style.SUCCESS("No bad edition values found. Nothing to do."))
            return

        self.stdout.write(f"Found {count} BookEvent records with Excel serial edition values.")

        from datetime import date, timedelta
        excel_epoch = date(1899, 12, 30)
        from django.db.models import Count
        breakdown = (
            qs.values("edition")
              .annotate(c=Count("id"))
              .order_by("-c")
        )
        for row in breakdown:
            serial = row["edition"]
            actual_date = excel_epoch + timedelta(days=serial)
            self.stdout.write(f"  Serial {serial} -> {actual_date} -> year {actual_date.year}  ({row['c']} records)")

        if not options["apply"]:
            self.stdout.write(self.style.WARNING(
                "\nDry-run only. All records above would be set to edition=2026. "
                "Run with --apply to execute."
            ))
            return

        updated = qs.update(edition=2026)
        self.stdout.write(self.style.SUCCESS(f"Done. Updated {updated} records to edition=2026."))
