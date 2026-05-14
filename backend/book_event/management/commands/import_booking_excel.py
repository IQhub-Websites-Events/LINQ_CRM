"""
management command: import_booking_excel

Wipes ALL BookDelegate + BookEvent rows and re-imports from the given Excel
workbook. Every row in the workbook is one delegate; rows sharing the same
Invoice Number belong to the same invoice (BookEvent).

Excel column → model field mapping:
  Payment Status    → BookEvent.payment_status
  Event Code        → BookEvent.event_code  (resolved to canonical Event.event_code
                       via master_code + year lookup)
  Booking Code      → BookEvent.booking_code
  Invoice Date      → BookEvent.invoice_date
  Invoice Number    → BookEvent.invoice_number
  Delegate Company  → BookEvent.company_name  +  BookDelegate.company_name_raw
  Accounts Contact  → BookEvent.accounts_contact_email
  Paid/Free         → BookEvent.paid_or_free
  Date Paid         → BookEvent.payment_date
  Payment Type      → BookEvent.payment_type
  Ticket Tier       → BookEvent.ticket_tier
  Discount          → BookEvent.discount_code
  Add-Ons           → BookEvent.add_ons
  Ref               → BookEvent.reference
  Event Name        → BookEvent.event_name
  Sales Executive   → BookEvent.sales_executive (FK, matched by full name)
  Added Time        → BookEvent.created_at  +  BookDelegate.created_at
  Name              → BookDelegate.first_name + last_name
  Delegate Email    → BookDelegate.email  (+ BookEvent.contact_email for first)
  Direct Line       → BookDelegate.phone_number  (+ BookEvent.contact_phone for first)
  Delegate Number   → BookDelegate.delegate_number
  Attendance - IN?  → BookDelegate.attendance  ("true" → "Confirmed", else "Pending")

Any invoices that cannot be matched to an Event are written to import_issues.md
in the repo root for manual resolution.

Usage:
    python manage.py import_booking_excel "path/to/file.xlsx"
    python manage.py import_booking_excel "path/to/file.xlsx" --dry-run
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date as Date
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import pandas as pd
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from book_delegate.models import BookDelegate
from book_event.models import BookEvent
from events.models import Event
from event_performance.active_edition_service import (
    extract_year_from_code,
    normalize_master_code,
)

User = get_user_model()

_EXCEL_EPOCH = datetime(1899, 12, 30)


def _s(v) -> str:
    """Any value → stripped string; '' for None / NaN / blank."""
    if v is None or v == "":
        return ""
    s = str(v).strip()
    return "" if s.lower() in ("nan", "none", "nat") else s


def _parse_date(v) -> Optional[Date]:
    sv = _s(v)
    if not sv:
        return None
    try:
        return pd.to_datetime(sv).date()
    except Exception:
        return None


def _xl_dt(v) -> Optional[datetime]:
    """Parse an Excel serial number (float string) or date string to datetime."""
    sv = _s(v)
    if not sv:
        return None
    # Try Excel serial number first (plain float, post-2009 = > 40000 days)
    try:
        f = float(sv)
        if f > 40000:
            return _EXCEL_EPOCH + timedelta(days=f)
    except ValueError:
        pass
    # Fall back to string-based date parse
    try:
        return pd.to_datetime(sv).to_pydatetime()
    except Exception:
        return None


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    """Make a naive datetime timezone-aware using Django's current tz."""
    if dt is None:
        return None
    if timezone.is_naive(dt):
        return timezone.make_aware(dt)
    return dt


