import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
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
    <div style={{
      minHeight: "100vh", background: "#f8fafc", display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20
    }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div>
            <img src="logo-dark.png" alt="Logo" width={130} height={40} />
          </div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "#1e293b", letterSpacing: "-.4px" }}>
            IQ-HUB CRM
          </h1>
        </div>

        {/* Form */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 28 }}>
          <form onSubmit={submit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: "#475569", marginBottom: 6 }}>
                Username
              </label>
              <input value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="your-username" autoFocus autoComplete="username"
                style={inputStyle} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 500, color: "#475569", marginBottom: 6 }}>
                Password
              </label>
              <input type="password" value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="••••••••" autoComplete="current-password"
                style={inputStyle} />
            </div>

            {error && (
              <div style={{
                marginBottom: 14, padding: "8px 12px", background: "#fef2f2",
                border: "1px solid #fecaca", borderRadius: 7, fontSize: 12.5, color: "#991b1b"
              }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !form.username || !form.password}
              style={{
                width: "100%", padding: "10px", background: "#1e293b", color: "#fff",
                border: "none", borderRadius: 8, fontSize: 13.5, fontWeight: 500, cursor: "pointer",
                opacity: loading || !form.username || !form.password ? 0.6 : 1, fontFamily: "inherit"
              }}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
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
