export function EventPerformancePage() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      height: "100%", flexDirection: "column", gap: 12,
    }}>
      <div style={{
        fontSize: 32, fontWeight: 100, color: "#e2e8f0", lineHeight: 1,
        userSelect: "none",
      }}>⚙</div>
      <p style={{
        margin: 0, fontSize: 15, fontWeight: 600, color: "#1e293b",
        letterSpacing: "-.2px",
      }}>
        This Module will be live soon
      </p>
      <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>
        Check back later for updates.
      </p>
    </div>
  );
}
