import { Drawer } from "../ui/Drawer";
import { InfoSection, InfoGrid, InfoItem } from "../ui/InfoCard";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(str) {
  if (!str) return "—";
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtMoney(v) {
  if (v == null) return "—";
  return "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function growthColor(pct) {
  if (pct == null) return "#94a3b8";
  return pct >= 0 ? "#10b981" : "#ef4444";
}

function GrowthPill({ pct, label }) {
  if (pct == null) return <span style={{ fontSize: 11, color: "#94a3b8" }}>—</span>;
  const col = growthColor(pct);
  const sign = pct >= 0 ? "+" : "";
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color: col,
      background: `${col}12`, border: `1px solid ${col}30`,
      borderRadius: 4, padding: "2px 7px",
    }}>
      {sign}{pct.toFixed(1)}%{label ? ` ${label}` : ""}
    </span>
  );
}

function MetricMini({ label, value, color }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: color ?? "#1e293b", fontFamily: "monospace" }}>
        {value ?? "—"}
      </div>
    </div>
  );
}

function SalesBar({ editions }) {
  if (!editions || editions.length === 0) return null;
  const maxSales = Math.max(...editions.map(e => e.total_sales ?? 0), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[...editions].reverse().map((ed) => {
        const pct = Math.round(((ed.total_sales ?? 0) / maxSales) * 100);
        const col = growthColor(ed.growth_pct);
        return (
          <div key={ed.year} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Year label */}
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--vz-primary)", fontFamily: "monospace", width: 36, flexShrink: 0 }}>
              {ed.year}
            </span>
            {/* Bar */}
            <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 4, height: 8, overflow: "hidden" }}>
              <div style={{
                width: `${pct}%`, height: "100%",
                background: "var(--vz-primary)", borderRadius: 4,
                minWidth: pct > 0 ? 6 : 0,
              }} />
            </div>
            {/* Sales */}
            <span style={{ fontSize: 11, fontWeight: 700, color: "#1e293b", fontFamily: "monospace", width: 72, textAlign: "right", flexShrink: 0 }}>
              {fmtMoney(ed.total_sales)}
            </span>
            {/* Growth pill */}
            <div style={{ width: 60, flexShrink: 0, textAlign: "right" }}>
              <GrowthPill pct={ed.growth_pct} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EditionDetailRow({ ed, isFirst }) {
  const paid_pct = ed.total_bookings > 0
    ? Math.round((ed.total_paid / ed.total_bookings) * 100)
    : 0;

  return (
    <div style={{
      borderRadius: 8,
      border: "1px solid #e2e8f0",
      padding: "12px 14px",
      background: isFirst ? "rgba(64,81,137,0.03)" : "#f8fafc",
      marginBottom: 6,
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: "var(--vz-primary)", fontFamily: "monospace" }}>
            {ed.year}
          </span>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>→</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>
            {ed.location || "—"}
          </span>
          {isFirst && (
            <span style={{
              fontSize: 9, fontWeight: 700, color: "#10b981",
              background: "#10b98112", border: "1px solid #10b98130",
              borderRadius: 4, padding: "1px 6px",
            }}>
              LATEST
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <GrowthPill pct={ed.growth_pct} />
        </div>
      </div>

      {/* Metrics grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 8 }}>
        <MetricMini label="Sales"     value={fmtMoney(ed.total_sales)} />
        <MetricMini label="Bookings"  value={ed.total_bookings} />
        <MetricMini label="Paid"      value={ed.total_paid}     color="#10b981" />
        <MetricMini label="Unpaid"    value={ed.total_unpaid}   color="#f59e0b" />
        <MetricMini label="Delegates" value={ed.total_delegates} />
      </div>

      {/* Payment rate mini-bar */}
      {ed.total_bookings > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <div style={{ flex: 1, background: "#e2e8f0", borderRadius: 3, height: 4 }}>
            <div style={{
              width: `${paid_pct}%`, height: "100%", borderRadius: 3,
              background: paid_pct >= 80 ? "#10b981" : paid_pct >= 50 ? "#f59e0b" : "#ef4444",
            }} />
          </div>
          <span style={{ fontSize: 10, color: "#64748b", minWidth: 32, textAlign: "right" }}>
            {paid_pct}% paid
          </span>
        </div>
      )}

      {/* Booking growth badges */}
      {(ed.booking_growth_pct != null || ed.delegate_growth_pct != null) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
          <GrowthPill pct={ed.booking_growth_pct}  label="bookings" />
          <GrowthPill pct={ed.delegate_growth_pct} label="delegates" />
        </div>
      )}
    </div>
  );
}

function WindowRow({ ed }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "48px 1fr 14px 1fr",
      gap: 6,
      alignItems: "center",
      padding: "6px 10px",
      borderRadius: 5,
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
      fontFamily: "monospace",
      fontSize: 11,
    }}>
      <span style={{ fontWeight: 700, color: "var(--vz-primary)" }}>{ed.year}</span>
      <span style={{ color: "#64748b" }}>{fmtDate(ed.window_start) || "— (first edition)"}</span>
      <span style={{ color: "#94a3b8", textAlign: "center" }}>→</span>
      <span style={{ color: "#1e293b", fontWeight: 600 }}>{fmtDate(ed.window_end) || "—"}</span>
    </div>
  );
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

