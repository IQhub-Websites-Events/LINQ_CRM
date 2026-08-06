import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Checkbox dropdown for column filters that accept several values at once,
 * e.g. Status = Paid + Cancelled.
 *
 * `value` is always an array; an empty array means "no filter". Changes are applied on
 * each tick rather than behind an Apply button, matching the other column filters.
 */
export function MultiSelectFilter({
  options = [],
  value = [],
  onChange,
  placeholder = "All",
  disabled = false,
  searchThreshold = 6,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef(null);
  const searchRef = useRef(null);

  // Accept ["Paid"] or [{ value, label }] so callers can use either shape.
  const items = useMemo(
    () => options.map((o) => (typeof o === "object" && o !== null
      ? { value: o.value, label: o.label ?? o.value }
      : { value: o, label: o })),
    [options]
  );

  const selected = Array.isArray(value) ? value : [];
  const showSearch = items.length > searchThreshold;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => String(i.label).toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocMouseDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open && showSearch) searchRef.current?.focus();
    if (!open) setQuery("");
  }, [open, showSearch]);

  const toggle = (v) => {
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
  };

  const label = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? (items.find((i) => i.value === selected[0])?.label ?? selected[0])
      : `${selected.length} selected`;

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        title={selected.length > 1 ? selected.join(", ") : undefined}
        style={{
          ...triggerStyle,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.55 : 1,
          borderColor: selected.length ? "var(--accent)" : "var(--border)",
          color: selected.length ? "var(--text)" : "var(--text-faint)",
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
        <svg width="9" height="6" viewBox="0 0 10 6" style={{ flexShrink: 0, marginLeft: 4 }}>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.3" fill="none"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div style={panelStyle}>
          {showSearch && (
            <div style={{ padding: 6, borderBottom: "1px solid var(--border)" }}>
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                style={searchStyle}
              />
            </div>
          )}

          <div style={{ maxHeight: 220, overflowY: "auto", padding: "4px 0" }}>
            {visible.length === 0 && (
              <div style={{ padding: "8px 10px", fontSize: 11, color: "var(--text-faint)" }}>
                No matches
              </div>
            )}
            {visible.map((item) => {
              const checked = selected.includes(item.value);
              return (
                <label key={item.value} style={{ ...rowStyle, background: checked ? "var(--surface-alt)" : "transparent" }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(item.value)}
                    style={{ width: 13, height: 13, cursor: "pointer", flexShrink: 0, accentColor: "var(--accent)" }}
                  />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.label}
                  </span>
                </label>
              );
            })}
          </div>

          <div style={footerStyle}>
            <button type="button" style={linkBtnStyle}
              onClick={() => onChange(items.map((i) => i.value))}>
              Select all
            </button>
            <button type="button" style={linkBtnStyle} onClick={() => onChange([])}>
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const triggerStyle = {
  width: "100%",
  height: 26,
  padding: "0 6px 0 8px",
  fontSize: 11,
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "var(--surface-alt)",
  fontFamily: "inherit",
  outline: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 2,
  textAlign: "left",
};

const panelStyle = {
  position: "absolute",
  top: "calc(100% + 3px)",
  left: 0,
  zIndex: 50,
  minWidth: "100%",
  width: "max-content",
  maxWidth: 260,
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  boxShadow: "0 6px 20px rgba(0,0,0,0.14)",
};

const searchStyle = {
  width: "100%",
  height: 24,
  padding: "0 7px",
  fontSize: 11,
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "var(--surface-alt)",
  color: "var(--text)",
  fontFamily: "inherit",
  outline: "none",
};

const rowStyle = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  padding: "5px 10px",
  fontSize: 11,
  color: "var(--text)",
  cursor: "pointer",
  userSelect: "none",
};

const footerStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  padding: "6px 10px",
  borderTop: "1px solid var(--border)",
};

const linkBtnStyle = {
  background: "none",
  border: "none",
  padding: 0,
  fontSize: 10.5,
  fontWeight: 600,
  color: "var(--accent)",
  cursor: "pointer",
  fontFamily: "inherit",
};

export default MultiSelectFilter;
