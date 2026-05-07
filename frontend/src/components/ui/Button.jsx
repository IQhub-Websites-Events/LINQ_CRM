export function Button({ children, onClick, variant = "secondary", size = "md",
  disabled, loading, icon: Icon, type = "button", style = {} }) {
  const base = {
    display: "inline-flex", alignItems: "center", gap: 5,
    borderRadius: 8, fontWeight: 500, cursor: disabled || loading ? "not-allowed" : "pointer",
    border: "none", fontFamily: "inherit", transition: "all .12s",
    opacity: disabled || loading ? 0.5 : 1,
    whiteSpace: "nowrap",
  };
  const sizes = {
    sm: { padding: "4px 10px", fontSize: 11.5 },
    md: { padding: "6px 12px", fontSize: 12 },
    lg: { padding: "8px 16px", fontSize: 13 },
  }[size];
  const variants = {
    primary:   { background: "#1e293b", color: "#fff" },
    secondary: { background: "#fff", color: "#475569", border: "1px solid #e2e8f0" },
    success:   { background: "#166534", color: "#fff" },
    danger:    { background: "#991b1b", color: "#fff" },
    ghost:     { background: "transparent", color: "#475569" },
  }[variant];

  return (
    <button type={type} onClick={onClick} disabled={disabled || loading}
      style={{ ...base, ...sizes, ...variants, ...style }}>
      {loading ? <Spinner /> : Icon && <Icon size={13} />}
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <svg width={13} height={13} viewBox="0 0 13 13" style={{ animation: "spin 1s linear infinite" }}>
      <circle cx="6.5" cy="6.5" r="5" fill="none" stroke="currentColor" strokeWidth="2"
        strokeDasharray="18 14" strokeLinecap="round" />
    </svg>
  );
}
