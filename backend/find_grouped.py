import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from book_delegate.models import BookDelegate
from django.db.models import Count

# Use 'invoice' (the FK field) for grouping
duplicates = BookDelegate.objects.values('invoice').annotate(dcount=Count('id')).filter(dcount__gt=1).order_by('-dcount')[:30]

print("Invoice Number | Delegate Count")
print("-------------------------------")
for d in duplicates:
    print(f"{d['invoice']} | {d['dcount']}")
