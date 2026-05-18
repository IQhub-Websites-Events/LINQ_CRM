/**
 * ReportsPage.jsx
 * ─────────────────
 * Enterprise Google Sheets reporting module.
 *
 * Tabs:
 *   Overview      — KPI summary from existing CRM stats
 *   Sheet Registry — CRUD for GoogleSheetSource records + sync controls
 *   Report Data    — Browse/search rows from any synced sheet
 *   Sync Logs      — Per-source sync history
 *   Documentation  — Markdown viewer for the complete reference doc
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { invoicesApi, reportsApi, searchApi } from "../api";
import { useFetch } from "../hooks/useFetch";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";
import { fmt } from "../utils/helpers";
import { EventGrowthDrawer } from "../components/events/EventGrowthDrawer";


// ─── Status color palettes ────────────────────────────────────────────────────
const SYNC_COLORS = {
  never: { bg: "#f1f5f9", c: "#94a3b8" },
  idle: { bg: "#f1f5f9", c: "#64748b" },
  syncing: { bg: "#fef3c7", c: "#d97706", pulse: true },
  success: { bg: "var(--success-soft)", c: "var(--success)" },
  partial: { bg: "#fff7ed", c: "#ea580c" },
  failed: { bg: "var(--danger-soft)", c: "var(--danger)" },
};

const LOG_COLORS = {
  running: { bg: "#fef3c7", c: "#d97706" },
  success: { bg: "var(--success-soft)", c: "var(--success)" },
  partial: { bg: "#fff7ed", c: "#ea580c" },
  failed: { bg: "var(--danger-soft)", c: "var(--danger)" },
};


// ─── Page shell ───────────────────────────────────────────────────────────────

export function ReportsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");

  const TABS = [
    ["overview", "Overview"],
    ...(user?.role === "admin" ? [
      ["growth", "Event Growth"],
      ["registry", "Sheet Registry"],
      ["data", "Report Data"],
      ["logs", "Sync Logs"],
      ["docs", "Documentation"],
    ] : []),
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg)" }}>
      <div style={{ padding: "24px 28px 0", flexShrink: 0 }}>
        <h1 style={{
          margin: 0, fontFamily: "var(--font-serif)",
          fontWeight: 500, fontSize: 38, lineHeight: 1,
          letterSpacing: "-0.01em", color: "var(--text)",
        }}>
          <span>Dashboard.</span>
        </h1>
        <div style={{ display: "flex", marginTop: 20, borderBottom: "1px solid var(--border)" }}>
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: "8px 16px", fontSize: 13, fontWeight: 500,
              fontFamily: "inherit", background: "none", border: "none",
              borderBottom: tab === id ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === id ? "var(--accent)" : "var(--text-dim)",
              cursor: "pointer", marginBottom: -1,
            }}>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {tab === "overview" ? <OverviewTab key="overview-tab" /> :
          tab === "growth" ? <EventGrowthTab key="growth-tab" /> :
            tab === "registry" ? <RegistryTab key="registry-tab" /> :
              tab === "data" ? <DataTab key="data-tab" /> :
                tab === "logs" ? <SyncLogsTab key="logs-tab" /> :
                  tab === "docs" ? <DocsTab key="docs-tab" /> : null}
      </div>
    </div>
  );
}


// ─── OVERVIEW TAB ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const [period, setPeriod] = useState("total");
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    setLoadingStats(true);
    invoicesApi.stats(period)
      .then((data) => { if (!cancelled) { setStats(data); setLoadingStats(false); } })
      .catch(() => { if (!cancelled) setLoadingStats(false); });
    return () => { cancelled = true; };
  }, [period]);

  const { data: dashStats, loading: loadingDash } = useFetch(
    () => searchApi.stats(),
    []
  );

  const inv = dashStats?.invoices || {};
  const ev = dashStats?.events || {};

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 28px 28px" }}>

      {/* Role-Specific Dashboard KPIs */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-faint)" }}>
            <span>Your Performance</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <span>Filter by</span>
            </span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "4px 28px 4px 10px",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--text)",
                appearance: "none",
                cursor: "pointer",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239a978f' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
                backgroundSize: "10px 6px",
                outline: "none",
              }}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_7_days">Last 7 Days</option>
              <option value="last_30_days">Last 30 Days</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="total">Total</option>
            </select>
          </div>
        </div>

        <div key="role-specific-rows" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {(user?.role === "admin" || user?.role === "sales" || user?.role === "telemarketing" || !["spex", "speaker_sales"].includes(user?.role)) ? (
            <div key="sales-kpis-block" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {user?.role === "admin" && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase" }}>Sales</span>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
                <StatCard key="s1" label="Total bookings" value={stats?.sales?.total} loading={loadingStats} color="var(--accent)" />
                <StatCard key="s2" label="Paid" value={stats?.sales?.paid} loading={loadingStats} color="var(--success)" />
                <StatCard key="s3" label="Pending" value={stats?.sales?.pending} loading={loadingStats} color="var(--danger)" />
                <StatCard key="s4" label="Free" value={stats?.sales?.free} loading={loadingStats} color="var(--text-faint)" />
              </div>
            </div>
          ) : null}

          {(user?.role === "admin" || user?.role === "spex") ? (
            <div key="spex-kpis-block" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {user?.role === "admin" && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase" }}>SpEx</span>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
                <StatCard key="x1" label="Sponsors Booked" value={stats?.spex?.booked} loading={loadingStats} color="var(--accent)" />
                <StatCard key="x2" label="Sponsors Paid" value={stats?.spex?.paid} loading={loadingStats} color="var(--success)" />
                <StatCard key="x3" label="Pending" value={stats?.spex?.pending} loading={loadingStats} color="var(--danger)" />
              </div>
            </div>
          ) : null}

          {(user?.role === "admin" || user?.role === "speaker_sales") ? (
            <div key="speaker-kpis-block" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {user?.role === "admin" && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase" }}>Speaker Sales</span>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
                <StatCard key="k1" label="Total Speakers" value={stats?.speaker?.total} loading={loadingStats} color="var(--accent)" />
                <StatCard key="k2" label="Paid" value={stats?.speaker?.paid} loading={loadingStats} color="var(--success)" />
                <StatCard key="k3" label="Pending" value={stats?.speaker?.pending} loading={loadingStats} color="var(--danger)" />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* CRM Summary (Global) */}
      <div key="global-summary-block">
        {user?.role === "admin" ? (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-faint)", marginBottom: 12 }}>
              <span>CRM Summary (Global)</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
              <StatCard key="g3" label="Total Invoices" value={loadingDash ? "…" : (inv.total || 0)} sub={`${inv.paid || 0} paid`} color="var(--accent)" />
              <StatCard key="g4" label="Live Events" value={loadingDash ? "…" : (ev.live || 0)} sub={`${ev.upcoming || 0} historical`} color="#6366f1" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color, loading }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-faint)", marginBottom: 8 }}><span>{label}</span></div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || "var(--text)", lineHeight: 1 }}>
        <span>{loading ? "…" : (value ?? 0)}</span>
      </div>
      {sub ? <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}><span>{sub}</span></div> : null}
    </div>
  );
}


