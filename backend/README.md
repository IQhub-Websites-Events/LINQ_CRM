# Linq CRM — Django Backend

> Payment confirmation CRM with invoice-driven architecture, RBAC, and Zoho website intake.

## Stack
- Python 3.11+, Django 5.2, Django REST Framework 3.16
- SQLite (dev) / PostgreSQL (prod via `DATABASE_URL`)
- Token authentication

## Quick start

```bash
cd backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                               # edit as needed
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver                         # → http://localhost:8000
```

## Architecture

```
Event ──── BookEvent (invoice_number, pre-generated) ──── BookDelegate
                │                                               │
                └── sales_executive (FK → User)                └── company (FK → Company)
```

| App | Purpose |
|-----|---------|
| `accounts` | Custom User (`AbstractUser`) with `role` + `assigned_events` M2M |
| `companies` | Reusable company registry; deduped by `(name, city)` |
| `events` | Event catalogue |
| `book_event` | Invoice entity — payment lives here |
| `book_delegate` | Individual attendees — payment is read-only `@property` from invoice |
| `config` | Settings, URLs, global search, stats views |

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/token/` | Returns `{ token }` |

### Website Intake
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/invoices/create_from_website/` | Full Zoho payload → invoice + delegates + company |

### Invoices
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/invoices/` | List (RBAC filtered, paginated) |
| `GET` | `/api/invoices/{id}/` | Detail + embedded delegates |
| `PATCH` | `/api/invoices/{id}/update_payment/` | Update payment status/date |
| `GET` | `/api/invoices/pending/` | Pending-only shortcut |

### Delegates
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/delegates/` | List (RBAC filtered) |
| `GET` | `/api/delegates/by_invoice/{invoice_number}/` | By invoice number |
| `PATCH` | `/api/delegates/{id}/update_attendance/` | Attendance toggle |

### Users (admin only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET/POST` | `/api/users/` | List / create |
| `POST` | `/api/users/{id}/assign_events/` | Replace all event assignments |
| `POST` | `/api/users/{id}/add_event/` | Add single event |

### Companies
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/companies/` | List |
| `GET` | `/api/companies/{id}/delegates/` | Company's delegates |

### Utilities
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/search/?q=` | Global search (RBAC scoped) |
| `GET` | `/api/stats/dashboard/` | Revenue dashboard stats |
| `GET` | `/api/events/{id}/stats/` | Per-event booking breakdown |

## Zoho Payload Example

```json
{
  "InvoiceNumber": "INV-ZOHO-001",
  "Eventcode": "GFS-2026",
  "Eventname": "Global Finance Summit 2026",
  "Date": "2026-06-12",
  "PreTaxAmount": "9000.00",
  "TaxAmount": "900.00",
  "TotalAmount": "9900.00",
  "Discount": "0",
  "Currency": "GBP",
  "DelegateCompanyName": "Halcyon Capital",
  "Address": "100 City Road",
  "City": "London",
  "StateRegion": "England",
  "Country": "UK",
  "PostalCode": "EC1V 2NX",
  "CompanyWebAddress": "https://halcyon.example.com",
  "Delegates": [
    {
      "FirstName": "Aaliyah",
      "LastName": "Okafor",
      "Email": "aaliyah@halcyon.com",
      "PhoneNumber": "+44 7700 900001",
      "Position": "Director"
    }
  ]
}
```

## RBAC Rules

| Role | Invoices | Delegates | Companies | Users | Events |
|------|----------|-----------|-----------|-------|--------|
| `admin` | All | All | All (CRUD) | All (CRUD) | All (CRUD) |
| `sales` | Assigned events only | Assigned events only | Read-only | ✗ | Read-only |

## Payment Flow

```
PATCH /api/invoices/{id}/update_payment/
Body: { "payment_status": "Paid", "payment_date": "2026-05-01", "payment_type": "Wire Transfer" }

Rules:
  • payment_date is required when payment_status = "Paid"
  • Delegates inherit payment_status at read-time via @property (no sync query)
```

## Run Tests

```bash
python tests.py    # 36 integration tests — should all pass
```
