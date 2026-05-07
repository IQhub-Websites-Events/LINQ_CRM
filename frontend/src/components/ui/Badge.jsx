const STATUS_MAP = {
  paid:    { c: "var(--success)", bg: "var(--success-soft)", l: "Paid" },
  pending: { c: "var(--warn)",    bg: "var(--warn-soft)",    l: "Pending" },
  overdue: { c: "var(--danger)",  bg: "var(--danger-soft)",  l: "Overdue" },
};

export function StatusBadge({ status }) {
  const key = status?.toLowerCase();
  const s = STATUS_MAP[key] || STATUS_MAP.pending;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      fontSize: 11,
      fontWeight: 500,
      color: s.c,
    }}>
      <span style={{
        width: 7, height: 7,
        borderRadius: "50%",
        background: s.c,
        boxShadow: `0 0 0 3px ${s.bg}`,
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
    Live:      "badge-soft-success",
    Upcoming:  "badge-soft-info",
    Draft:     "badge-soft-secondary",
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
