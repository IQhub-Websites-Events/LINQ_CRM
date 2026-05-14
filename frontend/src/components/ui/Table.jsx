/**
 * Reusable table primitives: SortableTh, Pager, EmptyState.
 */
export function SortableTh({ children, sortKey, sort, onSort, align = "left", width, noSort }) {
  const active = !noSort && sortKey && sort?.key === sortKey;
  return (
    <th onClick={() => !noSort && sortKey && onSort(sortKey)} width={width}
      style={{
        position: "sticky", top: 0, zIndex: 3,
        background: "var(--surface-alt)", color: "var(--text-faint)",
        fontSize: 10, fontWeight: 600, textTransform: "uppercase",
        letterSpacing: ".5px", padding: "8px 12px",
        textAlign: align, borderBottom: "1px solid var(--border)",
        whiteSpace: "nowrap", cursor: noSort ? "default" : "pointer",
        userSelect: "none",
      }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
        {children}
        {active && sort?.dir && (
          <span style={{ fontSize: 9 }}>{sort.dir === "asc" ? "↑" : "↓"}</span>
        )}
      </span>
    </th>
  );
}

export function Td({ children, mono, muted, right, style = {} }) {
  return (
    <td style={{
      padding: "8px 12px", verticalAlign: "middle",
      fontFamily: mono ? "Courier New, monospace" : "inherit",
      fontSize: mono ? 11.5 : "inherit",
      color: muted ? "var(--text-dim)" : "inherit",
      textAlign: right ? "right" : "left",
      whiteSpace: "nowrap",
      ...style,
    }}>
      {children}
    </td>
  );
}

export function Pager({ page, totalPages, total, pageSize, onPage }) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);
  return (
    <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border)",
      background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "space-between",
      flexShrink: 0 }}>
      <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
        Showing <strong style={{ color: "var(--text)" }}>{from}–{to}</strong>{" "}
        of <strong style={{ color: "var(--text)" }}>{total}</strong>
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <PgBtn onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1}>‹</PgBtn>
        <span style={{ fontSize: 11.5, color: "var(--text-dim)", padding: "0 10px", fontWeight: 500 }}>
          {page} / {totalPages}
        </span>
        <PgBtn onClick={() => onPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>›</PgBtn>
      </div>
    </div>
  );
}

function PgBtn({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border)",
        background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center",
        cursor: disabled ? "default" : "pointer", color: "var(--text-dim)", fontSize: 13,
        opacity: disabled ? 0.3 : 1 }}>
      {children}
    </button>
  );
}

export function EmptyState({ title, subtitle }) {
  return (
    <tr>
      <td colSpan={999}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "60px 20px", textAlign: "center", color: "var(--text-faint)" }}>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 12, opacity: 0.3 }}>
            <rect x="6" y="4" width="28" height="32" rx="3" />
            <path d="M13 14h14M13 20h10" />
          </svg>
          <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-dim)", margin: "0 0 4px" }}>{title}</p>
          {subtitle && <span style={{ fontSize: 12 }}>{subtitle}</span>}
        </div>
      </td>
    </tr>
  );
}
