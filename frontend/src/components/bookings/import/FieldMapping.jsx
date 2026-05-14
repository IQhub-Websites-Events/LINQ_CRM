import { useState, useMemo } from "react";
import { APP_FIELDS } from "./fieldDefinitions";
import { formatDateValue } from "./dateFormatter";

// ── small stat pill ───────────────────────────────────────────────────────────
function Pill({ label, value, color }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "4px 10px",
      background: color ? `${color}12` : "var(--surface-alt)",
      border: `1px solid ${color ? `${color}30` : "var(--border)"}`,
      borderRadius: 6, fontSize: 11, fontWeight: 600,
      color: color ?? "var(--text-dim)",
    }}>
      <span style={{ fontWeight: 700, fontFamily: "monospace" }}>{value}</span>
      <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>{label}</span>
    </div>
  );
}

// ── preview table ─────────────────────────────────────────────────────────────
function PreviewTable({ mapping, data }) {
  const mapped = APP_FIELDS.filter((f) => mapping[f.key]);
  if (!mapped.length || !data.length) return null;
  const rows = data.slice(0, 3);

  return (
    <div style={{ marginTop: 16, overflowX: "auto" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
        Data Preview (first 3 rows)
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>
            {mapped.map((f) => (
              <th key={f.key} style={{
                padding: "5px 8px", textAlign: "left", fontSize: 10,
                fontWeight: 700, color: "var(--text-faint)",
                textTransform: "uppercase", letterSpacing: "0.04em",
                background: "var(--surface-alt)", border: "1px solid var(--border)",
                whiteSpace: "nowrap",
              }}>
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {mapped.map((f) => {
                const raw = row[mapping[f.key]];
                const val = f.isDate ? formatDateValue(raw) : (raw ?? "—");
                return (
                  <td key={f.key} style={{
                    padding: "5px 8px", border: "1px solid var(--border)",
                    color: val ? "var(--text)" : "var(--text-faint)",
                    fontStyle: val ? "normal" : "italic",
                    maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {String(val) || "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export function FieldMapping({ columns, data, mapping, onChange, onValidate, onAutoMap }) {
  const [search, setSearch] = useState("");

  // Which source columns are already in use (by another field)
  const usedSources = useMemo(() => new Set(Object.values(mapping).filter(Boolean)), [mapping]);

  const requiredMissing = APP_FIELDS.filter((f) => f.required && !mapping[f.key]).length;
  const mappedCount     = Object.values(mapping).filter(Boolean).length;
  const unmappedSources = columns.filter((c) => !usedSources.has(c));

  const visibleFields = search
    ? APP_FIELDS.filter((f) =>
        f.label.toLowerCase().includes(search.toLowerCase()) ||
        f.key.toLowerCase().includes(search.toLowerCase())
      )
    : APP_FIELDS;

  function setField(fieldKey, srcCol) {
    // If another field already maps to srcCol, clear it first
    const updated = { ...mapping };
    if (srcCol) {
      for (const [k, v] of Object.entries(updated)) {
        if (v === srcCol && k !== fieldKey) updated[k] = "";
      }
    }
    updated[fieldKey] = srcCol;
    onChange(updated);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Stats bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Pill label="Mapped"   value={mappedCount}     color="#10b981" />
        <Pill label="Required missing" value={requiredMissing} color={requiredMissing > 0 ? "#ef4444" : "#10b981"} />
        <Pill label="Unmapped source cols" value={unmappedSources.length} />
        <div style={{ flex: 1 }} />
        <button
          onClick={onAutoMap}
          style={{
            padding: "5px 14px", fontSize: 12, fontWeight: 600,
            background: "var(--surface-alt)", border: "1px solid var(--border)",
            borderRadius: 7, cursor: "pointer", color: "var(--text-dim)",
            fontFamily: "inherit",
          }}
        >
          ↺ Re-run Auto Map
        </button>
      </div>

      {/* Search */}
      <input
        placeholder="Search fields…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          padding: "7px 12px", fontSize: 13,
          background: "var(--surface-alt)", border: "1px solid var(--border)",
          borderRadius: 8, color: "var(--text)", outline: "none",
          fontFamily: "inherit",
        }}
      />

      {/* Field mapping rows */}
      <div style={{
        maxHeight: 340, overflowY: "auto",
        border: "1px solid var(--border)", borderRadius: 8,
        background: "var(--surface)",
      }}>
        {/* Header */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 24px 1fr",
          gap: 8, padding: "8px 14px",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-alt)",
        }}>
          {["App Field", "", "Source Column"].map((h, i) => (
            <span key={i} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {h}
            </span>
          ))}
        </div>

        {visibleFields.map((field) => {
          const val = mapping[field.key] || "";
          const isMapped = !!val;
          return (
            <div
              key={field.key}
              style={{
                display: "grid", gridTemplateColumns: "1fr 24px 1fr",
                gap: 8, padding: "8px 14px",
                borderBottom: "1px solid var(--border)",
                alignItems: "center",
                background: isMapped ? "rgba(16,185,129,0.03)" : "transparent",
              }}
            >
              {/* App field label */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: "var(--text)" }}>
                  {field.label}
                </span>
                {field.required && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: "#ef4444",
                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                    borderRadius: 4, padding: "1px 5px", textTransform: "uppercase",
                  }}>
                    REQ
                  </span>
                )}
              </div>

              {/* Connector */}
              <div style={{
                height: 1, background: isMapped ? "var(--accent)" : "var(--border)",
                borderStyle: isMapped ? "solid" : "dashed",
                borderWidth: isMapped ? 0 : "1px 0 0 0",
                opacity: 0.6,
              }} />

              {/* Source dropdown + clear */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <select
                  value={val}
                  onChange={(e) => setField(field.key, e.target.value)}
                  style={{
                    flex: 1, padding: "5px 8px", fontSize: 12,
                    background: "var(--surface-alt)", border: `1px solid ${isMapped ? "var(--accent)" : "var(--border)"}`,
                    borderRadius: 6, color: val ? "var(--text)" : "var(--text-faint)",
                    outline: "none", fontFamily: "inherit", cursor: "pointer",
                  }}
                >
                  <option value="">— not mapped —</option>
                  {columns.map((col) => (
                    <option
                      key={col}
                      value={col}
                      disabled={usedSources.has(col) && col !== val}
                    >
                      {usedSources.has(col) && col !== val ? `${col} (in use)` : col}
                    </option>
                  ))}
                </select>
                {isMapped && (
                  <button
                    onClick={() => setField(field.key, "")}
                    title="Clear mapping"
                    style={{
                      width: 22, height: 22, border: "none", background: "none",
                      cursor: "pointer", color: "var(--text-faint)", fontSize: 14,
                      lineHeight: 1, padding: 0, flexShrink: 0,
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Unmapped source columns */}
      {unmappedSources.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            Unmapped source columns (will be ignored)
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {unmappedSources.map((c) => (
              <span key={c} style={{
                fontSize: 11, padding: "3px 8px",
                background: "var(--surface-alt)", border: "1px solid var(--border)",
                borderRadius: 5, color: "var(--text-faint)",
              }}>
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Preview */}
      <PreviewTable mapping={mapping} data={data} />

      {/* Validate button */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
        <button
          onClick={onValidate}
          disabled={requiredMissing > 0}
          style={{
            padding: "9px 26px", fontSize: 13, fontWeight: 600,
            background: requiredMissing > 0 ? "var(--surface-alt)" : "var(--accent)",
            color: requiredMissing > 0 ? "var(--text-faint)" : "#fff",
            border: `1px solid ${requiredMissing > 0 ? "var(--border)" : "var(--accent)"}`,
            borderRadius: 8, cursor: requiredMissing > 0 ? "not-allowed" : "pointer",
            fontFamily: "inherit", transition: "all 0.15s",
          }}
        >
          {requiredMissing > 0
            ? `${requiredMissing} required field${requiredMissing > 1 ? "s" : ""} not mapped`
            : "Validate →"}
        </button>
      </div>
    </div>
  );
}
