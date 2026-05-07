import { useState, useEffect } from "react";
import { teamApi } from "../api";
import { fmt } from "../utils/helpers";
import { Td, EmptyState } from "../components/ui/Table";
import { EventStatusBadge } from "../components/ui/Badge";

export function TeamPage() {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    teamApi.list()
      .then(data => {
        setUsers(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setDetailData(null);
      return;
    }
    teamApi.get(selectedUserId).then(setDetailData);
  }, [selectedUserId]);

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h4 style={{ margin: 0, fontSize: 18, color: "#495057", textTransform: "uppercase", fontWeight: 700 }}>Team Performance</h4>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#878a99" }}>Track and analyze sales performance across your entire team.</p>
      </div>

      <div style={{ display: "flex", gap: "20px", height: "100%", minHeight: 0 }}>
        {/* Master View (Table of Users) */}
        <div className="card" style={{ 
          flex: selectedUserId ? "0 0 350px" : 1, 
          display: "flex", 
          flexDirection: "column", 
          transition: "flex 0.3s ease",
          overflow: "hidden" 
        }}>
          <div className="card-header">
            <h5 style={{ margin: 0, fontSize: 14 }}>Sales Representatives</h5>
          </div>
          <div style={{ flex: 1, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ background: "#f3f6f9" }}>
                <tr>
                  <th style={thStyle}>Sales User</th>
                  <th style={thStyle}>Events</th>
                  <th style={thStyle}>Total Sales</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr 
                    key={u.id} 
                    onClick={() => setSelectedUserId(u.id)}
                    style={{ 
                      cursor: "pointer", 
                      background: selectedUserId === u.id ? "rgba(64, 81, 137, 0.05)" : "#fff",
                      borderBottom: "1px solid var(--vz-card-border-color)",
                      transition: "background .2s ease"
                    }}
                    onMouseEnter={(e) => { if (selectedUserId !== u.id) e.currentTarget.style.background = "#f3f3f9"; }}
                    onMouseLeave={(e) => { if (selectedUserId !== u.id) e.currentTarget.style.background = "#fff"; }}
                  >
                    <Td><span style={{ fontWeight: 600 }}>{u.username}</span></Td>
                    <Td muted>{u.total_events}</Td>
                    <Td style={{ fontWeight: 700, color: "var(--vz-success)" }}>{fmt.currency(u.total_sales)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && <EmptyState title="No sales team members found." />}
          </div>
        </div>

        {/* Detail View */}
        {selectedUserId && (
          <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", animation: "slideUp 0.3s ease-out" }}>
            {!detailData ? (
              <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
                <div style={{ width: 30, height: 30, border: "3px solid #e9ebec", borderTopColor: "var(--vz-primary)", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 10px" }} />
                Loading Performance...
              </div>
            ) : (
              <>
                {/* SECTION 1: User Info Header */}
                <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--vz-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700 }}>
                      {detailData.user.username[0].toUpperCase()}
                    </div>
                    <div>
                      <h5 style={{ margin: 0, fontSize: 16 }}>{detailData.user.username}</h5>
                      <div style={{ color: "#878a99", fontSize: 12 }}>{detailData.user.email}</div>
                    </div>
                  </div>
                  <button onClick={() => setSelectedUserId(null)} className="btn" style={{ background: "#f3f3f9", color: "#878a99" }}>
                    Close
                  </button>
                </div>

                {/* SECTION 2: Events Performance Table */}
                <div className="card-body" style={{ flex: 1, overflow: "auto" }}>
                  <h6 style={{ margin: "0 0 16px", color: "#495057", textTransform: "uppercase", fontSize: 12 }}>Event-wise Breakdown</h6>
                  <div style={{ border: "1px solid var(--vz-card-border-color)", borderRadius: 4, overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead style={{ background: "#f3f6f9" }}>
                        <tr>
                          <th style={thStyle}>Event</th>
                          <th style={thStyle}>Status</th>
                          <th style={thStyle}>Invoices</th>
                          <th style={thStyle}>Paid</th>
                          <th style={thStyle}>Pending</th>
                          <th style={{ ...thStyle, textAlign: "right" }}>Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailData.events.map(ev => (
                          <tr key={ev.event_id} style={{ borderBottom: "1px solid var(--vz-card-border-color)" }}>
                            <Td>
                              <div style={{ fontWeight: 600 }}>{ev.event_name}</div>
                              <div style={{ fontSize: 11, color: "#878a99" }}>{ev.event_code}</div>
                            </Td>
                            <Td><EventStatusBadge status={ev.event_status} /></Td>
                            <Td>{ev.total_invoices}</Td>
                            <Td style={{ color: "var(--vz-success)", fontWeight: 600 }}>{ev.paid_invoices}</Td>
                            <Td style={{ color: "var(--vz-warning)", fontWeight: 600 }}>{ev.pending_invoices}</Td>
                            <Td right style={{ fontWeight: 700, color: "var(--vz-primary)" }}>{fmt.currency(ev.revenue)}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {detailData.events.length === 0 && <EmptyState title="No assigned events." />}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


const thStyle = {
  background: "#f8fafc",
  color: "#64748b",
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: ".5px",
  padding: "10px 16px",
  textAlign: "left",
  borderBottom: "1px solid #e2e8f0",
  position: "sticky",
  top: 0
};
