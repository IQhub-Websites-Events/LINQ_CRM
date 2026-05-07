import { useEffect, useState } from "react";
import { searchApi } from "../api";
import { fmt } from "../utils/helpers";

export function ReportsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    searchApi.stats().then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>Loading…</div>;
  if (!stats) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>No data</div>;

  const { events: ev, invoices: inv, delegates: del, top_events_by_revenue: topEv = [] } = stats;
  const maxRev = topEv[0]?.revenue || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h4 style={{ margin: 0, fontSize: 18, color: "#495057", textTransform: "uppercase", fontWeight: 700 }}>Reports & Analytics</h4>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#878a99" }}>Comprehensive overview of events, revenue, and delegate statistics.</p>
      </div>

      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, marginBottom: 20 }}>
          <KpiCard
            label="Pending Invoices"
            value={inv?.pending || 0}
            sub={fmt.currency(inv?.revenue_pending)}
            icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></svg>}
            color="warning"
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Revenue by event */}
          <div className="card" style={{ padding: "20px" }}>
            <div className="card-header" style={{ border: "none", padding: 0, marginBottom: 20 }}>
              <h5 style={{ margin: 0 }}>Revenue by Event</h5>
            </div>
            {topEv.length === 0 ? (
              <p style={{ color: "#94a3b8", fontSize: 13 }}>No paid revenue yet</p>
            ) : topEv.map((e) => (
              <div key={e.event_code} style={{ marginBottom: 15 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#495057" }}>{e.event_code}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--vz-primary)" }}>{fmt.currency(e.revenue)}</span>
                </div>
                <div style={{ height: 6, background: "#f3f3f9", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    borderRadius: 4,
                    background: "var(--vz-primary)",
                    width: `${Math.round(e.revenue / maxRev * 100)}%`,
                    transition: "width .4s ease"
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* Status breakdown */}
          <div className="card" style={{ padding: "20px" }}>
            <div className="card-header" style={{ border: "none", padding: 0, marginBottom: 20 }}>
              <h5 style={{ margin: 0 }}>Invoice & Event Summary</h5>
            </div>

            <div style={{ display: "grid", gap: 15, marginBottom: 25 }}>
              {[
                ["Paid", inv?.paid || 0, "var(--vz-success)"],
                ["Pending", inv?.pending || 0, "var(--vz-warning)"],
                ["Cancelled", inv?.cancelled || 0, "var(--vz-danger)"],
              ].map(([label, count, color]) => (
                <div key={label}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: "#495057" }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{count} ({inv?.total ? Math.round(count / inv.total * 100) : 0}%)</span>
                  </div>
                  <div style={{ height: 12, background: "#f3f3f9", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      background: color,
                      width: inv?.total ? `${Math.max(count > 0 ? 5 : 0, Math.round(count / inv.total * 100))}%` : "0%",
                      transition: "width .4s ease"
                    }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: "1px solid #e9ebec", paddingTop: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 12, color: "#878a99", marginBottom: 4 }}>Live</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{ev?.live || 0}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 12, color: "#878a99", marginBottom: 4 }}>Upcoming</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{ev?.upcoming || 0}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 12, color: "#878a99", marginBottom: 4 }}>Total</div>
                  <div style={{ fontSize: 18, fontWeight: 700 }}>{ev?.total || 0}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, icon, color }) {
  const colors = {
    primary: { bg: "rgba(64, 81, 137, 0.1)", text: "var(--vz-primary)" },
    success: { bg: "rgba(10, 179, 156, 0.1)", text: "var(--vz-success)" },
    warning: { bg: "rgba(247, 184, 75, 0.1)", text: "var(--vz-warning)" },
    info: { bg: "rgba(41, 156, 219, 0.1)", text: "var(--vz-info)" },
  }[color] || { bg: "#f3f3f9", text: "#495057" };

  return (
    <div className="card" style={{ padding: "20px", display: "flex", justifyContent: "space-between" }}>
      <div>
        <h6 style={{ margin: "0 0 12px", color: "#878a99", textTransform: "uppercase", fontSize: 13, fontWeight: 600 }}>{label}</h6>
        <h3 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700 }}>{value}</h3>
        {sub && <div style={{ fontSize: 13, color: "#878a99" }}>{sub}</div>}
      </div>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 8,
        background: colors.bg,
        color: colors.text,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        {icon}
      </div>
    </div>
  );
}

