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
      background: verified ? "rgba(16,185,129,0.06)" : "var(--surface-alt)",
      border: `1px solid ${verified ? "rgba(16,185,129,0.2)" : "var(--border)"}`,
    }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", fontFamily: "monospace" }}>
        {record.event_year}
      </span>
      <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{record.event_month}</span>
      <span style={{ fontSize: 11, color: "var(--text)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {record.event_location || "—"}
      </span>
      <span style={{ fontSize: 10, color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "12px 14px",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--accent)";
        e.currentTarget.style.background = "var(--surface-alt)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.background = "var(--surface)";
      }}
    >
      {/* Year → Location header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{
          fontSize: 13, fontWeight: 800, color: "var(--accent)",
          fontFamily: "monospace",
        }}>
          {edition.year}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-faint)" }}>→</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", flex: 1 }}>
          {edition.location || "—"}
        </span>
        <span style={{ fontSize: 10, color: "var(--text-faint)" }}>›</span>
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
                background: color ? `${color}12` : "var(--surface-alt)",
                border: `1px solid ${color ? `${color}28` : "var(--border)"}`,
                borderRadius: 5,
                padding: "6px 8px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 9, color: "var(--text-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>
                  {label}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: color ?? "var(--text)", fontFamily: "monospace" }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* Payment rate bar */}
          {total > 0 && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, background: "var(--border)", borderRadius: 3, height: 4 }}>
                <div style={{
                  width: `${paidPct}%`,
                  height: "100%",
                  background: paidPct >= 80 ? "#10b981" : paidPct >= 50 ? "#f59e0b" : "#ef4444",
                  borderRadius: 3,
                }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-dim)", minWidth: 32, textAlign: "right" }}>
                {paidPct}% paid
              </span>
            </div>
          )}

          {/* Revenue */}
          {sales > 0 && (
            <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-dim)", fontWeight: 600, fontFamily: "monospace" }}>
              Revenue: ${Number(sales).toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 11, color: "var(--text-faint)", padding: "2px 0" }}>
          No booking data linked to this edition.
        </div>
      )}
    </div>
  );
}

// ── Current-edition metric tile ───────────────────────────────────────────────

function MetricTile({ label, value, color, sub }) {
  return (
    <div style={{
      background: color ? `${color}12` : "var(--surface-alt)",
      border: `1px solid ${color ? `${color}28` : "var(--border)"}`,
      borderRadius: 7, padding: "10px 12px",
    }}>
      <div style={{
        fontSize: 9, color: "var(--text-faint)", fontWeight: 700,
        textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 18, fontWeight: 800,
        color: color ?? "var(--text)", fontFamily: "monospace", lineHeight: 1.1,
      }}>
        {value ?? "—"}
      </div>
      {sub && <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function CurrentEditionMetrics({ edition }) {
  const total   = edition.total_bookings  ?? 0;
  const paid    = edition.total_paid      ?? 0;
  const unpaid  = edition.total_unpaid    ?? 0;
  const canc    = edition.total_cancelled ?? 0;
  const pending = edition.total_pending   ?? 0;
  const dels    = edition.total_delegates ?? 0;
const paidPct = total > 0 ? Math.round((paid / total) * 100) : 0;
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 8 }}>
        <MetricTile label="Total"     value={total} />
        <MetricTile label="Paid"      value={paid}   color="#10b981" sub={`${paidPct}%`} />
        <MetricTile label="Unpaid"    value={unpaid} color="#f59e0b" />
        <MetricTile label="Cancelled" value={canc}   color="#ef4444" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <MetricTile label="Pending"   value={pending} color="#6366f1" />
        <MetricTile label="Delegates" value={dels} />
      </div>
      {total > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <div style={{ flex: 1, background: "var(--border)", borderRadius: 3, height: 5 }}>
            <div style={{
              width: `${paidPct}%`, height: "100%", borderRadius: 3,
              background: paidPct >= 80 ? "#10b981" : paidPct >= 50 ? "#f59e0b" : "#ef4444",
            }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-dim)", minWidth: 44, textAlign: "right" }}>
            {paidPct}% paid
          </span>
        </div>
      )}
    </>
  );
}

// ── Main drawer ───────────────────────────────────────────────────────────────

