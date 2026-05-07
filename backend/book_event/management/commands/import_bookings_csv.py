import csv
import os
from datetime import datetime
from django.core.management.base import BaseCommand
from django.utils.timezone import make_aware
from django.db import transaction, models
from book_event.models import BookEvent
from book_delegate.models import BookDelegate
from accounts.models import User
from companies.models import Company
from events.models import Event

class Command(BaseCommand):
    help = "Import bookings from C:\\Users\\harrison peck\\Downloads\\Event Bookings Report (1).csv"

    def handle(self, *args, **options):
        file_path = r"C:\Users\harrison peck\Downloads\Event Bookings Report (1).csv"
        if not os.path.exists(file_path):
            self.stdout.write(self.style.ERROR(f"File not found: {file_path}"))
            return

        # Clear existing data to ensure matching counts
        self.stdout.write("Clearing existing bookings and delegates...")
        BookDelegate.objects.all().delete()
        BookEvent.objects.all().delete()

        with open(file_path, mode='r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            success_count = 0
            error_count = 0
            
            for row in reader:
                invoice_num = row.get('Invoice Number', '').strip()
                if not invoice_num:
                    continue

                try:
                    with transaction.atomic():
                        # 1. Handle Sales Executive
                        sales_name = row.get('Sales Executive', '').strip()
                        sales_user = None
                        if sales_name:
                            sales_user = User.objects.filter(
                                models.Q(first_name__icontains=sales_name) | 
                                models.Q(last_name__icontains=sales_name) |
                                models.Q(username__icontains=sales_name.replace(" ", ".").lower())
                            ).first()

                        # 2. Parse Dates and Numbers
                        def parse_date(d):
                            if not d or d.lower() == 'nan': return None
                            try: return datetime.strptime(d, "%d-%b-%Y").date()
                            except: return None

                        def parse_datetime(dt):
                            if not dt or dt.lower() == 'nan': return None
                            try: return make_aware(datetime.strptime(dt, "%d-%b-%Y %H:%M:%S"))
                            except: return None

                        def parse_float(val):
                            if not val: return 0.0
                            val = val.strip().replace('%', '').replace(',', '')
                            try: return float(val)
                            except: return 0.0

                        # 3. Create/Update BookEvent
                        raw_status = row.get('Payment Status', 'Pending').strip()
                        
                        event_defaults = {
                            'event_code': row.get('Event Code', '').strip(),
                            'event_name': row.get('Event Name', '').strip(),
                            'booking_code': row.get('Booking Code', '').strip(),
                            'invoice_date': parse_date(row.get('Invoice Date')),
                            'contact_name': row.get('Name', '').strip(),
                            'company_name': row.get('Delegate Company', '').strip(),
                            'contact_email': row.get('Delegate Email', '').strip(),
                            'contact_phone': row.get('Direct Line', '').strip(),
                            'accounts_contact_email': row.get('Accounts Contact', '').strip(),
                            'payment_status': raw_status,
                            'payment_date': parse_date(row.get('Date Paid')),
                            'payment_type': row.get('Payment Type', '').strip(),
                            'ticket_tier': row.get('Ticket Tier', '').strip(),
                            'discount': parse_float(row.get('Discount')),
                            'paid_free': row.get('Paid/Free', '').strip(),
                            'add_ons': row.get('Add-Ons', '').strip(),
                            'reference': row.get('Ref', '').strip(),
                            'sales_executive': sales_user,
                        }
                        
                        added_time = parse_datetime(row.get('Added Time'))
                        if added_time:
                            event_defaults['created_at'] = added_time

                        be, created = BookEvent.objects.get_or_create(
                            invoice_number=invoice_num,
                            defaults=event_defaults
                        )

                        # 4. Handle Delegate
                        email = row.get('Delegate Email', '').strip().lower()
                        if email:
                            co_name = row.get('Delegate Company', '').strip()
                            company = None
                            if co_name:
                                company, _ = Company.objects.get_or_create(name=co_name)

                            name_parts = row.get('Name', '').strip().split(' ', 1)
                            first_name = name_parts[0]
                            last_name = name_parts[1] if len(name_parts) > 1 else ""

                            BookDelegate.objects.create(
                                invoice=be,
                                email=email,
                                event_code=be.event_code,
                                company=company,
                                company_name_raw=co_name,
                                first_name=first_name,
                                last_name=last_name,
                                phone_number=row.get('Direct Line', '').strip(),
                                delegate_number=int(row.get('Delegate Number', 1) or 1),
                                attendance=BookDelegate.Attendance.CONFIRMED if row.get('Attendance - IN?') == 'true' else BookDelegate.Attendance.PENDING
                            )

                        success_count += 1
                        if success_count % 500 == 0:
                            self.stdout.write(f"Processed {success_count}...")

                except Exception as e:
                    self.stdout.write(self.style.ERROR(f"Error on {invoice_num}: {e}"))
                    error_count += 1

            self.stdout.write(self.style.SUCCESS(f"Finished. Success: {success_count}, Errors: {error_count}"))
