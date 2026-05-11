import { useState, useEffect, useCallback, useRef } from "react";
import { googleSyncApi } from "../api";
import { useToast } from "../contexts/ToastContext";

/* ─── Constants ─── */

const STATUS_COLORS = {
  pending:        { bg: "#f1f5f9", c: "#64748b",  dot: "#94a3b8" },
  running:        { bg: "#fef3c7", c: "#d97706",  dot: "#f59e0b" },
  success:        { bg: "var(--success-soft)", c: "var(--success)", dot: "var(--success)" },
  failed:         { bg: "var(--danger-soft)",  c: "var(--danger)",  dot: "var(--danger)" },
  partial_success:{ bg: "#fff7ed", c: "#ea580c",  dot: "#ea580c" },
};

const SYNC_TYPE_LABELS = {
  bookings:  "Bookings",
  events:    "Events",
  full_sync: "Full Sync",
};

const TRIGGER_LABELS = {
  admin_manual: "Manual",
  scheduler:    "Scheduler",
  system:       "System",
};

const STATUS_TABS = ["", "running", "success", "failed", "partial_success", "pending"];
const PAGE_SIZE   = 50;

/* ─── Main Page ─── */

export function GoogleSyncPage() {
  const toast = useToast();

  // Dashboard state
  const [syncStatus, setSyncStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Table state
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [logsLoading, setLogsLoading] = useState(true);

  // Filters
  const [statusFilter,  setStatusFilter]  = useState("");
  const [typeFilter,    setTypeFilter]    = useState("");
  const [triggerFilter, setTriggerFilter] = useState("");
  const [search, setSearch] = useState("");

  // Actions
  const [syncing, setSyncing]       = useState(false);
  const [retrying, setRetrying]     = useState(null);
  const [dropOpen, setDropOpen]     = useState(false);
  const [detailLog, setDetailLog]   = useState(null);
  const dropRef = useRef(null);

  // ── Data loaders ────────────────────────────────────────────────────────────

  const loadStatus = useCallback(async () => {
    try {
      const s = await googleSyncApi.status();
      setSyncStatus(s);
    } catch {
      // silent
    } finally {
      setStatusLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (statusFilter)  params.status         = statusFilter;
      if (typeFilter)    params.sync_type       = typeFilter;
      if (triggerFilter) params.trigger_source  = triggerFilter;
      if (search)        params.search          = search;
      const res = await googleSyncApi.logs(params);
      setLogs(res.results || []);
      setTotal(res.count  || 0);
    } catch {
      toast.error("Failed to load sync logs");
    } finally {
      setLogsLoading(false);
    }
  }, [page, statusFilter, typeFilter, triggerFilter, search, toast]);

  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { loadLogs();   }, [loadLogs]);

  // Poll status while a sync is running
  useEffect(() => {
    if (!syncStatus?.is_running) return;
    const interval = setInterval(async () => {
      const s = await googleSyncApi.status().catch(() => null);
      if (s) {
        setSyncStatus(s);
        if (!s.is_running) {
          loadLogs();
          clearInterval(interval);
        }
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [syncStatus?.is_running, loadLogs]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) {
        setDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleSync = async (syncType) => {
    setDropOpen(false);
    if (syncStatus?.is_running) {
      toast.error("A sync is already in progress. Please wait.");
      return;
    }
    setSyncing(true);
    try {
      const res = await googleSyncApi.run({ sync_type: syncType, full: false });
      if (res.status === "success") {
        toast.success(`Sync complete · ${res.records_processed} records`);
      } else if (res.status === "partial_success") {
        toast.error(`Partial sync · check errors`);
      } else {
        toast.error(`Sync failed · ${res.error_message?.slice(0, 80) || "Unknown error"}`);
      }
      await loadStatus();
      await loadLogs();
    } catch (err) {
      const msg = err?.response?.data?.error || "Sync request failed";
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  };

  const handleRetry = async (logId, e) => {
    e?.stopPropagation();
    setRetrying(logId);
    try {
      const res = await googleSyncApi.retry(logId);
      if (res.status === "success") {
        toast.success(`Retry succeeded · ${res.records_processed} records`);
      } else {
        toast.error(`Retry ${res.status} · ${res.error_message?.slice(0, 60) || ""}`);
      }
      await loadStatus();
      await loadLogs();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Retry failed");
    } finally {
      setRetrying(null);
    }
  };

  const openDetail = async (logId, e) => {
    e?.stopPropagation();
    try {
      const d = await googleSyncApi.get(logId);
      setDetailLog(d);
    } catch {
      toast.error("Failed to load sync detail");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isRunning  = syncStatus?.is_running || syncing;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg)" }}>

      {/* Running banner */}
      {isRunning && (
        <div style={{
          background: "#fef3c7", borderBottom: "1px solid #fcd34d",
          padding: "8px 28px", display: "flex", alignItems: "center", gap: 10,
          fontSize: 12, color: "#92400e", flexShrink: 0,
        }}>
          <Spinner size={12} />
          <span>Sync in progress — please wait…</span>
        </div>
      )}

      {/* Page header */}
      <div style={{ padding: "24px 28px 16px", flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 4 }}>CRM › Admin › Integrations</div>
        <h1 style={{
          margin: 0, fontFamily: "var(--font-serif)",
          fontWeight: 500, fontSize: 38, lineHeight: 1,
          letterSpacing: "-0.01em", color: "var(--text)",
        }}>
          Sync Operations.
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-dim)" }}>
          Google Sheets sync history, status monitoring, and manual sync controls.
        </p>
      </div>

      {/* Status dashboard */}
      <div style={{ padding: "0 28px 20px", flexShrink: 0 }}>
        <SyncDashboard status={syncStatus} loading={statusLoading} />
      </div>

      {/* Toolbar */}
      <div style={{ padding: "0 28px 12px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", flexShrink: 0 }}>

        {/* Status tabs */}
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            style={tabStyle(statusFilter === s)}
          >
            {s ? (s === "partial_success" ? "Partial" : s.charAt(0).toUpperCase() + s.slice(1)) : "All"}
          </button>
        ))}

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          style={selectStyle}
        >
          <option value="">All Types</option>
          <option value="bookings">Bookings</option>
          <option value="events">Events</option>
          <option value="full_sync">Full Sync</option>
        </select>

        {/* Trigger filter */}
        <select
          value={triggerFilter}
          onChange={(e) => { setTriggerFilter(e.target.value); setPage(1); }}
          style={selectStyle}
        >
          <option value="">All Sources</option>
          <option value="admin_manual">Manual</option>
          <option value="scheduler">Scheduler</option>
          <option value="system">System</option>
        </select>

        {/* Search */}
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 8, padding: "0 10px", height: 30,
        }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="var(--text-faint)" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="5" cy="5" r="4"/><path d="M9 9l2 2"/>
          </svg>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search logs…"
            style={{ border: "none", outline: "none", fontSize: 12, background: "none", color: "var(--text)", fontFamily: "inherit", width: 140 }}
          />
        </div>

        {(statusFilter || typeFilter || triggerFilter || search) && (
          <button
            onClick={() => { setStatusFilter(""); setTypeFilter(""); setTriggerFilter(""); setSearch(""); setPage(1); }}
            style={{ fontSize: 11, color: "var(--text-faint)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
          >
            Clear ×
          </button>
        )}

        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-faint)" }}>{total} logs</span>

        <button
          onClick={() => { loadStatus(); loadLogs(); }}
          style={iconBtnStyle}
          title="Refresh"
        >
          ↺
        </button>

        {/* Sync Now split button */}
        <div ref={dropRef} style={{ position: "relative" }}>
          <div style={{ display: "flex", borderRadius: 7, overflow: "hidden" }}>
            <button
              onClick={() => handleSync("full_sync")}
              disabled={isRunning}
              style={syncBtnStyle(isRunning)}
            >
              {syncing ? <><Spinner size={10} /> Syncing…</> : "↑ Sync Now"}
            </button>
            <button
              onClick={() => setDropOpen((v) => !v)}
              disabled={isRunning}
              style={{
                ...syncBtnStyle(isRunning),
                padding: "7px 8px",
                borderLeft: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 0,
              }}
            >
              ▾
            </button>
          </div>

          {dropOpen && (
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 4px)",
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
              zIndex: 100, minWidth: 160, overflow: "hidden",
            }}>
              {[
                { type: "full_sync", label: "Sync All" },
                { type: "bookings",  label: "Bookings Only" },
                { type: "events",    label: "Events Only" },
              ].map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => handleSync(type)}
                  style={dropItemStyle}
                  onMouseOver={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
                  onMouseOut={(e)  => { e.currentTarget.style.background = "transparent"; }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, minHeight: 0, padding: "0 28px 28px" }}>
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, overflow: "hidden",
          display: "flex", flexDirection: "column", height: "100%",
        }}>
          <div style={{ flex: 1, overflowX: "auto", overflowY: "auto" }}>
            <table style={{ width: "max-content", minWidth: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                <tr style={{ background: "var(--surface-alt)" }}>
                  {[
                    { label: "#",           w: 56  },
                    { label: "Type",        w: 110 },
                    { label: "Sheet",       w: 160 },
                    { label: "Status",      w: 130 },
                    { label: "Mode",        w: 100 },
                    { label: "Started",     w: 160 },
                    { label: "Duration",    w: 90  },
                    { label: "Records",     w: 90  },
                    { label: "Updated",     w: 80  },
                    { label: "Failed",      w: 70  },
                    { label: "Source",      w: 110 },
                    { label: "By",          w: 130 },
                    { label: "",            w: 120 },
                  ].map(({ label, w }) => (
                    <th key={label} style={{
                      padding: "10px 14px", fontSize: 10, fontWeight: 500,
                      textTransform: "uppercase", letterSpacing: "0.05em",
                      color: "var(--text-dim)", textAlign: "left",
                      borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
                      minWidth: w,
                    }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logsLoading ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: "center", padding: "48px 0", color: "var(--text-faint)", fontSize: 13 }}>
                      Loading…
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={13} style={{ textAlign: "center", padding: "48px 0", color: "var(--text-faint)", fontSize: 13 }}>
                      No sync logs yet. Click <strong>Sync Now</strong> to start.
                    </td>
                  </tr>
                ) : logs.map((log) => (
                  <SyncLogRow
                    key={log.id}
                    log={log}
                    retrying={retrying === log.id}
                    onDetail={(e) => openDetail(log.id, e)}
                    onRetry={(e) => handleRetry(log.id, e)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Pager */}
          <div style={{
            borderTop: "1px solid var(--border)", padding: "10px 16px",
            display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
          }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={pageBtnStyle}>← Prev</button>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Page {page} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={pageBtnStyle}>Next →</button>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      {detailLog && (
        <SyncDetailModal
          log={detailLog}
          onClose={() => setDetailLog(null)}
          onRetry={async () => {
            setDetailLog(null);
            await handleRetry(detailLog.id);
          }}
        />
      )}
    </div>
  );
}


/* ─── Status Dashboard ─── */

function SyncDashboard({ status: s, loading }) {
  if (loading || !s) {
    return (
      <div style={{ display: "flex", gap: 12 }}>
        {[1,2,3,4].map((i) => (
          <div key={i} style={{ ...cardStyle, background: "var(--surface-alt)", height: 76 }} />
        ))}
      </div>
    );
  }

  const bookings = s.bookings || {};
  const events   = s.events   || {};

  const cards = [
    {
      label: "Bookings Last Sync",
      value: bookings.last_synced_at ? fmtDate(bookings.last_synced_at) : "Never",
      sub:   bookings.records_synced ? `${bookings.records_synced} rows` : "",
      status: bookings.last_status,
    },
    {
      label: "Events Last Sync",
      value: events.last_synced_at ? fmtDate(events.last_synced_at) : "Never",
      sub:   events.records_synced ? `${events.records_synced} rows` : "",
      status: events.last_status,
    },
    {
      label: "Sync Status",
      value: s.is_running ? "Running" : (s.latest_log?.status || "Idle"),
      sub:   s.latest_log ? fmtDate(s.latest_log.started_at) : "",
      status: s.is_running ? "running" : s.latest_log?.status,
    },
    {
      label: "Latest Run",
      value: s.latest_log ? (s.latest_log.duration_display || `${s.latest_log.duration_seconds?.toFixed(1) || 0}s`) : "—",
      sub:   s.latest_log ? `${SYNC_TYPE_LABELS[s.latest_log.sync_type] || s.latest_log.sync_type}` : "",
      status: s.latest_log?.status,
    },
  ];

  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {cards.map((c) => (
        <div key={c.label} style={cardStyle}>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-faint)", marginBottom: 6 }}>
            {c.label}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {c.status && STATUS_COLORS[c.status] && (
              <span style={{
                width: 8, height: 8, borderRadius: "50%",
                background: STATUS_COLORS[c.status].dot,
                flexShrink: 0,
                ...(c.status === "running" ? { animation: "pulse 1s infinite" } : {}),
              }} />
            )}
            <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text)" }}>{c.value}</span>
          </div>
          {c.sub && <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 3 }}>{c.sub}</div>}
          {c.status === "failed" && (
            <div style={{ fontSize: 10, color: "var(--danger)", marginTop: 2, fontWeight: 500 }}>
              {c.status === "failed" && (c === cards[0] ? bookings.error_message : events.error_message)
                ? "Error — check logs"
                : ""
              }
            </div>
          )}
        </div>
      ))}
    </div>
  );
}


