import { operatorLabel } from "./FilterBuilderModal";

/**
 * Applied-filter chips. One pill per criterion with an × that removes it
 * immediately — no modal round-trip, since removing a filter needs no
 * confirmation and no draft.
 *
 * Renders nothing when there are no criteria, so callers can mount it
 * unconditionally.
 */

const NO_VALUE_OPS = new Set(["is_empty", "is_not_empty"]);
const MAX_LISTED = 3;
const MAX_TEXT = 28;

function labelForChoice(cfg, raw) {
  const choices = cfg?.choices;
  if (!choices) return String(raw);
  const hit = choices.find((c) =>
    (typeof c === "object" ? c.value : c) === raw
    // ids can arrive as strings from a <select>
    || String(typeof c === "object" ? c.value : c) === String(raw));
  if (!hit) return String(raw);
  return typeof hit === "object" ? hit.label : String(hit);
}

function ellipsize(s) {
  const str = String(s);
  return str.length > MAX_TEXT ? `${str.slice(0, MAX_TEXT - 1)}…` : str;
}

/** Human value text for one criterion, or "" when the operator takes none. */
export function describeValue(criterion, cfg) {
  if (NO_VALUE_OPS.has(criterion.op)) return "";

  if (criterion.values !== undefined) {
    const list = criterion.values.map((v) => labelForChoice(cfg, v));
    if (criterion.op === "between") {
      return `${ellipsize(list[0] ?? "")} and ${ellipsize(list[1] ?? "")}`;
    }
    const shown = list.slice(0, MAX_LISTED).map(ellipsize).join(", ");
    const extra = list.length - MAX_LISTED;
    return extra > 0 ? `${shown} +${extra} more` : shown;
  }

  if (cfg?.type === "boolean") return criterion.value ? "Yes" : "No";
  return ellipsize(labelForChoice(cfg, criterion.value));
}

export function FilterChips({ criteria, schema, onRemove, onClearAll }) {
  if (!criteria || criteria.length === 0) return null;
  const fields = schema?.fields || {};

  return (
    <div style={wrap}>
      {criteria.map((c, i) => {
        const cfg = fields[c.field];
        const fieldLabel = cfg?.label || c.field;
        const valueText = describeValue(c, cfg);
        return (
          <span key={`${c.field}-${c.op}-${i}`} style={chip}>
            <span style={{ color: "var(--text-dim)" }}>{fieldLabel}</span>
            <span style={{ color: "var(--text-faint)" }}>{operatorLabel(c.op)}</span>
            {valueText && <span style={{ fontWeight: 600 }}>{valueText}</span>}
            <button
              onClick={() => onRemove(i)}
              style={chipX}
              title={`Remove filter: ${fieldLabel}`}
            >
              ✕
            </button>
          </span>
        );
      })}

      {criteria.length >= 2 && (
        <button onClick={onClearAll} style={clearBtn}>Clear all</button>
      )}
    </div>
  );
}

const wrap = {
  display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6,
  padding: "6px 0",
};

const chip = {
  display: "inline-flex", alignItems: "center", gap: 5,
  padding: "3px 6px 3px 9px", borderRadius: 12,
  background: "var(--surface-alt)", border: "1px solid var(--border)",
  fontSize: 11.5, color: "var(--text)", whiteSpace: "nowrap",
  maxWidth: "100%",
};

const chipX = {
  border: "none", background: "none", cursor: "pointer",
  padding: "0 2px", fontSize: 10, lineHeight: 1,
  color: "var(--text-faint)", fontFamily: "inherit",
};

const clearBtn = {
  border: "none", background: "none", cursor: "pointer",
  fontSize: 11.5, fontWeight: 600, color: "var(--accent)",
  fontFamily: "inherit", padding: "0 4px",
};

export default FilterChips;
