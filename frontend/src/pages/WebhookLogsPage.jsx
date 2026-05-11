import { useState, useEffect, useCallback } from "react";
import { webhooksApi } from "../api";
import { useToast } from "../contexts/ToastContext";

const STATUS_COLORS = {
  received:   { bg: "#f1f5f9", c: "#64748b", dot: "#94a3b8" },
  processing: { bg: "#fef3c7", c: "#d97706", dot: "#f59e0b" },
  success:    { bg: "var(--success-soft)", c: "var(--success)", dot: "var(--success)" },
  failed:     { bg: "var(--danger-soft)",  c: "var(--danger)",  dot: "var(--danger)"  },
  duplicate:  { bg: "#f3e8ff", c: "#7c3aed", dot: "#7c3aed" },
};

const PROC_COLORS = {
  pending:   { bg: "#f1f5f9", c: "#64748b" },
  processed: { bg: "var(--success-soft)", c: "var(--success)" },
  error:     { bg: "var(--danger-soft)",  c: "var(--danger)"  },
};

const DB_COLORS = {
  inserted:  { bg: "var(--success-soft)", c: "var(--success)" },
  updated:   { bg: "#eff6ff", c: "#2563eb" },
  partial:   { bg: "#fef3c7", c: "#d97706" },
  failed:    { bg: "var(--danger-soft)",  c: "var(--danger)"  },
  duplicate: { bg: "#f3e8ff", c: "#7c3aed" },
};

const STATUS_TABS = ["", "received", "processing", "success", "failed", "duplicate"];
const PAGE_SIZE   = 50;


// ─── Page shell ───────────────────────────────────────────────────────────────

export function WebhookLogsPage() {
  const [activeTab, setActiveTab] = useState("logs");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg)" }}>
      <div style={{ padding: "24px 28px 0", flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 4 }}>CRM › Integrations</div>
        <h1 style={{
          margin: 0, fontFamily: "var(--font-serif)",
          fontWeight: 500, fontSize: 38, lineHeight: 1,
          letterSpacing: "-0.01em", color: "var(--text)",
        }}>
          Webhooks.
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-dim)" }}>
          Live booking ingestion from event websites.
        </p>

        {/* Tab bar */}
        <div style={{ display: "flex", marginTop: 20, borderBottom: "1px solid var(--border)" }}>
          {[["logs", "Logs"], ["keys", "API Keys"]].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                padding: "8px 18px", fontSize: 13, fontWeight: 500,
                fontFamily: "inherit", background: "none", border: "none",
                borderBottom: activeTab === id ? "2px solid var(--accent)" : "2px solid transparent",
                color: activeTab === id ? "var(--accent)" : "var(--text-dim)",
                cursor: "pointer", marginBottom: -1,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "logs" && <LogsTab />}
      {activeTab === "keys" && <ApiKeysTab />}
    </div>
  );
}


// ─── LOGS TAB ─────────────────────────────────────────────────────────────────

