export function Field({ label, hint, span = 6, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, gridColumn: `span ${span}` }}>
      <span style={{
        fontSize: 11,
        color: "var(--text-dim)",
        fontWeight: 500,
        letterSpacing: "0.02em",
      }}>
        {label}
      </span>
      {children}
      {hint && (
        <span style={{ fontSize: 10, color: "var(--text-faint)" }}>{hint}</span>
      )}
    </label>
  );
}
