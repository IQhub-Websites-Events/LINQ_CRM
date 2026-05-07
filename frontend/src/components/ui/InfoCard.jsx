export function InfoSection({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: "#94a3b8",
          textTransform: "uppercase", letterSpacing: ".7px" }}>{title}</span>
        <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
      </div>
      {children}
    </div>
  );
}

export function InfoGrid({ children }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
      {children}
    </div>
  );
}

export function InfoItem({ label, value, mono, span }) {
  return (
    <div style={{ background: "#f8fafc", borderRadius: 7, padding: "9px 11px",
      gridColumn: span ? "span 2" : undefined }}>
      <div style={{ fontSize: 9.5, color: "#94a3b8", textTransform: "uppercase",
        letterSpacing: ".4px", marginBottom: 3 }}>{label}</div>
      <div style={{ color: "#1e293b", fontWeight: 500,
        fontFamily: mono ? "Courier New, monospace" : "inherit",
        fontSize: mono ? 11.5 : 12.5 }}>
        {value || "—"}
      </div>
    </div>
  );
}
