import { useState, useEffect, useCallback, useRef } from "react";
import { paymentActivityApi } from "../../api/paymentActivity";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
};

const fmtDatetime = (d) => {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
};

const fmtAmount = (n, currency) => {
  if (n == null) return "—";
  const sym = { USD: "$", GBP: "£", EUR: "€", AED: "AED ", SGD: "S$", INR: "₹" }[currency] ?? "";
  return sym + Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

// ── Shared style tokens ───────────────────────────────────────────────────────

const inputStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 12,
  color: "var(--text)",
  outline: "none",
  fontFamily: "inherit",
};

const STATUS_STYLE = {
  Upcoming:  { background: "#dbeafe", color: "#1d4ed8" },
  Live:      { background: "var(--success-soft)", color: "var(--success)" },
  Completed: { background: "var(--surface-alt)", color: "var(--text-dim)" },
  Draft:     { background: "var(--surface-alt)", color: "var(--text-faint)" },
  Cancelled: { background: "var(--danger-soft)", color: "var(--danger)" },
};

const TREND_STYLE = {
  Increasing:   { bg: "var(--success-soft)", color: "var(--success)",  arrow: "↑" },
  Stable:       { bg: "#dbeafe",            color: "#1d4ed8",          arrow: "→" },
  Declining:    { bg: "var(--danger-soft)", color: "var(--danger)",    arrow: "↓" },
  "New Activity":{ bg: "#ede9fe",           color: "#7c3aed",          arrow: "★" },
  Inactive:     { bg: "var(--surface-alt)", color: "var(--text-faint)", arrow: "·" },
};

const ACTIVITY_COLOR = {
  green:  { dot: "var(--success)",  label: "Active"   },
  yellow: { dot: "var(--warn)",     label: "Low"      },
  red:    { dot: "var(--danger)",   label: "Inactive" },
};

// ── Small atoms ───────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || { background: "var(--surface-alt)", color: "var(--text-faint)" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 7px", borderRadius: 4, fontSize: 10, fontWeight: 600,
      ...s,
    }}>{status || "—"}</span>
  );
}

function TrendBadge({ trend }) {
  const s = TREND_STYLE[trend] || TREND_STYLE.Inactive;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600,
      background: s.bg, color: s.color,
    }}>
      <span>{s.arrow}</span>
      <span>{trend}</span>
    </span>
  );
}

function ActivityDot({ color }) {
  const s = ACTIVITY_COLOR[color] || ACTIVITY_COLOR.red;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: s.dot, flexShrink: 0,
        boxShadow: `0 0 0 2px ${s.dot}33`,
      }} />
      <span style={{ fontSize: 10, color: "var(--text-faint)", fontWeight: 500 }}>{s.label}</span>
    </span>
  );
}

function MonoNum({ v, color }) {
  return (
    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: color || "var(--text)" }}>
      {v != null ? v : "—"}
    </span>
  );
}

// ── Table columns ─────────────────────────────────────────────────────────────

const COLS = [
  { key: "event_code",        label: "Code",       sticky: true, left: 0,   width: 90 },
  { key: "event_name",        label: "Event",      sticky: true, left: 90,  width: 210, ellipsis: true },
  { key: "sales_rep",         label: "Rep",        width: 110, ellipsis: true },
  { key: "event_date",        label: "Date",       width: 85  },
  { key: "status",            label: "Status",     width: 96  },
  { key: "total_paid",        label: "Total",      width: 65  },
  { key: "paid_7d",           label: "7D",         width: 60  },
  { key: "paid_15d",          label: "15D",        width: 60  },
  { key: "paid_30d",          label: "30D",        width: 60  },
  { key: "last_payment_date", label: "Last Pay",   width: 85  },
  { key: "last_booking_date", label: "Last Book",  width: 85  },
  { key: "trend",             label: "Trend",      width: 110 },
  { key: "_activity",         label: "Activity",   width: 80  },
];

function cellValue(col, row) {
  if (col.key === "event_date" || col.key === "last_payment_date" || col.key === "last_booking_date") {
    return fmtDate(row[col.key]);
  }
  if (col.key === "status")   return <StatusBadge status={row.status} />;
  if (col.key === "trend")    return <TrendBadge trend={row.trend} />;
  if (col.key === "_activity") return <ActivityDot color={row.activity_color} />;
  if (col.key === "total_paid")  return <MonoNum v={row.total_paid} color="var(--text)" />;
  if (col.key === "paid_7d")     return <MonoNum v={row.paid_7d}    color={row.paid_7d  > 0 ? "var(--success)" : "var(--text-faint)"} />;
  if (col.key === "paid_15d")    return <MonoNum v={row.paid_15d}   color={row.paid_15d > 0 ? "var(--success)" : "var(--text-faint)"} />;
  if (col.key === "paid_30d")    return <MonoNum v={row.paid_30d}   color={row.paid_30d > 0 ? "var(--success)" : "var(--text-faint)"} />;
  if (col.key === "sales_rep")   return <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{row.sales_rep}</span>;
  return row[col.key] ?? "—";
}

