export function SourceBadge({ source }) {
  const isWebsite = source === "website";
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      fontSize: 10,
      fontWeight: 500,
      padding: "2px 7px",
      borderRadius: 6,
      background: isWebsite ? "var(--accent-soft)" : "var(--surface-alt)",
      color: isWebsite ? "var(--accent)" : "var(--text-dim)",
      border: `1px solid ${isWebsite ? "var(--accent)" : "var(--border)"}`,
      letterSpacing: "0.03em",
      textTransform: "uppercase",
      fontFamily: "var(--font-mono)",
    }}>
      {isWebsite ? "Web" : "Manual"}
    </span>
  );
}
