import csv

file_path = r"C:\Users\harrison peck\Downloads\Event Bookings Report.csv"

with open(file_path, mode='r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    skipped_rows = []
    row_num = 1 # Start after header
    for row in reader:
        row_num += 1
        if not row.get('Invoice Number', '').strip():
            skipped_rows.append((row_num, row))

print(f"Total skipped: {len(skipped_rows)}")
for num, row in skipped_rows:
    print(f"Row {num}: Name={row.get('Name')}, Event={row.get('Event Code')}")
