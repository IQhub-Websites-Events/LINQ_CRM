import { useState } from "react";
import { FileUpload }     from "./import/FileUpload";
import { FieldMapping }   from "./import/FieldMapping";
import { Validation }     from "./import/Validation";
import { ImportProgress } from "./import/ImportProgress";
import { autoMapColumns } from "./import/autoMapper";

const STEPS = ["Upload File", "Map Fields", "Validate", "Import"];

// ── Step indicator ────────────────────────────────────────────────────────────
function StepBar({ step }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "0 0 20px" }}>
      {STEPS.map((label, i) => {
        const active   = i === step;
        const complete = i < step;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flex: "none" }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700,
                background: complete ? "#10b981" : active ? "var(--accent)" : "var(--surface-alt)",
                color: complete || active ? "#fff" : "var(--text-faint)",
                border: `2px solid ${complete ? "#10b981" : active ? "var(--accent)" : "var(--border)"}`,
                transition: "all 0.2s",
              }}>
                {complete ? "✓" : i + 1}
              </div>
              <span style={{
                fontSize: 10, fontWeight: active ? 700 : 500,
                color: active ? "var(--accent)" : complete ? "#10b981" : "var(--text-faint)",
                whiteSpace: "nowrap",
              }}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2, margin: "0 6px", marginBottom: 14,
                background: i < step ? "#10b981" : "var(--border)",
                transition: "background 0.3s",
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export function ImportModal({ open, onClose, onImportDone }) {
  const [step,       setStep]       = useState(0);
  const [fileData,   setFileData]   = useState(null);   // { columns, data, fileName }
  const [mapping,    setMapping]    = useState({});
  const [dupStrat,   setDupStrat]   = useState("skip"); // "skip" | "upsert"

  function reset() {
    setStep(0);
    setFileData(null);
    setMapping({});
    setDupStrat("skip");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleParsed(result) {
    setFileData(result);
    const autoMapping = autoMapColumns(result.columns);
    setMapping(autoMapping);
    setStep(1);
  }

  function handleAutoMap() {
    if (fileData) setMapping(autoMapColumns(fileData.columns));
  }

  function handleValidate() {
    setStep(2);
  }

  function handleStartImport() {
    setStep(3);
  }

  function handleImportDone() {
    reset();
    onClose();
    onImportDone?.();
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "32px 16px",
        overflowY: "auto",
      }}
      onClick={step < 3 ? handleClose : undefined}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 860,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 24px 0",
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "var(--text)" }}>
              Smart Import
            </div>
            {fileData && (
              <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                {fileData.fileName} · {fileData.data.length.toLocaleString()} rows · {fileData.columns.length} columns
              </div>
            )}
          </div>
          {step < 3 && (
            <button
              onClick={handleClose}
              style={{
                width: 30, height: 30, border: "none", background: "none",
                cursor: "pointer", color: "var(--text-faint)", fontSize: 18,
                lineHeight: 1, padding: 0, borderRadius: 6,
              }}
            >
              ×
            </button>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px 24px" }}>
          <StepBar step={step} />

          {/* Step 0 — Upload */}
          {step === 0 && (
            <FileUpload onParsed={handleParsed} />
          )}

          {/* Step 1 — Mapping */}
          {step === 1 && fileData && (
            <FieldMapping
              columns={fileData.columns}
              data={fileData.data}
              mapping={mapping}
              onChange={setMapping}
              onValidate={handleValidate}
              onAutoMap={handleAutoMap}
            />
          )}

          {/* Step 2 — Validation + duplicate strategy */}
          {step === 2 && fileData && (
            <>
              {/* Duplicate handling choice */}
              <div style={{
                marginBottom: 16, padding: "12px 16px",
                background: "var(--surface-alt)", border: "1px solid var(--border)",
                borderRadius: 8,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
                  Duplicate handling (checked by Invoice Number)
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  {[
                    { val: "skip",   label: "Skip duplicates",   desc: "Existing records are left unchanged" },
                    { val: "upsert", label: "Update existing",   desc: "Overwrite matching records with new data" },
                  ].map(({ val, label, desc }) => (
                    <label key={val} style={{
                      flex: 1, display: "flex", alignItems: "flex-start", gap: 8,
                      padding: "10px 12px",
                      background: dupStrat === val ? "rgba(64,81,137,0.08)" : "var(--surface)",
                      border: `1px solid ${dupStrat === val ? "var(--accent)" : "var(--border)"}`,
                      borderRadius: 7, cursor: "pointer",
                    }}>
                      <input
                        type="radio" name="dupStrat" value={val}
                        checked={dupStrat === val}
                        onChange={() => setDupStrat(val)}
                        style={{ marginTop: 2, accentColor: "var(--accent)" }}
                      />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{label}</div>
                        <div style={{ fontSize: 11, color: "var(--text-faint)" }}>{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <Validation
                mapping={mapping}
                data={fileData.data}
                onBack={() => setStep(1)}
                onImport={handleStartImport}
              />
            </>
          )}

          {/* Step 3 — Progress */}
          {step === 3 && fileData && (
            <ImportProgress
              mapping={mapping}
              data={fileData.data}
              fileName={fileData.fileName}
              duplicateStrategy={dupStrat}
              onDone={handleImportDone}
            />
          )}
        </div>
      </div>
    </div>
  );
}
