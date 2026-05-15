const STATUS_MAP = {
  paid: { c: "var(--success)", bg: "var(--success-soft)", l: "Paid" },
  pending: { c: "var(--warn)", bg: "var(--warn-soft)", l: "Pending" },
  overdue: { c: "var(--danger)", bg: "var(--danger-soft)", l: "Overdue" },
  cancelled: { c: "var(--danger)", bg: "var(--danger-soft)", l: "Cancelled" },
  refunded: { c: "var(--text-faint)", bg: "var(--surface-alt)", l: "Refunded" },
  free: { c: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)", l: "Free" },
  "credit pending (free)": { c: "#a855f7", bg: "rgba(168, 85, 247, 0.12)", l: "Credit Pending (Free)" },
  "credit pending (paid)": { c: "#a855f7", bg: "rgba(168, 85, 247, 0.12)", l: "Credit Pending (Paid)" },
  "credit transferred": { c: "#06b6d4", bg: "rgba(6, 182, 212, 0.12)", l: "Credit Transferred" },
  "paid (transferred)": { c: "var(--success)", bg: "var(--success-soft)", l: "Paid (Transferred)" },
};

export function StatusBadge({ status }) {
  const key = status?.toLowerCase();
  const s = STATUS_MAP[key] || STATUS_MAP.pending;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      fontSize: 11,
      fontWeight: 600,
      color: s.c,
      background: s.bg,
      border: `1px solid ${s.c}22`,
      borderRadius: 999,
      padding: "3px 9px",
      whiteSpace: "nowrap",
      letterSpacing: "0.01em",
    }}>
      <span style={{
        width: 6, height: 6,
        borderRadius: "50%",
        background: s.c,
        flexShrink: 0,
      }} />
      {s.l}
    </span>
  );
}

export function TierBadge({ tier }) {
  return (
    <span className="badge badge-soft-info">{tier}</span>
  );
}

export function EventStatusBadge({ status }) {
  const className = {
    Live: "badge-soft-success",
    Upcoming: "badge-soft-info",
    Draft: "badge-soft-secondary",
    Completed: "badge-soft-success",
    Cancelled: "badge-soft-danger",
  }[status] || "badge-soft-secondary";

  return (
    <span className={`badge ${className}`} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor" }} />
      {status}
    </span>
  );
}
