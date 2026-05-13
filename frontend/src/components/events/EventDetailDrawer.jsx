import { useState, useEffect } from "react";
import { eventsApi, historicalEventsApi, editionBookingsApi } from "../../api";
import { useToast } from "../../contexts/ToastContext";
import { Drawer } from "../ui/Drawer";
import { InfoSection, InfoGrid, InfoItem } from "../ui/InfoCard";
import { EventStatusBadge } from "../ui/Badge";
import { Avatar } from "../ui/Avatar";
import { fmt } from "../../utils/helpers";
import { EditionBookingDrawer } from "./EditionBookingDrawer";

// ── Historical confidence badge ───────────────────────────────────────────────
function ConfidenceBadge({ confidence }) {
  const pct = Math.round((confidence ?? 0) * 100);
  const color =
    pct >= 80 ? "#10b981" :
    pct >= 60 ? "#f59e0b" :
                "#ef4444";
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, color, background: `${color}18`,
      border: `1px solid ${color}40`, borderRadius: 4, padding: "1px 5px",
    }}>
      {pct}%
    </span>
  );
}

// ── Historical timeline row (raw references) ──────────────────────────────────
function HistoricalRow({ record }) {
  const verified = record.verification_status === "verified";
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "60px 90px 1fr 90px 42px",
      gap: 8,
      alignItems: "center",
      padding: "7px 10px",
      borderRadius: 6,
      background: verified ? "rgba(16,185,129,0.04)" : "rgba(148,163,184,0.06)",
      border: `1px solid ${verified ? "rgba(16,185,129,0.18)" : "#e2e8f0"}`,
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--vz-primary)", fontFamily: "monospace" }}>
        {record.event_year}
      </span>
      <span style={{ fontSize: 11, color: "#64748b" }}>{record.event_month}</span>
      <span style={{ fontSize: 11, color: "#1e293b", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {record.event_location || "—"}
      </span>
      <span style={{ fontSize: 10, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {record.source_pdf}
      </span>
      <ConfidenceBadge confidence={record.matched_confidence} />
    </div>
  );
}

// ── Past edition compact card ─────────────────────────────────────────────────
function EditionCard({ edition, onClick }) {
  const total     = edition.total_bookings  ?? 0;
  const paid      = edition.total_paid      ?? 0;
  const unpaid    = edition.total_unpaid    ?? 0;
  const delegates = edition.total_delegates ?? 0;
  const sales     = edition.total_sales     ?? 0;
  const paidPct   = total > 0 ? Math.round((paid / total) * 100) : 0;
  const hasData   = total > 0 || delegates > 0;

  return (
    <div
      onClick={onClick}
      style={{
        cursor: "pointer",
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 8,
        padding: "12px 14px",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--vz-primary)";
        e.currentTarget.style.boxShadow   = "0 2px 8px rgba(64,81,137,0.10)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#e2e8f0";
        e.currentTarget.style.boxShadow   = "none";
      }}
    >
      {/* Year → Location header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{
          fontSize: 13, fontWeight: 800, color: "var(--vz-primary)",
          fontFamily: "monospace",
        }}>
          {edition.year}
        </span>
        <span style={{ fontSize: 12, color: "#94a3b8" }}>→</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", flex: 1 }}>
          {edition.location || "—"}
        </span>
        <span style={{ fontSize: 10, color: "#94a3b8" }}>›</span>
      </div>

      {hasData ? (
        <>
          {/* Metrics row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
            {[
              { label: "Bookings",  value: total,     color: null },
              { label: "Paid",      value: paid,      color: "#10b981" },
              { label: "Unpaid",    value: unpaid,    color: "#f59e0b" },
              { label: "Delegates", value: delegates, color: null },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                background: color ? `${color}10` : "rgba(100,116,139,0.06)",
                border: `1px solid ${color ? `${color}28` : "#e2e8f0"}`,
                borderRadius: 5,
                padding: "6px 8px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
                  {label}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: color ?? "#1e293b", fontFamily: "monospace" }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Payment rate bar */}
          {total > 0 && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, background: "#e2e8f0", borderRadius: 3, height: 4 }}>
                <div style={{
                  width: `${paidPct}%`,
                  height: "100%",
                  background: paidPct >= 80 ? "#10b981" : paidPct >= 50 ? "#f59e0b" : "#ef4444",
                  borderRadius: 3,
                }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#64748b", minWidth: 32, textAlign: "right" }}>
                {paidPct}% paid
              </span>
            </div>
          )}

          {/* Revenue */}
          {sales > 0 && (
            <div style={{ marginTop: 6, fontSize: 10, color: "#64748b", fontWeight: 600, fontFamily: "monospace" }}>
              Revenue: ${Number(sales).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 11, color: "#94a3b8", padding: "2px 0" }}>
          No booking data linked to this edition.
        </div>
      )}
    </div>
  );
}

