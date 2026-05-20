import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { eventPerformanceApi } from "../api/eventPerformance";
import { EventPaymentActivityModule } from "../components/eventPerformance/EventPaymentActivityModule";
import { MasterEventDrawer } from "../components/eventPerformance/MasterEventDrawer";
import { usePolling } from "../hooks/usePolling";

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtCurrency = (n) =>
  n == null ? "—" : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const HEALTH_STYLE = {
  healthy:  { bg: "var(--success-soft)", color: "var(--success)",  label: "Healthy"  },
  on_track: { bg: "#dbeafe",            color: "#1d4ed8",          label: "On Track" },
  warning:  { bg: "var(--warn-soft)",   color: "var(--warn)",      label: "Warning"  },
  critical: { bg: "var(--danger-soft)", color: "var(--danger)",    label: "Critical" },
  unknown:  { bg: "var(--surface-alt)", color: "var(--text-faint)", label: "—"       },
};

const STATUS_STYLE = {
  Upcoming:  { bg: "#dbeafe", color: "#1d4ed8" },
  Live:      { bg: "var(--success-soft)", color: "var(--success)" },
  Completed: { bg: "var(--surface-alt)", color: "var(--text-dim)" },
  Draft:     { bg: "var(--surface-alt)", color: "var(--text-faint)" },
  Cancelled: { bg: "var(--danger-soft)", color: "var(--danger)" },
};

function Badge({ label, style }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 7px", borderRadius: 4,
      fontSize: 10, fontWeight: 600, whiteSpace: "nowrap",
      ...style,
    }}>{label}</span>
  );
}

function KPICard({ label, value, sub }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "14px 16px", minWidth: 140,
    }}>
      <div style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginTop: 4, fontFamily: "var(--font-mono)" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Column definitions per tab ────────────────────────────────────────────────
const COLS_OVERVIEW = [
  { key: "master_code",        label: "Master",    sticky: true,  left: 0,   width: 80  },
  { key: "current_event_name", label: "Event",     sticky: true,  left: 80,  width: 210, ellipsis: true },
  { key: "_edition",           label: "Edition",   width: 120 },
  { key: "event_status",       label: "Status",    width: 96  },
  { key: "paid_count",         label: "Paid",      width: 60  },
  { key: "pending_count",      label: "Pend",      width: 60  },
  { key: "total_delegates",    label: "Delegates", width: 80  },
  { key: "total_revenue",      label: "Revenue",   width: 100 },
  { key: "edition_count",      label: "Editions",  width: 68  },
];

const COLS_PAYMENTS = [
  { key: "master_code",        label: "Master",    sticky: true, left: 0,  width: 80  },
  { key: "current_event_name", label: "Event",     sticky: true, left: 80, width: 210, ellipsis: true },
  { key: "_edition",           label: "Edition",   width: 120 },
  { key: "today_paid",         label: "Today",     width: 60  },
  { key: "today_revenue",      label: "Today £",   width: 100 },
  { key: "yesterday_paid",     label: "Yest.",     width: 60  },
  { key: "yesterday_revenue",  label: "Yest. £",   width: 100 },
  { key: "d7_paid",            label: "7D",        width: 60  },
  { key: "d7_revenue",         label: "7D £",      width: 100 },
  { key: "d14_paid",           label: "14D",       width: 60  },
  { key: "d21_paid",           label: "21D",       width: 60  },
  { key: "total_revenue",      label: "Total £",   width: 100 },
];

const COLS_HEALTH = [
  { key: "master_code",          label: "Master",     sticky: true, left: 0,  width: 80  },
  { key: "current_event_name",   label: "Event",      sticky: true, left: 80, width: 210, ellipsis: true },
  { key: "_edition",             label: "Edition",    width: 120 },
  { key: "event_status",         label: "Status",     width: 96  },
  { key: "paid_count",           label: "Paid",       width: 60  },
  { key: "pending_count",        label: "Pending",    width: 70  },
  { key: "total_delegates",      label: "Delegates",  width: 80  },
  { key: "confirmed_delegates",  label: "Confirmed",  width: 90  },
];

