import { useState, useEffect } from "react";
import { editionBookingsApi } from "../../api";
import { Drawer } from "../ui/Drawer";
import { InfoSection, InfoGrid, InfoItem } from "../ui/InfoCard";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(str) {
  if (!str) return "—";
  const d = new Date(str + "T00:00:00");
  if (isNaN(d.getTime())) return str;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMoney(amount) {
  if (amount == null) return "—";
  return `$${Number(amount).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

const STATUS_COLORS = {
  "Paid":               "#10b981",
  "Paid (Transferred)": "#10b981",
  "Credit Transferred": "#10b981",
  "Free":               "#10b981",
  "Pending":            "#f59e0b",
  "Credit Pending":     "#f59e0b",
  "Credit Pending Free": "#f59e0b",
  "Cancelled":          "#ef4444",
  "Refunded":           "#ef4444",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function MetricTile({ label, value, color, sub }) {
  return (
    <div style={{
      background: color ? `${color}10` : "#f8fafc",
      border: `1px solid ${color ? `${color}28` : "#e2e8f0"}`,
      borderRadius: 7,
      padding: "10px 12px",
    }}>
      <div style={{
        fontSize: 9, color: "#94a3b8", fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 18, fontWeight: 800,
        color: color ?? "#1e293b",
        fontFamily: "monospace", lineHeight: 1.1,
      }}>
        {value ?? "—"}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}

function BookingRow({ b }) {
  const color = STATUS_COLORS[b.payment_status] ?? "#94a3b8";
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 100px 76px 38px",
      gap: 6,
      alignItems: "center",
      padding: "7px 8px",
      borderRadius: 5,
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: "#1e293b",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {b.company_name || b.contact_name || "—"}
        </div>
        <div style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>
          {b.invoice_number} · {fmtDate(b.invoice_date)}
        </div>
      </div>
      <span style={{
        fontSize: 9, fontWeight: 700, color,
        background: `${color}14`, border: `1px solid ${color}30`,
        borderRadius: 4, padding: "2px 5px", textAlign: "center",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {b.payment_status}
      </span>
      <span style={{
        fontSize: 11, color: "#64748b",
        textAlign: "right", fontFamily: "monospace",
      }}>
        {b.total_amount != null
          ? `${b.currency ?? ""} ${Number(b.total_amount).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
          : "—"}
      </span>
      <span style={{ fontSize: 10, color: "#94a3b8", textAlign: "right" }}>
        {(b.actual_delegates ?? b.delegate_count ?? 0)}d
      </span>
    </div>
  );
}

// ── Main drawer ───────────────────────────────────────────────────────────────

