import { useState, useEffect, useCallback } from "react";
import { eventPerformanceApi } from "../../api/eventPerformance";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtCurrency = (n) =>
  n == null ? "—" : "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });

const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
};


// ── Style maps ────────────────────────────────────────────────────────────────

const HEALTH_STYLE = {
  healthy: { bg: "var(--success-soft)", color: "var(--success)", label: "Healthy" },
  on_track: { bg: "#dbeafe", color: "#1d4ed8", label: "On Track" },
  warning: { bg: "var(--warn-soft)", color: "var(--warn)", label: "Warning" },
  critical: { bg: "var(--danger-soft)", color: "var(--danger)", label: "Critical" },
  unknown: { bg: "var(--surface-alt)", color: "var(--text-faint)", label: "—" },
};

const STATUS_STYLE = {
  Upcoming: { bg: "#dbeafe", color: "#1d4ed8" },
  Live: { bg: "var(--success-soft)", color: "var(--success)" },
  Completed: { bg: "var(--surface-alt)", color: "var(--text-dim)" },
  Draft: { bg: "var(--surface-alt)", color: "var(--text-faint)" },
  Cancelled: { bg: "var(--danger-soft)", color: "var(--danger)" },
};

const FOLLOW_UP_STATUS_STYLE = {
  pending: { bg: "var(--warn-soft)", color: "var(--warn)" },
  called: { bg: "#dbeafe", color: "#1d4ed8" },
  emailed: { bg: "#ede9fe", color: "#6d28d9" },
  voicemail: { bg: "var(--surface-alt)", color: "var(--text-dim)" },
  converted: { bg: "var(--success-soft)", color: "var(--success)" },
  no_answer: { bg: "var(--danger-soft)", color: "var(--danger)" },
};

// ── Atoms ─────────────────────────────────────────────────────────────────────

function Badge({ label, style }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 7px", borderRadius: 4,
      fontSize: 10, fontWeight: 600, whiteSpace: "nowrap",
      background: style?.bg, color: style?.color, ...style,
    }}>{label}</span>
  );
}

