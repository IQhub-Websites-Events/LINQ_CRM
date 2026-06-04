/**
 * TicketStatusBadge / TicketPriorityBadge
 * ────────────────────────────────────────
 * Mirrors components/ui/Badge.jsx StatusBadge, with ticket-specific colours.
 */

const STATUS_MAP = {
  draft:            { c: "var(--text-faint)", bg: "var(--surface-alt)",          l: "Draft" },
  mr_submitted:     { c: "#3b82f6",           bg: "rgba(59, 130, 246, 0.12)",    l: "MR Submitted" },
  completed:        { c: "var(--success)",    bg: "var(--success-soft)",         l: "Completed" },
  returned:         { c: "var(--danger)",     bg: "var(--danger-soft)",          l: "Returned" },
};

const PRIORITY_MAP = {
  AS:    { c: "var(--text-faint)", bg: "var(--surface-alt)",          l: "AS"    },
  AD:    { c: "#3b82f6",           bg: "rgba(59, 130, 246, 0.12)",    l: "AD"    },
  SPEX:  { c: "#8b5cf6",           bg: "rgba(139, 92, 246, 0.12)",    l: "SPEX"  },
  DD:    { c: "var(--warn)",       bg: "var(--warn-soft)",            l: "DD"    },
  ASSOC: { c: "var(--success)",    bg: "var(--success-soft)",         l: "ASSOC" },
  MEDIA: { c: "#f97316",           bg: "rgba(249, 115, 22, 0.12)",    l: "MEDIA" },
  AB:    { c: "var(--danger)",     bg: "var(--danger-soft)",          l: "AB"    },
};

export function TicketStatusBadge({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.draft;
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
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.c, flexShrink: 0 }} />
      {s.l}
    </span>
  );
}

export function TicketPriorityBadge({ priority }) {
  const p = PRIORITY_MAP[priority];
  if (!p) return null;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      fontSize: 10,
      fontWeight: 600,
      color: p.c,
      background: p.bg,
      border: `1px solid ${p.c}22`,
      borderRadius: 4,
      padding: "2px 7px",
      whiteSpace: "nowrap",
    }}>
      {p.l}
    </span>
  );
}
