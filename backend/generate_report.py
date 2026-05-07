import os
import django
import csv

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from book_delegate.models import BookDelegate
from django.db.models import Count

# Group all delegates by invoice and count them
stats = BookDelegate.objects.values('invoice').annotate(total_entries=Count('id')).order_by('-total_entries')

output_file = "grouped_bookings_report.csv"

with open(output_file, 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['invoice_number', 'total_no_of_entries_grouped'])
    for s in stats:
        writer.writerow([s['invoice'], s['total_entries']])

print(f"Report generated: {os.path.abspath(output_file)}")
print(f"Total invoices processed: {len(stats)}")
