# Linq CRM — Website Booking Integration Guide

This document explains how to integrate your live event website with the Linq CRM so that
registrations submitted on the website automatically appear as bookings in the CRM.

---

## How It Works

1. A delegate fills in a registration form on your event website.
2. Your website backend sends a single `POST` request to the CRM API with the booking details.
3. The CRM creates the invoice, delegates, and company record automatically.
4. The booking appears instantly in the CRM under **Bookings**, tagged as `source: website`.
5. Every submission is logged in the CRM's webhook log for audit purposes.

---

## Prerequisites

Before going live, the CRM admin must:

1. Generate a secure API key:
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
2. Set it in the CRM server's `.env` file:
   ```
   WEBSITE_API_KEY=9f160ecbbda3b26d3f3078ec25b11846c346214e7d29791e5c3ef743d372f919
   ```
3. Allowed origins are already configured in `.env`:
   ```
   CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,https://iq-hub.com,https://www.iq-hub.com
   ```
   Add any additional website domains to this list (comma-separated, no trailing slash).
4. Restart the CRM backend after saving `.env`.

The API key should be treated like a password — store it in your website's environment variables,
never hard-code it in source files.

---

## Endpoint

```
POST /api/invoices/create_from_website/
```

**Full URL (production):** `https://<crm-domain>/api/invoices/create_from_website/`

---

## Authentication

Every request must include the API key in the header:

```
X-API-KEY: <your-api-key>
Content-Type: application/json
```

Requests without a valid key receive `401 Unauthorized`.

---

## Request Body

### Top-level fields