// ─── SHEET REGISTRY TAB ───────────────────────────────────────────────────────

function RegistryTab() {
  const toast = useToast();
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [syncing, setSyncing] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (typeFilter) params.sheet_type = typeFilter;
      const res = await reportsApi.sources.list(params);
      setSources(res.results || res);
    } catch {
      toast.error("Failed to load sheet sources");
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, toast]);

  useEffect(() => { load(); }, [load]);

  const handleSync = async (source) => {
    setSyncing(source.id);
    try {
      const log = await reportsApi.sources.sync(source.id);
      if (log.status === "success") toast.success(`"${source.name}" synced — ${log.records_processed} rows`);
      else if (log.status === "partial") toast.warn?.(`"${source.name}" synced with ${log.records_failed} failures`);
      else toast.error(`"${source.name}" sync failed: ${log.error_message?.slice(0, 80)}`);
      load();
    } catch {
      toast.error("Sync request failed");
    } finally {
      setSyncing(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await reportsApi.sources.syncAll();
      toast.success(`Sync all complete — ${res.success} succeeded, ${res.failed} failed`);
      load();
    } catch {
      toast.error("Sync all failed");
    } finally {
      setSyncingAll(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await reportsApi.sources.delete(id);
      toast.success("Sheet source deleted");
      setConfirmDelete(null);
      load();
    } catch {
      toast.error("Delete failed");
    }
  };

  const SHEET_TYPES = ["", "bookings", "events", "delegates", "revenue", "pipeline", "custom"];

  const COLS = [
    { label: "Name", w: 180 },
    { label: "Tab", w: 130 },
    { label: "Type", w: 100 },
    { label: "Status", w: 110 },
    { label: "Records", w: 80 },
    { label: "Freq", w: 80 },
    { label: "Last Sync", w: 160 },
    { label: "", w: 200 },
  ];

  return (
    <>
      {/* Toolbar */}
      <div style={{ padding: "12px 28px 14px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
        {SHEET_TYPES.map(t => (
          <button key={t} onClick={() => setTypeFilter(t)} style={{
            padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 500,
            fontFamily: "inherit", textTransform: "capitalize", cursor: "pointer",
            border: `1px solid ${typeFilter === t ? "var(--accent)" : "var(--border)"}`,
            background: typeFilter === t ? "var(--accent-soft)" : "var(--surface)",
            color: typeFilter === t ? "var(--accent)" : "var(--text-dim)",
          }}>
            {t || "All"}
          </button>
        ))}

        <div style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "0 10px", height: 30, marginLeft: "auto" }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="var(--text-faint)" strokeWidth="1.6" strokeLinecap="round"><circle cx="5" cy="5" r="4" /><path d="M9 9l2 2" /></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sources…" style={{ border: "none", outline: "none", fontSize: 12, background: "none", color: "var(--text)", fontFamily: "inherit", width: 160 }} />
        </div>

        <button onClick={() => load()} style={toolBtn} title="Refresh">↺</button>
        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{sources.length} sources</span>

        <button onClick={handleSyncAll} disabled={syncingAll} style={{ ...toolBtn, borderColor: "var(--accent)", color: "var(--accent)", opacity: syncingAll ? 0.6 : 1 }}>
          {syncingAll ? "Syncing…" : "⟳ Sync All"}
        </button>

        <button onClick={() => setCreating(true)} style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid var(--accent)", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
          + Add Sheet
        </button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, minHeight: 0, padding: "0 28px 28px" }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", height: "100%" }}>
          <div style={{ flex: 1, overflowX: "auto", overflowY: "auto" }}>
            <table style={{ width: "max-content", minWidth: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                <tr style={{ background: "var(--surface-alt)" }}>
                  {COLS.map(({ label, w }) => (
                    <th key={label + w} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)", textAlign: "left", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", minWidth: w }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? <tr><td colSpan={COLS.length} style={emptyCell}>Loading…</td></tr>
                  : sources.length === 0
                    ? <tr><td colSpan={COLS.length} style={emptyCell}>No sheet sources yet. Click "+ Add Sheet" to connect a Google Sheet.</td></tr>
                    : sources.map(src => (
                      <SourceRow
                        key={src.id}
                        source={src}
                        syncing={syncing === src.id}
                        onSync={() => handleSync(src)}
                        onEdit={() => setEditing(src)}
                        onDelete={() => setConfirmDelete(src)}
                      />
                    ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {creating && <SourceModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />}
      {editing && <SourceModal source={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {confirmDelete && (
        <ConfirmModal
          title="Delete Sheet Source"
          message={`Delete "${confirmDelete.name}"? All synced rows will also be deleted.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDelete(confirmDelete.id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}

function SourceRow({ source: s, syncing, onSync, onEdit, onDelete }) {
  return (
    <tr style={{ borderTop: "1px solid var(--border)", fontSize: 13 }}
      onMouseOver={e => e.currentTarget.style.background = "var(--surface-alt)"}
      onMouseOut={e => e.currentTarget.style.background = "transparent"}
    >
      <td style={cell}>
        <div style={{ fontWeight: 500, color: "var(--text)" }}>{s.name}</div>
        {s.description && <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 1 }}>{s.description.slice(0, 60)}</div>}
      </td>
      <td style={cell}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>{s.worksheet_name}</span>
      </td>
      <td style={cell}>
        <span style={{ fontSize: 11, textTransform: "capitalize", color: "var(--text-dim)" }}>{s.sheet_type}</span>
      </td>
      <td style={cell}><StatusChip status={s.sync_status} colors={SYNC_COLORS} /></td>
      <td style={{ ...cell, textAlign: "center" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>{s.records_count.toLocaleString()}</span>
      </td>
      <td style={cell}>
        <span style={{ fontSize: 11, textTransform: "capitalize", color: "var(--text-dim)" }}>{s.sync_frequency}</span>
      </td>
      <td style={{ ...cell, fontSize: 11, color: "var(--text-dim)" }}>
        {s.last_synced_at ? new Date(s.last_synced_at).toLocaleString() : "Never"}
      </td>
      <td style={cell} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onSync} disabled={syncing} style={{ ...actionBtn, borderColor: syncing ? "var(--border)" : "var(--accent)", color: syncing ? "var(--text-faint)" : "var(--accent)" }}>
            {syncing ? "Syncing…" : "Sync"}
          </button>
          <button onClick={onEdit} style={actionBtn}>Edit</button>
          <button onClick={onDelete} style={{ ...actionBtn, borderColor: "var(--danger)", color: "var(--danger)" }}>Delete</button>
        </div>
      </td>
    </tr>
  );
}


// ─── REPORT DATA TAB ──────────────────────────────────────────────────────────

function DataTab() {
  const toast = useToast();
  const [sources, setSources] = useState([]);
  const [selectedSrc, setSelectedSrc] = useState(null);
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  useEffect(() => {
    reportsApi.sources.list({ page_size: 100 })
      .then(r => setSources(r.results || r))
      .catch(() => toast.error("Failed to load sources"));
  }, [toast]);

  const loadRows = useCallback(async () => {
    if (!selectedSrc) return;
    setLoading(true);
    try {
      const params = { page, page_size: 50 };
      if (search) params.search = search;
      const res = await reportsApi.sources.rows(selectedSrc.id, params);
      const data = res.results || res;
      setRows(data);
      setTotal(res.count || data.length);
      // Derive columns from first row
      if (data.length > 0) {
        setColumns(Object.keys(data[0].processed_data || {}));
      }
    } catch {
      toast.error("Failed to load rows");
    } finally {
      setLoading(false);
    }
  }, [selectedSrc, page, search, toast]);

  useEffect(() => { loadRows(); }, [loadRows]);

  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, padding: "12px 28px 28px" }}>
      {/* Source selector + search */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <select
          value={selectedSrc?.id || ""}
          onChange={e => {
            const src = sources.find(s => String(s.id) === e.target.value);
            setSelectedSrc(src || null);
            setPage(1);
            setSearch("");
            setColumns([]);
            setRows([]);
          }}
          style={{ ...inputStyle, width: 260, height: 32, padding: "0 10px" }}
        >
          <option value="">— Select a sheet source —</option>
          {sources.map(s => (
            <option key={s.id} value={s.id}>{s.name} ({s.records_count} rows)</option>
          ))}
        </select>

        {selectedSrc && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "0 10px", height: 32 }}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="var(--text-faint)" strokeWidth="1.6" strokeLinecap="round"><circle cx="5" cy="5" r="4" /><path d="M9 9l2 2" /></svg>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search rows…" style={{ border: "none", outline: "none", fontSize: 12, background: "none", color: "var(--text)", fontFamily: "inherit", width: 180 }} />
            </div>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{total.toLocaleString()} rows</span>
          </>
        )}
      </div>

      {!selectedSrc ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", fontSize: 13 }}>
          Select a sheet source above to browse its data.
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ flex: 1, overflow: "auto" }}>
              {loading ? (
                <div style={emptyCell}>Loading…</div>
              ) : rows.length === 0 ? (
                <div style={emptyCell}>No rows found. Sync the sheet first.</div>
              ) : (
                <table style={{ width: "max-content", minWidth: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                    <tr style={{ background: "var(--surface-alt)" }}>
                      <th style={thStyle}>#</th>
                      {columns.map(col => <th key={col} style={{ ...thStyle, minWidth: 140 }}>{col}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.id} style={{ borderTop: "1px solid var(--border)", fontSize: 12 }}
                        onMouseOver={e => e.currentTarget.style.background = "var(--surface-alt)"}
                        onMouseOut={e => e.currentTarget.style.background = "transparent"}
                      >
                        <td style={{ ...cell, color: "var(--text-faint)", fontSize: 11 }}>{row.row_number}</td>
                        {columns.map(col => (
                          <td key={col} style={{ ...cell, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>
                            {String(row.processed_data?.[col] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={{ borderTop: "1px solid var(--border)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pageBtn}>← Prev</button>
              <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={pageBtn}>Next →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── SYNC LOGS TAB ────────────────────────────────────────────────────────────

function SyncLogsTab() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState([]);
  const [srcFilter, setSrcFilter] = useState("");
  const [stFilter, setStFilter] = useState("");
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    reportsApi.sources.list({ page_size: 100 })
      .then(r => setSources(r.results || r))
      .catch(() => { });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: 50 };
      if (srcFilter) params.source = srcFilter;
      if (stFilter) params.status = stFilter;
      const res = await reportsApi.syncLogs.list(params);
      setLogs(res.results || []);
      setTotal(res.count || 0);
    } catch {
      toast.error("Failed to load sync logs");
    } finally {
      setLoading(false);
    }
  }, [page, srcFilter, stFilter, toast]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / 50));
  const STATUSES = ["", "running", "success", "partial", "failed"];

  return (
    <>
      <div style={{ padding: "12px 28px 14px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
        <select value={srcFilter} onChange={e => { setSrcFilter(e.target.value); setPage(1); }} style={{ ...inputStyle, width: 220, height: 30, padding: "0 8px" }}>
          <option value="">All Sources</option>
          {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        {STATUSES.map(st => (
          <button key={st} onClick={() => { setStFilter(st); setPage(1); }} style={{
            padding: "5px 11px", borderRadius: 7, fontSize: 11, fontWeight: 500,
            fontFamily: "inherit", textTransform: "capitalize", cursor: "pointer",
            border: `1px solid ${stFilter === st ? "var(--accent)" : "var(--border)"}`,
            background: stFilter === st ? "var(--accent-soft)" : "var(--surface)",
            color: stFilter === st ? "var(--accent)" : "var(--text-dim)",
          }}>
            {st || "All"}
          </button>
        ))}

        <button onClick={() => load()} style={toolBtn} title="Refresh">↺</button>
        <span style={{ fontSize: 11, color: "var(--text-faint)", marginLeft: "auto" }}>{total} logs</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, padding: "0 28px 28px" }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", height: "100%" }}>
          <div style={{ flex: 1, overflowX: "auto", overflowY: "auto" }}>
            <table style={{ width: "max-content", minWidth: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                <tr style={{ background: "var(--surface-alt)" }}>
                  {[
                    { label: "Status", w: 100 },
                    { label: "Source", w: 180 },
                    { label: "Started", w: 160 },
                    { label: "Duration", w: 90 },
                    { label: "Processed", w: 90 },
                    { label: "Created", w: 80 },
                    { label: "Updated", w: 80 },
                    { label: "Failed", w: 70 },
                    { label: "Triggered", w: 120 },
                  ].map(({ label, w }) => (
                    <th key={label} style={{ padding: "10px 14px", fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-dim)", textAlign: "left", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", minWidth: w }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? <tr><td colSpan={9} style={emptyCell}>Loading…</td></tr>
                  : logs.length === 0
                    ? <tr><td colSpan={9} style={emptyCell}>No sync logs yet.</td></tr>
                    : logs.map(log => (
                      <tr key={log.id} style={{ borderTop: "1px solid var(--border)", fontSize: 13 }}>
                        <td style={cell}><StatusChip status={log.status} colors={LOG_COLORS} /></td>
                        <td style={cell}><span style={{ fontSize: 12, color: "var(--text)" }}>{log.source_name || "—"}</span></td>
                        <td style={{ ...cell, fontSize: 11, color: "var(--text-dim)" }}>{new Date(log.started_at).toLocaleString()}</td>
                        <td style={{ ...cell, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
                          {log.duration_seconds != null ? `${log.duration_seconds}s` : "—"}
                        </td>
                        <td style={{ ...cell, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12 }}>{log.records_processed}</td>
                        <td style={{ ...cell, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--success)" }}>+{log.records_created}</td>
                        <td style={{ ...cell, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, color: "#2563eb" }}>↑{log.records_updated}</td>
                        <td style={{ ...cell, textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 12, color: log.records_failed > 0 ? "var(--danger)" : "var(--text-faint)" }}>
                          {log.records_failed > 0 ? `✕${log.records_failed}` : "—"}
                        </td>
                        <td style={{ ...cell, fontSize: 11, color: "var(--text-dim)" }}>{log.triggered_by || "—"}</td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>

          <div style={{ borderTop: "1px solid var(--border)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={pageBtn}>← Prev</button>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={pageBtn}>Next →</button>
          </div>
        </div>
      </div>
    </>
  );
}


// ─── DOCUMENTATION TAB ───────────────────────────────────────────────────────

function DocsTab() {
  const toast = useToast();
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    reportsApi.docs.list()
      .then(setFiles)
      .catch(() => toast.error("Failed to load documentation files"));
  }, [toast]);

  const openDoc = async (filename) => {
    if (selected === filename) return;
    setSelected(filename);
    setLoading(true);
    try {
      const res = await reportsApi.docs.get(filename);
      setContent(res.content || "");
    } catch {
      toast.error("Failed to load document");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flex: 1, minHeight: 0, padding: "12px 28px 28px", gap: 16 }}>
      {/* Sidebar file list */}
      <div style={{ width: 260, flexShrink: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 14px 8px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-faint)", borderBottom: "1px solid var(--border)" }}>
          Documentation Files
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {files.length === 0
            ? <div style={{ padding: "20px 14px", fontSize: 12, color: "var(--text-faint)" }}>No docs yet.</div>
            : files.map(f => (
              <button key={f.filename} onClick={() => openDoc(f.filename)} style={{
                width: "100%", textAlign: "left", padding: "9px 14px",
                fontSize: 12, fontFamily: "inherit", cursor: "pointer",
                background: selected === f.filename ? "var(--accent-soft)" : "none",
                color: selected === f.filename ? "var(--accent)" : "var(--text-dim)",
                border: "none", borderLeft: selected === f.filename ? "2px solid var(--accent)" : "2px solid transparent",
              }}>
                <div style={{ fontWeight: 500 }}>{f.filename.replace(".md", "").replace(/_/g, " ")}</div>
                <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 1 }}>{f.filename}</div>
              </button>
            ))
          }
        </div>
      </div>

      {/* Markdown viewer */}
      <div style={{ flex: 1, minWidth: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {!selected ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", fontSize: 13 }}>
            Select a document from the list to view it.
          </div>
        ) : loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", fontSize: 13 }}>
            Loading…
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
            <MarkdownRenderer content={content} />
          </div>
        )}
      </div>
    </div>
  );
}

function MarkdownRenderer({ content }) {
  if (!content) return null;

  const lines = content.split("\n");
  const elements = [];
  let i = 0;
  let inTable = false;
  let tableRows = [];
  let inCodeBlock = false;
  let codeLines = [];
  let codeLang = "";

  const flushTable = () => {
    if (tableRows.length < 2) { tableRows = []; inTable = false; return; }
    const header = tableRows[0].split("|").map(c => c.trim()).filter(Boolean);
    const body = tableRows.slice(2); // skip separator row
    elements.push(
      <div key={`tbl-${i}`} style={{ overflowX: "auto", marginBottom: 16 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
          <thead>
            <tr style={{ background: "var(--surface-alt)" }}>
              {header.map((h, hi) => <th key={hi} style={{ padding: "7px 12px", textAlign: "left", borderBottom: "1px solid var(--border)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-dim)", whiteSpace: "nowrap" }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => {
              const cells = row.split("|").map(c => c.trim()).filter(Boolean);
              return (
                <tr key={ri} style={{ borderTop: "1px solid var(--border)" }}>
                  {cells.map((c, ci) => <td key={ci} style={{ padding: "7px 12px", color: "var(--text-dim)", fontSize: 12 }}>{c}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    inTable = false;
  };

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
        codeLines = [];
      } else {
        elements.push(
          <pre key={`code-${i}`} style={{ margin: "0 0 16px", padding: "12px 14px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)", overflowX: "auto", whiteSpace: "pre", lineHeight: 1.6 }}>
            {codeLines.join("\n")}
          </pre>
        );
        inCodeBlock = false;
        codeLines = [];
      }
      i++; continue;
    }
    if (inCodeBlock) { codeLines.push(line); i++; continue; }

    // Table row
    if (line.startsWith("|")) {
      if (!inTable) inTable = true;
      tableRows.push(line);
      i++; continue;
    } else if (inTable) {
      flushTable();
    }

    // Headings
    if (line.startsWith("#### ")) { elements.push(<h4 key={i} style={{ margin: "20px 0 8px", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{line.slice(5)}</h4>); i++; continue; }
    if (line.startsWith("### ")) { elements.push(<h3 key={i} style={{ margin: "24px 0 10px", fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{line.slice(4)}</h3>); i++; continue; }
    if (line.startsWith("## ")) { elements.push(<h2 key={i} style={{ margin: "28px 0 12px", fontSize: 18, fontWeight: 700, color: "var(--text)", borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>{line.slice(3)}</h2>); i++; continue; }
    if (line.startsWith("# ")) { elements.push(<h1 key={i} style={{ margin: "0 0 16px", fontSize: 22, fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-serif)" }}>{line.slice(2)}</h1>); i++; continue; }

    // HR
    if (line.match(/^---+$/)) { elements.push(<hr key={i} style={{ border: "none", borderTop: "1px solid var(--border)", margin: "20px 0" }} />); i++; continue; }

    // Empty line
    if (!line.trim()) { elements.push(<div key={i} style={{ height: 8 }} />); i++; continue; }

    // Blockquote
    if (line.startsWith("> ")) {
      elements.push(<blockquote key={i} style={{ margin: "0 0 12px", padding: "8px 14px", background: "var(--surface-alt)", borderLeft: "3px solid var(--accent)", borderRadius: "0 6px 6px 0", fontSize: 12, color: "var(--text-dim)" }}>{line.slice(2)}</blockquote>);
      i++; continue;
    }

    // List item
    if (line.match(/^[\-\*] /)) {
      elements.push(<div key={i} style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 4, paddingLeft: 16, display: "flex", gap: 8 }}><span style={{ flexShrink: 0, color: "var(--accent)" }}>•</span>{line.slice(2)}</div>);
      i++; continue;
    }
    if (line.match(/^\d+\. /)) {
      const text = line.replace(/^\d+\. /, "");
      const num = line.match(/^(\d+)\./)?.[1] || "•";
      elements.push(<div key={i} style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 4, paddingLeft: 16, display: "flex", gap: 8 }}><span style={{ flexShrink: 0, minWidth: 16, color: "var(--accent)", fontWeight: 600 }}>{num}.</span>{text}</div>);
      i++; continue;
    }

    // Paragraph
    const rendered = line
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.+?)`/g, `<code style="font-family:var(--font-mono);font-size:11px;background:var(--bg);padding:1px 5px;border-radius:3px;border:1px solid var(--border)">$1</code>`);
    elements.push(<p key={i} style={{ margin: "0 0 10px", fontSize: 13, color: "var(--text-dim)", lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: rendered }} />);
    i++;
  }

  if (inTable) flushTable();

  return <div>{elements}</div>;
}


// ─── Source Create/Edit Modal ─────────────────────────────────────────────────

function SourceModal({ source, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = !!source;
  const [form, setForm] = useState({
    name: source?.name || "",
    description: source?.description || "",
    sheet_url: source?.sheet_url || "",
    sheet_id: source?.sheet_id || "",
    worksheet_name: source?.worksheet_name || "Sheet1",
    sheet_type: source?.sheet_type || "custom",
    sync_enabled: source?.sync_enabled ?? true,
    sync_frequency: source?.sync_frequency || "manual",
    notes: source?.notes || "",
  });
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [worksheets, setWorksheets] = useState([]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const detectWorksheets = async () => {
    const urlOrId = form.sheet_url || form.sheet_id;
    if (!urlOrId) { toast.error("Enter a Sheet URL or ID first"); return; }
    setDetecting(true);
    try {
      const res = await reportsApi.sources.listWorksheets({ sheet_url: urlOrId });
      if (res.worksheets) {
        setWorksheets(res.worksheets);
        toast.success(`Found ${res.worksheets.length} tabs`);
      } else {
        toast.error(res.error || "Could not list worksheets");
      }
    } catch {
      toast.error("Failed to detect worksheets");
    } finally {
      setDetecting(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await reportsApi.sources.update(source.id, form);
        toast.success("Source updated");
      } else {
        await reportsApi.sources.create(form);
        toast.success(`"${form.name}" created`);
      }
      onSaved();
    } catch {
      toast.error(isEdit ? "Update failed" : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, width: "min(600px, 100%)", maxHeight: "calc(100vh - 80px)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>{isEdit ? `Edit: ${source.name}` : "Add Google Sheet Source"}</span>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <form onSubmit={submit} style={{ overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Name *">
              <input required value={form.name} onChange={e => set("name", e.target.value)} style={inputStyle} placeholder="e.g. Summit Bookings 2025" />
            </Field>
            <Field label="Type">
              <select value={form.sheet_type} onChange={e => set("sheet_type", e.target.value)} style={{ ...inputStyle, height: 34 }}>
                {["bookings", "events", "delegates", "revenue", "pipeline", "attendance", "custom"].map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Google Sheet URL" hint="Paste the full Google Sheets URL — the Sheet ID will be extracted automatically">
            <input value={form.sheet_url} onChange={e => set("sheet_url", e.target.value)} style={inputStyle} placeholder="https://docs.google.com/spreadsheets/d/…" />
          </Field>

          <Field label="Worksheet / Tab Name">
            <div style={{ display: "flex", gap: 8 }}>
              {worksheets.length > 0 ? (
                <select value={form.worksheet_name} onChange={e => set("worksheet_name", e.target.value)} style={{ ...inputStyle, flex: 1, height: 34 }}>
                  {worksheets.map(w => <option key={w} value={w}>{w}</option>)}
                </select>
              ) : (
                <input value={form.worksheet_name} onChange={e => set("worksheet_name", e.target.value)} style={{ ...inputStyle, flex: 1 }} placeholder="Sheet1" />
              )}
              <button type="button" onClick={detectWorksheets} disabled={detecting} style={{ ...toolBtn, whiteSpace: "nowrap" }}>
                {detecting ? "Detecting…" : "Detect Tabs"}
              </button>
            </div>
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Field label="Sync Frequency">
              <select value={form.sync_frequency} onChange={e => set("sync_frequency", e.target.value)} style={{ ...inputStyle, height: 34 }}>
                {[["manual", "Manual Only"], ["hourly", "Every Hour"], ["daily", "Daily"], ["weekly", "Weekly"]].map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <Field label="Sync Enabled">
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", paddingTop: 6, fontSize: 13, color: "var(--text-dim)" }}>
                <input type="checkbox" checked={form.sync_enabled} onChange={e => set("sync_enabled", e.target.checked)} />
                {form.sync_enabled ? "Enabled" : "Disabled"}
              </label>
            </Field>
          </div>

          <Field label="Description">
            <textarea value={form.description} onChange={e => set("description", e.target.value)} style={{ ...inputStyle, minHeight: 56, resize: "vertical" }} placeholder="What data does this sheet contain?" />
          </Field>

          <Field label="Notes">
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)} style={{ ...inputStyle, minHeight: 48, resize: "vertical" }} placeholder="Admin notes…" />
          </Field>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={pageBtn}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: "6px 16px", borderRadius: 7, border: "1px solid var(--accent)", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 500, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Source"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 24 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, width: "min(400px,100%)", padding: 24 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: "var(--text)", marginBottom: 10 }}>{title}</div>
        <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "0 0 20px" }}>{message}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={pageBtn}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: "6px 16px", borderRadius: 7, border: `1px solid ${danger ? "var(--danger)" : "var(--accent)"}`, background: danger ? "var(--danger)" : "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Shared components ────────────────────────────────────────────────────────

function StatusChip({ status, colors }) {
  const sc = colors[status] || { bg: "#f1f5f9", c: "#64748b" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 6, background: sc.bg, color: sc.c, textTransform: "capitalize", whiteSpace: "nowrap" }}>
      {sc.pulse && <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.c, flexShrink: 0, animation: "pulse 1.2s infinite" }} />}
      {!sc.pulse && <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.c, flexShrink: 0 }} />}
      {status}
    </span>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text)", display: "block", marginBottom: 5 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}


// ─── Shared styles ────────────────────────────────────────────────────────────

const cell = {
  padding: "10px 14px", color: "var(--text)",
  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
};

const thStyle = {
  padding: "10px 14px", fontSize: 10, fontWeight: 500,
  textTransform: "uppercase", letterSpacing: "0.05em",
  color: "var(--text-dim)", textAlign: "left",
  borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
};

const emptyCell = {
  textAlign: "center", padding: "48px 0",
  color: "var(--text-faint)", fontSize: 13,
};

const actionBtn = {
  fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 6,
  border: "1px solid var(--border)", background: "transparent",
  color: "var(--text-dim)", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
};

const closeBtn = {
  fontSize: 14, lineHeight: 1, padding: "4px 8px", borderRadius: 6,
  border: "1px solid var(--border)", background: "transparent",
  color: "var(--text-faint)", cursor: "pointer", fontFamily: "inherit",
};

const pageBtn = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 6, padding: "4px 10px",
  fontSize: 11, color: "var(--text-dim)", cursor: "pointer", fontFamily: "inherit",
};

const toolBtn = {
  padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border)",
  background: "var(--surface)", color: "var(--text-dim)", fontSize: 11,
  cursor: "pointer", fontFamily: "inherit",
};

const inputStyle = {
  width: "100%", padding: "7px 10px",
  border: "1px solid var(--border)", borderRadius: 7,
  background: "var(--bg)", color: "var(--text)",
  fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};


// ─── EVENT GROWTH TAB ─────────────────────────────────────────────────────────

function growthColor(pct) {
  if (pct == null) return "var(--text-faint)";
  return pct >= 0 ? "var(--success)" : "var(--danger)";
}

function GrowthBadge({ pct }) {
  if (pct == null) return <span style={{ fontSize: 11, color: "var(--text-faint)" }}>—</span>;
  const col = growthColor(pct);
  const sign = pct >= 0 ? "+" : "";
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color: col,
      background: pct >= 0 ? "var(--success-soft)" : "var(--danger-soft)",
      border: `1px solid ${col}30`, borderRadius: 4, padding: "2px 7px",
      fontFamily: "monospace",
    }}>
      {sign}{pct.toFixed(1)}%
    </span>
  );
}

function MiniSalesBar({ editions }) {
  if (!editions || editions.length === 0) return null;
  const maxS = Math.max(...editions.map(e => e.total_sales ?? 0), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 28 }}>
      {[...editions].reverse().map((ed) => {
        const h = Math.round(((ed.total_sales ?? 0) / maxS) * 100);
        return (
          <div
            key={ed.year}
            title={`${ed.year}: $${Number(ed.total_sales).toLocaleString()}`}
            style={{
              flex: 1, minWidth: 6, height: `${Math.max(h, 4)}%`,
              background: "var(--accent)", borderRadius: "3px 3px 0 0", opacity: 0.75,
            }}
          />
        );
      })}
    </div>
  );
}

function EventGrowthTab() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setLoading(true);
    editionGrowthApi.getAll()
      .then(setRows)
      .catch(() => toast.error("Failed to load edition growth data"))
      .finally(() => setLoading(false));
  }, [toast]);

  const filtered = rows.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.event_code?.toLowerCase().includes(q) ||
      r.event_name?.toLowerCase().includes(q) ||
      r.current_city?.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 28px 28px" }}>

        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
              Year-on-Year Event Growth
            </div>
            <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
              Booking-based sales growth per event edition · click a row for full detail
            </div>
          </div>
          <input
            placeholder="Search event…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, width: 220 }}
          />
        </div>

        {loading ? (
          <div style={{ color: "var(--text-faint)", fontSize: 13, textAlign: "center", padding: 40 }}>
            Loading growth data…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ color: "var(--text-faint)", fontSize: 13, textAlign: "center", padding: 40 }}>
            {search ? "No events match the search." : "No edition growth data found. Run calculate_edition_growth command."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {[
                    "Event", "City", "Editions", "Total Sales", "Latest Year",
                    "Latest Sales", "Prev Sales", "Sales Growth",
                    "Booking Growth", "Delegate Growth", "Trend",
                  ].map((h) => (
                    <th key={h} style={{
                      padding: "8px 10px", textAlign: "left", fontWeight: 700,
                      fontSize: 10, color: "var(--text-faint)",
                      textTransform: "uppercase", letterSpacing: "0.05em",
                      background: "var(--surface)", whiteSpace: "nowrap",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const latest = row.editions?.[0] ?? {};
                  return (
                    <tr
                      key={row.event_code}
                      onClick={() => setSelected(row)}
                      style={{
                        borderBottom: "1px solid var(--border)",
                        cursor: "pointer",
                        transition: "background 0.1s",
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      {/* Event code + name */}
                      <td style={{ padding: "10px 10px" }}>
                        <div style={{ fontWeight: 700, color: "var(--accent)", fontFamily: "monospace", fontSize: 12 }}>
                          {row.event_code}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 1 }}>
                          {row.event_name}
                        </div>
                      </td>
                      {/* City */}
                      <td style={{ padding: "10px 10px", color: "var(--text-dim)", fontSize: 11 }}>
                        {row.current_city || "—"}
                      </td>
                      {/* Editions count */}
                      <td style={{ padding: "10px 10px", textAlign: "center" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: "var(--accent)",
                          background: "rgba(64,81,137,0.08)", borderRadius: 4, padding: "2px 8px",
                          fontFamily: "monospace",
                        }}>
                          {row.total_historical_years}
                        </span>
                      </td>
                      {/* Total sales */}
                      <td style={{ padding: "10px 10px", fontFamily: "monospace", fontWeight: 700, fontSize: 12, color: "var(--text)" }}>
                        ${Number(row.total_sales_all_years ?? 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </td>
                      {/* Latest year */}
                      <td style={{ padding: "10px 10px", color: "var(--text-dim)", fontFamily: "monospace", fontSize: 11 }}>
                        {latest.year ?? "—"}
                      </td>
                      {/* Latest sales */}
                      <td style={{ padding: "10px 10px", fontFamily: "monospace", fontSize: 11, color: "var(--text)" }}>
                        {latest.total_sales != null
                          ? `$${Number(latest.total_sales).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                          : "—"}
                      </td>
                      {/* Prev sales */}
                      <td style={{ padding: "10px 10px", fontFamily: "monospace", fontSize: 11, color: "var(--text-dim)" }}>
                        {latest.previous_year_sales != null
                          ? `$${Number(latest.previous_year_sales).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                          : "—"}
                      </td>
                      {/* Sales growth */}
                      <td style={{ padding: "10px 10px" }}>
                        <GrowthBadge pct={row.latest_growth_pct} />
                      </td>
                      {/* Booking growth */}
                      <td style={{ padding: "10px 10px" }}>
                        <GrowthBadge pct={latest.booking_growth_pct} />
                      </td>
                      {/* Delegate growth */}
                      <td style={{ padding: "10px 10px" }}>
                        <GrowthBadge pct={latest.delegate_growth_pct} />
                      </td>
                      {/* Mini sales trend bar */}
                      <td style={{ padding: "10px 10px", minWidth: 80 }}>
                        <MiniSalesBar editions={row.editions} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: 10, fontSize: 10, color: "var(--text-faint)" }}>
          {!loading && `${filtered.length} event${filtered.length !== 1 ? "s" : ""} · growth calculated from live booking data`}
        </div>
      </div>

      <EventGrowthDrawer data={selected} onClose={() => setSelected(null)} />
    </>
  );
}
