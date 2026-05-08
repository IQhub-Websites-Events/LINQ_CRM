import { useState, useEffect } from "react";
import { eventsApi } from "../../api";
import { useToast } from "../../contexts/ToastContext";
import { Drawer } from "../ui/Drawer";
import { InfoSection, InfoGrid, InfoItem } from "../ui/InfoCard";
import { EventStatusBadge } from "../ui/Badge";
import { Avatar } from "../ui/Avatar";
import { fmt } from "../../utils/helpers";

export function EventDetailDrawer({ eventId, onClose }) {
  const toast = useToast();
  const [event,   setEvent]   = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!eventId) { setEvent(null); return; }
    setLoading(true);
    eventsApi.get(eventId)
      .then(setEvent)
      .catch(() => toast.error("Failed to load event"))
      .finally(() => setLoading(false));
  }, [eventId]);

  if (!eventId) return null;

  return (
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
              <InfoItem label="Capacity" value={event.capacity?.toLocaleString()} mono />
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

          <InfoSection title="Sales Team">
            {(event.sales_executive || event.assigned_sales_users?.length > 0) ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* Primary Executive */}
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

                {/* Other Assigned Users */}
                {event.assigned_sales_users?.filter(u => u.id !== event.sales_executive).map((u) => (
                  <div key={u.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: "#f8fafc", border: "1px solid #e2e8f0",
                    borderRadius: 8, padding: "10px 12px",
                  }}>
                    <Avatar name={u.full_name} size={30} />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: "#1e293b" }}>
                        {u.full_name}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>
                        Assigned Member
                      </div>
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
  );
}