function LogsTab() {
  const toast = useToast();
  const [logs, setLogs]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch]           = useState("");
  const [expanded, setExpanded]       = useState(null);
  const [retrying, setRetrying]       = useState(null);
  const [detail, setDetail]           = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (statusFilter) params.status = statusFilter;
      if (search)       params.search = search;
      const res = await webhooksApi.list(params);
      setLogs(res.results || []);
      setTotal(res.count  || 0);
    } catch {
      toast.error("Failed to load webhook logs");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, toast]);

  useEffect(() => { load(); }, [load]);

  const handleRetry = async (logId, e) => {
    e.stopPropagation();
    setRetrying(logId);
    try {
      const res = await webhooksApi.retry(logId);
      if (res.success) toast.success(`Retry succeeded · Invoice ${res.invoice_number}`);
      else             toast.error(`Retry failed · ${res.detail || "Unknown error"}`);
      load();
    } catch {
      toast.error("Retry request failed");
    } finally {
      setRetrying(null);
    }
  };

  const openDetail = async (logId, e) => {
    e.stopPropagation();
    try {
      const d = await webhooksApi.get(logId);
      setDetail(d);
    } catch {
      toast.error("Failed to load webhook detail");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const COLS = [
    { label: "Status",    w: 120 },
    { label: "DB Status", w: 100 },
    { label: "Invoice",   w: 140 },
    { label: "Event",     w: 90  },
    { label: "API Key",   w: 120 },
    { label: "Records",   w: 120 },
    { label: "Duration",  w: 80  },
    { label: "Retries",   w: 70  },
    { label: "Received",  w: 160 },
    { label: "",          w: 140 },
  ];

  return (
    <>
      {/* Toolbar */}
      <div style={{ padding: "12px 28px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", flexShrink: 0 }}>
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            style={{
              padding: "5px 12px", borderRadius: 7,
              border: `1px solid ${statusFilter === s ? "var(--accent)" : "var(--border)"}`,
              background: statusFilter === s ? "var(--accent-soft)" : "var(--surface)",
              color: statusFilter === s ? "var(--accent)" : "var(--text-dim)",
              fontSize: 11, fontWeight: 500, cursor: "pointer",
              fontFamily: "inherit", textTransform: "capitalize",
            }}
          >
            {s || "All"}
          </button>
        ))}

        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 8, padding: "0 10px", height: 30, marginLeft: "auto",
        }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="var(--text-faint)" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="5" cy="5" r="4"/><path d="M9 9l2 2"/>
          </svg>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Invoice, event, source, IP…"
            style={{ border: "none", outline: "none", fontSize: 12, background: "none", color: "var(--text)", fontFamily: "inherit", width: 190 }}
          />
        </div>

        <button onClick={() => load()} style={toolBtn} title="Refresh">↺</button>
        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{total} total</span>
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
                  {COLS.map(({ label, w }) => (
                    <th key={label + w} style={{
                      padding: "10px 14px", fontSize: 10, fontWeight: 500,
                      textTransform: "uppercase", letterSpacing: "0.05em",
                      color: "var(--text-dim)", textAlign: "left",
                      borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", minWidth: w,
                    }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={COLS.length} style={emptyCell}>Loading…</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={COLS.length} style={emptyCell}>No webhook activity yet.</td></tr>
                ) : logs.map((log) => (
                  <LogRow
                    key={log.id}
                    log={log}
                    expanded={expanded === log.id}
                    retrying={retrying === log.id}
                    onToggle={() => setExpanded(expanded === log.id ? null : log.id)}
                    onRetry={(e) => handleRetry(log.id, e)}
                    onDetail={(e) => openDetail(log.id, e)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ borderTop: "1px solid var(--border)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))}         disabled={page === 1}         style={pageBtn}>← Prev</button>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Page {page} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={pageBtn}>Next →</button>
          </div>
        </div>
      </div>

      {detail && (
        <DetailModal
          log={detail}
          onClose={() => setDetail(null)}
          onRetry={async () => { setDetail(null); await handleRetry(detail.id, { stopPropagation: () => {} }); }}
        />
      )}
    </>
  );
}


function LogRow({ log, expanded, retrying, onToggle, onRetry, onDetail }) {
  const canRetry = log.status !== "success";

  return (
    <>
      <tr
        onClick={onToggle}
        style={{
          borderTop: "1px solid var(--border)", cursor: "pointer",
          background: expanded ? "var(--surface-alt)" : "transparent",
          transition: "background 0.1s", fontSize: 13,
        }}
        onMouseOver={(e) => { if (!expanded) e.currentTarget.style.background = "var(--surface-alt)"; }}
        onMouseOut={(e)  => { if (!expanded) e.currentTarget.style.background = "transparent"; }}
      >
        <td style={cell}><StatusChip status={log.status} colors={STATUS_COLORS} /></td>

        <td style={cell}>
          {log.db_insert_status
            ? <StatusChip status={log.db_insert_status} colors={DB_COLORS} />
            : <span style={{ fontSize: 11, color: "var(--text-faint)" }}>—</span>
          }
        </td>

        <td style={cell}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500, color: "var(--accent)" }}>
            {log.invoice_number || "—"}
          </span>
        </td>

        <td style={cell}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>
            {log.event_code || "—"}
          </span>
        </td>

        <td style={cell}>
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>
            {log.api_key_name || <span style={{ color: "var(--text-faint)" }}>legacy</span>}
          </span>
        </td>

        <td style={cell}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
            {log.records_inserted > 0 || log.records_updated > 0
              ? `+${log.records_inserted} ↑${log.records_updated}`
              : "—"
            }
            {log.records_failed > 0 && <span style={{ color: "var(--danger)" }}> ✕{log.records_failed}</span>}
          </span>
        </td>

        <td style={{ ...cell, textAlign: "right" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
            {log.processing_duration != null ? `${log.processing_duration}s` : "—"}
          </span>
        </td>

        <td style={{ ...cell, textAlign: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: log.retry_count > 0 ? "#d97706" : "var(--text-faint)" }}>
            {log.retry_count}
          </span>
        </td>

        <td style={{ ...cell, whiteSpace: "nowrap", fontSize: 11, color: "var(--text-dim)" }}>
          {new Date(log.received_at || log.created_at).toLocaleString()}
        </td>

        <td style={{ ...cell, width: 140 }} onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={onDetail} style={actionBtn}>Details</button>
            {canRetry && (
              <button
                onClick={onRetry}
                disabled={retrying}
                style={{ ...actionBtn, borderColor: retrying ? "var(--border)" : "var(--accent)", color: retrying ? "var(--text-faint)" : "var(--accent)" }}
              >
                {retrying ? "…" : "Retry"}
              </button>
            )}
          </div>
        </td>
      </tr>

      {expanded && log.error_message && (
        <tr style={{ background: "var(--surface-alt)" }}>
          <td colSpan={10} style={{ padding: "0 14px 12px" }}>
            <div style={{
              padding: "8px 12px",
              background: "var(--danger-soft)", border: "1px solid var(--danger)",
              borderRadius: 6, fontSize: 12, color: "var(--danger)", fontFamily: "var(--font-mono)",
            }}>
              {log.error_message}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}


function DetailModal({ log, onClose, onRetry }) {
  const [section, setSection] = useState("payload");
  const canRetry = log.status !== "success";

  const copy = (val) =>
    navigator.clipboard.writeText(typeof val === "object" ? JSON.stringify(val, null, 2) : (val || "")).catch(() => {});

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
        width: "min(1000px, 100%)", maxHeight: "calc(100vh - 48px)",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <StatusChip status={log.status} colors={STATUS_COLORS} />
            {log.db_insert_status && <StatusChip status={log.db_insert_status} colors={DB_COLORS} />}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 500, color: "var(--accent)" }}>
              {log.invoice_number || "No invoice"}
            </span>
            <span style={{ fontSize: 12, color: "var(--text-faint)" }}>Log #{log.id}</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {canRetry && <button onClick={onRetry} style={{ ...actionBtn, borderColor: "var(--accent)", color: "var(--accent)" }}>Retry</button>}
            <button onClick={onClose} style={closeBtn}>✕</button>
          </div>
        </div>

        {/* Meta grid */}
        <div style={{ display: "flex", gap: 20, padding: "12px 20px", borderBottom: "1px solid var(--border)", flexShrink: 0, fontSize: 12, flexWrap: "wrap" }}>
          {[
            ["Event",    log.event_code || "—"],
            ["API Key",  log.api_key_name || "legacy"],
            ["Source",   log.source     || "—"],
            ["IP",       log.ip_address || "—"],
            ["HTTP",     log.http_status],
            ["Inserted", log.records_inserted],
            ["Updated",  log.records_updated],
            ["Failed ✕", log.records_failed],
            ["Duration", log.processing_duration != null ? `${log.processing_duration}s` : "—"],
            ["Retries",  log.retry_count],
            ["Received", log.received_at ? new Date(log.received_at).toLocaleString() : "—"],
          ].map(([k, v]) => (
            <div key={k}>
              <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-faint)", display: "block" }}>{k}</span>
              <span style={{ fontWeight: 500, color: "var(--text)" }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Section tabs */}
        <div style={{ display: "flex", padding: "0 20px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          {[["payload", "Payload"], ["response", "Response"], ["notes", "Processing Notes"], ["trace", "Stack Trace"]].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              style={{
                padding: "8px 14px", fontSize: 12, fontWeight: 500, fontFamily: "inherit",
                background: "none", border: "none",
                borderBottom: section === id ? "2px solid var(--accent)" : "2px solid transparent",
                color: section === id ? "var(--accent)" : "var(--text-dim)",
                cursor: "pointer", marginBottom: -1,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {log.error_message && (
            <div style={{ marginBottom: 14, padding: "10px 14px", background: "var(--danger-soft)", border: "1px solid var(--danger)", borderRadius: 8, fontSize: 12, color: "var(--danger)", fontFamily: "var(--font-mono)" }}>
              {log.error_message}
            </div>
          )}
          {log.created_booking_number && (
            <div style={{ marginBottom: 14, padding: "8px 14px", background: "var(--success-soft)", border: "1px solid var(--success)", borderRadius: 8, fontSize: 12, color: "var(--success)" }}>
              Booking: <strong style={{ fontFamily: "var(--font-mono)" }}>{log.created_booking_number}</strong>
            </div>
          )}

          {section === "payload"  && <JsonBlock  label="Payload"           data={log.payload}          onCopy={() => copy(log.payload)} />}
          {section === "response" && <JsonBlock  label="Response"          data={log.response}         onCopy={() => copy(log.response)} />}
          {section === "notes"    && <TextBlock  label="Processing Notes"  text={log.processing_notes || "(no notes)"}    onCopy={() => copy(log.processing_notes)} />}
          {section === "trace"    && <TextBlock  label="Stack Trace"       text={log.stack_trace || "(no stack trace)"} onCopy={() => copy(log.stack_trace)} isError={!!log.stack_trace} />}
        </div>
      </div>
    </div>
  );
}


// ─── API KEYS TAB ─────────────────────────────────────────────────────────────

function ApiKeysTab() {
  const toast = useToast();
  const [keys, setKeys]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [creating, setCreating]       = useState(false);
  const [newKeyVal, setNewKeyVal]     = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await webhooksApi.keys.list(search ? { search } : {});
      setKeys(res.results || res);
    } catch {
      toast.error("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, [search, toast]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (formData) => {
    try {
      const key = await webhooksApi.keys.create(formData);
      toast.success(`API key "${key.name}" created`);
      setNewKeyVal(key.api_key);
      load();
    } catch {
      toast.error("Failed to create API key");
    }
    setCreating(false);
  };

  const handleToggle = async (id, isActive) => {
    try {
      await webhooksApi.keys.toggle(id);
      toast.success(isActive ? "Key disabled" : "Key enabled");
      load();
    } catch {
      toast.error("Failed to toggle key");
    }
  };

  const handleRegenerate = async (id, name) => {
    try {
      const res = await webhooksApi.keys.regenerate(id);
      setNewKeyVal(res.api_key);
      toast.success(`"${name}" regenerated — save the new value now`);
      load();
    } catch {
      toast.error("Failed to regenerate key");
    }
  };

  const handleDelete = async (id) => {
    try {
      await webhooksApi.keys.delete(id);
      toast.success("API key deleted");
      setConfirmDelete(null);
      load();
    } catch {
      toast.error("Failed to delete key");
    }
  };

  const copyText = (val) =>
    navigator.clipboard.writeText(val).then(
      () => toast.success("Copied to clipboard"),
      () => toast.error("Copy failed"),
    );

  const COLS = [
    { label: "Name",       w: 150 },
    { label: "Event",      w: 90  },
    { label: "API Key",    w: 240 },
    { label: "Status",     w: 90  },
    { label: "Usage",      w: 70  },
    { label: "Last Used",  w: 160 },
    { label: "Created By", w: 120 },
    { label: "",           w: 210 },
  ];

  return (
    <>
      {/* Toolbar */}
      <div style={{ padding: "12px 28px 14px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "0 10px", height: 30 }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="var(--text-faint)" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="5" cy="5" r="4"/><path d="M9 9l2 2"/>
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or event…"
            style={{ border: "none", outline: "none", fontSize: 12, background: "none", color: "var(--text)", fontFamily: "inherit", width: 160 }}
          />
        </div>
        <button onClick={() => load()} style={toolBtn} title="Refresh">↺</button>
        <span style={{ fontSize: 11, color: "var(--text-faint)", marginLeft: "auto" }}>{keys.length} keys</span>
        <button
          onClick={() => setCreating(true)}
          style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid var(--accent)", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
        >
          + New Key
        </button>
      </div>

      {/* New key banner */}
      {newKeyVal && (
        <div style={{ margin: "0 28px 12px", padding: "12px 16px", background: "var(--success-soft)", border: "1px solid var(--success)", borderRadius: 10, display: "flex", alignItems: "center", gap: 12, flexShrink: 0, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "var(--success)", fontWeight: 500, whiteSpace: "nowrap" }}>
            Save this key — it won&apos;t be shown again:
          </span>
          <code style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)", background: "var(--surface)", padding: "4px 8px", borderRadius: 5, border: "1px solid var(--border)", wordBreak: "break-all" }}>
            {newKeyVal}
          </code>
          <button onClick={() => copyText(newKeyVal)} style={{ ...actionBtn, borderColor: "var(--success)", color: "var(--success)" }}>Copy</button>
          <button onClick={() => setNewKeyVal(null)} style={closeBtn}>✕</button>
        </div>
      )}

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
                {loading ? (
                  <tr><td colSpan={COLS.length} style={emptyCell}>Loading…</td></tr>
                ) : keys.length === 0 ? (
                  <tr><td colSpan={COLS.length} style={emptyCell}>No API keys yet. Create one to start ingesting bookings.</td></tr>
                ) : keys.map((k) => (
                  <ApiKeyRow
                    key={k.id}
                    apiKey={k}
                    onToggle={() => handleToggle(k.id, k.is_active)}
                    onRegenerate={() => handleRegenerate(k.id, k.name)}
                    onDelete={() => setConfirmDelete(k)}
                    onCopy={() => copyText(k.api_key)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {creating && <CreateKeyModal onClose={() => setCreating(false)} onCreate={handleCreate} />}

      {confirmDelete && (
        <ConfirmModal
          title="Delete API Key"
          message={`Permanently delete "${confirmDelete.name}"? Any integrations using this key will stop working.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDelete(confirmDelete.id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </>
  );
}


function ApiKeyRow({ apiKey, onToggle, onRegenerate, onDelete, onCopy }) {
  return (
    <tr style={{ borderTop: "1px solid var(--border)", fontSize: 13 }}>
      <td style={cell}>
        <span style={{ fontWeight: 500, color: "var(--text)" }}>{apiKey.name}</span>
        {apiKey.notes && <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{apiKey.notes}</div>}
      </td>

      <td style={cell}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)" }}>
          {apiKey.event || <span style={{ color: "var(--text-faint)" }}>any</span>}
        </span>
      </td>

      <td style={cell}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <code style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", background: "var(--bg)", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)" }}>
            {apiKey.key_preview}
          </code>
          <button onClick={onCopy} style={{ ...actionBtn, padding: "2px 7px", fontSize: 10 }}>Copy</button>
        </div>
      </td>

      <td style={cell}>
        <span style={{
          fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 5,
          background: apiKey.is_active ? "var(--success-soft)" : "var(--danger-soft)",
          color:      apiKey.is_active ? "var(--success)"      : "var(--danger)",
        }}>
          {apiKey.is_active ? "Active" : "Disabled"}
        </span>
      </td>

      <td style={{ ...cell, textAlign: "center" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>{apiKey.usage_count}</span>
      </td>

      <td style={{ ...cell, fontSize: 11, color: "var(--text-dim)" }}>
        {apiKey.last_used_at ? new Date(apiKey.last_used_at).toLocaleString() : "Never"}
      </td>

      <td style={{ ...cell, fontSize: 11, color: "var(--text-dim)" }}>
        {apiKey.created_by_name || "—"}
      </td>

      <td style={cell} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onToggle}     style={actionBtn}>{apiKey.is_active ? "Disable" : "Enable"}</button>
          <button onClick={onRegenerate} style={actionBtn}>Regen</button>
          <button onClick={onDelete}     style={{ ...actionBtn, borderColor: "var(--danger)", color: "var(--danger)" }}>Delete</button>
        </div>
      </td>
    </tr>
  );
}


function CreateKeyModal({ onClose, onCreate }) {
  const [form, setForm]     = useState({ name: "", event: "", notes: "", is_active: true });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    await onCreate(form);
    setSaving(false);
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, width: "min(480px, 100%)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>New API Key</span>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        <form onSubmit={submit} style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Name *" hint="Identify this integration (e.g. 'Summit Website')">
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="e.g. Summit Website Integration" />
          </Field>
          <Field label="Event Code" hint="Restrict to one event code (leave blank for all events)">
            <input value={form.event} onChange={(e) => setForm((f) => ({ ...f, event: e.target.value }))} style={inputStyle} placeholder="e.g. SUMMIT2025" />
          </Field>
          <Field label="Notes">
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} placeholder="Optional notes…" />
          </Field>

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={pageBtn}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: "6px 16px", borderRadius: 7, border: "1px solid var(--accent)", background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 500, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>
              {saving ? "Creating…" : "Create Key"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, width: "min(400px, 100%)", padding: 24 }}>
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
  const sc = colors[status] || { bg: "#f1f5f9", c: "#64748b", dot: "#94a3b8" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 6, background: sc.bg, color: sc.c, textTransform: "capitalize", whiteSpace: "nowrap" }}>
      {sc.dot && <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot, flexShrink: 0 }} />}
      {status || "—"}
    </span>
  );
}

function JsonBlock({ label, data, onCopy }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-faint)" }}>{label}</span>
        {onCopy && <button onClick={onCopy} style={{ ...actionBtn, fontSize: 10, padding: "2px 7px" }}>Copy</button>}
      </div>
      <pre style={{ margin: 0, padding: "10px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-dim)", overflow: "auto", maxHeight: 380, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

function TextBlock({ label, text, onCopy, isError }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-faint)" }}>{label}</span>
        {onCopy && <button onClick={onCopy} style={{ ...actionBtn, fontSize: 10, padding: "2px 7px" }}>Copy</button>}
      </div>
      <pre style={{ margin: 0, padding: "10px 12px", background: isError ? "var(--danger-soft)" : "var(--bg)", border: `1px solid ${isError ? "var(--danger)" : "var(--border)"}`, borderRadius: 8, fontSize: 11, fontFamily: "var(--font-mono)", color: isError ? "var(--danger)" : "var(--text-dim)", overflow: "auto", maxHeight: 380, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {text}
      </pre>
    </div>
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
