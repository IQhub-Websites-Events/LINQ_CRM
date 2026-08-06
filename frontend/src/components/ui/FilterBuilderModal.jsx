import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { MultiSelectFilter } from "./MultiSelectFilter";
import { buildCriterion, specToJson, MAX_SPEC_BYTES } from "../../hooks/useFilterSpec";

/**
 * Criteria builder. Edits a DRAFT copy seeded from `criteria` when opened;
 * Apply hands the draft back, Cancel discards it. Chips outside this modal
 * mutate applied state directly — the modal never does until Apply.
 *
 * Field list, operator list and choices all come from `schema`; nothing about
 * them is hardcoded here except the human labels below.
 */

// Display labels only. The backend schema stays untouched.
export const OPERATOR_LABELS = {
  is: "is",
  is_not: "is not",
  contains: "contains",
  not_contains: "doesn't contain",
  starts_with: "starts with",
  ends_with: "ends with",
  any_of: "is any of",
  none_of: "is none of",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  gt: "greater than",
  gte: "greater or equal",
  lt: "less than",
  lte: "less or equal",
  between: "between",
  before: "before",
  after: "after",
};

const NO_VALUE_OPS = new Set(["is_empty", "is_not_empty"]);
const _warned = new Set();

/** Unlabelled operator = schema drift. Say so loudly, then show the raw key. */
export function operatorLabel(op) {
  const label = OPERATOR_LABELS[op];
  if (label) return label;
  if (!_warned.has(op)) {
    _warned.add(op);
    // eslint-disable-next-line no-console
    console.error(
      `[FilterBuilderModal] No OPERATOR_LABELS entry for operator "${op}". ` +
      `The backend schema offers it but the frontend has no label — add one.`,
    );
  }
  return op;
}

/** First operator a field supports, used when the field changes. */
function defaultOpFor(cfg) {
  return (cfg?.operators || [])[0] || "is";
}

/** Blank payload appropriate to the operator, so the row starts coherent. */
function blankPayload(op) {
  if (NO_VALUE_OPS.has(op)) return undefined;
  if (op === "between") return ["", ""];
  if (op === "any_of" || op === "none_of") return [];
  return "";
}

function payloadOf(criterion) {
  if (criterion.values !== undefined) return criterion.values;
  if (criterion.value !== undefined) return criterion.value;
  return undefined;
}

