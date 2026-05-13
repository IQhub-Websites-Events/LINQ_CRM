import { Drawer } from "../ui/Drawer";
import { InfoSection, InfoGrid, InfoItem } from "../ui/InfoCard";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(str) {
  if (!str) return "—";
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtCurrency(amount, currency) {
  if (amount == null) return "—";
  const sym = { USD: "$", GBP: "£", EUR: "€", AED: "AED ", SGD: "S$", INR: "₹" }[currency] ?? "";
  return `${sym}${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricBlock({ label, value, color }) {
  return (
    <div style={{
      background: color ? `${color}10` : "#f8fafc",
      border: `1px solid ${color ? `${color}30` : "#e2e8f0"}`,
      borderRadius: 7,
      padding: "10px 12px",
      display: "flex",
      flexDirection: "column",
      gap: 2,
    }}>
      <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
      <span style={{ fontSize: 20, fontWeight: 800, color: color ?? "#1e293b", fontFamily: "monospace", lineHeight: 1.2 }}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function ActivityBar({ label, value7, value15, value30 }) {
  const max = Math.max(value7, value15, value30, 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </span>
      {[["7 days", value7], ["15 days", value15], ["30 days", value30]].map(([lbl, v]) => (
        <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "#94a3b8", width: 44, flexShrink: 0 }}>{lbl}</span>
          <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 3, height: 6, overflow: "hidden" }}>
            <div style={{
              width: `${Math.round((v / max) * 100)}%`,
              height: "100%",
              background: "var(--vz-primary)",
              borderRadius: 3,
              minWidth: v > 0 ? 4 : 0,
            }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#1e293b", width: 24, textAlign: "right", fontFamily: "monospace" }}>
            {v}
          </span>
        </div>
      ))}
    </div>
  );
}

function VerificationBadge({ status }) {
  const map = {
    verified:  { bg: "#10b98118", border: "#10b98140", color: "#10b981", label: "Verified" },
    pending:   { bg: "#f59e0b18", border: "#f59e0b40", color: "#f59e0b", label: "Pending" },
    unmatched: { bg: "#ef444418", border: "#ef444440", color: "#ef4444", label: "Unmatched" },
    failed:    { bg: "#64748b18", border: "#64748b40", color: "#64748b", label: "Failed" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color: s.color,
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 4, padding: "1px 6px",
    }}>
      {s.label}
    </span>
  );
}

function ConfPct({ value }) {
  const pct = Math.round((value ?? 0) * 100);
  const color = pct >= 80 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}18`,
      border: `1px solid ${color}40`, borderRadius: 4, padding: "1px 5px" }}>
      {pct}%
    </span>
  );
}

function BookingRow({ booking }) {
  const paid = ["Paid", "Paid (Transferred)", "Credit Transferred", "Free"].includes(booking.payment_status);
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 110px 70px 55px",
      gap: 6,
      alignItems: "center",
      padding: "6px 8px",
      borderRadius: 5,
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
    }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#1e293b" }}>
          {booking.company_name || booking.contact_name || "—"}
        </div>
        <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>
          {booking.invoice_number}
        </div>
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700,
        color: paid ? "#10b981" : "#f59e0b",
        background: paid ? "#10b98112" : "#f59e0b12",
        border: `1px solid ${paid ? "#10b98130" : "#f59e0b30"}`,
        borderRadius: 4, padding: "2px 6px", textAlign: "center",
      }}>
        {booking.payment_status}
      </span>
      <span style={{ fontSize: 11, color: "#64748b", textAlign: "right" }}>
        {fmtCurrency(booking.total_amount, booking.currency)}
      </span>
      <span style={{ fontSize: 10, color: "#94a3b8", textAlign: "right" }}>
        {booking.delegate_count ?? 0}d
      </span>
    </div>
  );
}

function DelegateRow({ delegate }) {
  const att = delegate.attendance ?? "Pending";
  const attColor = att === "Confirmed" ? "#10b981" : att === "Cancelled" ? "#ef4444" : "#f59e0b";
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 90px 80px",
      gap: 6,
      alignItems: "center",
      padding: "6px 8px",
      borderRadius: 5,
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
    }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#1e293b" }}>
          {[delegate.first_name, delegate.last_name].filter(Boolean).join(" ") || "—"}
        </div>
        <div style={{ fontSize: 10, color: "#94a3b8" }}>{delegate.company_name_raw || "—"}</div>
      </div>
      <span style={{ fontSize: 10, color: "#64748b" }}>{delegate.ticket_package || "—"}</span>
      <span style={{
        fontSize: 10, fontWeight: 700, color: attColor,
        background: `${attColor}12`, border: `1px solid ${attColor}30`,
        borderRadius: 4, padding: "2px 6px", textAlign: "center",
      }}>
        {att}
      </span>
    </div>
  );
}

// ── Main drawer ───────────────────────────────────────────────────────────────