/* ─── Table Row ─── */

function SyncLogRow({ log, retrying, onDetail, onRetry }) {
  const canRetry = log.status === "failed" || log.status === "partial_success";

  return (
    <tr
      style={{
        borderTop: "1px solid var(--border)",
        background: "transparent",
        transition: "background 0.1s",
        fontSize: 13,
        cursor: "pointer",
      }}
      onMouseOver={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
      onMouseOut={(e)  => { e.currentTarget.style.background = "transparent"; }}
      onClick={onDetail}
    >
      <td style={cell}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)" }}>
          #{log.id}
        </span>
      </td>

      <td style={cell}>
        <span style={{
          fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 5,
          background: "var(--surface-alt)", color: "var(--text-dim)",
        }}>
          {SYNC_TYPE_LABELS[log.sync_type] || log.sync_type}
        </span>
      </td>

      <td style={cell}>
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{log.sheet_name || "—"}</span>
      </td>

      <td style={cell}>
        <StatusChip status={log.status} />
      </td>

      <td style={cell}>
        <span style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "capitalize" }}>
          {log.sync_mode}
        </span>
      </td>

      <td style={{ ...cell, whiteSpace: "nowrap", fontSize: 11, color: "var(--text-dim)" }}>
        {fmtDateFull(log.started_at)}
      </td>

      <td style={{ ...cell, fontFamily: "var(--font-mono)", fontSize: 12 }}>
        {log.duration_display || (log.duration_seconds != null ? `${log.duration_seconds.toFixed(1)}s` : "—")}
      </td>

      <td style={{ ...cell, textAlign: "center" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500, color: "var(--text)" }}>
          {log.records_processed ?? "—"}
        </span>
      </td>

      <td style={{ ...cell, textAlign: "center" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>
          {log.records_updated || "—"}
        </span>
      </td>

      <td style={{ ...cell, textAlign: "center" }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 12,
          color: log.records_failed > 0 ? "var(--danger)" : "var(--text-faint)",
          fontWeight: log.records_failed > 0 ? 600 : 400,
        }}>
          {log.records_failed || "—"}
        </span>
      </td>

      <td style={cell}>
        <span style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "capitalize" }}>
          {TRIGGER_LABELS[log.trigger_source] || log.trigger_source || "—"}
        </span>
      </td>

      <td style={{ ...cell, maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis" }}>
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{log.triggered_by || "—"}</span>
      </td>

      <td style={{ ...cell, width: 120 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onDetail} style={actionBtn}>Detail</button>
          {canRetry && (
            <button
              onClick={onRetry}
              disabled={retrying}
              style={{ ...actionBtn, borderColor: "var(--accent)", color: retrying ? "var(--text-faint)" : "var(--accent)" }}
            >
              {retrying ? "…" : "Retry"}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}


/* ─── Detail Modal ─── */

function SyncDetailModal({ log, onClose, onRetry }) {
  const canRetry = log.status === "failed" || log.status === "partial_success";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 1000, padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 14,
          width: "min(860px, 100%)", maxHeight: "calc(100vh - 48px)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <StatusChip status={log.status} />
            <span style={{ fontWeight: 500, color: "var(--text)", fontSize: 14 }}>
              {SYNC_TYPE_LABELS[log.sync_type] || log.sync_type}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
              #{log.id}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {canRetry && (
              <button
                onClick={onRetry}
                style={{ ...actionBtn, borderColor: "var(--accent)", color: "var(--accent)" }}
              >
                Retry
              </button>
            )}
            <button onClick={onClose} style={closeBtnStyle}>✕</button>
          </div>
        </div>

        {/* Meta grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0,
          padding: "14px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0,
        }}>
          {[
            ["Sheet",       log.sheet_name || "—"],
            ["Mode",        log.sync_mode],
            ["Source",      TRIGGER_LABELS[log.trigger_source] || log.trigger_source],
            ["By",          log.triggered_by || "—"],
            ["Started",     fmtDateFull(log.started_at)],
            ["Completed",   log.completed_at ? fmtDateFull(log.completed_at) : "—"],
            ["Duration",    log.duration_display || (log.duration_seconds != null ? `${log.duration_seconds.toFixed(2)}s` : "—")],
            ["Records",     log.records_processed ?? "—"],
          ].map(([k, v]) => (
            <div key={k} style={{ padding: "6px 0" }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-faint)", marginBottom: 2 }}>
                {k}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {log.error_message && (
            <div style={{
              marginBottom: 16, padding: "10px 14px",
              background: "var(--danger-soft)", border: "1px solid var(--danger)",
              borderRadius: 8, fontSize: 12, color: "var(--danger)", fontFamily: "var(--font-mono)",
              whiteSpace: "pre-wrap",
            }}>
              {log.error_message}
            </div>
          )}

          {log.sync_summary && Object.keys(log.sync_summary).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-faint)", marginBottom: 8 }}>
                Sync Summary
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                {Object.entries(log.sync_summary).map(([k, v]) => (
                  <div key={k} style={{ ...cardStyle, flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-faint)", marginBottom: 4 }}>{k}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>{v.records}</div>
                    <div style={{ fontSize: 10, color: "var(--text-faint)" }}>{v.last_synced_at ? `at ${fmtDate(v.last_synced_at)}` : ""}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-faint)", marginBottom: 6 }}>
                Counters
              </div>
              {[
                ["Processed", log.records_processed],
                ["Created",   log.records_created],
                ["Updated",   log.records_updated],
                ["Failed",    log.records_failed],
              ].map(([label, val]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                  <span style={{ color: "var(--text-dim)" }}>{label}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, color: "var(--text)" }}>{val ?? 0}</span>
                </div>
              ))}
            </div>

            <JsonBlock label="Sync Summary JSON" data={log.sync_summary} />
          </div>
        </div>
      </div>
    </div>
  );
}


/* ─── Shared sub-components ─── */

function StatusChip({ status }) {
  const sc = STATUS_COLORS[status] || STATUS_COLORS.pending;
  const label = status === "partial_success" ? "Partial" : status;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 500,
      padding: "2px 8px", borderRadius: 6,
      background: sc.bg, color: sc.c,
      textTransform: "capitalize", whiteSpace: "nowrap",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot, flexShrink: 0 }} />
      {label}
    </span>
  );
}

function JsonBlock({ label, data }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-faint)", marginBottom: 6 }}>
        {label}
      </div>
      <pre style={{
        margin: 0, padding: "10px 12px",
        background: "var(--bg)", border: "1px solid var(--border)",
        borderRadius: 8, fontSize: 11, fontFamily: "var(--font-mono)",
        color: "var(--text-dim)", overflow: "auto", maxHeight: 200,
        whiteSpace: "pre-wrap", wordBreak: "break-all",
      }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function Spinner({ size = 14 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
      style={{ animation: "spin 0.8s linear infinite", display: "inline-block" }}
    >
      <path d="M12 2a10 10 0 1 0 10 10" opacity="0.3" />
      <path d="M12 2a10 10 0 0 1 10 10" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  );
}


/* ─── Helpers ─── */

function fmtDate(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return ts; }
}

function fmtDateFull(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch { return ts; }
}


/* ─── Styles ─── */

const cell = {
  padding: "10px 14px",
  color: "var(--text)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  verticalAlign: "middle",
};

const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "12px 16px",
  flex: "1 1 180px",
  minWidth: 160,
};