class Command(BaseCommand):
    help = "Wipe all booking data and re-import from an Excel workbook."

    def add_arguments(self, parser):
        parser.add_argument("excel_path", type=str, help="Path to the .xlsx file")
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview counts and issues without writing to the database.",
        )

    def handle(self, *args, **options):
        path = Path(options["excel_path"])
        dry_run = options["dry_run"]
        prefix = "[DRY RUN] " if dry_run else ""

        if not path.exists():
            raise CommandError(f"File not found: {path}")

        # ── 1. Load Excel ─────────────────────────────────────────────────────
        self.stdout.write(f"Reading {path} ...")
        df = pd.read_excel(
            str(path),
            dtype=str,
            keep_default_na=False,
            engine="openpyxl",
        )
        self.stdout.write(f"  {len(df):,} rows x {df.shape[1]} columns loaded.")

        # ── 2. Build Event lookup: (master_code, year) → Event ───────────────
        event_lookup: dict[tuple, Event] = {}
        for ev in Event.objects.all():
            mc = normalize_master_code(ev.event_code)
            yr = extract_year_from_code(ev.event_code)
            if (mc, yr) not in event_lookup:
                event_lookup[(mc, yr)] = ev
            # Also index by calendar year from event_date as fallback
            if ev.event_date:
                dy = ev.event_date.year
                if dy != yr and (mc, dy) not in event_lookup:
                    event_lookup[(mc, dy)] = ev

        self.stdout.write(f"  {len(event_lookup)} event (master, year) keys built.")

        # ── 3. Build User lookup: lowercase full name → User ─────────────────
        user_lookup: dict[str, User] = {}
        for u in User.objects.all():
            full = f"{u.first_name} {u.last_name}".strip()
            if full:
                user_lookup[full.lower()] = u
            user_lookup[u.username.lower()] = u

        # ── 4. Group rows by Invoice Number ───────────────────────────────────
        by_invoice: dict[str, list] = defaultdict(list)
        skipped = 0
        for _, row in df.iterrows():
            inv = _s(row.get("Invoice Number", ""))
            if not inv:
                skipped += 1
                continue
            by_invoice[inv].append(row)

        if skipped:
            self.stdout.write(
                self.style.WARNING(f"  Skipped {skipped} rows with no Invoice Number.")
            )
        self.stdout.write(f"  {len(by_invoice):,} unique invoices found.")

        # ── 5. Build BookEvent + BookDelegate objects ──────────────────────────
        events_to_create: list[BookEvent] = []
        delegates_to_create: list[BookDelegate] = []
        issues: list[dict] = []

        for inv_num, rows in by_invoice.items():
            first = rows[0]
            excel_code = _s(first.get("Event Code", ""))
            mc = normalize_master_code(excel_code)
            yr = extract_year_from_code(excel_code)
            event = event_lookup.get((mc, yr))

            if not event:
                issues.append({
                    "invoice_number": inv_num,
                    "excel_code": excel_code,
                    "master": mc or "—",
                    "year": str(yr) if yr else "—",
                    "event_name": _s(first.get("Event Name", "")),
                    "delegate_count": len(rows),
                    "sample_delegates": " | ".join(
                        _s(r.get("Name", "")) for r in rows[:3]
                    ),
                    "reason": f"No Event found for master={mc}, year={yr}",
                })
                continue

            canonical_code = event.event_code

            # ── Sales executive ──────────────────────────────────────────────
            rep_name = _s(first.get("Sales Executive", ""))
            rep: Optional[User] = None
            if rep_name:
                rep = user_lookup.get(rep_name.lower())
                if not rep:
                    # Partial first-name fallback
                    first_token = rep_name.lower().split()[0]
                    for key, u in user_lookup.items():
                        if key.startswith(first_token):
                            rep = u
                            break
                if not rep:
                    issues.append({
                        "invoice_number": inv_num,
                        "excel_code": excel_code,
                        "master": mc or "—",
                        "year": str(yr) if yr else "—",
                        "event_name": _s(first.get("Event Name", "")),
                        "delegate_count": len(rows),
                        "sample_delegates": _s(first.get("Name", "")),
                        "reason": (
                            f"Sales executive '{rep_name}' not found — "
                            "invoice created without rep assignment"
                        ),
                    })

            # ── BookEvent ────────────────────────────────────────────────────
            added_dt = _aware(_xl_dt(_s(first.get("Added Time", ""))))
            contact_name  = _s(first.get("Name", ""))
            contact_email = _s(first.get("Delegate Email", ""))
            contact_phone = _s(first.get("Direct Line", ""))

            be = BookEvent(
                invoice_number         = inv_num,
                event_code             = canonical_code,
                event_name             = _s(first.get("Event Name", "")) or event.name,
                request_date           = _parse_date(_s(first.get("Request Date", ""))),
                invoice_date           = _parse_date(_s(first.get("Invoice Date", ""))),
                booking_code           = _s(first.get("Booking Code", "")),
                company_name           = _s(first.get("Delegate Company", "")),
                contact_name           = contact_name,
                contact_email          = contact_email,
                contact_phone          = contact_phone,
                accounts_contact_email = _s(first.get("Accounts Contact", "")),
                paid_or_free           = _s(first.get("Paid/Free", "")),
                payment_date           = _parse_date(_s(first.get("Date Paid", ""))),
                payment_type           = _s(first.get("Payment Type", "")),
                payment_status         = _s(first.get("Payment Status", "")) or "Pending",
                ticket_tier            = _s(first.get("Ticket Tier", "")),
                discount_code          = _s(first.get("Discount", "")),
                add_ons                = _s(first.get("Add-Ons", "")),
                reference              = _s(first.get("Ref", "")),
                sales_executive        = rep,
                delegate_count         = len(rows),
                source                 = "manual",
            )
            if added_dt:
                be.created_at = added_dt

            events_to_create.append(be)

            # ── BookDelegates ─────────────────────────────────────────────────
            seen_emails: set[str] = set()
            for idx, row in enumerate(rows):
                full_name = _s(row.get("Name", ""))
                parts = full_name.split(None, 1)
                first_name = parts[0] if parts else "Unknown"
                last_name  = parts[1] if len(parts) > 1 else ""

                email = _s(row.get("Delegate Email", ""))
                if not email:
                    email = f"noemail.{idx}@{inv_num.replace('/', '-')}.import"
                # Deduplicate email within same invoice
                base_email = email.lower()
                if base_email in seen_emails:
                    local, domain = email.rsplit("@", 1)
                    email = f"{local}.{idx}@{domain}"
                    base_email = email.lower()
                seen_emails.add(base_email)

                attendance_raw = _s(row.get("Attendance - IN?", "")).lower()
                attendance = "Confirmed" if attendance_raw in ("true", "1", "yes") else "Pending"

                del_num_s = _s(row.get("Delegate Number", ""))
                try:
                    del_num = int(float(del_num_s)) if del_num_s else 1
                except (ValueError, OverflowError):
                    del_num = 1

                del_dt = _aware(_xl_dt(_s(row.get("Added Time", ""))))

                bd = BookDelegate(
                    invoice_id       = inv_num,   # to_field="invoice_number"
                    event_code       = canonical_code,
                    first_name       = first_name,
                    last_name        = last_name,
                    email            = email,
                    phone_number     = _s(row.get("Direct Line", "")),
                    company_name_raw = _s(row.get("Delegate Company", "")),
                    delegate_number  = del_num,
                    attendance       = attendance,
                )
                if del_dt:
                    bd.created_at = del_dt

                delegates_to_create.append(bd)

        # ── 6. Write issues MD ────────────────────────────────────────────────
        md_path = (
            Path(__file__).resolve()
            .parent.parent.parent.parent.parent
            / "import_issues.md"
        )
        if issues:
            lines = [
                "# Booking Import Issues\n\n",
                f"> Generated by `import_booking_excel`. "
                f"**{len(issues)} issue(s)** require manual review.\n\n",
                "| Invoice Number | Event Code | Master | Year | Event Name | Delegates | Reason |\n",
                "|---|---|---|---|---|---|---|\n",
            ]
            for iss in issues:
                safe_name = iss["event_name"].encode("ascii", errors="replace").decode("ascii")
                safe_delegates = iss["sample_delegates"].encode("ascii", errors="replace").decode("ascii")
                lines.append(
                    f"| `{iss['invoice_number']}` "
                    f"| `{iss['excel_code']}` "
                    f"| {iss['master']} "
                    f"| {iss['year']} "
                    f"| {safe_name or '—'} "
                    f"| {iss['delegate_count']} ({safe_delegates}) "
                    f"| {iss['reason']} |\n"
                )
            if not dry_run:
                md_path.write_text("".join(lines), encoding="utf-8")
            self.stdout.write(
                self.style.WARNING(
                    f"{prefix}Issues: {len(issues)} -> {md_path}"
                )
            )

        # ── 7. Summary ────────────────────────────────────────────────────────
        self.stdout.write(
            f"\n{prefix}Invoices   : {len(events_to_create):,}"
        )
        self.stdout.write(
            f"{prefix}Delegates  : {len(delegates_to_create):,}"
        )
        self.stdout.write(
            self.style.WARNING(
                f"{prefix}Issues     : {len(issues)} -- see import_issues.md"
            )
        )

        if dry_run:
            self.stdout.write(self.style.SUCCESS("\nDry run complete -- no changes made."))
            return

        # ── 8. Wipe and re-import in a single transaction ─────────────────────
        self.stdout.write("\nClearing existing booking data...")
        with transaction.atomic():
            BookDelegate.objects.all().delete()
            BookEvent.objects.all().delete()
            self.stdout.write("  Old data cleared.")

            self.stdout.write(f"  Inserting {len(events_to_create):,} invoices...")
            BookEvent.objects.bulk_create(events_to_create, batch_size=500)

            self.stdout.write(f"  Inserting {len(delegates_to_create):,} delegates...")
            BookDelegate.objects.bulk_create(
                delegates_to_create,
                batch_size=500,
                ignore_conflicts=True,
            )

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. {len(events_to_create):,} invoices + "
            f"{len(delegates_to_create):,} delegates imported. "
            f"{len(issues)} issues in import_issues.md."
        ))