function MetricTile({ label, value, color, sub, compact = false }) {
  return (
    <div style={{
      background: color ? `${color}10` : "var(--surface-alt)",
      border: `1px solid ${color ? `${color}28` : "var(--border)"}`,
      borderRadius: 7, padding: compact ? "6px 10px" : "10px 12px",
    }}>
      <div style={{ fontSize: 9, color: "var(--text-faint)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: compact ? 1 : 3 }}>
        {label}
      </div>
      <div style={{ fontSize: compact ? 15 : 20, fontWeight: 800, color: color ?? "var(--text)", fontFamily: "var(--font-mono)", lineHeight: 1.1 }}>
        {value ?? "—"}
      </div>
      {sub && <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Shared form styles ────────────────────────────────────────────────────────

const inputStyle = {
  width: "100%", padding: "6px 9px", borderRadius: 6,
  border: "1px solid var(--border)", background: "var(--surface)",
  fontSize: 12, color: "var(--text)", fontFamily: "inherit", outline: "none",
};
const labelStyle = {
  display: "block", fontSize: 10, fontWeight: 600, color: "var(--text-faint)",
  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4,
};
const formCardStyle = {
  background: "var(--surface-alt)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "14px", marginBottom: 14,
};
const recordCardStyle = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "12px 14px", marginBottom: 8,
};
const addBtnStyle = {
  fontSize: 11, padding: "4px 10px", borderRadius: 5, border: "1px solid var(--border)",
  background: "var(--surface-alt)", color: "var(--text)", cursor: "pointer", fontWeight: 500,
};
const saveBtnStyle = {
  padding: "6px 14px", borderRadius: 6, border: "none",
  background: "var(--accent)", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 12,
};
const cancelBtnStyle = {
  padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)",
  background: "var(--surface-alt)", color: "var(--text-dim)", cursor: "pointer", fontSize: 12,
};
const deleteBtnStyle = {
  background: "none", border: "none", cursor: "pointer",
  color: "var(--text-faint)", fontSize: 13, padding: "2px 4px", flexShrink: 0,
};

// ── Current Edition Tab ───────────────────────────────────────────────────────

function CurrentEditionTab({ edition, insights, compact = false }) {
  if (!edition) return <div style={{ color: "var(--text-faint)", padding: 24 }}>No current edition data.</div>;

  const paid = edition.paid_count ?? 0;
  const pending = edition.pending_count ?? 0;
  const delegates = edition.total_delegates ?? 0;
  const revenue = edition.total_revenue ?? 0;
  const pendValue = edition.pending_value ?? 0;
  const benchmark = edition.benchmark ?? 0;
  const hs = HEALTH_STYLE[edition.health] ?? HEALTH_STYLE.unknown;
  const paidPct = delegates > 0 ? Math.round((paid / delegates) * 100) : 0;

  return (
    <div style={{ padding: compact ? "0 0 8px" : "0 0 24px" }}>
      {/* Edition info strip */}
      <div style={{
        background: "var(--bg)", border: "1px solid var(--border)",
        borderRadius: 8, padding: compact ? "6px 12px" : "10px 14px", marginBottom: compact ? 8 : 14,
        display: "flex", gap: compact ? 14 : 20, flexWrap: "wrap", alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.06em" }}>Code</div>
          <div style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 12, color: "var(--accent)", marginTop: 1 }}>{edition.event_code}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.06em" }}>Edition</div>
          <div style={{ fontWeight: 700, fontSize: 12, color: "var(--text)", marginTop: 1 }}>{edition.year ?? "—"} · {edition.city || "—"}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--text-faint)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.06em" }}>Date</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 1 }}>{fmtDate(edition.event_date)}</div>
        </div>
        <Badge label={edition.status || "—"} style={STATUS_STYLE[edition.status] || {}} />
        <Badge label={hs.label} style={{ bg: hs.bg, color: hs.color }} />
      </div>

      {/* Key metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: compact ? "repeat(6, 1fr)" : "repeat(3, 1fr)", gap: compact ? 6 : 8, marginBottom: compact ? 6 : 8 }}>
        <MetricTile label="Paid" value={paid} color="#10b981" sub={compact ? null : `${paidPct}% rate`} compact={compact} />
        <MetricTile label="Pending" value={pending} color="#f59e0b" compact={compact} />
        <MetricTile label="Free" value={edition.free_count ?? 0} compact={compact} />
        {compact && <MetricTile label="Total" value={delegates} compact />}
        {compact && <MetricTile label="Confirmed" value={edition.confirmed_delegates ?? 0} color="#10b981" compact />}
        {compact && <MetricTile label="Revenue" value={fmtCurrency(revenue)} compact />}
      </div>
      {!compact && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
          <MetricTile label="Total Delegates" value={delegates} />
          <MetricTile label="Confirmed" value={edition.confirmed_delegates ?? 0} color="#10b981" />
          <MetricTile label="Revenue" value={fmtCurrency(revenue)} />
        </div>
      )}

      {/* Benchmark bar */}
      {benchmark > 0 && (
        <div style={{
          background: "var(--surface-alt)", border: "1px solid var(--border)",
          borderRadius: 8, padding: compact ? "7px 10px" : "12px 14px", marginBottom: compact ? 6 : 14,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: compact ? 5 : 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)" }}>Capacity Benchmark</span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: hs.color, fontSize: 13 }}>{benchmark}%</span>
          </div>
          <div style={{ background: "var(--border)", borderRadius: 4, height: 5 }}>
            <div style={{
              width: `${Math.min(benchmark, 100)}%`, height: "100%", borderRadius: 4,
              background: hs.color,
            }} />
          </div>
        </div>
      )}

      {/* Payment timeline */}
      <div style={{ marginBottom: compact ? 6 : 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: compact ? 5 : 8 }}>
          Payment Timeline
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: compact ? 4 : 6 }}>
          {[
            { label: "Today", paid: edition.today_paid ?? 0, rev: edition.today_revenue ?? 0 },
            { label: "7 Days", paid: edition.d7_paid ?? 0, rev: edition.d7_revenue ?? 0 },
            { label: "14 Days", paid: edition.d14_paid ?? 0, rev: edition.d14_revenue ?? 0 },
            { label: "21 Days", paid: edition.d21_paid ?? 0, rev: edition.d21_revenue ?? 0 },
          ].map(({ label, paid: p, rev }) => (
            <div key={label} style={{
              background: p > 0 ? "rgba(16,185,129,0.06)" : "var(--surface-alt)",
              border: `1px solid ${p > 0 ? "rgba(16,185,129,0.2)" : "var(--border)"}`,
              borderRadius: 6, padding: compact ? "5px 8px" : "8px 10px",
            }}>
              <div style={{ fontSize: 9, color: "var(--text-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: compact ? 13 : 15, color: p > 0 ? "#10b981" : "var(--text-faint)", marginTop: 1 }}>{p}</div>
              {!compact && <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 1 }}>{fmtCurrency(rev)}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Pending value */}
      {pendValue > 0 && (
        <div style={{
          background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.25)",
          borderRadius: 7, padding: "10px 14px", marginBottom: 14,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dim)" }}>Pending Revenue</span>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "#f59e0b", fontSize: 14 }}>
            {fmtCurrency(pendValue)}
          </span>
        </div>
      )}

      {/* Performance insights */}
      {insights?.length > 0 && (
        <div style={{
          background: "rgba(99,102,241,0.05)", border: "1px solid rgba(99,102,241,0.2)",
          borderRadius: 8, padding: "12px 14px",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Performance Intelligence
          </div>
          <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 5 }}>
            {insights.map((insight, i) => (
              <li key={i} style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}>{insight}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────

function HistoryTab({ editions, compact = false }) {
  if (!editions?.length) {
    return <div style={{ color: "var(--text-faint)", padding: 24, fontSize: 12 }}>No historical editions found.</div>;
  }

  // editions are sorted newest-first from the API
  const currentEd = editions.find(e => e.is_current) ?? editions[0];
  const prevEd = editions.find(e => !e.is_current);  // most recent past edition
  const maxPaid = Math.max(...editions.map(e => e.paid_count ?? 0), 1);
  const maxRevenue = Math.max(...editions.map(e => e.total_revenue ?? 0), 1);
  const mb = compact ? 10 : 18;

  const ticketDiff = prevEd
    ? (currentEd.paid_count ?? 0) - (prevEd.paid_count ?? 0)
    : null;
  const ticketPct = (prevEd?.paid_count > 0 && ticketDiff != null)
    ? Math.round((ticketDiff / prevEd.paid_count) * 100)
    : null;

  return (
    <div style={{ paddingBottom: compact ? 10 : 24 }}>

      {/* ── Current vs Previous: tickets booked ── */}
      {prevEd && (
        <div style={{ marginBottom: mb }}>
          {!compact && (
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
              Tickets Booked — Current vs Previous Edition
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: compact ? 8 : 12, alignItems: "center" }}>
            {/* Previous edition */}
            <div style={{
              background: "var(--surface-alt)", border: "1px solid var(--border)",
              borderRadius: 8, padding: compact ? "7px 10px" : "12px 14px",
            }}>
              <div style={{ fontSize: 9, color: "var(--text-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: compact ? 2 : 4 }}>
                Prev · {prevEd.year ?? "—"}{!compact && prevEd.city ? ` · ${prevEd.city}` : ""}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: compact ? 18 : 28, fontWeight: 800, color: "var(--text-dim)" }}>
                  {prevEd.paid_count ?? 0}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-faint)" }}>paid</span>
              </div>
              {!compact && (
                <>
                  <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>
                    {prevEd.total_delegates ?? 0} total · {fmtCurrency(prevEd.total_revenue)}
                  </div>
                  <div style={{ marginTop: 8, background: "var(--border)", borderRadius: 3, height: 5 }}>
                    <div style={{ width: `${Math.round(((prevEd.paid_count ?? 0) / maxPaid) * 100)}%`, height: "100%", borderRadius: 3, background: "var(--text-dim)" }} />
                  </div>
                </>
              )}
            </div>

            {/* Delta arrow */}
            <div style={{ textAlign: "center", minWidth: compact ? 44 : 60 }}>
              {ticketPct != null && (
                <>
                  <div style={{ fontSize: compact ? 14 : 18, fontWeight: 800, color: ticketPct >= 0 ? "var(--success)" : "var(--danger)" }}>
                    {ticketPct >= 0 ? "▲" : "▼"}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: compact ? 11 : 13, fontWeight: 700, color: ticketPct >= 0 ? "var(--success)" : "var(--danger)" }}>
                    {ticketPct >= 0 ? "+" : ""}{ticketPct}%
                  </div>
                  {!compact && (
                    <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>
                      {ticketDiff >= 0 ? "+" : ""}{ticketDiff} tickets
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Current edition */}
            <div style={{
              background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.25)",
              borderRadius: 8, padding: compact ? "7px 10px" : "12px 14px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: compact ? 2 : 4 }}>
                <div style={{ fontSize: 9, color: "#6366f1", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Now · {currentEd.year ?? "—"}{!compact && currentEd.city ? ` · ${currentEd.city}` : ""}
                </div>
                <Badge label="CURRENT" style={{ bg: "rgba(99,102,241,0.15)", color: "#6366f1" }} />
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: compact ? 18 : 28, fontWeight: 800, color: "#6366f1" }}>
                  {currentEd.paid_count ?? 0}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-faint)" }}>paid</span>
              </div>
              {!compact && (
                <>
                  <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>
                    {currentEd.total_delegates ?? 0} total · {fmtCurrency(currentEd.total_revenue)}
                  </div>
                  <div style={{ marginTop: 8, background: "rgba(99,102,241,0.15)", borderRadius: 3, height: 5 }}>
                    <div style={{ width: `${Math.round(((currentEd.paid_count ?? 0) / maxPaid) * 100)}%`, height: "100%", borderRadius: 3, background: "#6366f1" }} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Bar charts — side by side in compact, stacked in full ── */}
      {editions.length > 1 && (
        <div style={{ marginBottom: mb, display: compact ? "grid" : "block", gridTemplateColumns: compact ? "1fr 1fr" : undefined, gap: compact ? 10 : undefined }}>

          {/* Tickets booked */}
          <div style={{ marginBottom: compact ? 0 : mb }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: compact ? 6 : 10 }}>
              Tickets
            </div>
            <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: compact ? 44 : 72 }}>
              {[...editions].reverse().map((ed, i) => {
                const pct = maxPaid > 0 ? Math.max(((ed.paid_count ?? 0) / maxPaid) * 100, 4) : 4;
                return (
                  <div key={ed.event_code ?? i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    <div style={{ fontSize: 8, color: ed.is_current ? "#6366f1" : "var(--text-faint)", fontFamily: "var(--font-mono)", fontWeight: ed.is_current ? 700 : 400 }}>
                      {ed.paid_count ?? 0}
                    </div>
                    <div style={{
                      width: "100%", height: `${pct}%`, minHeight: 3, borderRadius: "2px 2px 0 0",
                      background: ed.is_current ? "#6366f1" : "var(--border)", transition: "height 0.3s",
                    }} />
                    <div style={{ fontSize: 8, color: ed.is_current ? "#6366f1" : "var(--text-faint)", fontWeight: ed.is_current ? 700 : 400 }}>
                      {ed.year ?? "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Revenue */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: compact ? 6 : 10 }}>
              Revenue
            </div>
            <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: compact ? 44 : 56 }}>
              {[...editions].reverse().map((ed, i) => {
                const pct = maxRevenue > 0 ? Math.max(((ed.total_revenue ?? 0) / maxRevenue) * 100, 4) : 4;
                return (
                  <div key={ed.event_code ?? i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    {!compact && <div style={{ fontSize: 8, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>{fmtCurrency(ed.total_revenue)}</div>}
                    <div style={{
                      width: "100%", height: `${pct}%`, minHeight: 3, borderRadius: "2px 2px 0 0",
                      background: ed.is_current ? "var(--accent)" : "var(--border)", transition: "height 0.3s",
                    }} />
                    <div style={{ fontSize: 8, color: ed.is_current ? "var(--accent)" : "var(--text-faint)", fontWeight: ed.is_current ? 700 : 400 }}>
                      {ed.year ?? "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Editions table ── */}
      <div style={{ overflowX: "auto", marginTop: compact ? 8 : 12 }}>
        <table style={{ width: "auto", minWidth: compact ? 300 : 380, borderCollapse: "collapse", fontSize: compact ? 11 : 12, borderRadius: 7, overflow: "hidden", border: "1px solid var(--border)" }}>
          <thead>
            <tr style={{ background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
              {[
                { h: "Year", align: "left", w: compact ? 70 : 80 },
                { h: "Status", align: "left", w: compact ? 90 : 110 },
                { h: "Paid", align: "right", w: compact ? 60 : 80 },
                { h: "Pending", align: "right", w: compact ? 60 : 80 },
              ].map(({ h, align, w }) => (
                <th key={h} style={{
                  padding: compact ? "5px 10px" : "7px 14px", textAlign: align, width: w,
                  fontWeight: 700, fontSize: 10, textTransform: "uppercase",
                  letterSpacing: "0.06em", color: "var(--text-faint)", whiteSpace: "nowrap",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {editions.map((ed, idx) => {
              const tdP = compact ? "5px 10px" : "8px 14px";
              return (
                <tr
                  key={ed.event_code ?? idx}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: ed.is_current
                      ? "rgba(99,102,241,0.06)"
                      : idx % 2 === 0 ? "var(--surface)" : "var(--bg)",
                  }}
                >
                  <td style={{ padding: tdP, fontFamily: "var(--font-mono)", fontWeight: ed.is_current ? 800 : 600, color: ed.is_current ? "#6366f1" : "var(--text)", whiteSpace: "nowrap" }}>
                    {ed.year ?? "—"}
                    {ed.is_current && <span style={{ marginLeft: 5, fontSize: 8, background: "#6366f1", color: "#fff", borderRadius: 3, padding: "1px 4px" }}>NOW</span>}
                  </td>
                  <td style={{ padding: tdP }}>
                    <Badge label={ed.status || "—"} style={STATUS_STYLE[ed.status] || {}} />
                  </td>
                  <td style={{ padding: tdP, textAlign: "right", fontFamily: "var(--font-mono)", color: "#10b981", fontWeight: 700 }}>
                    {ed.paid_count ?? 0}
                  </td>
                  <td style={{ padding: tdP, textAlign: "right", fontFamily: "var(--font-mono)", color: "#f59e0b" }}>
                    {ed.pending_count ?? 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Reps Tab ──────────────────────────────────────────────────────────────────

function RepsTab({ reps }) {
  if (!reps?.length) return <div style={{ color: "var(--text-faint)", fontSize: 12, padding: "20px 0" }}>No rep data available.</div>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
      <thead>
        <tr>{["Rep", "Paid", "Pending", "Revenue", "Pend £"].map(h => (
          <th key={h} style={{ textAlign: h === "Rep" ? "left" : "right", padding: "6px 10px", borderBottom: "1px solid var(--border)", color: "var(--text-faint)", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
        ))}</tr>
      </thead>
      <tbody>
        {reps.map((r, i) => (
          <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
            <td style={{ padding: "8px 10px", fontWeight: 500 }}>{r.rep_name}</td>
            <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--success)" }}>{r.paid_bookings}</td>
            <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--warn)" }}>{r.pending_bookings}</td>
            <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--font-mono)" }}>{fmtCurrency(r.total_revenue)}</td>
            <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--warn)" }}>{fmtCurrency(r.pending_value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

export function MasterEventDrawer({ masterCode, currentEventCode, onClose, inline = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("current");
  const [adding, setAdding] = useState(null);
  const [formData, setFormData] = useState({});

  const codeForOps = currentEventCode; // event_code to use for creating ops records

  const load = useCallback(() => {
    if (!masterCode) return;
    setLoading(true);
    eventPerformanceApi.masterHistory(masterCode)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [masterCode]);

  useEffect(() => { load(); }, [load]);

  const submitFollowUp = async () => {
    await eventPerformanceApi.followUps.create(codeForOps, formData);
    setAdding(null); setFormData({}); load();
  };
  const submitMailshot = async () => {
    await eventPerformanceApi.mailshots.create(codeForOps, formData);
    setAdding(null); setFormData({}); load();
  };
  const submitNote = async () => {
    await eventPerformanceApi.notes.create(codeForOps, { note: formData.note });
    setAdding(null); setFormData({}); load();
  };
  const deleteFollowUp = async (id) => { await eventPerformanceApi.followUps.delete(codeForOps, id); load(); };
  const deleteMailshot = async (id) => { await eventPerformanceApi.mailshots.delete(codeForOps, id); load(); };
  const deleteNote = async (id) => { await eventPerformanceApi.notes.delete(codeForOps, id); load(); };

  const currentEdition = data?.editions?.find(e => e.is_current) ?? data?.editions?.[0];
  const hs = HEALTH_STYLE[currentEdition?.health] ?? HEALTH_STYLE.unknown;

  return (
    <>
      {!inline && <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)", zIndex: 900 }} />}
      <div style={inline ? {
        background: "var(--surface)", display: "flex", flexDirection: "column",
        borderTop: "2px solid var(--accent)", borderBottom: "1px solid var(--border)",
      } : {
        position: "fixed", top: 0, right: 0, bottom: 0, width: 920,
        background: "var(--surface)", borderLeft: "1px solid var(--border)",
        display: "flex", flexDirection: "column", zIndex: 901, overflowY: "auto",
      }}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={{ padding: inline ? "8px 16px 6px" : "18px 24px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", minWidth: 0 }}>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: inline ? 11 : 13, fontWeight: 800,
                color: "var(--accent)", background: "rgba(99,102,241,0.1)",
                border: "1px solid rgba(99,102,241,0.25)", padding: inline ? "2px 7px" : "3px 9px", borderRadius: 5, flexShrink: 0,
              }}>{masterCode}</span>
              <span style={{ fontSize: inline ? 13 : 18, fontWeight: 700, color: "var(--text)", lineHeight: 1.2 }}>
                {loading ? "Loading…" : (currentEdition?.event_name || masterCode)}
              </span>
              {currentEdition && <Badge label={currentEdition.status || "—"} style={STATUS_STYLE[currentEdition.status] || {}} />}
              {currentEdition && <Badge label={hs.label} style={{ bg: hs.bg, color: hs.color }} />}
              {data && !inline && (
                <span style={{
                  fontSize: 10, fontWeight: 600, color: "var(--text-faint)",
                  background: "var(--surface-alt)", border: "1px solid var(--border)",
                  borderRadius: 4, padding: "2px 6px",
                }}>
                  {data.total_editions} edition{data.total_editions !== 1 ? "s" : ""}
                </span>
              )}
              {/* Inline: quick metric pills in the header row itself */}
              {inline && currentEdition && (
                <div style={{ display: "flex", gap: 14, marginLeft: 8, flexWrap: "wrap" }}>
                  {[
                    { label: "Paid", value: currentEdition.paid_count ?? 0 },
                    { label: "Pending", value: currentEdition.pending_count ?? 0 },
                    { label: "Delegates", value: currentEdition.total_delegates ?? 0 },
                    { label: "Revenue", value: fmtCurrency(currentEdition.total_revenue) },
                    { label: "Benchmark", value: `${currentEdition.benchmark ?? 0}%` },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                      <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-faint)", fontWeight: 600 }}>{label}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: inline ? 11 : 20, padding: 4, lineHeight: 1, fontWeight: inline ? 500 : 400, flexShrink: 0 }}>{inline ? "▲ Collapse" : "✕"}</button>
          </div>

          {/* Quick metric pills — full drawer only */}
          {!inline && currentEdition && (
            <div style={{ display: "flex", gap: 20, marginTop: 14, flexWrap: "wrap" }}>
              {[
                { label: "Paid", value: currentEdition.paid_count ?? 0 },
                { label: "Pending", value: currentEdition.pending_count ?? 0 },
                { label: "Delegates", value: currentEdition.total_delegates ?? 0 },
                { label: "Revenue", value: fmtCurrency(currentEdition.total_revenue) },
                { label: "Pend £", value: fmtCurrency(currentEdition.pending_value) },
                { label: "Benchmark", value: `${currentEdition.benchmark ?? 0}%` },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-faint)", fontWeight: 600 }}>{label}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────── */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", flexShrink: 0, paddingLeft: inline ? 16 : 24 }}>
          {[
            { id: "current", label: "Current Performance" },
            { id: "history", label: "Edition Comparison" },
            { id: "reps", label: "Reps" },
            { id: "follow-ups", label: "Follow-Ups" },
            { id: "mailshots", label: "Mailshots" },
            { id: "notes", label: "Notes" },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => { setTab(id); setAdding(null); }}
              style={{
                padding: inline ? "6px 10px" : "10px 14px", border: "none", background: "none",
                fontSize: inline ? 11 : 12, fontWeight: tab === id ? 600 : 400,
                color: tab === id ? "var(--accent)" : "var(--text-faint)",
                borderBottom: tab === id ? "2px solid var(--accent)" : "2px solid transparent",
                cursor: "pointer", whiteSpace: "nowrap",
              }}
            >{label}</button>
          ))}
        </div>

        {/* ── Content ────────────────────────────────────────────────── */}
        <div style={{ padding: inline ? "10px 16px 14px" : "16px 24px", ...(inline ? { height: 300, overflowY: "auto" } : { flex: 1, overflowY: "auto" }) }}>
          {loading && <div style={{ color: "var(--text-faint)", padding: "24px 0", textAlign: "center" }}>Loading…</div>}

          {!loading && tab === "current" && (
            <CurrentEditionTab edition={currentEdition} insights={data?.insights} compact={inline} />
          )}

          {!loading && tab === "history" && (
            <HistoryTab editions={data?.editions} compact={inline} />
          )}

          {!loading && tab === "reps" && <RepsTab reps={data?.reps} />}

          {/* Follow-Ups */}
          {!loading && tab === "follow-ups" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Follow-Up Records</div>
                <button onClick={() => setAdding(adding === "followup" ? null : "followup")} style={addBtnStyle}>+ Add</button>
              </div>
              {adding === "followup" && (
                <div style={formCardStyle}>
                  {[["contact_name", "Contact Name", "text"], ["company", "Company", "text"], ["email", "Email", "email"], ["phone", "Phone", "text"]].map(([k, l, t]) => (
                    <div key={k} style={{ marginBottom: 8 }}>
                      <label style={labelStyle}>{l}</label>
                      <input type={t} value={formData[k] || ""} onChange={e => setFormData(p => ({ ...p, [k]: e.target.value }))} style={inputStyle} />
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Date</label>
                      <input type="date" value={formData.follow_up_date || ""} onChange={e => setFormData(p => ({ ...p, follow_up_date: e.target.value }))} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Status</label>
                      <select value={formData.status || "pending"} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))} style={inputStyle}>
                        {["pending", "called", "emailed", "voicemail", "converted", "no_answer"].map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Notes</label>
                    <textarea value={formData.notes || ""} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={submitFollowUp} style={saveBtnStyle}>Save</button>
                    <button onClick={() => { setAdding(null); setFormData({}); }} style={cancelBtnStyle}>Cancel</button>
                  </div>
                </div>
              )}
              {(!data?.follow_ups?.length && adding !== "followup") && <div style={{ color: "var(--text-faint)", fontSize: 12, padding: "16px 0" }}>No follow-ups recorded.</div>}
              {data?.follow_ups?.map(fu => (
                <div key={fu.id} style={recordCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{fu.contact_name || "—"} {fu.company && <span style={{ fontWeight: 400, color: "var(--text-dim)", fontSize: 11 }}>· {fu.company}</span>}</div>
                      <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{fu.email} {fu.phone && "· " + fu.phone}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Badge label={fu.status} style={FOLLOW_UP_STATUS_STYLE[fu.status] || {}} />
                      <span style={{ fontSize: 10, color: "var(--text-faint)" }}>{fmtDate(fu.follow_up_date)}</span>
                      <button onClick={() => deleteFollowUp(fu.id)} style={deleteBtnStyle}>✕</button>
                    </div>
                  </div>
                  {fu.notes && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6, lineHeight: 1.5 }}>{fu.notes}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Mailshots */}
          {!loading && tab === "mailshots" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Mailshot Records</div>
                <button onClick={() => setAdding(adding === "mailshot" ? null : "mailshot")} style={addBtnStyle}>+ Add</button>
              </div>
              {adding === "mailshot" && (
                <div style={formCardStyle}>
                  <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Type</label>
                      <select value={formData.mailshot_type || "invite"} onChange={e => setFormData(p => ({ ...p, mailshot_type: e.target.value }))} style={inputStyle}>
                        {["invite", "reminder", "thank_you", "follow_up", "promotional", "other"].map(t => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Date Sent</label>
                      <input type="date" value={formData.sent_at || ""} onChange={e => setFormData(p => ({ ...p, sent_at: e.target.value }))} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={labelStyle}>Subject</label>
                    <input type="text" value={formData.subject || ""} onChange={e => setFormData(p => ({ ...p, subject: e.target.value }))} style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                    {[["target_count", "Sent"], ["opened_count", "Opened"], ["clicked_count", "Clicked"]].map(([k, l]) => (
                      <div key={k} style={{ flex: 1 }}>
                        <label style={labelStyle}>{l}</label>
                        <input type="number" min="0" value={formData[k] || ""} onChange={e => setFormData(p => ({ ...p, [k]: parseInt(e.target.value) || 0 }))} style={inputStyle} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={submitMailshot} style={saveBtnStyle}>Save</button>
                    <button onClick={() => { setAdding(null); setFormData({}); }} style={cancelBtnStyle}>Cancel</button>
                  </div>
                </div>
              )}
              {(!data?.mailshots?.length && adding !== "mailshot") && <div style={{ color: "var(--text-faint)", fontSize: 12, padding: "16px 0" }}>No mailshots recorded.</div>}
              {data?.mailshots?.map(ms => (
                <div key={ms.id} style={recordCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{ms.subject || ms.mailshot_type.replace("_", " ")}</div>
                      <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                        Sent: {fmtDate(ms.sent_at)} · <span style={{ color: "var(--text-dim)" }}>{ms.target_count} sent</span> · <span style={{ color: "var(--success)" }}>{ms.opened_count} opened ({ms.open_rate}%)</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <Badge label={ms.mailshot_type.replace("_", " ")} style={{ bg: "var(--surface-alt)", color: "var(--text-dim)" }} />
                      <button onClick={() => deleteMailshot(ms.id)} style={deleteBtnStyle}>✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          {!loading && tab === "notes" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Notes</div>
                <button onClick={() => setAdding(adding === "note" ? null : "note")} style={addBtnStyle}>+ Add</button>
              </div>
              {adding === "note" && (
                <div style={formCardStyle}>
                  <textarea
                    placeholder="Add a note…"
                    value={formData.note || ""}
                    onChange={e => setFormData(p => ({ ...p, note: e.target.value }))}
                    rows={3}
                    style={{ ...inputStyle, resize: "vertical", marginBottom: 10 }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={submitNote} style={saveBtnStyle}>Save</button>
                    <button onClick={() => { setAdding(null); setFormData({}); }} style={cancelBtnStyle}>Cancel</button>
                  </div>
                </div>
              )}
              {(!data?.notes?.length && adding !== "note") && <div style={{ color: "var(--text-faint)", fontSize: 12, padding: "16px 0" }}>No notes recorded.</div>}
              {data?.notes?.map(n => (
                <div key={n.id} style={recordCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>{n.note}</div>
                    <button onClick={() => deleteNote(n.id)} style={deleteBtnStyle}>✕</button>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 6 }}>{n.created_by_name} · {new Date(n.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
