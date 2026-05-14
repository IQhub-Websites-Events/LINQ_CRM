import { useState, useRef } from "react";
import { parseFile } from "./fileParser";

const ACCEPTED = ".csv,.xlsx,.xls,.json";
const ACCEPTED_SET = new Set(["csv", "xlsx", "xls", "json"]);

function getExt(name) {
  return name.split(".").pop().toLowerCase();
}

export function FileUpload({ onParsed }) {
  const [dragging,  setDragging]  = useState(false);
  const [parsing,   setParsing]   = useState(false);
  const [error,     setError]     = useState("");
  const inputRef = useRef(null);

  async function handleFile(file) {
    if (!file) return;
    const ext = getExt(file.name);
    if (!ACCEPTED_SET.has(ext)) {
      setError(`Unsupported format ".${ext}". Please upload .csv, .xlsx, or .json`);
      return;
    }
    setError("");
    setParsing(true);
    try {
      const { columns, data } = await parseFile(file);
      if (!data.length) {
        setError("The file appears to be empty.");
        return;
      }
      onParsed({ columns, data, fileName: file.name });
    } catch (e) {
      setError(e.message || "Failed to parse file.");
    } finally {
      setParsing(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      {/* Drop zone */}
      <div
        onClick={() => !parsing && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          width: "100%",
          maxWidth: 520,
          border: `2px dashed ${dragging ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 12,
          background: dragging ? "rgba(64,81,137,0.06)" : "var(--surface-alt)",
          padding: "48px 32px",
          textAlign: "center",
          cursor: parsing ? "default" : "pointer",
          transition: "all 0.2s",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          style={{ display: "none" }}
          onChange={(e) => handleFile(e.target.files[0])}
        />

        {parsing ? (
          <>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Parsing file…</div>
            <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4 }}>
              Large files may take a few seconds
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📂</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
              Drag & drop your file here
            </div>
            <div style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 20 }}>
              or click to browse
            </div>
            <button
              style={{
                padding: "8px 22px",
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Browse Files
            </button>
            <div style={{ marginTop: 16, fontSize: 11, color: "var(--text-faint)" }}>
              Supported formats: .csv · .xlsx · .json
            </div>
          </>
        )}
      </div>

      {error && (
        <div style={{
          marginTop: 16,
          padding: "10px 16px",
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 8,
          fontSize: 13,
          color: "#ef4444",
          maxWidth: 520,
          width: "100%",
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
