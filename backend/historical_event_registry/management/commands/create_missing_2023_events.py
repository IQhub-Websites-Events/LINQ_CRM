"""
management/commands/create_missing_2023_events.py

Creates 36 hardcoded 2023 CRM Event records that were missing from the CRM
(causing 'unmatched' status during the 2023 historical import), then wipes
all 2023 HistoricalEventReference rows and re-runs the import so those
records can now be matched.

Usage:
    python manage.py create_missing_2023_events
    python manage.py create_missing_2023_events --dry-run
"""
import datetime

from django.core.management.base import BaseCommand

from events.models import Event
from historical_event_registry.models import HistoricalEventReference
from historical_event_registry.services import Historical2023ImportService


# ---------------------------------------------------------------------------
# The 36 2023 events that were unmatched in HISTORICAL_2023_IMPORT_ERRORS.md
# Each entry: (event_code, name, city, country, event_date, end_date)
# event_date / end_date are best-guess dates from the 2023 PDF date ranges.
# ---------------------------------------------------------------------------
MISSING_2023_EVENTS = [
    # code        name                                     city                   country       event_date      end_date
    ("BSG",  "Business Summit Global 2023",                "Singapore",           "Singapore",  datetime.date(2023,  2,  8), datetime.date(2023,  2,  9)),
    ("VTU",  "Venture Tech USA 2023",                      "Cambridge",           "USA",        datetime.date(2023,  3, 20), datetime.date(2023,  3, 23)),
    ("GSO",  "Global Summit Online 2023",                  "Cambridge",           "USA",        datetime.date(2023,  3, 20), datetime.date(2023,  3, 23)),
    ("CCS",  "Corporate Conference Summit 2023",           "Williamsburg",        "USA",        datetime.date(2023,  3, 22), datetime.date(2023,  3, 23)),
    ("AWC",  "Advanced Wireless Conference 2023",          "Willow Grove",        "USA",        datetime.date(2023,  3, 28), datetime.date(2023,  3, 29)),
    ("IBU",  "Innovation Business USA 2023",               "Orange County",       "USA",        datetime.date(2023,  3, 28), datetime.date(2023,  3, 30)),
    ("PDE",  "Petroleum Downstream Expo 2023",             "Calgary",             "Canada",     datetime.date(2023,  4,  3), datetime.date(2023,  4,  5)),
    ("DIMI", "Digital Innovation & Marketing Insight 2023","Los Angeles",         "USA",        datetime.date(2023,  4, 25), datetime.date(2023,  4, 26)),
    ("WNJ",  "Wireless Network Japan 2023",                "Los Angeles",         "USA",        datetime.date(2023,  4, 26), datetime.date(2023,  4, 27)),
    ("SNU",  "Sustainability Now USA 2023",                "Los Angeles",         "USA",        datetime.date(2023,  5,  3), datetime.date(2023,  5,  4)),
    ("WVE",  "Water & Vertical Engineering 2023",          "",                    "USA",        datetime.date(2023,  5,  8), datetime.date(2023,  5,  9)),
    ("GWU",  "Global Water USA 2023",                      "Toronto",             "Canada",     datetime.date(2023,  5, 22), datetime.date(2023,  5, 25)),
    ("WWAC", "World Water & Agriculture Conference 2023",  "Toronto",             "Canada",     datetime.date(2023,  5, 22), datetime.date(2023,  5, 25)),
    ("AUF",  "Automation USA Forum 2023",                  "Houston",             "USA",        datetime.date(2023,  5, 30), datetime.date(2023,  5, 31)),
    ("MNE",  "Mining & Natural Extraction 2023",           "London",              "UK",         datetime.date(2023,  6, 15), datetime.date(2023,  6, 17)),
    ("BMU",  "Battery & Mobility USA 2023",                "",                    "USA",        datetime.date(2023,  6, 26), datetime.date(2023,  6, 27)),
    ("AWE",  "Advanced Wind Energy 2023",                  "",                    "USA",        datetime.date(2023,  7, 10), datetime.date(2023,  7, 11)),
    ("PRO",  "Petrochemicals & Refining Online 2023",      "Buenos Aires",        "Argentina",  datetime.date(2023,  8,  6), datetime.date(2023,  8, 10)),
    ("BLBT", "Battery & Low-Carbon Business Tech 2023",    "London",              "UK",         datetime.date(2023,  8,  8), datetime.date(2023,  8,  9)),
    ("GFS",  "Global Fuels Summit 2023",                   "Buenos Aires",        "Argentina",  datetime.date(2023,  8,  8), datetime.date(2023,  8, 10)),
    ("WAIS", "World AI Summit 2023",                       "Munich",              "Germany",    datetime.date(2023,  8, 14), datetime.date(2023,  8, 16)),
    ("MWO",  "Manufacturing World Online 2023",            "Boston",              "USA",        datetime.date(2023,  8, 28), datetime.date(2023,  8, 29)),
    ("DDF",  "Digital Disruption Forum 2023",              "",                    "USA",        datetime.date(2023,  8, 28), datetime.date(2023,  8, 29)),
    ("PPTV", "Pipeline & Process Technology Vegas 2023",   "Munich",              "Germany",    datetime.date(2023,  9,  6), datetime.date(2023,  9,  7)),
    ("GES",  "Global Energy Summit 2023",                  "",                    "USA",        datetime.date(2023,  9,  7), datetime.date(2023,  9,  7)),
    ("IRF",  "Integrity & Reliability Forum 2023",         "Calgary",             "Canada",     datetime.date(2023,  9, 13), datetime.date(2023,  9, 14)),
    ("WLC",  "Water & Lifecycle Conference 2023",          "Toronto",             "Canada",     datetime.date(2023,  9, 20), datetime.date(2023,  9, 21)),
    ("CUF",  "Corrosion & Upstream Forum 2023",            "Calgary",             "Canada",     datetime.date(2023,  9, 25), datetime.date(2023,  9, 26)),
    ("WWME", "World Water & Marine Energy 2023",           "Abu Dhabi",           "UAE",        datetime.date(2023, 10, 16), datetime.date(2023, 10, 17)),
    ("WEEM", "World Energy & Environment Meet 2023",       "Abu Dhabi",           "UAE",        datetime.date(2023, 10, 18), datetime.date(2023, 10, 19)),
    ("PBU",  "Power & Battery USA 2023",                   "Houston",             "USA",        datetime.date(2023, 10, 25), datetime.date(2023, 10, 28)),
    ("VHE",  "Vehicle & Heavy Equipment 2023",             "Berlin",              "Germany",    datetime.date(2023, 11, 13), datetime.date(2023, 11, 16)),
    ("SSU",  "Sustainability Summit USA 2023",             "Los Angeles",         "USA",        datetime.date(2023, 11, 15), datetime.date(2023, 11, 16)),
    ("DIM",  "Digital Infrastructure & Mobility 2023",     "Singapore",           "Singapore",  datetime.date(2023, 12, 11), datetime.date(2023, 12, 12)),
    ("WDSS", "World Data & Smart Systems 2023",            "Detroit",             "USA",        datetime.date(2023, 12, 13), datetime.date(2023, 12, 14)),
    ("HTU",  "Hydrogen Tech USA 2023",                     "Los Angeles",         "USA",        datetime.date(2023, 12, 13), datetime.date(2023, 12, 14)),
]


