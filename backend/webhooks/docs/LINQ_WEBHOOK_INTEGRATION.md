# LINQ CRM — Webhook Integration Guide

Receive live bookings from event websites directly into the CRM.

---

## Endpoint

```
POST https://<your-domain>/api/webhooks/bookings/
Content-Type: application/json
X-WEBHOOK-SECRET: <your-secret>
```

| Header | Required | Description |
|---|---|---|
| `X-WEBHOOK-SECRET` | Yes | Shared secret set in `WEBHOOK_SECRET_KEY` env var |
| `X-WEBHOOK-SOURCE` | No | Human-readable origin label (e.g. `"zoho-creator"`, `"website-main"`) |

---

## Payload Schema

```json
{
  "InvoiceNumber":       "INV-2024-001",
  "Eventcode":           "CONF24",
  "Eventname":           "Conference 2024",
  "Date":                "2024-06-15",
  "PaymentStatus":       "Pending",
  "Currency":            "GBP",
  "TotalAmount":         "1500.00",
  "PreTaxAmount":        "1250.00",
  "TaxAmount":           "250.00",
  "AddOnsTotalAmount":   "0.00",
  "Discount":            "0",
  "DiscountCode":        "",
  "FormName":            "Conference Registration",
  "FormURL":             "https://example.com/register",
  "DelegateCompanyName": "Acme Ltd",
  "AccountsContactEmail": "accounts@acme.com",
  "Packages":            [],
  "Delegates": [
    {
      "FirstName":        "Jane",
      "LastName":         "Smith",
      "Email":            "jane@acme.com",
      "PhoneNumber":      "+44 7700 900000",
      "Position":         "Head of Finance",
      "TicketPackage":    "VIP",
      "SponsorshipLevel": ""
    }
  ]
}
```

### Required Fields

| Field | Type | Notes |
|---|---|---|
| `InvoiceNumber` | string | Must be globally unique — duplicate triggers 409 |
| `Eventcode` | string | Uppercased automatically |
| `Delegates` | array | At least one delegate required in practice |
| `Delegates[].FirstName` | string | Required per delegate |
| `Delegates[].Email` | string | Required per delegate; must be valid email |

### Optional Fields

All other fields are optional and default to empty/null if absent.

---

## Responses

### 201 Created — booking accepted and processed

```json
{
  "success": true,
  "log_id": 42,
  "invoice_number": "INV-2024-001",
  "booking_id": 123,
  "event_code": "CONF24",
  "delegates_created": 1,
  "delegates_skipped": 0,
  "sales_executive": "john.doe",
  "payment_status": "Pending"
}
```

### 409 Conflict — duplicate invoice

```json
{
  "success": false,
  "log_id": 43,
  "detail": "Invoice 'INV-2024-001' already exists."
}
```

### 400 Bad Request — payload validation failed

```json
{
  "success": false,
  "log_id": 44,
  "detail": "Payload validation failed.",
  "errors": { "InvoiceNumber": ["This field is required."] }
}
```

### 401 Unauthorized — missing or wrong secret

```json
{
  "success": false,
  "error": "Invalid webhook secret."
}
```

### 500 Internal Server Error — unexpected processing failure

```json
{
  "success": false,
  "log_id": 45,
  "detail": "Internal error during booking creation."
}
```

---

## Authentication

The endpoint is unauthenticated at the session level. Access is controlled entirely by the `X-WEBHOOK-SECRET` header.

Set the secret on the server:

```bash
# .env
WEBHOOK_SECRET_KEY=your-strong-random-secret-here
```

Use the same value in your website's POST request header.

---

## Important Behaviour

- **No company objects created.** Company name is stored as a raw string on the booking and delegates. No lookup or creation in the CRM companies table occurs.
- **Sales executive auto-assigned.** The first sales user mapped to `Eventcode` is automatically assigned to the booking.
- **Delegate deduplication.** If a delegate email already exists on the same invoice, it is silently skipped (counted in `delegates_skipped`).
- **All activity logged.** Every request — success, failure, and duplicate — is written to the `webhook_events` table and visible in the CRM admin under **Integrations → Webhooks**.

---

## Retry

Failed or duplicate webhooks can be retried from the CRM admin UI:

1. Navigate to **CRM › Integrations › Webhooks**
2. Find the failed log row
3. Click **Retry** — a new log entry is created and the payload is reprocessed immediately

Or via API (admin token required):

```
POST /api/webhooks/logs/{log_id}/retry/
Authorization: Token <admin-token>
```

---

## Admin API

All endpoints require a valid admin CRM token (`Authorization: Token <token>`).

| Method | URL | Description |
|---|---|---|
| GET | `/api/webhooks/logs/` | Paginated list of all webhook logs |
| GET | `/api/webhooks/logs/?status=failed` | Filter by status |
| GET | `/api/webhooks/logs/?search=INV-001` | Search by invoice number, event code, or source |
| GET | `/api/webhooks/logs/{id}/` | Full detail including payload and response JSON |
| POST | `/api/webhooks/logs/{id}/retry/` | Retry a failed webhook |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `WEBHOOK_SECRET_KEY` | Yes | Shared secret validated against `X-WEBHOOK-SECRET` header |
| `WEBSITE_API_KEY` | Separate | Used by the legacy `create_from_website` endpoint (different flow) |

---

## Testing with curl

```bash
curl -X POST https://localhost:8000/api/webhooks/bookings/ \
  -H "Content-Type: application/json" \
  -H "X-WEBHOOK-SECRET: your-secret-here" \
  -H "X-WEBHOOK-SOURCE: test-curl" \
  -d '{
    "InvoiceNumber": "TEST-001",
    "Eventcode": "CONF24",
    "Eventname": "Test Event",
    "DelegateCompanyName": "Test Co",
    "Delegates": [
      { "FirstName": "Test", "LastName": "User", "Email": "test@example.com" }
    ]
  }'
```
