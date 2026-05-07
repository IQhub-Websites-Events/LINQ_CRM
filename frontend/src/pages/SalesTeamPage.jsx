import { useState, useEffect } from "react";
import { usersApi } from "../api";
import { fmt } from "../utils/helpers";

export function SalesTeamPage() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [stats, setStats] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    usersApi.list({ role: "sales" })
      .then(data => {
        setUsers(data.results || data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedUser) return;
    usersApi.eventsStats(selectedUser.id).then(setStats);
    usersApi.logs(selectedUser.id).then(setLogs);
  }, [selectedUser]);

  if (loading) return <div style={{ padding: 40 }}>Loading...</div>;

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {/* List of sales team members */}
      <div style={{ width: 300, borderRight: "1px solid #e2e8f0", background: "#fff", overflow: "auto" }}>
        <div style={{ padding: 16, borderBottom: "1px solid #e2e8f0" }}>
          <h2 style={{ margin: 0, fontSize: 16, color: "#0f172a" }}>Sales Team</h2>
        </div>
        {Array.isArray(users) && users.map(u => (
          <div
            key={u.id}
            onClick={() => setSelectedUser(u)}
            style={{
              padding: 16, borderBottom: "1px solid #f1f5f9", cursor: "pointer",
              background: selectedUser?.id === u.id ? "#f8fafc" : "#fff"
            }}
          >
            <div style={{ fontWeight: 500, color: "#1e293b" }}>{u.username}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>{u.email}</div>
          </div>
        ))}
        {users.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "#94a3b8" }}>No sales members found</div>
        )}
      </div>

      {/* Detail View */}
      <div style={{ flex: 1, padding: 24, overflow: "auto", background: "#f8fafc" }}>
        {!selectedUser ? (
          <div style={{ color: "#94a3b8", textAlign: "center", marginTop: 40 }}>Select a team member</div>
        ) : (
          <div>
            <h2 style={{ margin: "0 0 24px", fontSize: 20 }}>{selectedUser.username}'s Profile</h2>
            
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              {/* Events stats */}
              <div style={{ flex: 1, minWidth: 300, background: "#fff", padding: 20, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 14, color: "#475569" }}>Assigned Events</h3>
                {stats.length === 0 ? <p style={{ color: "#94a3b8" }}>No assigned events</p> : null}
                {stats.map(s => {
                  const percent = s.expected_revenue > 0 ? Math.min(100, Math.round((s.current_revenue / s.expected_revenue) * 100)) : 0;
                  return (
                    <div key={s.event_code} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #f1f5f9" }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name} ({s.event_code})</div>
                      <div style={{ fontSize: 12, color: "#64748b", margin: "4px 0" }}>Status: {s.event_status}</div>
                      
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 12, marginBottom: 4 }}>
                        <span style={{ color: "#64748b" }}>Expected: {fmt.currency(s.expected_revenue)}</span>
                        <span style={{ color: s.current_revenue >= s.expected_revenue && s.expected_revenue > 0 ? "#16a34a" : "#ea580c", fontWeight: 600 }}>
                          Current: {fmt.currency(s.current_revenue)}
                        </span>
                      </div>
                      <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${percent}%`, height: "100%", background: percent >= 100 ? "#16a34a" : "#3b82f6" }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Logs */}
              <div style={{ flex: 1, minWidth: 300, background: "#fff", padding: 20, borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <h3 style={{ margin: "0 0 16px", fontSize: 14, color: "#475569" }}>Activity Log</h3>
                {logs.length === 0 ? <p style={{ color: "#94a3b8" }}>No recent activity</p> : null}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {logs.map(log => (
                    <div key={log.id} style={{ fontSize: 12, borderLeft: "2px solid #e2e8f0", paddingLeft: 12 }}>
                      <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 4 }}>{new Date(log.created_at).toLocaleString()}</div>
                      <div style={{ fontWeight: 600, color: "#1e293b", margin: "2px 0", fontSize: 13 }}>{log.action}</div>
                      {log.details && <div style={{ color: "#64748b", marginTop: 4 }}>{log.details}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