class Command(BaseCommand):
    help = (
        "Create 36 missing 2023 CRM Event records, then wipe unmatched "
        "2023 HistoricalEventReference rows and re-run the 2023 import."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=False,
            help="Show what would be created/deleted without touching the database.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write("[create_missing_2023_events] DRY-RUN mode -- no DB writes.")

        # ------------------------------------------------------------------
        # 1. Create missing Event records
        # ------------------------------------------------------------------
        self.stdout.write("")
        self.stdout.write("=== Step 1: Creating missing 2023 Event records ===")
        created_count  = 0
        skipped_count  = 0

        for (code, name, city, country, event_date, end_date) in MISSING_2023_EVENTS:
            exists = Event.objects.filter(event_code=code).exists()
            if exists:
                self.stdout.write(f"  [SKIP]    {code:<10} already exists in CRM.")
                skipped_count += 1
                continue

            if dry_run:
                self.stdout.write(
                    f"  [DRY-RUN] Would create Event: {code:<10} | {name}"
                )
                created_count += 1
                continue

            Event.objects.create(
                event_code=code,
                name=name,
                sub_company=Event.SubCompany.CONFERENCES,
                status=Event.Status.COMPLETED,
                city=city,
                country=country,
                event_date=event_date,
                end_date=end_date,
                accepting_web_bookings=False,
            )
            self.stdout.write(f"  [CREATED] {code:<10} | {name}")
            created_count += 1

        self.stdout.write(
            f"\n  Created: {created_count}  |  Skipped (already existed): {skipped_count}"
        )

        # ------------------------------------------------------------------
        # 2. Wipe unmatched 2023 historical references
        # ------------------------------------------------------------------
        self.stdout.write("")
        self.stdout.write("=== Step 2: Wiping unmatched 2023 HistoricalEventReference rows ===")

        unmatched_qs = HistoricalEventReference.objects.filter(
            event_year=2023,
            verification_status=HistoricalEventReference.VerificationStatus.UNMATCHED,
        )
        unmatched_count = unmatched_qs.count()

        if dry_run:
            self.stdout.write(
                f"  [DRY-RUN] Would delete {unmatched_count} unmatched 2023 reference(s)."
            )
        else:
            deleted, _ = unmatched_qs.delete()
            self.stdout.write(f"  Deleted {deleted} unmatched 2023 reference(s).")

        # ------------------------------------------------------------------
        # 3. Re-run 2023 import service
        # ------------------------------------------------------------------
        self.stdout.write("")
        self.stdout.write("=== Step 3: Re-running 2023 historical import service ===")

        service = Historical2023ImportService(dry_run=dry_run)
        summary = service.run()

        self.stdout.write("")
        self.stdout.write("--- 2023 Re-import Summary ---")
        self.stdout.write(f"  Total rows processed : {summary['total']}")
        self.stdout.write(f"  Verified             : {summary['verified']}")
        self.stdout.write(f"  Unmatched            : {summary['unmatched']}")
        self.stdout.write(f"  Failed               : {summary['failed']}")
        self.stdout.write(f"  Duplicates skipped   : {summary['duplicates']}")

        still_unmatched = summary.get("errors", [])
        if still_unmatched:
            self.stdout.write("")
            self.stdout.write(
                f"  WARNING: {len(still_unmatched)} row(s) still unmatched after re-import:"
            )
            for rec in still_unmatched:
                code   = rec.get("original_code") or rec.get("normalized_code") or "(empty)"
                month  = rec.get("event_month", "")
                reason = rec.get("error_reason", "")
                self.stdout.write(f"    {code:<10} {month:<12}  {reason}")

        self.stdout.write("")
        self.stdout.write("[create_missing_2023_events] Done.")
