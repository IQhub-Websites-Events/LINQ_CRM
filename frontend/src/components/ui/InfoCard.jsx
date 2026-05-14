export function InfoSection({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        <span style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-faint)",
          textTransform: "uppercase", letterSpacing: ".7px" }}>{title}</span>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
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
    <div style={{ background: "var(--surface-alt)", borderRadius: 7, padding: "9px 11px",
      gridColumn: span ? "span 2" : undefined }}>
      <div style={{ fontSize: 9.5, color: "var(--text-faint)", textTransform: "uppercase",
        letterSpacing: ".4px", marginBottom: 3 }}>{label}</div>
      <div style={{ color: "var(--text)", fontWeight: 500,
        fontFamily: mono ? "Courier New, monospace" : "inherit",
        fontSize: mono ? 11.5 : 12.5 }}>
        {value || "—"}
      </div>
    </div>
  );
}
