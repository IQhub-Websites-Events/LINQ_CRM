# LINQ CRM — Full Project Reference

> Complete application overview, architecture, work status, and development context for use in Claude Projects.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture](#3-architecture)
4. [Backend — Django](#4-backend--django)
   - [Apps & Models](#41-apps--models)
   - [API Endpoints](#42-api-endpoints)
   - [Serializers](#43-serializers)
   - [Permissions & RBAC](#44-permissions--rbac)
   - [Google Sheets Sync](#45-google-sheets-sync)
   - [Website Intake (Zoho)](#46-website-intake-zoho)
5. [Frontend — React](#5-frontend--react)
   - [Pages](#51-pages)
   - [Components](#52-components)
   - [API Layer](#53-api-layer)
   - [Contexts & Hooks](#54-contexts--hooks)
6. [Bookings Module — Detailed Breakdown](#6-bookings-module--detailed-breakdown)
7. [Work Completed](#7-work-completed)
8. [Current State of Key Files](#8-current-state-of-key-files)
9. [Environment & Configuration](#9-environment--configuration)
10. [Data Flow Diagrams](#10-data-flow-diagrams)
11. [Known Patterns & Conventions](#11-known-patterns--conventions)

---

## 1. Project Overview

LINQ CRM is a full-stack invoice and delegate management system built for an events company. It tracks bookings (invoices + delegates) across multiple events, manages payment status, syncs data to Google Sheets, and receives automatic bookings from event websites via a webhook API.

**Core business flows:**
- Sales teams manage bookings (invoices) and mark payments as Paid/Pending
- Delegates are tracked per invoice with attendance, dietary, and contact info
- Admins manage users, events, teams, and see all financial data
- Event websites automatically POST new bookings via a Zoho-compatible API
- All booking and event data is synced to a shared Google Sheets report

---

## 2. Tech Stack

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Python | 3.x | Runtime |
| Django | 5.2.8 | Web framework |
| Django REST Framework | 3.16.1 | API layer |
| django-filter | 25.2 | Query filtering |
| django-cors-headers | 4.4.0 | CORS handling |
| psycopg2-binary | 2.9.11 | PostgreSQL driver |
| dj-database-url | 2.1.0 | Database URL parsing |
| python-dotenv | 1.0.0 | Environment variables |
| gunicorn | 21.2.0 | Production WSGI server |
| google-api-python-client | 2.128.0 | Google Sheets API |
| google-auth | 2.29.0 | Google authentication |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18.3.1 | UI framework |
| React Router DOM | 6.23.1 | Client-side routing |
| Axios | 1.7.2 | HTTP client |
| @dnd-kit/core | 6.3.1 | Drag-and-drop (team management) |
| @dnd-kit/sortable | 10.0.0 | Sortable lists |

**Styling approach:** Pure inline styles throughout — no CSS frameworks, no Tailwind, no CSS-in-JS libraries. All styling is done via JavaScript style objects.

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        LINQ CRM System                          │
├──────────────────┬──────────────────┬───────────────────────────┤
│   React SPA      │   Django API      │   External Services       │
│   (port 3000)    │   (port 8000)     │                           │
│                  │                  │                           │
│  AuthContext     │  /api/auth/       │  Google Sheets API        │
│  ToastContext    │  /api/invoices/   │  (service account)        │
│  ThemeContext    │  /api/delegates/  │                           │
│                  │  /api/events/     │  Event Websites           │
│  Pages/          │  /api/users/      │  (Zoho-compatible         │
│  Components/     │  /api/teams/      │   webhook intake)         │
│  API Layer/      │  /api/companies/  │                           │
│                  │  /api/search/     │                           │
│                  │  /api/stats/      │                           │
└──────────────────┴──────────────────┴───────────────────────────┘
         │                   │
         └─────── Proxy ─────┘
         (CRA proxy in dev,
          nginx/gunicorn in prod)
```

### Directory Layout

```
linqcrm_project/
├── backend/
│   ├── config/                 # Django project settings & root URLs
│   │   ├── settings.py
│   │   └── urls.py
│   ├── accounts/               # User model, roles, action logs
│   ├── teams/                  # Team groupings (CRUD)
│   ├── companies/              # Company registry (deduped)
│   ├── events/                 # Event catalogue
│   ├── book_event/             # Invoices + payment + webhook log
│   ├── book_delegate/          # Delegates (attendees) per invoice
│   ├── sync/                   # Google Sheets sync scripts
│   │   ├── bookings_sync.py
│   │   └── events_sync.py
│   └── services/
│       └── google_sheets.py    # Google Sheets client wrapper
├── frontend/
│   └── src/
│       ├── api/                # Axios-based API modules
│       ├── components/         # Reusable UI + domain components
│       ├── contexts/           # React context providers
│       ├── hooks/              # Custom hooks
│       ├── pages/              # Top-level page components
│       └── utils/              # Constants, formatters
├── .env                        # All environment variables
├── WEBSITE_INTEGRATION.md      # Webhook intake API docs
├── architecture.md             # Architecture diagrams
└── PROJECT_README.md           # This file
```

---

## 4. Backend — Django

### 4.1 Apps & Models

#### `accounts` — Users

**Model: `User`** (extends AbstractUser)
```
Fields:
  role            CharField  choices: ADMIN, SALES, MARKET_RESEARCH, SPEX, OPERATIONS
  status          CharField  choices: ACTIVE, INACTIVE, SUSPENDED
  team            ForeignKey → teams.Team (nullable)
  assigned_events ManyToManyField → events.Event (related_name: assigned_users)
  full_name       @property  first_name + last_name
```

**Model: `ActionLog`** — Audit trail
```
Fields: user (FK), action (str), details (str), created_at
```

---

#### `teams` — Team Groupings

**Model: `Team`**
```
Fields: name, slug (auto-generated), color (hex), description, created_at, updated_at
```

---

#### `companies` — Company Registry

**Model: `Company`**
```
Fields: name, address, city, state, country, postal_code, website, notes
Dedup:  Unique by (name, city), case-insensitive via get_or_create_from_payload()
```

---

#### `events` — Event Catalogue

**Model: `Event`**
```
Fields:
  event_code          CharField unique, indexed
  name                CharField
  official_name       CharField (nullable)
  sub_company         CharField choices: Conferences, Training, Summits, Live
  city, country       CharField
  venue               CharField
  event_date          DateField
  end_date            DateField (nullable)
  capacity            PositiveIntegerField
  expected_revenue    DecimalField (nullable)
  accepting_web_bookings  BooleanField
  sales_executive     ForeignKey → accounts.User
  assigned_users      ManyToManyField → accounts.User (via User.assigned_events)

  Team string fields (store team names, not FK):
    speaker_sales_team, spex_team, tele_marketing_team, market_research_team
    content_check, marketing_check, sales_check

  Computed:
    event_status  @property  "Completed" if event_date < today else "Live"
```

---

#### `book_event` — Invoices

**Model: `BookEvent`** (the core invoice entity)
```
Identifiers:
  invoice_number   CharField unique, indexed
  event_code       CharField indexed
  event_name       CharField
  event_date       DateField
  booking_code     CharField  (Speaker, Delegate, Group Pass, SpEx variants, etc.)

Ownership:
  sales_executive  ForeignKey → accounts.User
  team_leader      ForeignKey → accounts.User

Company/Contact (denormalized):
  company_name         CharField
  contact_name         CharField
  contact_email        EmailField
  contact_phone        CharField
  accounts_contact_email  EmailField

Financial:
  currency             CharField  choices: USD, EUR, GBP, AED, SGD, OTHER
  paid_free            CharField  (Paid / Free)
  pre_tax_amount       DecimalField (nullable)
  tax_amount           DecimalField (nullable)
  total_amount         DecimalField (nullable)
  add_ons_total_amount DecimalField (nullable)
  discount             DecimalField default 0
  discount_code        CharField
  ticket_tier          CharField
  delegate_count       PositiveIntegerField

Payment:
  payment_status    CharField  Pending|Paid|Cancelled|Refunded|Free|
                               Credit Pending (Free)|Credit Pending (Paid)|
                               Credit Transferred|Paid (Transferred)
  payment_date      DateField (nullable)
  payment_due_date  DateField (nullable)
  payment_type      CharField  Bank|Stripe (nullable)

Website/Source metadata:
  source      CharField  manual|website
  form_name   CharField
  form_url    CharField
  packages    JSONField

Reference:
  reference     CharField
  parent_code   CharField
  notes         TextField
  add_ons       TextField

Timestamps: created_at, updated_at (auto)
```

**Model: `WebhookLog`** — Website intake audit
```
Fields:
  source_ip, payload (JSON), headers (JSON), response (JSON)
  status          choices: success, failed, duplicate
  http_status     IntegerField
  invoice_number, event_code, error_message
  created_at
```

**Model: `SyncLog`** — Google Sheets sync tracking
```
Fields:
  dataset (unique)       e.g. "bookings", "events"
  last_synced_at         DateTimeField
  last_status            choices: SUCCESS, FAILED
  records_synced         IntegerField
  error_message          TextField
```

---

#### `book_delegate` — Delegates (Attendees)

**Model: `BookDelegate`**
```
Relations:
  invoice    ForeignKey → book_event.BookEvent (related_name: delegates)
  company    ForeignKey → companies.Company (nullable)

Fields:
  first_name, last_name   CharField
  full_name               @property
  email                   EmailField indexed
  phone_number            CharField
  position                CharField  (job title)
  ticket_package          CharField
  sponsorship_level       CharField
  attendance              CharField  Pending|Confirmed|Attended|No-show|Cancelled
  delegate_number         IntegerField
  dietary_requirements    CharField
  notes                   TextField

Per-delegate payment overrides (null = inherit from invoice):
  delegate_payment_status  CharField (nullable)
  delegate_payment_type    CharField (nullable)
  delegate_payment_date    DateField (nullable)

Computed @properties:
  payment_status  → delegate_payment_status or invoice.payment_status
  payment_date    → delegate_payment_date or invoice.payment_date

Unique constraint: (invoice, email)
Timestamps: created_at, updated_at
```

---

### 4.2 API Endpoints

All endpoints are prefixed with `/api/`.

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `auth/token/` | Login — returns token + user info | None |
| GET | `users/` | List all users | Admin |
| POST | `users/` | Create user | Admin |
| GET | `users/{id}/` | User detail | Admin |
| PATCH | `users/{id}/` | Update user | Admin |
| DELETE | `users/{id}/` | Delete user (guards last admin) | Admin |
| POST | `users/{id}/assign_events/` | Bulk-assign events to user | Admin |
| POST | `users/{id}/add_event/` | Add single event | Admin |
| POST | `users/{id}/remove_event/` | Remove single event | Admin |
| GET | `users/{id}/logs/` | Action logs for user | Admin |
| GET | `users/{id}/events_stats/` | Revenue stats by event | Admin |
| PATCH | `users/{id}/move-team/` | Change team assignment | Admin |
| PATCH | `users/{id}/toggle-status/` | Activate/deactivate | Admin |
| PATCH | `users/{id}/reset-password/` | Reset password | Admin |
| GET | `team/` | Sales team performance data | Auth |
| GET | `teams/` | List teams | Auth |
| POST | `teams/` | Create team | Admin |
| PATCH | `teams/{id}/` | Update team | Admin |
| DELETE | `teams/{id}/` | Delete team | Admin |
| GET | `companies/` | List companies | Auth |
| POST | `companies/` | Create company | Auth |
| GET | `companies/{id}/` | Company detail | Auth |
| GET | `events/` | List events (filterable) | Auth |
| POST | `events/` | Create event | Admin |
| PATCH | `events/{id}/` | Update event | Admin |
| DELETE | `events/{id}/` | Delete event | Admin |
| GET | `invoices/` | List invoices | Auth (RBAC filtered) |
| POST | `invoices/` | Create invoice | Auth |
| GET | `invoices/{id}/` | Invoice detail with delegates | Auth |
| PATCH | `invoices/{id}/` | Update invoice | Auth |
| DELETE | `invoices/{id}/` | Delete invoice | Admin |
| GET | `invoices/pending/` | Pending invoices shortcut | Auth |
| PATCH | `invoices/{id}/update_payment/` | Payment-only update with validation | Auth |
| GET | `invoices/webhook_logs/` | Website intake audit log | Admin |
| POST | `invoices/create_from_website/` | Webhook intake endpoint | X-API-KEY |
| GET | `delegates/` | List delegates (full field set) | Auth |
| GET | `delegates/{id}/` | Delegate detail | Auth |
| GET | `search/` | Global search (invoices/delegates/events) | Auth |
| GET | `stats/dashboard/` | KPI data (pending count, revenue) | Auth |

**Filtering / Sorting / Search:**
- `invoices/` supports: `?payment_status=`, `?event_code=`, `?search=`, `?ordering=`
- `delegates/` supports: `?payment_status=`, `?event_code=`, `?search=`, `?ordering=`, `?page=`, `?page_size=`
- Default pagination: 50 records per page

---

### 4.3 Serializers

| Serializer | Used For |
|---|---|
| `BookEventListSerializer` | Invoice list — hides financial fields for non-admins |
| `BookEventDetailSerializer` | Full invoice CRUD with nested delegates |
| `PaymentUpdateSerializer` | `update_payment/` action — validates Paid requires date + type |
| `WebsiteBookingSerializer` | Zoho-compatible website payload validation |
| `BookDelegateInlineSerializer` | Nested in BookEvent detail |
| `BookDelegateListSerializer` | Full delegate list (includes accounts_contact_email, all payment fields) |
| `UserListSerializer` | User list |
| `UserWriteSerializer` | User create/update |

---

### 4.4 Permissions & RBAC

```
Role: ADMIN
  - Sees all invoices across all events
  - Sees all financial fields (amounts, discount, currency)
  - Can create/edit/delete users, events, teams
  - Access to webhook logs

Role: SALES / others
  - Sees only invoices for events in their assigned_events M2M
  - Financial fields are hidden in list serializer
  - Can create/edit invoices and update payment status
  - No access to admin endpoints
```

**Custom Classes:**
- `RBACMixin` — On `BookEventViewSet`, filters `queryset` by `user.assigned_event_codes`
- `IsAdminRole` — `user.role == "admin"`
- `IsSalesOrAdmin` — `user.role in ["sales", "admin"]`

---

### 4.5 Google Sheets Sync

Two sync scripts live in `backend/sync/`:

#### `bookings_sync.py`

Syncs all `BookEvent` records to the configured "Bookings" Google Sheet tab.

**Column mapping (in order):**
```
Payment Status, Event Code, Event Name, Booking Code,
Request Date, Invoice Date, Invoice Number, Source,
Delegate Name, Delegate Email, Phone, Position,
Ticket Package, Sponsorship Level, Attendance, Delegate Number,
Delegate Company, Accounts Contact Email,
Currency, Paid/Free,
Pre-Tax Amount, Tax Amount, Total Amount, Add-Ons Total, Discount, Discount Code,
Payment Type, Date Paid, Payment Due Date, Ref Number, Add-Ons Notes,
Sales Executive, Team Leader,
Added Time, Modified Time
```

**Logic:**
- One row per delegate, or one row per invoice if no delegates
- Payment Status / Type / Date use per-delegate override with invoice fallback
- Batches of 500 records
- Incremental by `updated_at > last_synced_at` or full replace
- Results logged to `SyncLog`

#### `events_sync.py`

Syncs `Event` records to the "Events" Google Sheet tab.

**Columns:**
```
ID, Event Name, Event Code, Event Date, Event Status, Sales Team,
Speaker Sales Team, SpEx Team, Tele Marketing Team, Market Research Team,
City, Country, Venue, Sub Company, End Date, Capacity, Expected Revenue
```

#### `services/google_sheets.py`

Google Sheets client wrapper:
- Authenticates via service account JSON credentials
- `replace_data(sheet_name, headers, rows)` — clears and rewrites entire sheet
- `sync_data(sheet_name, headers, rows, id_index)` — incremental update by ID

---

### 4.6 Website Intake (Zoho)

**Endpoint:** `POST /api/invoices/create_from_website/`

**Authentication:** `X-API-KEY: {WEBSITE_API_KEY}` header OR standard `Authorization: Token`

**Flow:**
1. Validates incoming Zoho-formatted payload via `WebsiteBookingSerializer`
2. Checks `invoice_number` uniqueness → 409 Conflict if duplicate
3. Upserts `Company` by `(name, city)` case-insensitively
4. Auto-assigns `sales_executive` from the event's assigned users
5. Creates `BookEvent` + one or more `BookDelegate` records (skips duplicate emails)
6. Logs everything to `WebhookLog` (success / failed / duplicate)
7. Returns 201 with booking details

All webhook traffic is visible in the UI at Admin → Webhook Logs.

---

## 5. Frontend — React

### 5.1 Pages

| Page | Route/Screen | Description |
|---|---|---|
| `LoginPage.jsx` | `/login` | Username + password form, stores token |
| `BookingsPage.jsx` | default | Main workspace — bookings table + drawer |
| `EventsPage.jsx` | Events | Event list with admin create/edit modal |
| `ReportsPage.jsx` | Reports | KPI cards + revenue chart + status breakdown |
| `CompaniesPage.jsx` | Companies | Company registry table |
| `UsersPage.jsx` | Users | User management (admin only) |
| `TeamPage.jsx` | Team | Sales team performance analytics |
| `TeamsManagementPage.jsx` | Teams Mgmt | Drag-and-drop team organisation |
| `WebhookLogsPage.jsx` | Webhook Logs | Website intake audit log (admin only) |
| `SalesTeamPage.jsx` | Sales Team | Individual sales team member profiles |

**Routing:** Uses a custom `screen` state in `App.jsx` (no React Router `<Route>` components). Navigation is driven by sidebar item clicks calling `setScreen()`.

---

### 5.2 Components

#### `components/ui/` — Generic UI primitives

| Component | Description |
|---|---|
| `Button.jsx` | Primary, secondary, success, danger, ghost variants |
| `Input.jsx` | Input, Select, Textarea, FormField, FieldLabel |
| `Modal.jsx` | ESC-closeable modal with header / body / footer slots |
| `Drawer.jsx` | 400px right-sliding panel |
| `Table.jsx` | SortableTh, Td, Pager, EmptyState |
| `Badge.jsx` | StatusBadge, TierBadge, EventStatusBadge, SourceBadge |
| `Avatar.jsx` | Coloured initials circle (deterministic colour by name) |
| `InfoCard.jsx` | InfoSection, InfoGrid, InfoItem — structured detail sections |

#### `components/layout/` — Shell

| Component | Description |
|---|---|
| `Sidebar.jsx` | Dark left sidebar with nav items + pending count badge (refreshes every 60s) |
| `Header.jsx` | Breadcrumb bar + global search (⌘K) with 300ms debounce |

#### `components/bookings/` — Booking Module

| Component | Description |
|---|---|
| `BookingsTable.jsx` | Main bookings list — all columns from delegate table |
| `BookingEditModal.jsx` | Full edit modal — compact header + delegate table |
| `AddBookingModal.jsx` | Create modal — same layout as edit (EventCodePicker, 3-col header) |
| `DatePopup.jsx` | Inline date confirmation popup (Enter confirms, ESC cancels) |

#### `components/events/`

| Component | Description |
|---|---|
| `EventDetailDrawer.jsx` | Right-side drawer with event stats and detail |

#### `components/users/`

| Component | Description |
|---|---|
| `UserDetailDrawer.jsx` | User detail with event assignments list |
| `UserModal.jsx` | Create / edit user form |

#### `components/teams/`

| Component | Description |
|---|---|
| `TeamCard.jsx` | Team card showing name, color, member list |
| `UserDraggable.jsx` | Draggable user item (dnd-kit) |

---

### 5.3 API Layer

All API modules live in `frontend/src/api/` and use a shared Axios client.

**`client.js`:**
- Base URL from `REACT_APP_API_URL` env var
- Injects `Authorization: Token {token}` from localStorage on every request
- On 401 response: clears localStorage, redirects to `/login`

| Module | Key Methods |
|---|---|
| `auth.js` | `authApi.login(u,p)`, `authApi.me()` |
| `invoices.js` | `list()`, `get(id)`, `pending()`, `create(data)`, `update(id,data)`, `delete(id)`, `updatePayment(id,data)`, `webhookLogs()` |
| `delegates.js` | `list(params)`, `get(id)`, `byInvoice(invId)` |
| `events.js` | `list(params)`, `get(id)`, `create(data)`, `update(id,data)`, `delete(id)`, `stats()` |
| `companies.js` | `list(params)`, `get(id)`, `delegates(id)` |
| `users.js` | `list(params)`, `get(id)`, `create(data)`, `update(id,data)`, `moveTeam(id,teamId)`, `resetPassword(id,pw)`, `toggleStatus(id)`, `assignEvents(id,codes)` |
| `teams.js` | `list(params)`, `create(data)`, `update(id,data)`, `delete(id)` |
| `team.js` | `list()`, `retrieve(id)` |
| `search.js` | `search(q)`, `stats()` |

---

### 5.4 Contexts & Hooks

#### Contexts

| Context | Provides |
|---|---|
| `AuthContext` | `user`, `token`, `isAuthenticated`, `login()`, `logout()`, `isAdmin`, `isSales` |
| `ToastContext` | `toast.success()`, `toast.error()`, `toast.warn()`, `toast.info()` |
| `ThemeContext` | Theme state (light/dark) |

#### Hooks

| Hook | Purpose |
|---|---|
| `useFetch(fn, deps, opts)` | Generic async data fetch with loading/error/data/refetch |
| `usePagination()` | Returns `{ page, setPage }` |
| `useSort(key, dir)` | Returns `{ sort, toggle }` for sortable columns |

---

## 6. Bookings Module — Detailed Breakdown

The bookings module is the core of the application. Here is its complete structure.

### BookingsTable Columns (current)

The main bookings list (`BookingsTable.jsx`) fetches from `delegatesApi.list()` and displays:

| Column | Source Field | Sortable | Notes |
|---|---|---|---|
| Status | `effective_payment_status` | Yes | Shows per-delegate override or invoice status |
| Invoice | `invoice_number` | Yes | Mono font, accent colour |
| Event | `event_code` | No | Mono font |
| Booking Code | `booking_code` | No | — |
| Request Date | `created_at` | Yes | Datetime sliced to date |
| Invoice Date | `invoice_date` | Yes | — |
| Name | `full_name` (with Avatar) | Yes | — |
| Job Title | `position` | Yes | — |
| Company | `company_display` | No | — |
| Accounts Email | `accounts_contact_email` | No | Invoice-level field |
| Email | `email` | No | Delegate email |
| Direct Line | `phone_number` | No | Mono font |
| Attendance | `attendance` | Yes | Shows **Yes** / **No** |
| Pmt Type | `effective_payment_type` | No | — |
| Pmt Date | `effective_payment_date` | Yes | — |
| — | (action button) | No | "View booking" opens EditModal |

### BookingEditModal Layout

```
┌─ HEADER (sticky) ──────────────────────────────────────────────┐
│  [Avatar] Edit Booking [Status Badge] [Source Badge]   [✕]     │
│  {Lead Name} · {Company}                                        │
│  [Event Code Picker] [Event Name (read-only)] [Invoice Number]  │
└────────────────────────────────────────────────────────────────┘
┌─ DELEGATE DETAILS ──────────────────────────────────────────────┐
│  Delegate Details [N] [+ Add Delegate]                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ # | PmtStatus | BookCode | ReqDate | InvDate | Name |   │   │
│  │   | JobTitle  | Company  | AccEmail| Email   | Line |   │   │
│  │   | Attend    | PmtType  | PmtDate                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘
┌─ FOOTER (sticky) ───────────────────────────────────────────────┐
│  [Delete booking]  N delegates · Modified DD/MM/YYYY  [Cancel] [Save] │
└────────────────────────────────────────────────────────────────┘
```

### AddBookingModal Layout (matches EditModal)

```
┌─ HEADER (sticky) ──────────────────────────────────────────────┐
│  Add Booking                                            [✕]     │
│  [Event Code Picker (rich)] [Event Name (read-only)] [Inv No.] │
└────────────────────────────────────────────────────────────────┘
┌─ DELEGATE DETAILS ──────────────────────────────────────────────┐
│  Same COLS table as edit modal (Invoice Date & Booking Code     │
│  editable inline in the table via invoiceCtx)                   │
└────────────────────────────────────────────────────────────────┘
┌─ FOOTER (sticky) ───────────────────────────────────────────────┐
│  N delegates                          [Cancel] [Save Booking]   │
└────────────────────────────────────────────────────────────────┘
```

### Delegate Table COLS (shared between add and edit modal)

```javascript
const COLS = [
  { key: "delegate_payment_status", label: "Pmt Status",     width: 180, type: "select" },
  { key: "_booking_code",           label: "Booking Code",   width: 130, invoiceLevel: true },
  { key: "_request_date",           label: "Request Date",   width: 130, invoiceLevel: true, readOnly: true },
  { key: "_invoice_date",           label: "Invoice Date",   width: 130, invoiceLevel: true },
  { key: "_full_name",              label: "Name",           width: 160, virtual: "name" },
  { key: "position",                label: "Job Title",      width: 180 },
  { key: "_company_name",           label: "Company",        width: 180, invoiceLevel: true },
  { key: "email",                   label: "Email",          width: 240, type: "email" },
  { key: "_accounts_contact_email", label: "Accounts Email", width: 220, invoiceLevel: true },
  { key: "phone_number",            label: "Direct Line",    width: 160, mono: true },
  { key: "attendance",              label: "Attendance",     width: 80,  type: "checkbox" },
  { key: "delegate_payment_type",   label: "Pmt Type",       width: 140, type: "select" },
  { key: "delegate_payment_date",   label: "Pmt Date",       width: 150, type: "date" },
];
```

**`invoiceLevel` fields** are shared across all delegates in the same invoice (booking_code, invoice_date, company, accounts_contact_email). Editing any cell updates the invoice, not the individual delegate.

---

## 7. Work Completed

The following features have been fully built and are working:

### Backend
- [x] Custom User model with roles (ADMIN, SALES, MARKET_RESEARCH, SPEX, OPERATIONS)
- [x] Token authentication (login → token → Authorization header)
- [x] RBAC: non-admin users filtered to their assigned events only
- [x] Full CRUD for: Users, Teams, Companies, Events, Invoices (BookEvent), Delegates (BookDelegate)
- [x] Payment update endpoint with validation (Paid requires date + type)
- [x] Website intake webhook endpoint (Zoho-compatible) with duplicate detection
- [x] WebhookLog audit trail for all website intake requests
- [x] Google Sheets sync for bookings (one row per delegate, 35 columns)
- [x] Google Sheets sync for events
- [x] Incremental + full-replace sync modes with SyncLog tracking
- [x] Global search across invoices / delegates / events
- [x] Dashboard KPI stats endpoint
- [x] Company deduplication (upsert by name + city)
- [x] Per-delegate payment override (delegate_payment_status/type/date fall back to invoice)
- [x] CORS configuration for frontend and event website domains
- [x] ActionLog for user activity auditing

### Frontend
- [x] Login page with token storage
- [x] App shell: sidebar + header + global search (⌘K, 300ms debounce)
- [x] Pending badge in sidebar (auto-refreshes every 60s)
- [x] **Bookings page** — full delegate-centric table with all columns:
  - Status, Invoice, Event, Booking Code, Request Date, Invoice Date, Name, Job Title, Company, Accounts Email, Email, Direct Line, Attendance (Yes/No), Pmt Type, Pmt Date
  - Horizontal scroll for wide table
  - Sortable columns (status, invoice, name, position, attendance, dates, pmt date)
  - Pagination (50 per page)
  - Search + event filter + clear filters
  - Click row → opens BookingEditModal
- [x] **BookingEditModal** — compact sticky header (EventCodePicker + event name + invoice number), delegate details table (all COLS), sticky footer
- [x] **AddBookingModal** — same layout as edit modal (EventCodePicker, same COLS table), no separate Invoice Information section
- [x] **EventCodePicker** — rich searchable dropdown with event code badge, name, date, city in both add and edit modals
- [x] Accounts Email column restored to delegate details table in both modals
- [x] Attendance shows Yes (green) / No (dim) in bookings table
- [x] Events page — event list table, admin create/edit modal
- [x] **Team dropdowns in Events modal** — all 7 team fields (Speaker Sales, SpEx, Tele Marketing, Market Research, Content Check, Marketing Check, Sales Check) are now linked dropdowns populated from Teams data (was plain text inputs)
- [x] Reports page — KPI cards + revenue by event + status breakdown
- [x] Companies page — company registry table
- [x] Users page — admin CRUD for users
- [x] Team page — sales team performance view
- [x] TeamsManagementPage — drag-and-drop team organisation with dnd-kit
- [x] WebhookLogsPage — website intake audit log (admin only)
- [x] Toast notification system (success / error / warn / info)
- [x] Avatar component (deterministic colour from name initials)
- [x] All inline styles, no CSS frameworks

---

## 8. Current State of Key Files

### Files recently modified (from git status at last session)

| File | Status | Summary of Changes |
|---|---|---|
| `frontend/src/components/bookings/AddBookingModal.jsx` | Modified | Removed Invoice Information section; added compact header matching EditModal; added EventCodePicker; added Accounts Email column to COLS; added invoiceCtx.accounts_contact_email |
| `frontend/src/components/bookings/BookingEditModal.jsx` | Modified | Added Accounts Email column to COLS; added accounts_contact_email to invoiceCtx; added _accounts_contact_email handler in DelegateRow; minor Overlay padding fix |
| `frontend/src/components/bookings/BookingsTable.jsx` | Modified | Expanded from 8 to 16 data columns to match edit modal COLS; added horizontal scroll; Attendance shows Yes/No; Booking Code replaces old Type column |
| `frontend/src/pages/EventsPage.jsx` | Modified | All 7 team text inputs replaced with linked dropdowns from teamsApi; added teamsApi import and fetch |

### Key architectural notes for future sessions

1. **`invoiceLevel: true`** fields in COLS are shared across all delegates in an invoice. They write back via `onSetInvoice(key, value)` which calls `set()` on the invoice form, not `setDelegate()`.

2. **`_accounts_contact_email`** is an invoice-level field (stored on `BookEvent.accounts_contact_email`). In the delegate table it appears under each row but edits the invoice.

3. **`effective_payment_status/type/date`** in the delegate serializer are read-only computed fields: `delegate_payment_X or invoice.payment_X`. These are what the bookings table displays.

4. **Google Sheets columns are fixed** — `BOOKINGS_HEADERS` in `bookings_sync.py` defines the exact column order and all 35 columns are mapped in `_row()`.

5. **`BookDelegateListSerializer`** is what powers the bookings table — it contains all fields including `accounts_contact_email`, `booking_code`, `position`, `phone_number`, `effective_payment_type`, `effective_payment_date`, `created_at`.

6. **No React Router routes** — navigation uses a custom `screen` state in `App.jsx`. Each sidebar item sets `screen` to a string and `AppShell` renders the corresponding page component.

7. **Team fields on events are strings** — `speaker_sales_team`, `spex_team`, etc. store the team name as a `CharField`, not a FK. The team dropdown saves `team.name` as the value.

---

## 9. Environment & Configuration

### Backend `.env` Variables

```env
SECRET_KEY=
DEBUG=True
DATABASE_URL=sqlite:///db.sqlite3  # or postgres://...
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:3000
WEBSITE_API_KEY=                   # for X-API-KEY header auth on webhook endpoint
GOOGLE_SHEETS_CREDENTIALS=config/credentials.json
GOOGLE_SHEET_ID=
GOOGLE_SHEET_EVENTS_TAB=Events
GOOGLE_SHEET_BOOKINGS_TAB=Bookings
```

### Frontend `.env`

```env
REACT_APP_API_URL=http://localhost:8000/api
```

### Django Settings Summary

```python
AUTH_USER_MODEL = "accounts.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": "..StandardPagination",   # 50 per page
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
}
```

---

## 10. Data Flow Diagrams

### Login Flow
```
User → POST /api/auth/token/ {username, password}
     ← {token, user_id, email, role}
     → Store token in localStorage
     → Axios client injects "Authorization: Token {token}" on every request
```

### Bookings Table Load
```
BookingsPage mounts
  → delegatesApi.list({page, ordering, payment_status, event_code, search})
  → GET /api/delegates/?page=1&page_size=50&...
  → BookDelegateListSerializer (includes all fields)
  → DelegateRow renders one row per delegate
  → Click row → setEditInvId(row.book_event_id)
  → BookingEditModal loads invoice via invoicesApi.get(invoiceId)
```

### Save Booking (Edit)
```
User edits fields in modal
  → form state updated via set() or setDelegate()
  → Click "Save Changes"
  → invoicesApi.update(form.id, payload)
  → PATCH /api/invoices/{id}/ with full form including nested delegates
  → Backend upserts delegates (creates new, updates existing by id)
  → onSaved() → reload bookings table
```

### Website Intake
```
Event Website → POST /api/invoices/create_from_website/
                Headers: X-API-KEY: {key}
                Body: Zoho-formatted payload
              → Validate via WebsiteBookingSerializer
              → Check duplicate invoice_number → 409 if exists
              → Upsert Company
              → Auto-assign sales_executive from event
              → Create BookEvent + BookDelegate(s)
              → Log to WebhookLog
              ← 201 {invoice_number, booking_code, delegates_created}
```

### Google Sheets Sync
```
Trigger sync_bookings(full=False)
  → Query BookEvent.objects.filter(updated_at > last_sync)
  → For each invoice: expand to one row per delegate (or one row if none)
  → Batch 500 rows at a time
  → google_sheets.replace_data(BOOKINGS_TAB, HEADERS, all_rows)
  → Update SyncLog.last_synced_at, records_synced, last_status
```

---

## 11. Known Patterns & Conventions

### Inline Styles
All styling is done via JavaScript style objects. No CSS files. Design tokens (colours, borders) use CSS custom properties:
```js
const BORDER   = "var(--border)";
const BG_ALT   = "var(--surface-alt)";
const TEXT     = "var(--text)";
const TEXT_DIM = "var(--text-dim)";
// var(--accent) — primary brand colour
// var(--accent-soft) — accent with opacity for focus rings
// var(--danger) — red for destructive actions
// var(--font-mono) — monospace font family
// var(--font-sans) — UI font family
```

### Cell Input Pattern (delegate table)
Cells are transparent until focused, then show white background + accent border:
```js
border: `1px solid ${f ? "var(--accent)" : "transparent"}`,
background: f ? "#fff" : "transparent",
boxShadow: f ? "0 0 0 2px var(--accent-soft)" : "none",
```

### invoiceLevel vs delegate-level fields
```
invoiceLevel: true  → same value shown in every row, editing writes to invoice form
(no flag)           → per-delegate value, editing writes to individual delegate
virtual: "name"     → special split-field input (first_name + last_name combined)
```

### API response shapes
- List endpoints: `{ count, results: [...] }`
- Detail endpoints: `{ id, ..., delegates: [...] }` (for invoices)
- Pagination: always `page` + `page_size` params

### Toast on error
Always use `toast.error(err.response?.data?.detail || "Fallback message")` to surface Django validation errors to the user.

### Payment status options (full list)
```
"Pending", "Paid", "Cancelled", "Refunded",
"Credit Pending (Free)", "Credit Pending (Paid)",
"Credit Transferred", "Paid (Transferred)"
```

### Booking code options (full list)
```
"Speaker", "Delegate", "Group Pass", "SPP", "SPP / Group Pass",
"PLT SpEx", "GLD SpEx", "SLV SpEx",
"Speaker / PLT SpEx", "Speaker / GLD SpEx", "Speaker / SLV SpEx",
"Speaker / PTN SpEx", "Speaker / Group Pass", "PTN SpEx",
"Upgraded to PLT SpEx", "Upgraded to GLD SpEx", "Upgraded to SLV SpEx",
"Speaker Table", "Advisory Board Member", "Complimentary", "Media", "Add-Ons"
```

---

*Generated: 2026-05-11 | Project: LINQ CRM Fullstack*
