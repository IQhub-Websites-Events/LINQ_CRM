from django.utils import timezone
from django.conf import settings
from book_event.models import BookEvent, SyncLog
from services.google_sheets import google_sheets
import logging

logger = logging.getLogger('book_event')

def sync_bookings(full=False):
    if not google_sheets:
        return

    # 1. Get sync log
    log, _ = SyncLog.objects.get_or_create(dataset="bookings")
    last_sync = log.last_synced_at if not full else None

    try:
        # 2. Query data
        query = BookEvent.objects.all().order_by('updated_at')
        if last_sync:
            query = query.filter(updated_at__gt=last_sync)
        
        total_count = query.count()
        if total_count == 0 and not full:
            return

        # 3. Process
        # Full set of headers matching the report requirements
        headers = [
            "Payment Status", "Event Code", "Booking Code", "Request Date", "Invoice Date", "Invoice Number",
            "Name", "Delegate Company", "Delegate Email", "Direct Line", "Accounts Contact", "Delegate Number",
            "Paid/Free", "Date Paid", "Payment Type", "Ticket Tier", "Discount", "Add-Ons", "Ref",
            "Event Name", "Added Time", "Modified Time", "Sales Executive", "Attendance"
        ]
        
        all_rows = []
        batch_size = 500

        for i in range(0, total_count, batch_size):
            batch_qs = query[i:i+batch_size].select_related("sales_executive").prefetch_related(
                "delegates", 
                "delegates__company"
            )
            invoices = list(batch_qs)
            
            for inv in invoices:
                delegates = list(inv.delegates.all())
                if not delegates:
                    # Fallback row if no delegates
                    all_rows.append([
                        inv.payment_status, inv.event_code, inv.booking_code,
                        str(inv.created_at.date()), str(inv.invoice_date) if inv.invoice_date else "",
                        inv.invoice_number, "N/A", inv.company_name, inv.contact_email, inv.contact_phone,
                        inv.accounts_contact_email, 0, inv.paid_free,
                        str(inv.payment_date) if inv.payment_date else "", inv.payment_type,
                        inv.ticket_tier, float(inv.discount), inv.add_ons, inv.reference,
                        inv.event_name, str(inv.created_at), str(inv.updated_at),
                        inv.sales_executive.username if inv.sales_executive else "", "N/A"
                    ])
                else:
                    for d in delegates:
                        company_info = d.company_display
                        if d.company:
                            parts = []
                            if d.company.city: parts.append(d.company.city)
                            if d.company.country: parts.append(d.company.country)
                            if parts:
                                company_info = f"{d.company.name} ({', '.join(parts)})"

                        all_rows.append([
                            inv.payment_status, inv.event_code, inv.booking_code,
                            str(inv.created_at.date()), str(inv.invoice_date) if inv.invoice_date else "",
                            inv.invoice_number, d.full_name, company_info, d.email, d.phone_number,
                            inv.accounts_contact_email, d.delegate_number, inv.paid_free,
                            str(inv.payment_date) if inv.payment_date else "", inv.payment_type,
                            inv.ticket_tier, float(inv.discount), inv.add_ons, inv.reference,
                            inv.event_name, str(inv.created_at), str(inv.updated_at),
                            inv.sales_executive.username if inv.sales_executive else "", d.attendance
                        ])

        # 4. Push
        if full:
            count = google_sheets.replace_data(settings.GOOGLE_SHEET_BOOKINGS_TAB, headers, all_rows)
        else:
            # For incremental, we use a unique ID. We'll use InvoiceNumber + Email as a stable ID for the sheet
            # but since sync_data expects a single ID index, we'll just use full refresh for now if possible
            # or we could use d.id if we had it in the row. 
            # Given the user's request, full refresh seems to be the intended way for now.
            count = google_sheets.replace_data(settings.GOOGLE_SHEET_BOOKINGS_TAB, headers, all_rows)
        
        # 5. Success update
        log.last_synced_at = timezone.now()
        log.records_synced = count
        log.last_status = SyncLog.Status.SUCCESS
        log.save()
        logger.info(f"Successfully synced {count} booking rows (Full={full}).")

    except Exception as e:
        log.last_status = SyncLog.Status.FAILED
        log.error_message = str(e)
        log.save()
        logger.error(f"Failed to sync bookings: {e}")
