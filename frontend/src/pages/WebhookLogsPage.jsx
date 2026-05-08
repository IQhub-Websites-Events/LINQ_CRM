import { useState, useEffect, useCallback } from "react";
import { invoicesApi } from "../api";
import { useToast } from "../contexts/ToastContext";

const STATUS_COLORS = {
  success:   { bg: "var(--success-soft)", c: "var(--success)",   dot: "var(--success)" },
  failed:    { bg: "var(--danger-soft)",  c: "var(--danger)",    dot: "var(--danger)" },
  duplicate: { bg: "var(--warn-soft)",    c: "var(--warn)",      dot: "var(--warn)" },
};

export function WebhookLogsPage() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [expanded, setExpanded] = useState(null);

  const PAGE_SIZE = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, page_size: PAGE_SIZE };
      if (statusFilter) params.status = statusFilter;
      const res = await invoicesApi.webhookLogs(params);
      setLogs(res.results || res);
      setTotal(res.count || (res.results ? res.count : res.length) || 0);
    } catch {
      toast.error("Failed to load webhook logs");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, toast]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg)" }}>

      {/* Page header */}
      <div style={{ padding: "24px 28px 16px", flexShrink: 0 }}>
        <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 4 }}>CRM › Integrations</div>
        <h1 style={{
          margin: 0, fontFamily: "var(--font-serif)",
          fontWeight: 500, fontSize: 38, lineHeight: 1,
          letterSpacing: "-0.01em", color: "var(--text)",
        }}>
          Webhooks.
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-dim)" }}>
          Incoming requests from event websites. Each row is one payload attempt.
        </p>
      </div>

      {/* Toolbar */}
      <div style={{ padding: "0 28px 14px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {["", "success", "failed", "duplicate"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            style={{
              padding: "5px 12px",
              borderRadius: 7,
              border: `1px solid ${statusFilter === s ? "var(--accent)" : "var(--border)"}`,
              background: statusFilter === s ? "var(--accent-soft)" : "var(--surface)",
              color: statusFilter === s ? "var(--accent)" : "var(--text-dim)",
              fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
              textTransform: "capitalize",
            }}
          >
            {s || "All"}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-faint)" }}>
          {total} total
        </span>
      </div>

      {/* Table */}
      <div style={{ flex: 1, minHeight: 0, padding: "0 28px 28px" }}>
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                <tr style={{ background: "var(--surface-alt)" }}>
                  {["Status", "Invoice", "Event", "IP", "HTTP", "Time", ""].map((h) => (
                    <th key={h} style={{
                      padding: "10px 14px", fontSize: 10, fontWeight: 500,
                      textTransform: "uppercase", letterSpacing: "0.05em",
                      color: "var(--text-dim)", textAlign: "left",
                      borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "48px 0", color: "var(--text-faint)", fontSize: 13 }}>
                      Loading…
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "48px 0", color: "var(--text-faint)", fontSize: 13 }}>
                      No webhook activity yet.
                    </td>
                  </tr>
                ) : logs.map((log) => (
                  <>
                    <tr
                      key={log.id}
                      onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                      style={{
                        borderTop: "1px solid var(--border)",
                        cursor: "pointer",
                        background: expanded === log.id ? "var(--surface-alt)" : "transparent",
                        transition: "background 0.1s",
                      }}
                      onMouseOver={(e) => { if (expanded !== log.id) e.currentTarget.style.background = "var(--surface-alt)"; }}
                      onMouseOut={(e) => { if (expanded !== log.id) e.currentTarget.style.background = "transparent"; }}
                    >
                      <td style={{ padding: "10px 14px" }}>
                        <StatusChip status={log.status} />
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500, color: "var(--accent)" }}>
                          {log.invoice_number || "—"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>
                          {log.event_code || "—"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)" }}>
                          {log.source_ip || "—"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{
                          fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500,
                          color: log.http_status >= 400 ? "var(--danger)" : "var(--success)",
                        }}>
                          {log.http_status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
                          {expanded === log.id ? "▲" : "▼"}
                        </span>
                      </td>
                    </tr>

                    {expanded === log.id && (
                      <tr key={`${log.id}-detail`} style={{ background: "var(--surface-alt)" }}>
                        <td colSpan={7} style={{ padding: "0 14px 14px" }}>
                          {log.error_message && (
                            <div style={{
                              marginBottom: 10,
                              padding: "8px 12px",
                              background: "var(--danger-soft)",
                              border: "1px solid var(--danger)",
                              borderRadius: 6,
                              fontSize: 12,
                              color: "var(--danger)",
                              fontFamily: "var(--font-mono)",
                            }}>
                              {log.error_message}
                            </div>
                          )}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <JsonBlock label="Payload" data={log.payload} />
                            <JsonBlock label="Response" data={log.response} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pager */}
          <div style={{
            borderTop: "1px solid var(--border)",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexShrink: 0,
          }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={pageBtn}
            >
              ← Prev
            </button>
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={pageBtn}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function StatusChip({ status }) {
  const sc = STATUS_COLORS[status] || STATUS_COLORS.failed;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 500,
      padding: "2px 8px", borderRadius: 6,
      background: sc.bg, color: sc.c,
      textTransform: "capitalize",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot }} />
      {status}
    </span>
  );
}

function JsonBlock({ label, data }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 500, textTransform: "uppercase",
        letterSpacing: "0.05em", color: "var(--text-faint)",
        marginBottom: 6,
      }}>
        {label}
      </div>
      <pre style={{
        margin: 0,
        padding: "10px 12px",
        background: "var(--bg)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        fontSize: 11,
        fontFamily: "var(--font-mono)",
        color: "var(--text-dim)",
        overflow: "auto",
        maxHeight: 220,
        whiteSpace: "pre-wrap",
        wordBreak: "break-all",
      }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

const pageBtn = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 11,
  color: "var(--text-dim)",
  cursor: "pointer",
  fontFamily: "inherit",
};