const actionBtn = {
  fontSize: 11, fontWeight: 500,
  padding: "3px 9px", borderRadius: 6,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-dim)",
  cursor: "pointer", fontFamily: "inherit",
  whiteSpace: "nowrap",
};

const closeBtnStyle = {
  fontSize: 14, lineHeight: 1,
  padding: "4px 8px", borderRadius: 6,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-faint)",
  cursor: "pointer", fontFamily: "inherit",
};

const pageBtnStyle = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 6, padding: "4px 10px",
  fontSize: 11, color: "var(--text-dim)",
  cursor: "pointer", fontFamily: "inherit",
};

const iconBtnStyle = {
  padding: "5px 10px", borderRadius: 7,
  border: "1px solid var(--border)", background: "var(--surface)",
  color: "var(--text-dim)", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
};

function tabStyle(active) {
  return {
    padding: "5px 12px", borderRadius: 7,
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    background: active ? "var(--accent-soft)" : "var(--surface)",
    color: active ? "var(--accent)" : "var(--text-dim)",
    fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
    textTransform: "capitalize",
  };
}

function syncBtnStyle(disabled) {
  return {
    display: "inline-flex", alignItems: "center", gap: 5,
    background: disabled ? "var(--text-faint)" : "var(--accent)",
    border: "none", color: "#fff",
    padding: "7px 14px", fontSize: 12, fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit",
    borderRadius: 7, transition: "opacity .15s",
    opacity: disabled ? 0.6 : 1,
  };
}

const selectStyle = {
  height: 30, padding: "0 26px 0 9px",
  fontSize: 12, border: "1px solid var(--border)",
  borderRadius: 8, color: "var(--text)", background: "var(--surface)",
  fontFamily: "inherit", outline: "none", cursor: "pointer", appearance: "none",
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239a978f' stroke-width='1.3' fill='none'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat", backgroundPosition: "right 7px center",
};

const dropItemStyle = {
  display: "block", width: "100%",
  padding: "9px 14px", textAlign: "left",
  fontSize: 12, color: "var(--text)", background: "transparent",
  border: "none", cursor: "pointer", fontFamily: "inherit",
};