export function EditionBookingDrawer({ eventId, edition, onClose }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!eventId || !edition) { setData(null); return; }
    setLoading(true);
    editionBookingsApi.getForYear(eventId, edition.year)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [eventId, edition?.year]);

  if (!edition) return null;

  const d         = data ?? edition;
  const total     = d.total_bookings  ?? 0;
  const paid      = d.total_paid      ?? 0;
  const pending   = d.total_pending   ?? 0;
  const canc      = d.total_cancelled ?? 0;
  const unpaid    = d.total_unpaid    ?? 0;
  const sales     = d.total_sales     ?? 0;
  const delegates = d.total_delegates ?? 0;
  const paidPct   = total > 0 ? Math.round((paid / total) * 100) : 0;

  const bookings     = data?.bookings ?? [];
  const bookingCount = data?.total ?? 0;

  return (
    <Drawer
      open={!!edition}
      onClose={onClose}
      title={`${edition.year} Edition — Bookings`}
      subtitle={[edition.location, "Invoice-date mapping"].filter(Boolean).join(" · ")}
    >
      {/* ── Section 1: Edition Window ────────────────────────────────── */}
      <InfoSection title="Edition Window">
        <InfoGrid>
          <InfoItem label="Year"         value={String(edition.year)} mono />
          <InfoItem label="Location"     value={edition.location || "—"} />
          <InfoItem label="Edition Date" value={fmtDate(edition.edition_date)} mono />
          <InfoItem label="Window Start" value={edition.window_start ? fmtDate(edition.window_start) : "All earlier"} mono />
          <InfoItem label="Window End"   value={fmtDate(edition.window_end)} mono />
          <InfoItem label="Date Source"  value={edition.source ?? "—"} />
        </InfoGrid>
        <p style={{ margin: "8px 0 0", fontSize: 10, color: "#94a3b8", lineHeight: 1.5 }}>
          Bookings are assigned to this edition when their{" "}
          <strong style={{ color: "#64748b" }}>invoice date</strong> falls within
          the window above. If no invoice date exists, the{" "}
          <strong style={{ color: "#64748b" }}>booking created date</strong> is used.
        </p>
      </InfoSection>

      {/* ── Section 2: Metrics ───────────────────────────────────────── */}
      <InfoSection title="Edition Metrics">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 8 }}>
          <MetricTile label="Total"     value={total}  />
          <MetricTile label="Paid"      value={paid}   color="#10b981" sub={`${paidPct}%`} />
          <MetricTile label="Unpaid"    value={unpaid} color="#f59e0b" />
          <MetricTile label="Cancelled" value={canc}   color="#ef4444" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <MetricTile label="Pending"   value={pending}   color="#6366f1" />
          <MetricTile label="Delegates" value={delegates} />
          <MetricTile label="Revenue"   value={fmtMoney(sales)} />
        </div>

        {total > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
            <div style={{ flex: 1, background: "#e2e8f0", borderRadius: 3, height: 5 }}>
              <div style={{
                width: `${paidPct}%`, height: "100%", borderRadius: 3,
                background: paidPct >= 80 ? "#10b981" : paidPct >= 50 ? "#f59e0b" : "#ef4444",
              }} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", minWidth: 44, textAlign: "right" }}>
              {paidPct}% paid
            </span>
          </div>
        )}
      </InfoSection>

      {/* ── Section 3: Booking List ──────────────────────────────────── */}
      <InfoSection title={`Bookings (${loading ? "…" : bookingCount})`}>
        {loading ? (
          <div style={{ color: "#94a3b8", fontSize: 11, padding: "6px 0" }}>Loading bookings…</div>
        ) : bookings.length === 0 ? (
          <div style={{ color: "#94a3b8", fontSize: 12, padding: "8px 0" }}>
            No bookings assigned to this edition.
          </div>
        ) : (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 100px 76px 38px",
              gap: 6,
              padding: "0 8px 5px",
              borderBottom: "1px solid #e2e8f0",
              marginBottom: 4,
            }}>
              {["Company / Invoice", "Status", "Amount", "Dels"].map((h) => (
                <span key={h} style={{
                  fontSize: 9, fontWeight: 700, color: "#94a3b8",
                  textTransform: "uppercase", letterSpacing: "0.05em",
                }}>
                  {h}
                </span>
              ))}
            </div>
            <div style={{
              display: "flex", flexDirection: "column", gap: 3,
              maxHeight: 460, overflowY: "auto",
            }}>
              {bookings.map((b) => (
                <BookingRow key={b.invoice_number ?? b.id} b={b} />
              ))}
            </div>
            <div style={{
              marginTop: 6, fontSize: 10, color: "#94a3b8",
              display: "flex", justifyContent: "space-between",
            }}>
              <span>
                {bookings.length} booking{bookings.length !== 1 ? "s" : ""} · assigned via invoice date
              </span>
              {(data?.orphaned_count ?? 0) > 0 && (
                <span style={{ color: "#f59e0b" }}>
                  {data.orphaned_count} unassigned
                </span>
              )}
            </div>
          </>
        )}
      </InfoSection>
    </Drawer>
  );
}
