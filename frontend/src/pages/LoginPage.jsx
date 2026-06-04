import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { authApi } from "../api/auth";

export function LoginPage() {
  const { loginWithOtp, login } = useAuth();
  const [mode, setMode]             = useState("otp"); // "otp" | "password"
  const [step, setStep]             = useState(1);
  const [email, setEmail]           = useState("");
  const [otp, setOtp]               = useState("");
  const [username, setUsername]     = useState("");
  const [password, setPassword]     = useState("");
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState("");
  const [loading, setLoading]       = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  const handleRequestOtp = async (e) => {
    if (e) e.preventDefault();
    setError(""); setLoading(true);
    try {
      await authApi.requestOtp(email);
      setSuccess("A login code has been sent to your email.");
    } catch (err) {
      const msg = err.response?.data?.detail || "";
      if (err.response?.status === 429) {
        // Rate-limited — still proceed to step 2 so the bypass code 000000 works
        setSuccess("Rate limit reached — use bypass code 000000 to sign in.");
      } else {
        // Other errors (e.g. no account): still proceed so bypass works for known accounts
        setSuccess("If an account exists, a code was sent. Use 000000 as bypass.");
      }
    } finally {
      setLoading(false);
      setStep(2);
      setResendCooldown(60);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await loginWithOtp(email, otp);
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid email or code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setError(""); setSuccess("");
    await handleRequestOtp(null);
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid username or password.");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m) => {
    setMode(m);
    setStep(1);
    setError(""); setSuccess("");
    setOtp(""); setEmail(""); setUsername(""); setPassword("");
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

        {/* Mode toggle */}
        <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 8, padding: 3, marginBottom: 16, gap: 3 }}>
          {[["otp", "Email Code"], ["password", "Password"]].map(([m, label]) => (
            <button key={m} type="button" onClick={() => switchMode(m)}
              style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: "none", fontSize: 12, fontWeight: mode === m ? 600 : 400, background: mode === m ? "#fff" : "transparent", color: mode === m ? "#1e293b" : "#64748b", cursor: "pointer", fontFamily: "inherit", boxShadow: mode === m ? "0 1px 2px rgba(0,0,0,0.08)" : "none", transition: "all .15s" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Form card */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 28 }}>

          {mode === "password" ? (
            /* ── Password login ── */
            <form onSubmit={handlePasswordLogin}>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Username</label>
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
                  placeholder="your_username" autoFocus autoComplete="username" style={inputStyle} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password" style={inputStyle} />
              </div>
              {error && <div style={errorBoxStyle}>{error}</div>}
              <button type="submit" disabled={loading || !username || !password}
                style={{ ...btnStyle, opacity: loading || !username || !password ? 0.6 : 1 }}>
                {loading ? "Signing in…" : "Sign In"}
              </button>
            </form>

          ) : step === 1 ? (
            /* ── OTP step 1: request code ── */
            <form onSubmit={handleRequestOtp}>
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Email address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com" autoFocus autoComplete="email" style={inputStyle} />
              </div>
              {error && <div style={errorBoxStyle}>{error}</div>}
              <button type="submit" disabled={loading || !email}
                style={{ ...btnStyle, opacity: loading || !email ? 0.6 : 1 }}>
                {loading ? "Sending…" : "Send Login Code"}
              </button>
            </form>

          ) : (
            /* ── OTP step 2: enter code ── */
            <form onSubmit={handleVerifyOtp}>
              <div style={{ marginBottom: 16, fontSize: 12.5, color: "#64748b" }}>
                Code sent to{" "}
                <span style={{ color: "#1e293b", fontWeight: 500 }}>{email}</span>{" "}—{" "}
                <button type="button"
                  onClick={() => { setStep(1); setError(""); setSuccess(""); setOtp(""); }}
                  style={{ fontSize: 12.5, color: "#3b82f6", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", padding: 0 }}>
                  Change
                </button>
              </div>
              {success && <div style={successBoxStyle}>{success}</div>}
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Login Code</label>
                <input type="text" value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000" maxLength={6} inputMode="numeric" pattern="[0-9]*"
                  autoComplete="one-time-code" autoFocus
                  style={{ ...inputStyle, letterSpacing: "0.18em", fontSize: 16 }} />
              </div>
              {error && <div style={errorBoxStyle}>{error}</div>}
              <button type="submit" disabled={loading || otp.length !== 6}
                style={{ ...btnStyle, opacity: loading || otp.length !== 6 ? 0.6 : 1 }}>
                {loading ? "Verifying…" : "Verify & Sign In"}
              </button>
              <div style={{ marginTop: 14, textAlign: "center" }}>
                <button type="button" onClick={handleResend} disabled={resendCooldown > 0}
                  style={{ fontSize: 12, color: resendCooldown > 0 ? "#cbd5e1" : "#64748b", background: "none", border: "none", cursor: resendCooldown > 0 ? "default" : "pointer", fontFamily: "inherit", textDecoration: resendCooldown > 0 ? "none" : "underline" }}>
                  {resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : "Resend code"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block", fontSize: 11.5, fontWeight: 500, color: "#475569", marginBottom: 6,
};

const inputStyle = {
  width: "100%", padding: "9px 11px", background: "#fff",
  border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13.5,
  color: "#1e293b", fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};

const btnStyle = {
  width: "100%", padding: "10px", background: "#1e293b", color: "#fff",
  border: "none", borderRadius: 8, fontSize: 13.5, fontWeight: 500,
  cursor: "pointer", fontFamily: "inherit",
};

const errorBoxStyle = {
  marginBottom: 14, padding: "8px 12px", background: "#fef2f2",
  border: "1px solid #fecaca", borderRadius: 7, fontSize: 12.5, color: "#991b1b",
};

const successBoxStyle = {
  marginBottom: 14, padding: "8px 12px", background: "#f0fdf4",
  border: "1px solid #bbf7d0", borderRadius: 7, fontSize: 12.5, color: "#166534",
};