| Field | Type | Required | Description |
|---|---|:---:|---|
| `InvoiceNumber` | string | ✅ | Unique reference for this booking. Duplicate submissions are rejected with `409`. |
| `Eventcode` | string | ✅ | Must match an event code that exists in the CRM (e.g. `ACU-RS26`). |
| `Eventname` | string | | Human-readable event name. |
| `Date` | string | | Event date in `YYYY-MM-DD` format. |
| `DelegateCompanyName` | string | | Registering company name. |
| `Address` | string | | Company street address. |
| `City` | string | | Company city. |
| `StateRegion` | string | | Company state or region. |
| `Country` | string | | Company country. |
| `PostalCode` | string | | Company postal/ZIP code. |
| `CompanyWebAddress` | string | | Company website URL. |
| `AccountsContactEmail` | email | | Finance/accounts contact email for the company. |
| `Currency` | string | | Three-letter currency code. Default: `USD`. |
| `PaymentStatus` | string | | See [Payment Status Values](#payment-status-values). Default: `Pending`. |
| `PreTaxAmount` | string/number | | Amount before tax (e.g. `"1200.00"`). |
| `TaxAmount` | string/number | | Tax amount. |
| `TotalAmount` | string/number | | Total including tax. |
| `AddOnsTotalAmount` | string/number | | Total for add-ons. |
| `Discount` | string/number | | Discount amount. Default: `0`. |
| `DiscountCode` | string | | Discount code applied. |
| `FormName` | string | | Name of the form used on the website (e.g. `"ACU-RS26 Registration"`). |
| `FormURL` | string | | Full URL of the registration form page. |
| `Packages` | array | | JSON array of package objects (free-form, stored as-is). |
| `Delegates` | array | | List of delegate objects. See below. |

### Delegate object (inside `Delegates` array)

| Field | Type | Required | Description |
|---|---|:---:|---|
| `FirstName` | string | ✅ | |
| `Email` | string | ✅ | Used for duplicate detection within the same booking. |
| `LastName` | string | | |
| `PhoneNumber` | string | | Direct phone/mobile number. |
| `Position` | string | | Job title. |
| `TicketPackage` | string | | Ticket tier or package name. |
| `SponsorshipLevel` | string | | Sponsorship level, if applicable. |

### Payment Status Values

| Value | Meaning |
|---|---|
| `Pending` | Not yet paid (default) |
| `Paid` | Payment received |
| `Free` | Complimentary / no charge |
| `Cancelled` | Booking cancelled |
| `Refunded` | Payment refunded |
| `Credit Pending (Free)` | Credit note pending for free ticket |
| `Credit Pending (Paid)` | Credit note pending for paid ticket |
| `Credit Transferred` | Credit has been transferred |
| `Paid (Transferred)` | Payment transferred from another booking |

---

## Full Example Payload

```json
{
  "InvoiceNumber": "WEB-ACU-RS26-00123",
  "Eventcode": "ACU-RS26",
  "Eventname": "ACU Risk Summit 2026",
  "Date": "2026-09-15",
  "DelegateCompanyName": "Acme Financial Ltd",
  "Address": "100 King Street",
  "City": "London",
  "StateRegion": "England",
  "Country": "United Kingdom",
  "PostalCode": "EC1A 1BB",
  "CompanyWebAddress": "https://acmefinancial.com",
  "AccountsContactEmail": "accounts@acmefinancial.com",
  "Currency": "GBP",
  "PaymentStatus": "Pending",
  "PreTaxAmount": "1250.00",
  "TaxAmount": "250.00",
  "TotalAmount": "1500.00",
  "Discount": "0",
  "FormName": "ACU Risk Summit 2026 — Standard Registration",
  "FormURL": "https://your-event-site.com/register/acu-rs26",
  "Delegates": [
    {
      "FirstName": "Jane",
      "LastName": "Smith",
      "Email": "jane.smith@acmefinancial.com",
      "PhoneNumber": "+44 20 7946 0958",
      "Position": "Chief Risk Officer",
      "TicketPackage": "Standard Delegate"
    },
    {
      "FirstName": "Tom",
      "LastName": "Baker",
      "Email": "tom.baker@acmefinancial.com",
      "PhoneNumber": "+44 20 7946 0959",
      "Position": "Risk Analyst",
      "TicketPackage": "Standard Delegate"
    }
  ]
}
```

---

## Response

### Success — `201 Created`

```json
{
  "success": true,
  "invoice_number": "WEB-ACU-RS26-00123",
  "booking_id": 4821,
  "event_code": "ACU-RS26",
  "company": {
    "id": 312,
    "name": "Acme Financial Ltd"
  },
  "company_created": true,
  "delegates_created": 2,
  "delegates_skipped": 0,
  "sales_executive": "chris.smith",
  "payment_status": "Pending"
}
```

### Duplicate — `409 Conflict`

Returned when `InvoiceNumber` already exists in the CRM. **Do not retry** — the booking is
already recorded.

```json
{
  "success": false,
  "detail": "Invoice 'WEB-ACU-RS26-00123' already exists."
}
```

### Validation Error — `400 Bad Request`

```json
{
  "success": false,
  "errors": {
    "InvoiceNumber": ["This field is required."],
    "Delegates": [{"Email": ["Enter a valid email address."]}]
  }
}
```

### Unauthorised — `401 Unauthorized`

Returned when `X-API-KEY` is missing or incorrect.

### Server Error — `500 Internal Server Error`

```json
{
  "success": false,
  "detail": "Internal server error during intake."
}
```

Retry after a short delay. The CRM team will have the error in logs.

---

## Code Examples

### Node.js / JavaScript

```js
const submitBooking = async (bookingData) => {
  const response = await fetch(
    'https://<crm-domain>/api/invoices/create_from_website/',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': process.env.LINQ_CRM_API_KEY,
      },
      body: JSON.stringify(bookingData),
    }
  );

  const data = await response.json();

  if (response.status === 409) {
    console.log('Booking already exists — skipping.');
    return;
  }
  if (!response.ok) {
    throw new Error(`CRM submission failed: ${JSON.stringify(data)}`);
  }

  console.log('Booking created:', data.invoice_number);
};
```

### Python

```python
import os
import requests

def submit_booking(booking_data: dict):
    url = "https://<crm-domain>/api/invoices/create_from_website/"
    headers = {
        "Content-Type": "application/json",
        "X-API-KEY": os.environ["LINQ_CRM_API_KEY"],
    }

    response = requests.post(url, json=booking_data, headers=headers, timeout=10)

    if response.status_code == 409:
        print("Booking already exists — skipping.")
        return

    response.raise_for_status()
    print("Booking created:", response.json()["invoice_number"])
```

### PHP

```php
function submitBooking(array $bookingData): array {
    $apiKey = getenv('LINQ_CRM_API_KEY');
    $url    = 'https://<crm-domain>/api/invoices/create_from_website/';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'X-API-KEY: ' . $apiKey,
        ],
        CURLOPT_POSTFIELDS     => json_encode($bookingData),
        CURLOPT_TIMEOUT        => 10,
    ]);

    $body    = curl_exec($ch);
    $status  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode($body, true);

    if ($status === 409) {
        error_log('Booking already exists: ' . $data['detail']);
        return $data;
    }
    if ($status !== 201) {
        throw new RuntimeException('CRM submission failed: ' . $body);
    }

    return $data;
}
```

### cURL (testing)

```bash
curl -X POST https://<crm-domain>/api/invoices/create_from_website/ \
  -H "Content-Type: application/json" \
  -H "X-API-KEY: 9f160ecbbda3b26d3f3078ec25b11846c346214e7d29791e5c3ef743d372f919" \
  -d '{
    "InvoiceNumber": "TEST-001",
    "Eventcode": "ACU-RS26",
    "DelegateCompanyName": "Test Company",
    "Currency": "USD",
    "PaymentStatus": "Pending",
    "Delegates": [
      {
        "FirstName": "Test",
        "LastName": "User",
        "Email": "test@example.com",
        "Position": "Manager"
      }
    ]
  }'
```

---

## Important Notes

### InvoiceNumber must be unique
The CRM rejects duplicate `InvoiceNumber` values with `409 Conflict`. Generate invoice numbers
that will not collide across submissions — using a prefix + timestamp + random suffix works well:

```
WEB-ACU-RS26-1747123456-a3f9
```

### Eventcode must exist
The `Eventcode` field must exactly match an event already created in the CRM. If it does not
match, the booking will be created but will not be linked to the correct event. Coordinate with
the CRM admin to ensure event codes are set up before the registration form goes live.

### Sales executive auto-assignment
The CRM will automatically assign the correct sales executive to the booking based on the
`Eventcode`. No action is needed from your side.

### Server-to-server only
The API key must **never** be exposed in browser-side JavaScript. Always call this endpoint
from your website's backend/server. If you need to submit directly from the browser, contact
the CRM admin to discuss an alternative authentication flow.

### Retry logic
On `500` errors, wait at least 5 seconds before retrying. Do not retry on `400` or `409` —
these indicate a data problem, not a transient failure. Implement a maximum of 3 retries.

---

## Testing Checklist

Before going live, verify the following:

- [ ] `WEBSITE_API_KEY` is set in the CRM server `.env` and the server has been restarted
- [ ] A test submission with `cURL` returns `201`
- [ ] The booking appears in the CRM under **Bookings** with `source: MANUAL → website`
- [ ] A duplicate submission returns `409` and does not create a second record
- [ ] A submission with a missing `InvoiceNumber` returns `400`
- [ ] A submission with a wrong API key returns `401`
- [ ] Delegates appear correctly under the booking in the CRM
- [ ] The event code used in the test matches an existing event in the CRM

---

## Webhook Logs

Every submission (success, failure, or duplicate) is logged in the CRM. CRM admins can
view the full log at:

```
GET /api/invoices/webhook_logs/
Authorization: Token <admin-crm-token>
```

This includes the full request payload, response, status code, source IP, and timestamp —
useful for debugging integration issues.

---

## Contact

For questions about event codes, API keys, or CRM configuration, contact the Linq CRM admin team.