// ── Main drawer ───────────────────────────────────────────────────────────────

export function EventDetailDrawer({ eventId, onClose }) {
  const toast = useToast();

  const [event,       setEvent]       = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [historical,  setHistorical]  = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [editions,    setEditions]    = useState([]);
  const [edLoading,   setEdLoading]   = useState(false);
  const [selectedEd,  setSelectedEd]  = useState(null);

  // Load event details
  useEffect(() => {
    if (!eventId) { setEvent(null); setHistorical([]); setEditions([]); return; }
    setLoading(true);
    eventsApi.get(eventId)
      .then(setEvent)
      .catch(() => toast.error("Failed to load event"))
      .finally(() => setLoading(false));
  }, [eventId]);

  // Load historical references (raw)
  useEffect(() => {
    if (!eventId) { setHistorical([]); return; }
    setHistLoading(true);
    historicalEventsApi.getByEvent(eventId)
      .then((data) => setHistorical(data.results ?? []))
      .catch(() => setHistorical([]))
      .finally(() => setHistLoading(false));
  }, [eventId]);

  // Load edition bookings summary (invoice-date based, excludes current year)
  useEffect(() => {
    if (!eventId) { setEditions([]); return; }
    setEdLoading(true);
    editionBookingsApi.getSummary(eventId)
      .then((data) => {
        const currentYear = event?.event_date ? new Date(event.event_date).getFullYear() : null;
        const all = data.editions ?? [];
        setEditions(currentYear ? all.filter((e) => e.year !== currentYear) : all);
      })
      .catch(() => setEditions([]))
      .finally(() => setEdLoading(false));
  }, [eventId, event?.event_date]);

  if (!eventId) return null;

  const verifiedCount = historical.filter((r) => r.verification_status === "verified").length;

  return (
    <>
      <Drawer
        open={!!eventId}
        onClose={onClose}
        title={loading ? "Loading…" : (event?.event_code || "Event")}
        subtitle={event ? `${event.name} · ${event.city}` : ""}
      >
        {loading ? (
          <div style={{ color: "#94a3b8", fontSize: 12, textAlign: "center", padding: "20px" }}>
            Loading…
          </div>
        ) : event ? (
          <>
            <InfoSection title="Event Info">
              <InfoGrid>
                <InfoItem label="Event Code" value={event.event_code} mono />
                <InfoItem label="Status"     value={<EventStatusBadge status={event.event_status} />} />
                <InfoItem label="Event Name" value={event.name} span />
                <InfoItem label="Official Name" value={event.official_name} span />
                <InfoItem label="Date"       value={fmt.date(event.event_date)} mono />
                {event.end_date && <InfoItem label="End Date" value={fmt.date(event.end_date)} mono />}
                <InfoItem label="City"        value={event.city} />
                {event.venue && <InfoItem label="Venue" value={event.venue} span />}
                <InfoItem label="Sales Executive" value={event.sales_executive_name || "—"} />
                <InfoItem label="Accepting Web Bookings" value={event.accepting_web_bookings ? "YES" : "NO"} />
              </InfoGrid>
            </InfoSection>

            <InfoSection title="Team & Checks">
              <InfoGrid>
                <InfoItem label="Speaker Sales Team" value={event.speaker_sales_team || "—"} />
                <InfoItem label="SpEx Team"          value={event.spex_team || "—"} />
                <InfoItem label="Tele Marketing"     value={event.tele_marketing_team || "—"} />
                <InfoItem label="Market Research"    value={event.market_research_team || "—"} />
                <InfoItem label="Content Check"      value={event.content_check || "—"} />
                <InfoItem label="Marketing Check"    value={event.marketing_check || "—"} />
                <InfoItem label="Sales Check"        value={event.sales_check || "—"} />
              </InfoGrid>
            </InfoSection>

            <InfoSection title="Bookings">
              <InfoGrid>
                <InfoItem label="Total Bookings"   value={String(event.total_bookings ?? "—")} mono />
                <InfoItem label="Pending Bookings" value={String(event.pending_bookings ?? "—")} mono />
              </InfoGrid>
            </InfoSection>

            {/* ── Past Event Editions ─────────────────────────────────── */}
            <InfoSection title="Past Event Editions">
              {edLoading ? (
                <div style={{ color: "#94a3b8", fontSize: 11, padding: "6px 0" }}>
                  Loading editions…
                </div>
              ) : editions.length === 0 ? (
                <div style={{ color: "#94a3b8", fontSize: 12, padding: "8px 0" }}>
                  No historical editions found for this event.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {editions.map((ed) => (
                    <EditionCard
                      key={ed.year}
                      edition={ed}
                      onClick={() => setSelectedEd(ed)}
                    />
                  ))}
                  <div style={{ marginTop: 4, fontSize: 10, color: "#94a3b8", display: "flex", justifyContent: "space-between" }}>
                    <span>{editions.length} edition{editions.length !== 1 ? "s" : ""} · click any card for full booking detail</span>
                    <span>Mapped via invoice date</span>
                  </div>
                </div>
              )}
            </InfoSection>

            {/* ── Historical Event Data (raw references) ──────────────── */}
            <InfoSection title="Historical Event Data">
              {histLoading ? (
                <div style={{ color: "#94a3b8", fontSize: 11, padding: "6px 0" }}>
                  Loading historical data…
                </div>
              ) : historical.length === 0 ? (
                <div style={{ color: "#94a3b8", fontSize: 12, padding: "8px 0" }}>
                  No historical references found for this event.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "60px 90px 1fr 90px 42px",
                    gap: 8,
                    padding: "0 10px 4px",
                    borderBottom: "1px solid #e2e8f0",
                    marginBottom: 2,
                  }}>
                    {["Year", "Month", "Location", "Source", "Conf."].map((h) => (
                      <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {h}
                      </span>
                    ))}
                  </div>
                  {historical.map((rec) => (
                    <HistoricalRow key={rec.id} record={rec} />
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, padding: "4px 2px" }}>
                    <span style={{ fontSize: 10, color: "#94a3b8" }}>
                      {historical.length} record{historical.length !== 1 ? "s" : ""} · {verifiedCount} verified
                    </span>
                    <span style={{ fontSize: 10, color: "#94a3b8" }}>
                      Source: Event Allocations PDFs (2023–2025)
                    </span>
                  </div>
                </div>
              )}
            </InfoSection>

            <InfoSection title="Sales Team">
              {(event.sales_executive || event.assigned_sales_users?.length > 0) ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {event.sales_executive && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: "rgba(64, 81, 137, 0.05)", border: "1px solid var(--vz-primary)",
                      borderRadius: 8, padding: "10px 12px", position: "relative"
                    }}>
                      <Avatar name={event.sales_executive_name} size={30} />
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--vz-primary)" }}>
                          {event.sales_executive_name}
                        </div>
                        <div style={{ fontSize: 11, color: "#878a99" }}>
                          Primary Executive
                        </div>
                      </div>
                      <div style={{ position: "absolute", top: 8, right: 10 }}>
                        <span className="badge badge-soft-primary" style={{ fontSize: 9 }}>OWNER</span>
                      </div>
                    </div>
                  )}
                  {event.assigned_sales_users?.filter(u => u.id !== event.sales_executive).map((u) => (
                    <div key={u.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: "#f8fafc", border: "1px solid #e2e8f0",
                      borderRadius: 8, padding: "10px 12px",
                    }}>
                      <Avatar name={u.full_name} size={30} />
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: "#1e293b" }}>{u.full_name}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>Assigned Member</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "#94a3b8", fontSize: 12, padding: "8px 0" }}>
                  No sales users assigned to this event.
                </div>
              )}
            </InfoSection>
          </>
        ) : null}
      </Drawer>

      {/* ── Edition booking detail drawer (nested) ───────────────── */}
      <EditionBookingDrawer
        eventId={eventId}
        edition={selectedEd}
        onClose={() => setSelectedEd(null)}
      />
    </>
  );
}