export function EventDetailDrawer({ eventId, onClose }) {
  const toast = useToast();

  const [event,          setEvent]          = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [historical,     setHistorical]     = useState([]);
  const [histLoading,    setHistLoading]    = useState(false);
  const [currentEdition, setCurrentEdition] = useState(null);
  const [editions,       setEditions]       = useState([]);
  const [edLoading,      setEdLoading]      = useState(false);
  const [selectedEd,     setSelectedEd]     = useState(null);

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

  // Load edition bookings summary (event-code based); split current vs past editions
  useEffect(() => {
    if (!eventId) { setEditions([]); setCurrentEdition(null); return; }
    setEdLoading(true);
    editionBookingsApi.getSummary(eventId)
      .then((data) => {
        const currentYear = event?.event_date ? new Date(event.event_date).getFullYear() : null;
        const all = data.editions ?? [];
        const curr = currentYear ? (all.find((e) => e.year === currentYear) ?? null) : null;
        setCurrentEdition(curr);
        setEditions(currentYear ? all.filter((e) => e.year !== currentYear) : all);
      })
      .catch(() => { setEditions([]); setCurrentEdition(null); })
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
          <div style={{ color: "var(--text-faint)", fontSize: 12, textAlign: "center", padding: "20px" }}>
            Loading…
          </div>
        ) : event ? (
          <>
            <InfoSection title="Event Specifications">
              <InfoGrid>
                {/* 1. Event Code */}
                <InfoItem label="Event Code" value={event.event_code || "—"} mono />

                {/* 2. Event Start Date */}
                <InfoItem label="Event Start Date" value={fmt.date(event.event_date) || "—"} mono />

                {/* 3. Event End Date */}
                <InfoItem label="Event End Date" value={fmt.date(event.end_date) || "—"} mono />

                {/* 4. Location */}
                <InfoItem label="Location" value={event.location || "—"} />

                {/* 5. Website */}
                <InfoItem label="Website" value={event.website ? <a href={(() => { const u = event.website.trim(); return /^https?:\/\//i.test(u) ? u : "https://" + u; })()} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)", textDecoration: "underline" }}>{event.website}</a> : "—"} span />

                {/* 6. Web Bookings */}
                <InfoItem label="Web Bookings" value={event.web_bookings ? "Yes" : "No"} />

                {/* 7. Nearest Related Event */}
                <InfoItem label="Nearest Related Event" value={event.nearest_related_event || "—"} />

                {/* 8. Event Type */}
                <InfoItem label="Event Type" value={event.event_type || "—"} />

                {/* 9. Website Live Date */}
                <InfoItem label="Website Live Date" value={fmt.date(event.website_live_date) || "—"} mono />

                {/* 10. Sales Check */}
                <InfoItem label="Sales Check" value={event.sales_check || "—"} />

                {/* 11. VR1 Sent Status */}
                <InfoItem label="VR1 Sent Status" value={event.vr1_sent_status || "—"} />

                {/* 12. Sales Team */}
                <InfoItem label="Sales Team" value={event.sales_team || "—"} />

                {/* 13. Sales Team Leader */}
                <InfoItem label="Sales Team Leader" value={event.team_leader || "—"} />

                {/* 14. Speaker Sales Team */}
                <InfoItem label="Speaker Sales Team" value={event.speaker_sales_team || "—"} />

                {/* 15. Telemarketing Team */}
                <InfoItem label="Telemarketing Team" value={event.telemarketing_team || "—"} />

                {/* 16. SpEx Team */}
                <InfoItem label="SpEx Team" value={event.spex_team || "—"} />

                {/* 17. Market Research (Senior) */}
                <InfoItem label="Market Research (Senior)" value={event.market_research_senior || "—"} />

                {/* 18. Market Research (Junior) */}
                <InfoItem label="Market Research (Junior)" value={event.market_research_junior || "—"} />

                {/* 19. Event Management Team */}
                <InfoItem label="Event Management Team" value={event.event_management_team || "—"} />

                {/* 20. Official Event Name */}
                <InfoItem label="Official Event Name" value={event.official_event_name || "—"} span />

                {/* 21. Event Name for Email Marketing */}
                <InfoItem label="Event Name for Email Marketing" value={event.email_marketing_name || "—"} span />

                {/* 22. Event Name for Branding */}
                <InfoItem label="Event Name for Branding" value={event.branding_name || "—"} span />

                {/* 23. Annualisation */}
                <InfoItem label="Annualisation" value={event.annualisation || "—"} />

                {/* 24. Date Format */}
                <InfoItem label="Date Format" value={event.date_format || "—"} />

                {/* 25. Related Event 1 */}
                <InfoItem label="Related Event 1" value={event.related_event_1 || "—"} />

                {/* 26. Related Event 2 */}
                <InfoItem label="Related Event 2" value={event.related_event_2 || "—"} />

                {/* 27. Related Event 3 */}
                <InfoItem label="Related Event 3" value={event.related_event_3 || "—"} />

                {/* 28. Upcoming Event 1 */}
                <InfoItem label="Upcoming Event 1" value={event.upcoming_event_1 || "—"} />

                {/* 29. Upcoming Event 2 */}
                <InfoItem label="Upcoming Event 2" value={event.upcoming_event_2 || "—"} />

                {/* 30. Upcoming Event 3 */}
                <InfoItem label="Upcoming Event 3" value={event.upcoming_event_3 || "—"} />

                {/* 31. Event Status */}
                <InfoItem label="Event Status" value={<EventStatusBadge status={event.status || event.event_status} />} />
              </InfoGrid>
            </InfoSection>

            <InfoSection title="Current Edition">
              {edLoading ? (
                <div style={{ color: "var(--text-faint)", fontSize: 11, padding: "6px 0" }}>Loading…</div>
              ) : currentEdition ? (
                <CurrentEditionMetrics edition={currentEdition} />
              ) : (
                <div style={{ color: "var(--text-faint)", fontSize: 12, padding: "8px 0" }}>
                  No bookings yet for the current edition.
                </div>
              )}
            </InfoSection>

            {/* ── Event Editions ──────────────────────────────────────── */}
            <InfoSection title="Event Editions">
              {edLoading ? (
                <div style={{ color: "var(--text-faint)", fontSize: 11, padding: "6px 0" }}>
                  Loading editions…
                </div>
              ) : editions.length === 0 ? (
                <div style={{ color: "var(--text-faint)", fontSize: 12, padding: "8px 0" }}>
                  No past editions found for this event.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {editions.map((ed) => (
                    <EditionCard key={ed.year} edition={ed} onClick={() => setSelectedEd(ed)} />
                  ))}
                  <div style={{ marginTop: 4, fontSize: 10, color: "var(--text-faint)", display: "flex", justifyContent: "space-between" }}>
                    <span>{editions.length} past edition{editions.length !== 1 ? "s" : ""} · click any card for full booking detail</span>
                    <span>Mapped via event code</span>
                  </div>
                </div>
              )}
            </InfoSection>

            {/* ── Historical Event Data (raw references) ──────────────── */}
            <InfoSection title="Historical Event Data">
              {histLoading ? (
                <div style={{ color: "var(--text-faint)", fontSize: 11, padding: "6px 0" }}>
                  Loading historical data…
                </div>
              ) : historical.length === 0 ? (
                <div style={{ color: "var(--text-faint)", fontSize: 12, padding: "8px 0" }}>
                  No historical references found for this event.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "60px 90px 1fr 90px 42px",
                    gap: 8,
                    padding: "0 10px 4px",
                    borderBottom: "1px solid var(--border)",
                    marginBottom: 2,
                  }}>
                    {["Year", "Month", "Location", "Source", "Conf."].map((h) => (
                      <span key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {h}
                      </span>
                    ))}
                  </div>
                  {historical.map((rec) => (
                    <HistoricalRow key={rec.id} record={rec} />
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, padding: "4px 2px" }}>
                    <span style={{ fontSize: 10, color: "var(--text-faint)" }}>
                      {historical.length} record{historical.length !== 1 ? "s" : ""} · {verifiedCount} verified
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-faint)" }}>
                      Source: Event Allocations PDFs (2023–2025)
                    </span>
                  </div>
                </div>
              )}
            </InfoSection>

            <InfoSection title="IQ-Hub Team">
              {(event.sales_executive || event.assigned_sales_users?.length > 0) ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {event.sales_executive && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      background: "rgba(64, 81, 137, 0.08)", border: "1px solid var(--accent)",
                      borderRadius: 8, padding: "10px 12px", position: "relative"
                    }}>
                      <Avatar name={event.sales_executive_name} size={30} />
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--accent)" }}>
                          {event.sales_executive_name}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
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
                      background: "var(--surface-alt)", border: "1px solid var(--border)",
                      borderRadius: 8, padding: "10px 12px",
                    }}>
                      <Avatar name={u.full_name} size={30} />
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)" }}>{u.full_name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-dim)" }}>Assigned Member</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "var(--text-faint)", fontSize: 12, padding: "8px 0" }}>
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
