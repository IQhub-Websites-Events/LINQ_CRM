"""
webhooks/services.py
─────────────────────
WebhookProcessor: full lifecycle processor with:
- payload validation
- upsert support (create or update booking)
- step-by-step processing notes
- stack trace capture
- timing instrumentation
- DB operation tracking
NO company objects are created.
"""
import logging
import time
import traceback
from datetime import datetime

from django.db import transaction
from django.utils import timezone

from book_event.models import BookEvent
from book_event.serializers import WebsiteBookingSerializer
from book_delegate.models import BookDelegate
from .models import WebhookLog
from .utils import unwrap_payload

logger = logging.getLogger(__name__)


class WebhookProcessor:
    def __init__(self, log: WebhookLog):
        self.log   = log
        self.notes = []

    def _note(self, msg: str):
        ts = datetime.utcnow().strftime("%H:%M:%S.%f")[:-3]
        self.notes.append(f"[{ts}] {msg}")

    def process(self) -> tuple[bool, dict]:
        log = self.log
        processing_start = time.monotonic()

        log.status               = WebhookLog.Status.PROCESSING
        log.processing_started_at = timezone.now()
        log.save(update_fields=["status", "processing_started_at"])

        self._note("Processing started.")

        # ── 1. Payload validation ──────────────────────────────────────────────
        payload = unwrap_payload(log.payload)
        ser = WebsiteBookingSerializer(data=payload)
        if not ser.is_valid():
            self._note(f"Payload validation FAILED: {ser.errors}")
            duration = round(time.monotonic() - processing_start, 3)
            log.status            = WebhookLog.Status.FAILED
            log.processing_status = WebhookLog.ProcessingStatus.ERROR
            log.http_status       = 400
            log.error_message     = str(ser.errors)
            log.processing_notes  = "\n".join(self.notes)
            log.processing_duration = duration
            log.processed_at      = timezone.now()
            log.save(update_fields=[
                "status", "processing_status", "http_status", "error_message",
                "processing_notes", "processing_duration", "processed_at",
            ])
            return False, {"detail": "Payload validation failed.", "errors": ser.errors}

        d              = ser.validated_data
        invoice_number = d["InvoiceNumber"]
        event_code     = self.normalize_event_code(d.get("Eventcode", ""))
        d["Eventcode"] = event_code  # Save normalized version back to data dict

        self._note(f"Payload validated. Invoice={invoice_number}  Event={event_code}")

        # ── 2. Field normalization ─────────────────────────────────────────────
        ps_map   = {v.lower(): v for v in BookEvent.PaymentStatus.values}
        tier_map = {v.lower(): v for v in BookEvent.TicketTier.values}
        pof_map  = {v.lower(): v for v in BookEvent.PaidOrFree.values}

        payment_status = ps_map.get(d.get("PaymentStatus", "").strip().lower(), BookEvent.PaymentStatus.PENDING)
        
        # Inject normalized values back into validated_data for use in helpers
        d["TicketTier"] = tier_map.get(d.get("TicketTier", "").strip().lower(), d.get("TicketTier", ""))
        d["PaidOrFree"] = pof_map.get(d.get("PaidOrFree", "").strip().lower(), d.get("PaidOrFree", ""))

        # ── 3. Sales exec assignment ───────────────────────────────────────────
        sales_exec = BookEvent.auto_assign_sales(event_code)
        self._note(f"Sales exec: {sales_exec.username if sales_exec else 'unassigned'}")

        # ── 4. Determine INSERT vs UPSERT ─────────────────────────────────────
        existing_invoice = BookEvent.objects.filter(invoice_number=invoice_number).first()

        try:
            with transaction.atomic():
                if existing_invoice:
                    invoice, db_status, note = self._update_booking(existing_invoice, d, payment_status)
                else:
                    invoice, db_status, note = self._create_booking(d, event_code, payment_status, sales_exec)

            self._note(note)

            # ── 5. Delegate processing ─────────────────────────────────────────
            delegates_payload = d.get("Delegates", [])
            inserted_delegates, skipped_delegates, failed_delegates = self._process_delegates(
                invoice, event_code, d, delegates_payload, tier_map, pof_map,
            )

            # ── 6. Update contact info ─────────────────────────────────────────
            all_delegates = list(invoice.delegates.order_by("id"))
            if all_delegates and not existing_invoice:
                first = all_delegates[0]
                invoice.contact_name  = first.full_name
                invoice.contact_email = first.email
                invoice.delegate_count = len(all_delegates)
                invoice.save(update_fields=["contact_name", "contact_email", "delegate_count"])

        except Exception as exc:
            err_str   = str(exc)
            trace_str = traceback.format_exc()
            self._note(f"EXCEPTION: {err_str}")
            logger.error("Webhook processing error: %s", err_str, exc_info=True)

            duration = round(time.monotonic() - processing_start, 3)
            log.status              = WebhookLog.Status.FAILED
            log.processing_status   = WebhookLog.ProcessingStatus.ERROR
            log.http_status         = 500
            log.invoice_number      = invoice_number
            log.event_code          = event_code
            log.error_message       = err_str
            log.stack_trace         = trace_str
            log.processing_notes    = "\n".join(self.notes)
            log.processing_duration = duration
            log.processed_at        = timezone.now()
            log.save(update_fields=[
                "status", "processing_status", "http_status",
                "invoice_number", "event_code", "error_message",
                "stack_trace", "processing_notes", "processing_duration", "processed_at",
            ])
            return False, {"detail": "Internal error during booking creation.", "error": err_str}

        # ── 7. Success logging ─────────────────────────────────────────────────
        final_db_status = (
            WebhookLog.DbInsertStatus.PARTIAL
            if failed_delegates > 0 and inserted_delegates > 0
            else WebhookLog.DbInsertStatus.FAILED
            if failed_delegates > 0 and inserted_delegates == 0
            else db_status
        )

        duration = round(time.monotonic() - processing_start, 3)

        self._note(
            f"Complete. Delegates inserted={inserted_delegates} skipped={skipped_delegates} "
            f"failed={failed_delegates}  duration={duration}s"
        )

        logger.info(
            "Webhook processed: %s | event: %s | delegates: %d | db=%s | %.3fs",
            invoice_number, event_code, inserted_delegates, db_status, duration,
        )

        if sales_exec and not existing_invoice:
            from accounts.models import ActionLog
            ActionLog.objects.create(
                user=sales_exec,
                action=f"Auto-assigned via webhook to {invoice.invoice_number}",
                details=f"Source: webhook | Event: {event_code}",
            )

        log.status                  = WebhookLog.Status.SUCCESS
        log.processing_status       = WebhookLog.ProcessingStatus.PROCESSED
        log.http_status             = 201 if not existing_invoice else 200
        log.invoice_number          = invoice_number
        log.event_code              = event_code
        log.event_name              = d.get("Eventname", "")
        log.created_booking         = invoice
        log.created_delegates_count = inserted_delegates
        log.db_insert_status        = final_db_status
        log.records_inserted        = inserted_delegates
        log.records_updated         = 1 if existing_invoice else 0
        log.records_failed          = failed_delegates
        log.processing_notes        = "\n".join(self.notes)
        log.processing_duration     = duration
        log.processed_at            = timezone.now()
        log.save(update_fields=[
            "status", "processing_status", "http_status",
            "invoice_number", "event_code", "event_name",
            "created_booking", "created_delegates_count",
            "db_insert_status", "records_inserted", "records_updated", "records_failed",
            "processing_notes", "processing_duration", "processed_at",
        ])

        return True, {
            "invoice_number":    invoice.invoice_number,
            "booking_id":        invoice.id,
            "event_code":        invoice.event_code,
            "db_action":         "updated" if existing_invoice else "inserted",
            "delegates_created": inserted_delegates,
            "delegates_skipped": skipped_delegates,
            "sales_executive":   sales_exec.username if sales_exec else None,
            "payment_status":    invoice.payment_status,
        }

    # ── Private helpers ────────────────────────────────────────────────────────

    def normalize_event_code(self, code):
        """
        Normalizes event codes to match the designated codes in the system.
        - Strips year suffixes (e.g., '26', '25')
        - Maps specific variant codes (e.g., 'ACU' -> 'ACU - RS')
        """
        if not code: return ""
        code = code.strip()
        
        # Specific mappings
        mapping = {
            "ACU":        "ACU - RS",
            "ACU - RS26": "ACU - RS",
            "ACU-RS26":   "ACU - RS",
            "ACU-RS":     "ACU - RS",
        }
        if code in mapping:
            return mapping[code]
            
        # General rule: Strip '26', '25', etc. from the end if it's a suffix
        # e.g., "MMU/GS - JS26" -> "MMU/GS - JS"
        for year in ["26", "25", "27"]:
            if code.endswith(year):
                # Only strip if it follows a letter or space (avoid stripping from codes where the number is part of the ID)
                return code[:-len(year)].strip()
        
        return code

    def _create_booking(self, d, event_code, payment_status, sales_exec):
        invoice = BookEvent.objects.create(
            invoice_number         = d["InvoiceNumber"],
            event_code             = event_code,
            event_name             = d.get("Eventname", ""),
            event_date             = d.get("Date"),
            company_name           = d.get("DelegateCompanyName", ""),
            accounts_contact_email = d.get("AccountsContactEmail", ""),
            discount               = d.get("Discount", 0),
            discount_code          = d.get("DiscountCode", ""),
            pre_tax_amount         = d.get("PreTaxAmount"),
            tax_amount             = d.get("TaxAmount"),
            total_amount           = d.get("TotalAmount"),
            add_ons_total_amount   = d.get("AddOnsTotalAmount"),
            currency               = d.get("Currency", "USD"),
            payment_status         = payment_status,
            sales_executive        = sales_exec,
            packages               = d.get("Packages", []),
            ticket_tier            = d.get("TicketTier", ""),
            paid_or_free           = d.get("PaidOrFree", ""),
            payment_type           = d.get("PaymentType", ""),
            request_date           = timezone.localdate(),
        )
        return invoice, WebhookLog.DbInsertStatus.INSERTED, f"Booking CREATED: id={invoice.id}"

    def _update_booking(self, invoice, d, payment_status):
        """Update non-payment fields on an existing booking."""
        update_fields = []
        field_map = {
            "event_code":             self.normalize_event_code(d.get("Eventcode", "")),
            "event_name":             d.get("Eventname", ""),
            "event_date":             d.get("Date"),
            "company_name":           d.get("DelegateCompanyName", ""),
            "accounts_contact_email": d.get("AccountsContactEmail", ""),
            "discount":               d.get("Discount", 0),
            "discount_code":          d.get("DiscountCode", ""),
            "pre_tax_amount":         d.get("PreTaxAmount"),
            "tax_amount":             d.get("TaxAmount"),
            "total_amount":           d.get("TotalAmount"),
            "add_ons_total_amount":   d.get("AddOnsTotalAmount"),
            "currency":               d.get("Currency", "USD"),
            "form_name":              d.get("FormName", ""),
            "form_url":               d.get("FormURL", ""),
            "packages":               d.get("Packages", []),
            "payment_status":         payment_status,
            "ticket_tier":            d.get("TicketTier", ""),
            "paid_or_free":           d.get("PaidOrFree", ""),
            "payment_type":           d.get("PaymentType", ""),
        }
        for attr, val in field_map.items():
            # Only update if the incoming value is not empty/None, 
            # OR if we explicitly want to allow clearing (not for these fields usually)
            if val or val == 0: 
                if getattr(invoice, attr) != val:
                    setattr(invoice, attr, val)
                    update_fields.append(attr)

        if not invoice.request_date:
            invoice.request_date = timezone.localdate()
            update_fields.append("request_date")

        if update_fields:
            invoice.save(update_fields=update_fields)
            note = f"Booking UPDATED: id={invoice.id} fields={update_fields}"
        else:
            note = f"Booking UNCHANGED: id={invoice.id} (no significant field changes)"

        return invoice, WebhookLog.DbInsertStatus.UPDATED, note

    def _process_delegates(self, invoice, event_code, d, delegates_payload, tier_map, pof_map):
        inserted = skipped = failed = 0
        company_name = d.get("DelegateCompanyName", "")

        for i, dp in enumerate(delegates_payload):
            email = dp.get("Email", "").strip().lower()
            if not email:
                skipped += 1
                self._note(f"Delegate #{i+1} skipped: no email")
                continue
            try:
                existing = BookDelegate.objects.filter(invoice=invoice, email=email).first()
                if existing:
                    # Update existing delegate
                    changed = []
                    upd = {
                        "first_name":        dp.get("FirstName", "").strip(),
                        "last_name":         dp.get("LastName", "").strip(),
                        "phone_number":      dp.get("PhoneNumber", "").strip(),
                        "position":          dp.get("Position", "").strip(),
                        "ticket_package":    dp.get("TicketPackage", "").strip(),
                        "sponsorship_level": dp.get("SponsorshipLevel", "").strip(),
                        "company_name_raw":  company_name,
                        "delegate_ticket_tier": tier_map.get(dp.get("TicketTier", "").strip().lower(), dp.get("TicketTier", "").strip()),
                        "delegate_paid_or_free": pof_map.get(dp.get("PaidOrFree", "").strip().lower(), dp.get("PaidOrFree", "").strip()),
                    }
                    for attr, val in upd.items():
                        if getattr(existing, attr, None) != val:
                            setattr(existing, attr, val)
                            changed.append(attr)
                    if changed:
                        existing.save(update_fields=changed)
                        self._note(f"Delegate #{i+1} updated: {email}")
                    else:
                        self._note(f"Delegate #{i+1} unchanged: {email}")
                    skipped += 1
                else:
                    BookDelegate.objects.create(
                        invoice           = invoice,
                        event_code        = event_code,
                        company           = None,
                        company_name_raw  = company_name,
                        first_name        = dp.get("FirstName", "").strip(),
                        last_name         = dp.get("LastName", "").strip(),
                        email             = email,
                        phone_number      = dp.get("PhoneNumber", "").strip(),
                        position          = dp.get("Position", "").strip(),
                        ticket_package    = dp.get("TicketPackage", "").strip(),
                        sponsorship_level = dp.get("SponsorshipLevel", "").strip(),
                        delegate_ticket_tier = tier_map.get(dp.get("TicketTier", "").strip().lower(), dp.get("TicketTier", "").strip()),
                        delegate_paid_or_free = pof_map.get(dp.get("PaidOrFree", "").strip().lower(), dp.get("PaidOrFree", "").strip()),
                    )
                    inserted += 1
                    self._note(f"Delegate #{i+1} inserted: {email}")
            except Exception as exc:
                failed += 1
                self._note(f"Delegate #{i+1} FAILED ({email}): {exc}")
                logger.warning("Delegate creation error: %s", exc)

        return inserted, skipped, failed