export function EventGrowthDrawer({ data, onClose }) {
  if (!data) return null;

  const editions    = data.editions ?? [];
  const totalSales  = data.total_sales_all_years ?? 0;
  const latestGrowth = data.latest_growth_pct;
  const totalYears  = data.total_historical_years ?? editions.length;

  return (
    <Drawer
      open={!!data}
      onClose={onClose}
      title={data.event_code}
      subtitle={`${data.event_name} · ${data.current_city || ""} · YoY Growth`}
    >
      {/* Top KPIs */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 10,
        padding: "12px 0",
        borderBottom: "1px solid #e2e8f0",
        marginBottom: 4,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Total Sales (All Years)
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1e293b", fontFamily: "monospace" }}>
            {fmtMoney(totalSales)}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Editions Tracked
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#1e293b", fontFamily: "monospace" }}>
            {totalYears}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            Latest Growth
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "monospace", color: growthColor(latestGrowth) }}>
            {latestGrowth != null ? `${latestGrowth >= 0 ? "+" : ""}${latestGrowth.toFixed(1)}%` : "—"}
          </div>
        </div>
      </div>

      {editions.length === 0 ? (
        <div style={{ color: "#94a3b8", fontSize: 12, padding: "20px 0", textAlign: "center" }}>
          No edition data available for this event.
        </div>
      ) : (
        <>
          {/* SECTION 1: Sales Comparison */}
          <InfoSection title="Sales Comparison">
            <SalesBar editions={editions} />
            {data.validation_issues?.length > 0 && (
              <div style={{ marginTop: 10, padding: "8px 10px", background: "#fff7ed", borderRadius: 6, border: "1px solid #fed7aa", fontSize: 11, color: "#ea580c" }}>
                {data.validation_issues.length} validation issue(s) detected — run{" "}
                <code style={{ fontFamily: "monospace" }}>calculate_edition_growth</code> to recompute.
              </div>
            )}
          </InfoSection>

          {/* SECTION 2: Edition Timeline */}
          <InfoSection title="Edition Timeline">
            {editions.map((ed, i) => (
              <EditionDetailRow key={ed.year} ed={ed} isFirst={i === 0} />
            ))}
          </InfoSection>

          {/* SECTION 3: Booking Assignment Windows */}
          <InfoSection title="Booking Ownership Windows">
            <p style={{ margin: "0 0 8px", fontSize: 11, color: "#64748b", lineHeight: 1.5 }}>
              Each edition owns bookings whose <code style={{ fontFamily: "monospace", fontSize: 10 }}>event_date</code>{" "}
              falls within the window below. After an edition ends, new bookings belong to the next edition.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {/* Header */}
              <div style={{
                display: "grid", gridTemplateColumns: "48px 1fr 14px 1fr",
                gap: 6, padding: "0 10px 4px",
                borderBottom: "1px solid #e2e8f0",
              }}>
                {["Year", "Window Start", "", "Window End"].map((h) => (
                  <span key={h} style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {h}
                  </span>
                ))}
              </div>
              {[...editions].reverse().map((ed) => (
                <WindowRow key={ed.year} ed={ed} />
              ))}
            </div>
          </InfoSection>
        </>
      )}
    </Drawer>
  );
}