const TAB_COLS = { overview: COLS_OVERVIEW, payments: COLS_PAYMENTS, health: COLS_HEALTH };

function cellValue(col, row) {
  if (col.key === "_edition")        return <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{row.current_year}{row.current_city ? ` · ${row.current_city}` : ""}</span>;
  if (col.key === "master_code")     return <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12 }}>{row.master_code}</span>;
  if (col.key === "event_status")    return <Badge label={row.event_status || "—"} style={STATUS_STYLE[row.event_status] || { background: "var(--surface-alt)", color: "var(--text-faint)" }} />;
  if (col.key === "health")          return <Badge label={(HEALTH_STYLE[row.health] || HEALTH_STYLE.unknown).label} style={{ background: (HEALTH_STYLE[row.health] || HEALTH_STYLE.unknown).bg, color: (HEALTH_STYLE[row.health] || HEALTH_STYLE.unknown).color }} />;
  if (col.key === "benchmark")       return <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: (HEALTH_STYLE[row.health] || HEALTH_STYLE.unknown).color }}>{row.benchmark != null ? row.benchmark + "%" : "—"}</span>;
  if (col.key === "edition_count")   return <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>{row.edition_count}</span>;
  if (col.key === "current_event_name") return <span style={{ fontSize: 12 }}>{row.current_event_name}</span>;
  const v = row[col.key];
  if (col.key.includes("revenue") || col.key.includes("value")) return <span style={{ fontFamily: "var(--font-mono)" }}>{fmtCurrency(v)}</span>;
  if (typeof v === "number") return <span style={{ fontFamily: "var(--font-mono)" }}>{v}</span>;
  return v ?? "—";
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const cancelBtnStyle = {
  padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)",
  background: "var(--surface-alt)", color: "var(--text-dim)", cursor: "pointer", fontSize: 12,
};
const inputStyle = {
  width: "100%", padding: "6px 9px", borderRadius: 6,
  border: "1px solid var(--border)", background: "var(--surface)",
  fontSize: 12, color: "var(--text)", fontFamily: "inherit", outline: "none",
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export function EventPerformancePage() {
  const [events, setEvents]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState("overview");
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter]         = useState("");
  const [selectedRow, setSelectedRow]           = useState(null);
  const debounceRef = useRef(null);

  const loadEvents = useCallback(() => {
    setLoading(true);
    const params = {};
    if (search)           params.search      = search;
    if (statusFilter)     params.status      = statusFilter;
    eventPerformanceApi.activeEditions(params)
      .then(data => setEvents(Array.isArray(data) ? data : (data.results || [])))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(loadEvents, 300);
    return () => clearTimeout(debounceRef.current);
  }, [loadEvents]);

  usePolling(loadEvents, 30000);

  // Aggregate KPIs from loaded data
  const kpis = events.reduce((acc, e) => {
    acc.totalEvents++;
    acc.totalPaid      += e.paid_count || 0;
    acc.totalPending   += e.pending_count || 0;
    acc.totalRevenue   += e.total_revenue || 0;
    acc.pendingValue   += e.pending_value || 0;
    acc.todayPaid      += e.today_paid || 0;
    acc.todayRevenue   += e.today_revenue || 0;
    return acc;
  }, { totalEvents: 0, totalPaid: 0, totalPending: 0, totalRevenue: 0, pendingValue: 0, todayPaid: 0, todayRevenue: 0 });

  const cols = TAB_COLS[tab] || COLS_OVERVIEW;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg)", overflow: "hidden" }}>

      {/* Top bar */}
      <div style={{ padding: "16px 20px 12px", flexShrink: 0, borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", margin: 0 }}>Event Performance</h1>
            <p style={{ fontSize: 11, color: "var(--text-faint)", margin: "2px 0 0" }}>Current edition metrics · current vs previous edition comparison · all-time totals</p>
          </div>
          <button
            onClick={loadEvents}
            style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-alt)", fontSize: 12, color: "var(--text)", cursor: "pointer", fontWeight: 500 }}
          >↺ Refresh</button>
        </div>

        {/* KPI Cards */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <KPICard label="Master Events"  value={kpis.totalEvents}                 />
          <KPICard label="Paid Today"     value={kpis.todayPaid}    sub={fmtCurrency(kpis.todayRevenue) + " today"} />
          <KPICard label="Total Paid"     value={kpis.totalPaid}                   />
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Search event name or code…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: 240 }}
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: 130 }}>
            <option value="">All Statuses</option>
            {["Draft","Upcoming","Live","Completed","Cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {(search || statusFilter) && (
            <button onClick={() => { setSearch(""); setStatusFilter(""); }} style={{ ...cancelBtnStyle, fontSize: 11 }}>Clear</button>
          )}
        </div>
      </div>

      {/* View Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0, paddingLeft: 20 }}>
        {[
          { id: "overview",          label: "Overview"             },
          { id: "payments",          label: "Payments Timeline"    },
          { id: "health",            label: "Health & Delegates"   },
          { id: "payment-activity",  label: "Payment Activity"     },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              padding: "10px 16px", border: "none", background: "none",
              fontSize: 12, fontWeight: tab === id ? 600 : 400,
              color: tab === id ? "var(--accent)" : "var(--text-faint)",
              borderBottom: tab === id ? "2px solid var(--accent)" : "2px solid transparent",
              cursor: "pointer",
            }}
          >{label}</button>
        ))}
      </div>

      {/* Payment Activity sub-module */}
      {tab === "payment-activity" && (
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <EventPaymentActivityModule />
        </div>
      )}

      {/* Table — hidden when payment-activity tab is active */}
      <div style={{ flex: 1, overflow: "auto", display: tab === "payment-activity" ? "none" : undefined }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>Loading…</div>
        ) : events.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>No events found.</div>
        ) : (
          <table style={{ borderCollapse: "collapse", fontSize: 12, width: "max-content", minWidth: "100%" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--surface)" }}>
              <tr>
                {cols.map(col => (
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
                      ...(col.sticky ? { position: "sticky", left: col.left, zIndex: 11, boxShadow: "1px 0 0 var(--border)" } : {}),
                      width: col.width,
                      minWidth: col.width,
                    }}
                  >{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((row, idx) => {
                const isExpanded = selectedRow?.master_code === row.master_code;
                return (
                  <Fragment key={row.master_code}>
                    <tr
                      onClick={() => setSelectedRow(isExpanded ? null : row)}
                      style={{
                        borderBottom: isExpanded ? "none" : "1px solid var(--border)",
                        background: isExpanded ? "var(--surface-alt)" : idx % 2 === 0 ? "var(--surface)" : "var(--bg)",
                        cursor: "pointer",
                        transition: "background .1s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "var(--surface-alt)"}
                      onMouseLeave={e => e.currentTarget.style.background = isExpanded ? "var(--surface-alt)" : idx % 2 === 0 ? "var(--surface)" : "var(--bg)"}
                    >
                      {cols.map((col, ci) => (
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
                          {ci === 0
                            ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                                <span style={{
                                  fontSize: 8, color: "var(--accent)",
                                  display: "inline-block", transition: "transform .15s",
                                  transform: isExpanded ? "rotate(90deg)" : "none",
                                }}>▶</span>
                                {cellValue(col, row)}
                              </span>
                            : cellValue(col, row)
                          }
                        </td>
                      ))}
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={cols.length} style={{ padding: 0, background: "var(--surface)" }}>
                          <MasterEventDrawer
                            masterCode={row.master_code}
                            currentEventCode={row.current_event_code}
                            onClose={() => setSelectedRow(null)}
                            inline
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
}
