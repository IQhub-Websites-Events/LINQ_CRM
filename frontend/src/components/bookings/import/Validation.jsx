import { useMemo } from "react";
import { APP_FIELDS } from "./fieldDefinitions";

function buildIssues(mapping, data) {
  const issues = [];

  // ERROR: required fields not mapped
  for (const field of APP_FIELDS) {
    if (field.required && !mapping[field.key]) {
      issues.push({
        type: "error",
        message: `"${field.label}" is required but not mapped — import is blocked`,
      });
    }
  }

  // WARNING: required mapped fields have empty values in some rows
  for (const field of APP_FIELDS) {
    const srcCol = mapping[field.key];
    if (!srcCol || !data.length) continue;
    const emptyRows = data.filter((row) => {
      const v = row[srcCol];
      return v == null || String(v).trim() === "";
    }).length;
    if (emptyRows > 0 && field.required) {
      issues.push({
        type: "warning",
        message: `"${field.label}": ${emptyRows.toLocaleString()} row${emptyRows !== 1 ? "s" : ""} have empty values`,
      });
    }
  }

  // INFO: optional fields not mapped
  for (const field of APP_FIELDS) {
    if (!field.required && !mapping[field.key]) {
      issues.push({
        type: "info",
        message: `"${field.label}" not mapped — will be blank`,
      });
    }
  }

  return issues;
}

const ICON = { error: "✖", warning: "⚠", info: "ℹ" };
const COLOR = { error: "#ef4444", warning: "#f59e0b", info: "var(--text-faint)" };
const BG    = { error: "rgba(239,68,68,0.06)", warning: "rgba(245,158,11,0.06)", info: "transparent" };
const BORDER= { error: "rgba(239,68,68,0.2)",  warning: "rgba(245,158,11,0.2)",  info: "var(--border)" };

export function Validation({ mapping, data, onBack, onImport }) {
  const issues  = useMemo(() => buildIssues(mapping, data), [mapping, data]);
  const errors  = issues.filter((i) => i.type === "error");
  const warnings= issues.filter((i) => i.type === "warning");
  const infos   = issues.filter((i) => i.type === "info");
  const blocked = errors.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary box */}
      <div style={{
        padding: "14px 18px",
        background: blocked ? "rgba(239,68,68,0.06)" : "rgba(16,185,129,0.06)",
        border: `1px solid ${blocked ? "rgba(239,68,68,0.25)" : "rgba(16,185,129,0.25)"}`,
        borderRadius: 10,
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: blocked ? "#ef4444" : "#10b981", marginBottom: 4 }}>
          {blocked ? `${errors.length} error${errors.length !== 1 ? "s" : ""} found — fix before importing` : "Ready to import"}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
          {data.length.toLocaleString()} row{data.length !== 1 ? "s" : ""} · {warnings.length} warning{warnings.length !== 1 ? "s" : ""} · {infos.length} info
        </div>
      </div>

      {/* Issues list */}
      <div style={{
        maxHeight: 380, overflowY: "auto",
        border: "1px solid var(--border)", borderRadius: 8,
      }}>
        {[...errors, ...warnings, ...infos].map((issue, i) => (
          <div
            key={i}
            style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "9px 14px",
              background: BG[issue.type],
              borderBottom: "1px solid var(--border)",
              borderLeft: `3px solid ${COLOR[issue.type]}`,
            }}
          >
            <span style={{ fontSize: 13, color: COLOR[issue.type], flexShrink: 0, marginTop: 1 }}>
              {ICON[issue.type]}
            </span>
            <span style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.5 }}>
              {issue.message}
            </span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <button
          onClick={onBack}
          style={{
            padding: "8px 20px", fontSize: 13, fontWeight: 500,
            background: "var(--surface-alt)", border: "1px solid var(--border)",
            borderRadius: 8, cursor: "pointer", color: "var(--text-dim)",
            fontFamily: "inherit",
          }}
        >
          ← Edit Mapping
        </button>
        <button
          onClick={onImport}
          disabled={blocked}
          style={{
            padding: "9px 28px", fontSize: 13, fontWeight: 600,
            background: blocked ? "var(--surface-alt)" : "var(--accent)",
            color: blocked ? "var(--text-faint)" : "#fff",
            border: `1px solid ${blocked ? "var(--border)" : "var(--accent)"}`,
            borderRadius: 8, cursor: blocked ? "not-allowed" : "pointer",
            fontFamily: "inherit", transition: "all 0.15s",
          }}
        >
          Import {data.length.toLocaleString()} rows →
        </button>
      </div>
    </div>
  );
}
