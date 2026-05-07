import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const [form,    setForm]    = useState({ username: "", password: "" });
  const [error,   setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(form.username, form.password);
    } catch (err) {
      setError(err.response?.data?.non_field_errors?.[0] || "Invalid credentials");
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 44, height: 44, background: "#0f172a", borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
            <svg width="20" height="20" viewBox="0 0 14 14" fill="none">
              <path d="M1 7h12M7 1l6 6-6 6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "#1e293b", letterSpacing: "-.4px" }}>
            Linq CRM
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>Payment Confirmation System</p>
        </div>

        {/* Form */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 28 }}>
          <form onSubmit={submit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: "#475569", marginBottom: 6 }}>
                Username
              </label>
              <input value={form.username} onChange={(e) => setForm((f) => ({...f, username: e.target.value}))}
                placeholder="your-username" autoFocus autoComplete="username"
                style={inputStyle} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: "#475569", marginBottom: 6 }}>
                Password
              </label>
              <input type="password" value={form.password}
                onChange={(e) => setForm((f) => ({...f, password: e.target.value}))}
                placeholder="••••••••" autoComplete="current-password"
                style={inputStyle} />
            </div>

            {error && (
              <div style={{ marginBottom: 14, padding: "8px 12px", background: "#fef2f2",
                border: "1px solid #fecaca", borderRadius: 7, fontSize: 12.5, color: "#991b1b" }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !form.username || !form.password}
              style={{ width: "100%", padding: "10px", background: "#1e293b", color: "#fff",
                border: "none", borderRadius: 8, fontSize: 13.5, fontWeight: 500, cursor: "pointer",
                opacity: loading || !form.username || !form.password ? 0.6 : 1, fontFamily: "inherit" }}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: 11.5, color: "#94a3b8" }}>
          Data auto-synced from event website · Sales team access only
        </p>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "9px 11px", background: "#fff",
  border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13.5,
  color: "#1e293b", fontFamily: "inherit", outline: "none",
  boxSizing: "border-box",
};