export function FilterBuilderModal({ open, onClose, schema, criteria, onApply }) {
  const [draft, setDraft] = useState([]);

  const fields = schema?.fields || {};
  const maxCriteria = schema?.max_criteria ?? 20;

  const fieldKeys = useMemo(
    () => Object.keys(fields).sort((a, b) =>
      (fields[a].label || a).localeCompare(fields[b].label || b)),
    [fields],
  );

  // Seed the draft each time the dialog opens.
  useEffect(() => {
    if (open) setDraft(criteria ? criteria.map((c) => ({ ...c })) : []);
  }, [open, criteria]);

  const setRow = (index, next) =>
    setDraft((d) => d.map((row, i) => (i === index ? next : row)));

  const changeField = (index, fieldKey) => {
    const cfg = fields[fieldKey];
    const op = defaultOpFor(cfg);
    setRow(index, buildCriterion(fieldKey, op, blankPayload(op)));
  };

  const changeOp = (index, op) => {
    const row = draft[index];
    setRow(index, buildCriterion(row.field, op, blankPayload(op)));
  };

  const changePayload = (index, payload) => {
    const row = draft[index];
    setRow(index, buildCriterion(row.field, row.op, payload));
  };

  const addRow = () => {
    const first = fieldKeys[0];
    if (!first) return;
    const op = defaultOpFor(fields[first]);
    setDraft((d) => [...d, buildCriterion(first, op, blankPayload(op))]);
  };

  const removeRow = (index) => setDraft((d) => d.filter((_, i) => i !== index));

  // Budget is evaluated against the DRAFT continuously — an over-budget spec
  // must never reach the network, because gunicorn answers 414 with no body.
  // Measure the ENCODED size — specToJson returns raw JSON, but the wire
  // carries the percent-encoded form.
  const json = specToJson(draft);
  const byteLength = json ? `filter_spec=${encodeURIComponent(json)}`.length : 0;
  const tooLarge = byteLength > MAX_SPEC_BYTES;
  const atCap = draft.length >= maxCriteria;

  if (!open) return null;

  const footer = (
    <>
      <button style={ghostBtn} onClick={onClose}>Cancel</button>
      <button
        style={{ ...primaryBtn, opacity: tooLarge ? 0.55 : 1, cursor: tooLarge ? "not-allowed" : "pointer" }}
        disabled={tooLarge}
        onClick={() => { onApply(draft); onClose(); }}
      >
        Apply{draft.length ? ` (${draft.length})` : ""}
      </button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} title="Filter" footer={footer} width={720}>
      {draft.length === 0 && (
        <div style={{ fontSize: 12.5, color: "var(--text-faint)", padding: "6px 0 12px" }}>
          No criteria yet. Every criterion you add must match — they are combined with AND.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {draft.map((row, i) => {
          const cfg = fields[row.field] || {};
          const ops = cfg.operators || [];
          return (
            <div key={i} style={rowStyle}>
              <span style={joinerStyle}>{i === 0 ? "Where" : "and"}</span>

              <select
                value={row.field}
                onChange={(e) => changeField(i, e.target.value)}
                style={{ ...selectStyle, flex: "0 0 200px" }}
              >
                {/* The label already carries any "(derived)" marker — the
                    Events registry bakes it in; there is no separate flag. */}
                {fieldKeys.map((k) => (
                  <option key={k} value={k}>{fields[k].label || k}</option>
                ))}
              </select>

              <select
                value={row.op}
                onChange={(e) => changeOp(i, e.target.value)}
                style={{ ...selectStyle, flex: "0 0 150px" }}
              >
                {ops.map((op) => (
                  <option key={op} value={op}>{operatorLabel(op)}</option>
                ))}
              </select>

              <div style={{ flex: 1, minWidth: 0 }}>
                <ValueInput cfg={cfg} op={row.op} payload={payloadOf(row)}
                  onChange={(v) => changePayload(i, v)} />
              </div>

              <button onClick={() => removeRow(i)} style={removeBtn} title="Remove">✕</button>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
        <button
          onClick={addRow}
          disabled={atCap}
          style={{ ...ghostBtn, opacity: atCap ? 0.5 : 1, cursor: atCap ? "not-allowed" : "pointer" }}
        >
          + Add criterion
        </button>
        {atCap && (
          <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>
            Maximum {maxCriteria} criteria.
          </span>
        )}
      </div>

      {tooLarge && (
        <div style={warnBox}>
          Filter too complex — remove a criterion or shorten values.
        </div>
      )}
    </Modal>
  );
}

/** Value control chosen by field type AND operator. */
function ValueInput({ cfg, op, payload, onChange }) {
  if (NO_VALUE_OPS.has(op)) return null;      // no input at all

  const type = cfg.type;
  const choices = cfg.choices || [];

  if (op === "any_of" || op === "none_of") {
    if (type === "choice" || type === "user_fk") {
      return (
        <MultiSelectFilter
          options={choices}
          value={Array.isArray(payload) ? payload : []}
          onChange={onChange}
          placeholder="Select…"
        />
      );
    }
    return <TagInput values={Array.isArray(payload) ? payload : []} onChange={onChange} />;
  }

  if (op === "between") {
    const pair = Array.isArray(payload) ? payload : ["", ""];
    const inputType = type === "date" ? "date" : "number";
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input type={inputType} value={pair[0] ?? ""} style={inputStyle}
          onChange={(e) => onChange([e.target.value, pair[1] ?? ""])} />
        <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>and</span>
        <input type={inputType} value={pair[1] ?? ""} style={inputStyle}
          onChange={(e) => onChange([pair[0] ?? "", e.target.value])} />
      </div>
    );
  }

  if ((type === "choice" || type === "user_fk") && choices.length > 0) {
    return (
      <select value={payload ?? ""} onChange={(e) => {
        const raw = e.target.value;
        const match = choices.find((c) =>
          String(typeof c === "object" ? c.value : c) === raw);
        onChange(typeof match === "object" ? match.value : raw);
      }} style={selectStyle}>
        <option value="">Choose…</option>
        {choices.map((c) => {
          const v = typeof c === "object" ? c.value : c;
          const l = typeof c === "object" ? c.label : c;
          return <option key={String(v)} value={String(v)}>{l}</option>;
        })}
      </select>
    );
  }

  if (type === "boolean") {
    return (
      <select
        value={payload === true ? "true" : payload === false ? "false" : ""}
        onChange={(e) => onChange(e.target.value === "" ? "" : e.target.value === "true")}
        style={selectStyle}
      >
        <option value="">Choose…</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }

  if (type === "date") {
    return <input type="date" value={payload ?? ""} style={inputStyle}
      onChange={(e) => onChange(e.target.value)} />;
  }

  // number: contains/not_contains go through a text cast server-side, so a
  // free-text box is correct there; everything else is numeric.
  if (type === "number" && op !== "contains" && op !== "not_contains") {
    return <input type="number" value={payload ?? ""} style={inputStyle}
      onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />;
  }

  return <input type="text" value={payload ?? ""} style={inputStyle}
    placeholder="Value…" onChange={(e) => onChange(e.target.value)} />;
}

/** Free-text multi-value entry: type, Enter adds a removable tag. */
function TagInput({ values, onChange }) {
  const [text, setText] = useState("");
  const commit = () => {
    const t = text.trim();
    if (!t) return;
    if (!values.includes(t)) onChange([...values, t]);
    setText("");
  };
  return (
    <div style={tagWrap}>
      {values.map((v) => (
        <span key={v} style={tagStyle}>
          {v}
          <button onClick={() => onChange(values.filter((x) => x !== v))} style={tagX} title="Remove">✕</button>
        </span>
      ))}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Backspace" && !text && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={values.length ? "" : "Type and press Enter…"}
        style={tagInput}
      />
    </div>
  );
}

const rowStyle = {
  display: "flex", alignItems: "center", gap: 8,
  padding: "6px 8px", borderRadius: 6, background: "var(--surface-alt)",
};

const joinerStyle = {
  flex: "0 0 46px", fontSize: 11, fontWeight: 600, textTransform: "uppercase",
  letterSpacing: "0.03em", color: "var(--text-faint)",
};

const inputStyle = {
  width: "100%", height: 30, padding: "0 9px", fontSize: 12.5,
  border: "1px solid var(--border)", borderRadius: 6,
  background: "var(--surface)", color: "var(--text)",
  fontFamily: "inherit", outline: "none",
};

const selectStyle = { ...inputStyle, cursor: "pointer" };

const removeBtn = {
  flex: "0 0 26px", height: 26, borderRadius: 6, border: "1px solid var(--border)",
  background: "var(--surface)", color: "var(--text-dim)", cursor: "pointer",
  fontSize: 12, fontFamily: "inherit",
};

const tagWrap = {
  display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4,
  minHeight: 30, padding: "3px 6px", border: "1px solid var(--border)",
  borderRadius: 6, background: "var(--surface)",
};

const tagStyle = {
  display: "inline-flex", alignItems: "center", gap: 4,
  padding: "1px 6px", borderRadius: 10, fontSize: 11.5,
  background: "var(--surface-alt)", color: "var(--text)",
  border: "1px solid var(--border)",
};

const tagX = {
  border: "none", background: "none", cursor: "pointer", padding: 0,
  fontSize: 10, color: "var(--text-faint)", fontFamily: "inherit",
};

const tagInput = {
  flex: 1, minWidth: 90, border: "none", outline: "none",
  background: "transparent", fontSize: 12.5, color: "var(--text)",
  fontFamily: "inherit", height: 22,
};

const warnBox = {
  marginTop: 12, padding: "8px 11px", borderRadius: 6,
  border: "1px solid var(--danger)", background: "var(--danger-soft)",
  color: "var(--danger)", fontSize: 12,
};

const ghostBtn = {
  padding: "6px 14px", fontSize: 12.5, borderRadius: 6,
  border: "1px solid var(--border)", background: "var(--surface)",
  color: "var(--text-dim)", cursor: "pointer", fontFamily: "inherit",
};

const primaryBtn = {
  padding: "6px 14px", fontSize: 12.5, fontWeight: 600, borderRadius: 6,
  border: "none", background: "var(--accent)", color: "#fff",
  cursor: "pointer", fontFamily: "inherit",
};

export default FilterBuilderModal;