export function HistoricalEditionDrawer({ edition, onClose }) {
  if (!edition) return null;

  const m  = edition.metrics ?? {};
  const refs = edition.references ?? [];

  const paidPct = m.total_bookings > 0
    ? Math.round((m.paid_entries / m.total_bookings) * 100)
    : 0;

  return (
    <Drawer
      open={!!edition}
      onClose={onClose}
      title={`${edition.event_code} — ${edition.year}`}
      subtitle={edition.location ? `${edition.location} · Historical Edition` : "Historical Edition"}
    >
      {/* ── SECTION 1: Edition Summary ──────────────────────────────── */}
      <InfoSection title="Edition Summary">
        <InfoGrid>
          <InfoItem label="Year"           value={String(edition.year)} mono />
          <InfoItem label="Location"       value={edition.location || "—"} />
          <InfoItem label="Event Code"     value={edition.event_code} mono />
          <InfoItem label="References"     value={`${refs.length} record${refs.length !== 1 ? "s" : ""}`} mono />
        </InfoGrid>

        {refs.length > 0 && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {/* Ref table header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "70px 90px 1fr 80px 42px",
              gap: 6,
              padding: "0 8px 4px",
              borderBottom: "1px solid #e2e8f0",
            }}>
              {["Month", "Orig. Code", "Location", "Source", "Conf"].map((h) => (
                <span key={h} style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {h}
                </span>
              ))}
            </div>
            {refs.map((r) => (
              <div key={r.id} style={{
                display: "grid",
                gridTemplateColumns: "70px 90px 1fr 80px 42px",
                gap: 6,
                alignItems: "center",
                padding: "5px 8px",
                borderRadius: 5,
                background: r.verification_status === "verified"
                  ? "rgba(16,185,129,0.04)"
                  : "rgba(148,163,184,0.06)",
                border: `1px solid ${r.verification_status === "verified" ? "rgba(16,185,129,0.18)" : "#e2e8f0"}`,
              }}>
                <span style={{ fontSize: 10, color: "#64748b" }}>{r.event_month}</span>
                <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.original_event_code}
                </span>
                <span style={{ fontSize: 10, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.event_location || "—"}
                </span>
                <span style={{ fontSize: 10, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.source_pdf}
                </span>
                <ConfPct value={r.matched_confidence} />
              </div>
            ))}
          </div>
        )}
      </InfoSection>

      {/* ── SECTION 2: Booking Metrics ──────────────────────────────── */}
      <InfoSection title="Booking Metrics">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
          <MetricBlock label="Total Bookings" value={m.total_bookings ?? 0} />
          <MetricBlock label="Paid"           value={m.paid_entries ?? 0}   color="#10b981" />
          <MetricBlock label="Unpaid"         value={m.unpaid_entries ?? 0} color="#f59e0b" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <MetricBlock label="Delegates" value={m.total_delegates ?? 0} />
          <div style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 7,
            padding: "10px 12px",
          }}>
            <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 4 }}>
              Payment Rate
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ flex: 1, background: "#e2e8f0", borderRadius: 3, height: 6 }}>
                <div style={{
                  width: `${paidPct}%`,
                  height: "100%",
                  background: paidPct >= 80 ? "#10b981" : paidPct >= 50 ? "#f59e0b" : "#ef4444",
                  borderRadius: 3,
                }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", fontFamily: "monospace" }}>
                {paidPct}%
              </span>
            </div>
          </div>
        </div>

        <InfoGrid style={{ marginTop: 10 }}>
          <InfoItem label="Last Booking"  value={fmtDate(m.last_booking_date)}  mono />
          <InfoItem label="Last Payment"  value={fmtDate(m.last_payment_date)}  mono />
        </InfoGrid>
      </InfoSection>

      {/* ── SECTION 3: Activity Windows ─────────────────────────────── */}
      <InfoSection title="Activity Windows">
        <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "2px 0" }}>
          <ActivityBar
            label="Booking Activity (final days)"
            value7={m.booking_activity_7_days  ?? 0}
            value15={m.booking_activity_15_days ?? 0}
            value30={m.booking_activity_30_days ?? 0}
          />
          <ActivityBar
            label="Payment Activity (final days)"
            value7={m.payment_activity_7_days  ?? 0}
            value15={m.payment_activity_15_days ?? 0}
            value30={m.payment_activity_30_days ?? 0}
          />
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 10, color: "#94a3b8", lineHeight: 1.4 }}>
          Activity windows are relative to the final booking date for this edition,
          showing how concentrated activity was in the closing period.
        </p>
      </InfoSection>

      {/* ── SECTION 4: Historical Operations ────────────────────────── */}
      {(m.latest_bookings?.length > 0 || m.latest_delegates?.length > 0) && (
        <InfoSection title="Historical Operations">
          {m.latest_bookings?.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: "#64748b",
                textTransform: "uppercase", letterSpacing: "0.05em",
                marginBottom: 6,
              }}>
                Latest Bookings
              </div>
              {/* Column headers */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 110px 70px 55px",
                gap: 6,
                padding: "0 8px 4px",
                borderBottom: "1px solid #e2e8f0",
                marginBottom: 4,
              }}>
                {["Company / Invoice", "Status", "Amount", "Dels"].map((h) => (
                  <span key={h} style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {h}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {m.latest_bookings.map((b, i) => (
                  <BookingRow key={b.invoice_number ?? i} booking={b} />
                ))}
              </div>
            </div>
          )}

          {m.latest_delegates?.length > 0 && (
            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, color: "#64748b",
                textTransform: "uppercase", letterSpacing: "0.05em",
                marginBottom: 6,
              }}>
                Latest Delegates
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 90px 80px",
                gap: 6,
                padding: "0 8px 4px",
                borderBottom: "1px solid #e2e8f0",
                marginBottom: 4,
              }}>
                {["Name / Company", "Package", "Attendance"].map((h) => (
                  <span key={h} style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {h}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {m.latest_delegates.map((d, i) => (
                  <DelegateRow key={d.email ?? i} delegate={d} />
                ))}
              </div>
            </div>
          )}

          {m.latest_bookings?.length === 0 && m.latest_delegates?.length === 0 && (
            <div style={{ color: "#94a3b8", fontSize: 12, padding: "8px 0" }}>
              No booking or delegate records linked to this edition.
            </div>
          )}
        </InfoSection>
      )}
    </Drawer>
  );
}
