import { useState, useEffect, useRef } from "react";
import { APP_FIELDS } from "./fieldDefinitions";
import { formatDateValue } from "./dateFormatter";
import { invoicesApi } from "../../../api";

const BATCH_SIZE = 500;

// Transform a raw data row into the mapped payload using the field mapping
function transformRow(row, mapping) {
  const out = {};
  for (const field of APP_FIELDS) {
    const srcCol = mapping[field.key];
    const raw = srcCol ? row[srcCol] : undefined;
    if (raw == null || raw === "") {
      out[field.key] = "";
    } else if (field.isDate) {
      out[field.key] = formatDateValue(raw);
    } else {
      out[field.key] = String(raw).trim();
    }
  }
  return out;
}

export function ImportProgress({ mapping, data, fileName, duplicateStrategy, onDone }) {
  const [imported,   setImported]   = useState(0);
  const [skipped,    setSkipped]    = useState(0);
  const [errors,     setErrors]     = useState([]);
  const [done,       setDone]       = useState(false);
  const [failed,     setFailed]     = useState(false);
  const [failedBatch,setFailedBatch]= useState(null);
  const started = useRef(false);

  const total      = data.length;
  const totalBatches = Math.ceil(total / BATCH_SIZE);
  const pct = total > 0 ? Math.round((imported + skipped) / total * 100) : 0;

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    runImport();
  }, []); // eslint-disable-line

  async function runImport(resumeFromBatch = 0) {
    setFailed(false);
    setFailedBatch(null);

    const rows = data.map((r) => transformRow(r, mapping));

    for (let b = resumeFromBatch; b < totalBatches; b++) {
      const batch = rows.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);

      // Yield to the browser between batches
      await new Promise((r) => requestAnimationFrame(r));

      try {
        const res = await invoicesApi.bulkImport({
          rows: batch,
          duplicate_strategy: duplicateStrategy,
          batch_number: b + 1,
          total_batches: totalBatches,
        });

        setImported((prev) => prev + (res.inserted ?? 0));
        setSkipped((prev)  => prev + (res.skipped_duplicates ?? 0));
        if (res.errors?.length) {
          setErrors((prev) => [...prev, ...res.errors.map((e) => ({ ...e, batch: b + 1 }))]);
        }
      } catch (err) {
        setFailed(true);
        setFailedBatch(b);
        return;
      }
    }

    setDone(true);
  }

  const mappedCount = APP_FIELDS.filter((f) => mapping[f.key]).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "8px 0" }}>
      {/* Progress bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
            {done ? "Import complete" : failed ? "Import paused" : "Importing…"}
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "var(--text-dim)" }}>
            {(imported + skipped).toLocaleString()} / {total.toLocaleString()} rows
          </span>
        </div>
        <div style={{ background: "var(--border)", borderRadius: 6, height: 10, overflow: "hidden" }}>
          <div style={{
            width: `${pct}%`, height: "100%", borderRadius: 6,
            background: failed ? "#f59e0b" : done ? "#10b981" : "var(--accent)",
            transition: "width 0.3s ease",
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 3 }}>
          <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "monospace" }}>{pct}%</span>
        </div>
      </div>

      {/* Live counters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {[
          { label: "Inserted",   value: imported, color: "#10b981" },
          { label: "Skipped",    value: skipped,  color: "#f59e0b" },
          { label: "Row errors", value: errors.length, color: errors.length ? "#ef4444" : "var(--text-faint)" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: "var(--surface-alt)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "10px 14px", textAlign: "center",
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "monospace" }}>
              {value.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Error list */}
      {errors.length > 0 && (
        <div style={{ maxHeight: 140, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
          {errors.map((e, i) => (
            <div key={i} style={{ padding: "6px 12px", borderBottom: "1px solid var(--border)", fontSize: 11, color: "var(--text-dim)" }}>
              <span style={{ color: "#ef4444", fontWeight: 600 }}>Batch {e.batch} row {e.row_index}: </span>
              {e.message}
            </div>
          ))}
        </div>
      )}

      {/* Retry on failure */}
      {failed && (
        <div style={{
          padding: "14px 18px",
          background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)",
          borderRadius: 10,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#f59e0b", marginBottom: 6 }}>
            Batch {(failedBatch ?? 0) + 1} failed — network or server error
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 10 }}>
            {(imported + skipped).toLocaleString()} / {total.toLocaleString()} rows processed before failure
          </div>
          <button
            onClick={() => runImport(failedBatch)}
            style={{
              padding: "7px 20px", fontSize: 12, fontWeight: 600,
              background: "#f59e0b", color: "#fff", border: "none",
              borderRadius: 7, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Retry from batch {(failedBatch ?? 0) + 1}
          </button>
        </div>
      )}

      {/* Completion summary */}
      {done && (
        <div style={{
          padding: "18px 20px",
          background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.25)",
          borderRadius: 10,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#10b981", marginBottom: 8 }}>
            ✓ Import finished
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--text-dim)" }}>
            <span>📄 File: <strong style={{ color: "var(--text)" }}>{fileName}</strong></span>
            <span>🔗 Fields mapped: <strong style={{ color: "var(--text)" }}>{mappedCount}</strong></span>
            <span>✅ Rows imported: <strong style={{ color: "#10b981" }}>{imported.toLocaleString()}</strong></span>
            {skipped > 0 && <span>⏭ Skipped (duplicates): <strong style={{ color: "#f59e0b" }}>{skipped.toLocaleString()}</strong></span>}
            {errors.length > 0 && <span>⚠ Row errors: <strong style={{ color: "#ef4444" }}>{errors.length}</strong></span>}
          </div>
          <button
            onClick={onDone}
            style={{
              marginTop: 14, padding: "8px 22px", fontSize: 13, fontWeight: 600,
              background: "var(--accent)", color: "#fff", border: "none",
              borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Close & Refresh Bookings
          </button>
        </div>
      )}
    </div>
  );
}
