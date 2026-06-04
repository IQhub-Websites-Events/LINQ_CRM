import { useAuth } from "../contexts/AuthContext";

export function NoAccessPage({ module }) {
  const { hasAnyPermission, user, logout, reloadPermissions } = useAuth();

  if (!hasAnyPermission) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", background: "var(--bg)", padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🔒</div>
        <h2 style={{ margin: "0 0 10px", fontFamily: "var(--font-serif)", fontWeight: 500, fontSize: 28, color: "var(--text)" }}>
          No Access
        </h2>
        <p style={{ margin: "0 0 8px", fontSize: 14, color: "var(--text-dim)", maxWidth: 400, lineHeight: 1.6 }}>
          You don't have permissions to view any Module.
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-faint)" }}>
          Contact the Admin for permissions.
        </p>
        <div style={{ marginTop: 24, padding: "8px 16px", background: "var(--surface-alt)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text-dim)" }}>
          Logged in as <strong>{user?.username}</strong>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button
            onClick={reloadPermissions}
            style={{ padding: "7px 16px", fontSize: 12, borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer", fontFamily: "inherit" }}
          >
            Retry
          </button>
          <button
            onClick={logout}
            style={{ padding: "7px 16px", fontSize: 12, borderRadius: 7, border: "none", background: "var(--danger, #dc3545)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}
          >
            Log Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", background: "var(--bg)", padding: 40, textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>🚫</div>
      <h2 style={{ margin: "0 0 10px", fontFamily: "var(--font-serif)", fontWeight: 500, fontSize: 28, color: "var(--text)" }}>
        Access Denied
      </h2>
      <p style={{ margin: "0 0 8px", fontSize: 14, color: "var(--text-dim)", maxWidth: 400, lineHeight: 1.6 }}>
        You don't have permission to view{module ? ` the ${module} module` : " this page"}.
      </p>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-faint)" }}>
        Contact the Admin to request access.
      </p>
    </div>
  );
}