// ── Main table ────────────────────────────────────────────────────────────────

function EventPaymentTable({ events, onRowClick, selectedCode }) {
  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      {events.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>
          No events found.
        </div>
      ) : (
        <table style={{ borderCollapse: "collapse", fontSize: 12, width: "max-content", minWidth: "100%" }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--surface)" }}>
            <tr>
              {COLS.map(col => (
                <th
                  key={col.key}
                  style={{
                    padding: "9px 12px",
                    textAlign: "left",
                    fontWeight: 600,
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "var(--text-faint)",
                    borderBottom: "1px solid var(--border)",
                    whiteSpace: "nowrap",
                    background: "var(--surface)",
                    width: col.width,
                    minWidth: col.width,
                    ...(col.sticky ? { position: "sticky", left: col.left, zIndex: 11, boxShadow: "1px 0 0 var(--border)" } : {}),
                  }}
                >{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((row, idx) => {
              const isActive = row.event_code === selectedCode;
              return (
                <tr
                  key={row.event_code}
                  onClick={() => onRowClick(row)}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: isActive
                      ? "rgba(52,211,153,0.07)"
                      : idx % 2 === 0 ? "var(--surface)" : "var(--bg)",
                    cursor: "pointer",
                    transition: "background .1s",
                    outline: isActive ? "1px solid rgba(52,211,153,0.3)" : "none",
                    outlineOffset: -1,
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "var(--surface-alt)"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = idx % 2 === 0 ? "var(--surface)" : "var(--bg)"; }}
                >
                  {COLS.map(col => (
                    <td
                      key={col.key}
                      style={{
                        padding: "8px 12px",
                        whiteSpace: "nowrap",
                        maxWidth: col.width,
                        ...(col.ellipsis ? { overflow: "hidden", textOverflow: "ellipsis" } : {}),
                        background: "inherit",
                        ...(col.sticky ? { position: "sticky", left: col.left, zIndex: 1, boxShadow: "1px 0 0 var(--border)" } : {}),
                      }}
                    >
                      {cellValue(col, row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Paid Bookings Table (inside drawer) ───────────────────────────────────────

const DRAWER_COLS = [
  { key: "invoice_number", label: "Invoice",     width: 130 },
  { key: "contact_name",   label: "Contact",     width: 140, ellipsis: true },
  { key: "company_name",   label: "Company",     width: 160, ellipsis: true },
  { key: "payment_type",   label: "Type",        width: 70  },
  { key: "total_amount",   label: "Amount",      width: 90  },
  { key: "payment_date",   label: "Paid On",     width: 85  },
  { key: "created_at",     label: "Booked",      width: 85  },
  { key: "delegate_count", label: "Dels",        width: 50  },
  { key: "sales_rep",      label: "Rep",         width: 110, ellipsis: true },
  { key: "_actions",       label: "",            width: 60  },
];

function drawerCellValue(col, row, onCopy) {
  if (col.key === "invoice_number") {
    return (
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>
        {row.invoice_number}
      </span>
    );
  }
  if (col.key === "payment_date") return fmtDate(row.payment_date);
  if (col.key === "created_at")   return fmtDatetime(row.created_at);
  if (col.key === "total_amount") {
    return (
      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--success)" }}>
        {fmtAmount(row.total_amount, row.currency)}
      </span>
    );
  }
  if (col.key === "delegate_count") {
    return <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>{row.delegate_count}</span>;
  }
  if (col.key === "payment_type") {
    return (
      <span style={{
        fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4,
        background: row.payment_type === "Stripe" ? "#ede9fe" : "#dbeafe",
        color: row.payment_type === "Stripe" ? "#7c3aed" : "#1d4ed8",
      }}>{row.payment_type}</span>
    );
  }
  if (col.key === "sales_rep") {
    return <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{row.sales_rep}</span>;
  }
  if (col.key === "_actions") {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); onCopy(row.invoice_number); }}
        title="Copy Invoice #"
        style={{
          background: "none", border: "1px solid var(--border)", borderRadius: 4,
          padding: "3px 7px", cursor: "pointer", fontSize: 10,
          color: "var(--text-faint)", fontFamily: "inherit",
        }}
      >Copy</button>
    );
  }
  return row[col.key] ?? "—";
}

function PaidBookingsTable({ bookings, onCopy }) {
  if (!bookings.length) {
    return (
      <div style={{ padding: "28px 0", textAlign: "center", color: "var(--text-faint)", fontSize: 12 }}>
        No paid bookings in this window.
      </div>
    );
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", fontSize: 12, width: "max-content", minWidth: "100%" }}>
        <thead style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--surface)" }}>
          <tr>
            {DRAWER_COLS.map(col => (
              <th
                key={col.key}
                style={{
                  padding: "8px 12px",
                  textAlign: "left",
                  fontWeight: 600,
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--text-faint)",
                  borderBottom: "1px solid var(--border)",
                  whiteSpace: "nowrap",
                  background: "var(--surface)",
                  width: col.width,
                  minWidth: col.width,
                }}
              >{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bookings.map((row, idx) => (
            <tr
              key={row.invoice_number}
              style={{
                borderBottom: "1px solid var(--border)",
                background: idx % 2 === 0 ? "var(--surface)" : "var(--bg)",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--surface-alt)"}
              onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? "var(--surface)" : "var(--bg)"}
            >
              {DRAWER_COLS.map(col => (
                <td
                  key={col.key}
                  style={{
                    padding: "7px 12px",
                    whiteSpace: "nowrap",
                    maxWidth: col.width,
                    ...(col.ellipsis ? { overflow: "hidden", textOverflow: "ellipsis" } : {}),
                  }}
                >
                  {drawerCellValue(col, row, onCopy)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Date range tabs ───────────────────────────────────────────────────────────

const DATE_TABS = [
  { id: null, label: "All Paid" },
  { id: 7,    label: "Last 7D"  },
  { id: 15,   label: "Last 15D" },
  { id: 30,   label: "Last 30D" },
];

function DateRangeTabs({ active, onChange }) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
      {DATE_TABS.map(tab => (
        <button
          key={String(tab.id)}
          onClick={() => onChange(tab.id)}
          style={{
            padding: "8px 14px",
            border: "none",
            background: "none",
            fontSize: 12,
            fontWeight: active === tab.id ? 600 : 400,
            color: active === tab.id ? "var(--accent)" : "var(--text-faint)",
            borderBottom: active === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
            cursor: "pointer",
            fontFamily: "inherit",
            whiteSpace: "nowrap",
          }}
        >{tab.label}</button>
      ))}
    </div>
  );
}

// ── Event Payment Drawer ──────────────────────────────────────────────────────

function EventPaymentDrawer({ event, onClose }) {
  const [days, setDays]         = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [copied, setCopied]     = useState(null);

  const load = useCallback(() => {
    if (!event?.event_code) return;
    setLoading(true);
    const params = days ? { days } : {};
    paymentActivityApi.bookings(event.event_code, params)
      .then(setBookings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [event?.event_code, days]);

  useEffect(() => { load(); }, [load]);

  const handleCopy = (inv) => {
    copyToClipboard(inv);
    setCopied(inv);
    setTimeout(() => setCopied(null), 1800);
  };

  if (!event) return null;
  const ts = TREND_STYLE[event.trend] || TREND_STYLE.Inactive;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 900 }}
      />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: 900,
        background: "var(--surface)",
        borderLeft: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        zIndex: 901,
      }}>
        {/* ── Drawer header ──────────────────────────────────── */}
        <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 11,
                  color: "var(--text-faint)", background: "var(--surface-alt)",
                  border: "1px solid var(--border)", padding: "2px 7px", borderRadius: 4,
                }}>{event.event_code}</span>
                <StatusBadge status={event.status} />
                <TrendBadge trend={event.trend} />
              </div>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", margin: 0, lineHeight: 1.3 }}>
                {event.event_name}
              </h2>
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>
                {event.sub_company} · {event.city} · {fmtDate(event.event_date)}
                {event.sales_rep && event.sales_rep !== "—" && <> · {event.sales_rep}</>}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 20, padding: 4, lineHeight: 1, flexShrink: 0 }}
            >✕</button>
          </div>

          {/* Quick metric pills */}
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {[
              { label: "Total Paid",  value: event.total_paid,                     color: "var(--success)"  },
              { label: "Last 7D",     value: event.paid_7d,                        color: event.paid_7d > 0 ? "var(--success)" : "var(--text-faint)" },
              { label: "Last 15D",    value: event.paid_15d,                       color: "var(--text)"     },
              { label: "Last 30D",    value: event.paid_30d,                       color: "var(--text)"     },
              { label: "Last Payment",value: fmtDate(event.last_payment_date),     color: "var(--text)"     },
              { label: "Last Booking",value: fmtDate(event.last_booking_date),     color: "var(--text-dim)" },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-faint)", fontWeight: 600 }}>{label}</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Date filter tabs ──────────────────────────────── */}
        <DateRangeTabs active={days} onChange={setDays} />

        {/* ── Bookings section header ───────────────────────── */}
        <div style={{
          padding: "10px 24px 8px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid var(--border)", flexShrink: 0,
          background: "var(--bg)",
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Paid Bookings
            {!loading && <span style={{ marginLeft: 8, fontFamily: "var(--font-mono)", color: "var(--accent)" }}>{bookings.length}</span>}
          </div>
          {copied && (
            <span style={{ fontSize: 11, color: "var(--success)", fontWeight: 500 }}>
              ✓ Copied {copied}
            </span>
          )}
        </div>

        {/* ── Scrollable table ──────────────────────────────── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px" }}>
          {loading ? (
            <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-faint)", fontSize: 12 }}>Loading…</div>
          ) : (
            <PaidBookingsTable bookings={bookings} onCopy={handleCopy} />
          )}
        </div>
      </div>
    </>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

function PaymentActivityFilters({ search, setSearch, statusFilter, setStatusFilter, subCompanyFilter, setSubCompanyFilter }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
      padding: "10px 20px", borderBottom: "1px solid var(--border)",
      background: "var(--surface)", flexShrink: 0,
    }}>
      <input
        placeholder="Search event or code…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ ...inputStyle, width: 220 }}
      />
      <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: 130 }}>
        <option value="">All Statuses</option>
        {["Draft", "Upcoming", "Live", "Completed", "Cancelled"].map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select value={subCompanyFilter} onChange={e => setSubCompanyFilter(e.target.value)} style={{ ...inputStyle, width: 160 }}>
        <option value="">All Sub-Companies</option>
        {["Linq Conferences", "Linq Training", "Linq Summits", "Linq Live"].map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {(search || statusFilter || subCompanyFilter) && (
        <button
          onClick={() => { setSearch(""); setStatusFilter(""); setSubCompanyFilter(""); }}
          style={{ ...inputStyle, cursor: "pointer", fontSize: 11, color: "var(--text-faint)" }}
        >Clear</button>
      )}
    </div>
  );
}

// ── Summary strip ─────────────────────────────────────────────────────────────

function SummaryStrip({ events }) {
  const total7d  = events.reduce((s, e) => s + (e.paid_7d  || 0), 0);
  const total15d = events.reduce((s, e) => s + (e.paid_15d || 0), 0);
  const total30d = events.reduce((s, e) => s + (e.paid_30d || 0), 0);
  const totalAll = events.reduce((s, e) => s + (e.total_paid || 0), 0);
  const activeEvents = events.filter(e => e.paid_7d > 0).length;

  return (
    <div style={{
      display: "flex", gap: 0,
      borderBottom: "1px solid var(--border)",
      background: "var(--bg)", flexShrink: 0,
    }}>
      {[
        { label: "Total Paid Delegates", value: totalAll,    color: "var(--text)"    },
        { label: "Paid Last 7D",         value: total7d,     color: "var(--success)" },
        { label: "Paid Last 15D",        value: total15d,    color: "var(--success)" },
        { label: "Paid Last 30D",        value: total30d,    color: "var(--success)" },
        { label: "Active Events (7D)",   value: activeEvents,color: "var(--accent)"  },
      ].map(({ label, value, color }, i) => (
        <div
          key={label}
          style={{
            padding: "10px 20px",
            borderRight: "1px solid var(--border)",
            minWidth: 140,
          }}
        >
          <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-faint)", fontWeight: 600 }}>{label}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color, marginTop: 2 }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

// ── Main exported module ──────────────────────────────────────────────────────

export function EventPaymentActivityModule() {
  const [events, setEvents]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [search, setSearch]               = useState("");
  const [statusFilter, setStatusFilter]   = useState("");
  const [subCompanyFilter, setSubCompanyFilter] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    paymentActivityApi.list({
      search:      search      || undefined,
      status:      statusFilter || undefined,
      sub_company: subCompanyFilter || undefined,
    })
      .then(setEvents)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, statusFilter, subCompanyFilter]);

  useEffect(() => { load(); }, [load]);

  const handleRowClick = (row) => {
    setSelectedEvent(prev => prev?.event_code === row.event_code ? null : row);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <PaymentActivityFilters
        search={search}               setSearch={setSearch}
        statusFilter={statusFilter}   setStatusFilter={setStatusFilter}
        subCompanyFilter={subCompanyFilter} setSubCompanyFilter={setSubCompanyFilter}
      />

      {!loading && events.length > 0 && <SummaryStrip events={events} />}

      {loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", fontSize: 13 }}>
          Loading payment activity…
        </div>
      ) : (
        <EventPaymentTable
          events={events}
          onRowClick={handleRowClick}
          selectedCode={selectedEvent?.event_code}
        />
      )}

      {selectedEvent && (
        <EventPaymentDrawer
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
}
