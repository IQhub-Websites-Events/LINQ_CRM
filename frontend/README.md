# Linq CRM — React Frontend

> Payment confirmation UI. Sales team reviews and confirms payments. All data auto-arrives from the event website.

## Stack
- React 18, React Router 6
- Axios (API client with token interceptor)
- Zero CSS frameworks — inline styles + global CSS-in-JS
- No Redux — React Context for auth + toast state

## Quick start

```bash
cd frontend
npm install
cp .env.example .env     # set REACT_APP_API_URL
npm start                 # → http://localhost:3000
```

`.env.example`:
```
REACT_APP_API_URL=http://localhost:8000/api
```

## Project structure

```
src/
├── api/                  # Axios client + per-resource API modules
│   ├── client.js         # Axios instance, token interceptor, 401 redirect
│   ├── auth.js           # login, me
│   ├── invoices.js       # list, get, pending, updatePayment, createFromWebsite
│   ├── delegates.js      # list, get, byInvoice, updateAttendance
│   ├── events.js         # list, get, stats, create, update, delete
│   ├── companies.js      # list, get, delegates
│   ├── users.js          # list, get, create, update, assignEvents
│   ├── search.js         # global search, dashboard stats
│   └── index.js          # re-exports
│
├── contexts/
│   ├── AuthContext.jsx   # token/user state, login/logout, isAdmin/isSales
│   └── ToastContext.jsx  # toast.success/error/warn/info + ToastContainer
│
├── hooks/
│   ├── useFetch.js       # generic data fetching with loading/error
│   ├── usePagination.js  # page state management
│   └── useSort.js        # column sort state + sortData()
│
├── utils/
│   ├── constants.js      # PAYMENT_STATUSES, EVENT_STATUSES, STATUS_CONFIG, etc.
│   └── helpers.js        # fmt.currency/date/dateShort/initials, today(), exportToCSV()
│
├── components/
│   ├── ui/               # Primitive UI components
│   │   ├── Badge.jsx     # StatusBadge, TierBadge, EventStatusBadge
│   │   ├── Avatar.jsx    # Colored initials avatar
│   │   ├── Button.jsx    # Button variants: primary/secondary/success/danger/ghost
│   │   ├── Input.jsx     # Input, Select, FieldLabel, FormField
│   │   ├── Table.jsx     # SortableTh, Td, Pager, EmptyState
│   │   ├── Modal.jsx     # ESC-closeable modal with header/body/footer
│   │   ├── Drawer.jsx    # Slide-in side panel (400px)
│   │   └── InfoCard.jsx  # InfoSection, InfoGrid, InfoItem
│   │
│   ├── layout/
│   │   ├── Sidebar.jsx   # Dark sidebar with nav items + pending badge
│   │   └── Header.jsx    # Breadcrumb + global search dropdown (⌘K)
│   │
│   └── bookings/
│       ├── BookingsTable.jsx  # Main workspace — invoice rows, filter chips, quick pay
│       ├── BookingDrawer.jsx  # Side panel — payment edit, delegate list, attendance
│       └── DatePopup.jsx      # Inline date confirmation (Enter/ESC keyboard support)
│
├── pages/
│   ├── LoginPage.jsx     # Username/password, token stored to localStorage
│   ├── BookingsPage.jsx  # Default screen — wraps BookingsTable
│   ├── EventsPage.jsx    # Events table with admin CRUD
│   ├── ReportsPage.jsx   # KPI cards + revenue bars + status breakdown
│   └── CompaniesPage.jsx # Company registry table
│
├── App.jsx               # AuthProvider + ToastProvider + AppShell routing
└── index.js              # ReactDOM.createRoot
```

## Key UX Patterns

### Bookings (default screen)
- Opens on **Pending** filter by default — straight to what needs action
- Click any row → **side drawer** opens (table shifts left, drawer slides in from right)
- Click payment status badge → **date popup** appears inline (Enter confirms, ESC cancels)
- Payment update calls `PATCH /api/invoices/{id}/update_payment/` — delegates inherit via backend `@property`

### Global search (⌘K)
- 300ms debounce → searches invoices + delegates + events simultaneously
- Click result → clears filter, navigates to screen, opens drawer if invoice

### Authentication
- `POST /api/auth/token/` → token stored in `localStorage`
- Axios interceptor attaches `Authorization: Token <token>` on every request
- 401 response → clears storage, redirects to `/login`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REACT_APP_API_URL` | `/api` | Django backend base URL |
