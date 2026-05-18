import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { invoicesApi } from "../../api";
import { useToast } from "../../contexts/ToastContext";

// ── Field definitions ──────────────────────────────────────────────────────────

const APP_FIELDS = [
  { key: "invoice_number",         label: "Invoice Number",   required: false },
  { key: "event_code",             label: "Event Code",       required: true  },
  { key: "event_name",             label: "Event Name",       required: false },
  { key: "booking_code",           label: "Booking Code",     required: false },
  { key: "contact_name",           label: "Name",             required: false },
  { key: "contact_email",          label: "Delegate Email",   required: false },
  { key: "request_date",           label: "Request Date",     required: false },
  { key: "invoice_date",           label: "Invoice Date",     required: false },
  { key: "company_name",           label: "Delegate Company", required: false },
  { key: "contact_phone",          label: "Direct Line",      required: false },
  { key: "accounts_contact_email", label: "Accounts Contact", required: false },
  { key: "payment_status",         label: "Payment Status",   required: false },
  { key: "paid_or_free",           label: "Paid/Free",        required: false },
  { key: "payment_date",           label: "Date Paid",        required: false },
  { key: "payment_type",           label: "Payment Type",     required: false },
  { key: "ticket_tier",            label: "Ticket Tier",      required: false },
  { key: "discount_code",          label: "Discount Code / Coupon", required: false },
  { key: "discount",               label: "Discount Value",   required: false },
  { key: "add_ons",                label: "Add-Ons",          required: false },
  { key: "reference",              label: "Ref",              required: false },
  { key: "sales_executive",        label: "Sales Executive",  required: false },
  { key: "attendance",             label: "Attendance",       required: false },
  { key: "created_at",             label: "Added Time",       required: false },
  { key: "delegate_count",         label: "Delegate Count",   required: false },
  { key: "edition",                label: "Edition Year",     required: false },
  { key: "position",               label: "Job Title",        required: false },
  { key: "notes",                  label: "Notes",            required: false },
];

const ALIAS_MAP = {
  invoice_number:         ["invoice number", "invoice no", "inv number", "inv no", "invoice #"],
  event_code:             ["event code", "eventcode", "evt code"],
  event_name:             ["event name", "eventname", "evt name", "event title"],
  request_date:           ["request date", "requestdate", "req date"],
  invoice_date:           ["invoice date", "invoicedate", "inv date"],
  booking_code:           ["booking code", "bookingcode", "booking ref", "booking reference", "booking no"],
  company_name:           ["company name", "delegate company", "company", "organisation", "organization"],
  contact_name:           ["name", "contact name", "full name", "delegate name", "person name"],
  contact_email:          ["email", "contact email", "delegate email", "email address", "e-mail"],
  contact_phone:          ["phone", "contact phone", "direct line", "telephone", "tel", "mobile"],
  accounts_contact_email: ["accounts contact", "accounts email", "finance email", "billing email"],
  payment_status:         ["payment status", "paymentstatus", "pay status"],
  paid_or_free:           ["paid/free", "paid or free", "paid free"],
  payment_date:           ["date paid", "payment date", "paymentdate", "pay date", "paid date"],
  payment_type:           ["payment type", "paymenttype", "pay type", "payment method"],
  ticket_tier:            ["ticket tier", "tickettier", "tier", "ticket type"],
  discount_code:          ["discount code", "coupon", "promo code", "discountcoupon"],
  discount:               ["discount", "discount value", "discount amount", "price reduction"],
  add_ons:                ["add-ons", "addons", "extras", "additional"],
  reference:              ["ref", "reference", "ref no", "reference number"],
  sales_executive:        ["sales executive", "salesexecutive", "sales rep", "account manager"],
  attendance:             ["attendance", "attendance in", "attended", "checked in", "present"],
  created_at:             ["added time", "created at", "createdat", "date added", "timestamp"],
  delegate_count:         ["count of rows", "delegate count", "row count", "total delegates"],
  edition:                ["edition", "edition year", "year of event", "event year"],
  position:               ["job title", "position", "role", "designation", "title"],
  notes:                  ["notes", "remarks", "comment", "comments"],
};

const ACCEPT_EXTS = [".xlsx", ".xls", ".csv", ".json"];
const BATCH_SIZE  = 500;
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ── Parsing helpers ────────────────────────────────────────────────────────────

function fmtDateDisplay(d) {
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${day} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function excelSerialToDate(serial) {
  return new Date((Math.floor(serial) - 25569) * 86400 * 1000);
}

function detectExcelDateCols(columns, rows) {
  const dateCols = new Set();
  const sample = rows.slice(0, 10);
  for (const col of columns) {
    for (const row of sample) {
      const v = row[col];
      if (typeof v === "number" && v > 30000 && v < 100000) { dateCols.add(col); break; }
    }
  }
  return dateCols;
}

async function parseXLSXFile(file) {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { columns: [], data: [] };
  const rawRows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });
  if (!rawRows.length) return { columns: [], data: [] };
  const columns = Object.keys(rawRows[0]);
  const dateCols = detectExcelDateCols(columns, rawRows);
  const data = rawRows.map(row => {
    const out = {};
    for (const col of columns) {
      const raw = row[col];
      out[col] = (dateCols.has(col) && typeof raw === "number")
        ? fmtDateDisplay(excelSerialToDate(raw))
        : (raw == null ? "" : String(raw));
    }
    return out;
  });
  return { columns, data };
}

function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const columns = result.meta.fields || [];
        const data = result.data.map(row => {
          const out = {};
          for (const col of columns) out[col] = String(row[col] ?? "");
          return out;
        });
        resolve({ columns, data });
      },
      error: (err) => reject(new Error(err.message)),
    });
  });
}

async function parseJSONFile(file) {
  const text = await file.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error("Invalid JSON — could not parse file"); }
  let rows;
  if (Array.isArray(parsed)) {
    rows = parsed;
  } else if (parsed && typeof parsed === "object") {
    const arrayKey = Object.keys(parsed).find(k => Array.isArray(parsed[k]));
    rows = arrayKey ? parsed[arrayKey] : [parsed];
  } else {
    throw new Error("Unrecognized JSON structure");
  }
  const flatten = (obj) => {
    const out = {};
    for (const [k, v] of Object.entries(obj || {})) {
      if (v !== null && !Array.isArray(v) && typeof v === "object") {
        for (const [k2, v2] of Object.entries(v)) out[`${k}.${k2}`] = String(v2 ?? "");
      } else if (Array.isArray(v)) {
        out[k] = v.join(", ");
      } else {
        out[k] = String(v ?? "");
      }
    }
    return out;
  };
  const flatRows = rows.map(flatten);
  const columns = flatRows.length ? [...new Set(flatRows.flatMap(Object.keys))] : [];
  return { columns, data: flatRows };
}

async function parseFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "csv")               return parseCSVFile(file);
  if (ext === "xlsx" || ext === "xls") return parseXLSXFile(file);
  if (ext === "json")              return parseJSONFile(file);
  throw new Error(`Unsupported file type: .${ext}. Accepted: .xlsx, .csv, .json`);
}

// ── Auto-mapper ────────────────────────────────────────────────────────────────

function normalizeForMatch(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

function autoMap(sourceColumns) {
  const used = new Set();
  const mapping = {};
  for (const field of APP_FIELDS) {
    const aliases = ALIAS_MAP[field.key] || [];
    let bestScore = 0, bestCol = null;
    for (const col of sourceColumns) {
      if (used.has(col)) continue;
      const normCol = normalizeForMatch(col);
      for (const alias of aliases) {
        const normAlias = normalizeForMatch(alias);
        let score = 0;
        if (normCol === normAlias) {
          score = 100;
        } else if (normCol.includes(normAlias) || normAlias.includes(normCol)) {
          score = 70;
        } else {
          const colWords = new Set(normCol.split(" ").filter(Boolean));
          const aliasWords = normAlias.split(" ").filter(Boolean);
          const overlap = aliasWords.filter(w => colWords.has(w)).length;
          if (overlap > 0) score = Math.round((overlap / Math.max(aliasWords.length, 1)) * 60);
        }
        if (score > bestScore) { bestScore = score; bestCol = col; }
      }
    }
    if (bestScore >= 40 && bestCol) { mapping[field.key] = bestCol; used.add(bestCol); }
  }
  return mapping;
}

// ── Row transformer ────────────────────────────────────────────────────────────

function transformRow(row, mapping) {
  const out = {};
  for (const field of APP_FIELDS) {
    const src = mapping[field.key];
    out[field.key] = src ? (row[src] ?? "") : "";
  }
  return out;
}

// ── Design tokens ──────────────────────────────────────────────────────────────

const B    = "var(--border)";
const SA   = "var(--surface-alt)";
const T    = "var(--text)";
const TD   = "var(--text-dim)";
const TF   = "var(--text-faint)";
const ACC  = "var(--accent)";

// ── Step 1: File Upload ────────────────────────────────────────────────────────

function Step1Upload({ onParsed }) {
  const [dragging, setDragging] = useState(false);
  const [parsing,  setParsing]  = useState(false);
  const [error,    setError]    = useState(null);
  const inputRef = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    setError(null);
    setParsing(true);
    try {
      const result = await parseFile(file);
      if (!result.data.length) throw new Error("File appears to be empty");
      onParsed({ ...result, fileName: file.name });
    } catch (e) {
      setError(e.message);
    } finally {
      setParsing(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div style={{ padding: "32px 28px", display: "flex", flexDirection: "column", gap: 20, alignItems: "center" }}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          width: "100%", maxWidth: 520,
          border: `2px dashed ${dragging ? ACC : B}`,
          borderRadius: 12,
          padding: "48px 24px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
          background: dragging ? `color-mix(in srgb, ${ACC} 6%, var(--surface))` : SA,
          transition: "all .15s",
          cursor: "pointer",
        }}
        onClick={() => !parsing && inputRef.current?.click()}
      >
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke={dragging ? ACC : TD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="4" width="28" height="32" rx="3" />
          <path d="M14 13h12M14 19h12M14 25h8" />
          <path d="M28 28l4 4m0 0l4-4m-4 4v-8" />
        </svg>

        {parsing ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: T }}>Parsing file…</div>
            <div style={{ fontSize: 12, color: TF }}>This may take a moment for large files</div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: T }}>
              {dragging ? "Drop to upload" : "Drag & drop your file here"}
            </div>
            <div style={{ fontSize: 12, color: TF }}>or click to browse</div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: TF, textTransform: "uppercase",
              letterSpacing: "0.08em", marginTop: 4,
            }}>
              .xlsx · .csv · .json
            </div>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv,.json"
        style={{ display: "none" }}
        onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ""; }}
      />

      {error && (
        <div style={{
          width: "100%", maxWidth: 520,
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: 8, padding: "10px 14px",
          fontSize: 12, color: "#ef4444",
        }}>
          {error}
        </div>
      )}

      <div style={{ fontSize: 11, color: TF, textAlign: "center", maxWidth: 420, lineHeight: 1.6 }}>
        Files are parsed <strong style={{ color: TD }}>entirely in your browser</strong> — no data is uploaded until you confirm the import.
        Datasets of 13,000+ rows are supported.
      </div>
    </div>
  );
}

// ── Step 2: Field Mapping ──────────────────────────────────────────────────────

function Step2Mapping({ columns, data, mapping, setMapping, onNext }) {
  const [search, setSearch] = useState("");

  const usedCols    = new Set(Object.values(mapping).filter(Boolean));
  const mapped      = APP_FIELDS.filter(f => mapping[f.key]).length;
  const reqMissing  = APP_FIELDS.filter(f => f.required && !mapping[f.key]).length;
  const unmappedSrc = columns.filter(c => !usedCols.has(c));

  const visibleFields = search.trim()
    ? APP_FIELDS.filter(f =>
        f.label.toLowerCase().includes(search.toLowerCase()) ||
        f.key.toLowerCase().includes(search.toLowerCase()))
    : APP_FIELDS;

  const setField = (fieldKey, srcCol) => {
    setMapping(prev => {
      const next = { ...prev };
      // Clear any other field that was using this source col
      if (srcCol) {
        for (const k of Object.keys(next)) {
          if (next[k] === srcCol && k !== fieldKey) delete next[k];
        }
        next[fieldKey] = srcCol;
      } else {
        delete next[fieldKey];
      }
      return next;
    });
  };

  // Preview table: first 3 rows with mapped columns
  const previewFields = APP_FIELDS.filter(f => mapping[f.key]).slice(0, 6);
  const previewRows   = data.slice(0, 3);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, flex: 1, minHeight: 0 }}>

      {/* Stats bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16,
        padding: "10px 20px",
        background: SA, borderBottom: `1px solid ${B}`,
        flexShrink: 0,
      }}>
        <StatChip label="Mapped" value={`${mapped} / ${APP_FIELDS.length}`} color={mapped === APP_FIELDS.length ? "#10b981" : ACC} />
        <StatChip label="Required Missing" value={reqMissing} color={reqMissing > 0 ? "#ef4444" : "#10b981"} />
        <StatChip label="Unmapped Source" value={unmappedSrc.length} color={TD} />
        <div style={{ flex: 1 }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search fields…"
          style={{
            height: 30, padding: "0 10px", fontSize: 12,
            border: `1px solid ${B}`, borderRadius: 6,
            background: "var(--surface)", color: T,
            outline: "none", fontFamily: "inherit", width: 160,
          }}
        />
        <button
          onClick={() => setMapping(autoMap(columns))}
          style={{
            height: 30, padding: "0 12px", fontSize: 11.5, fontWeight: 600,
            border: `1px solid ${B}`, borderRadius: 6,
            background: "var(--surface)", color: TD, cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          ↺ Re-run Auto Map
        </button>
      </div>

      {/* Field mapping rows */}
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
        {visibleFields.map(field => {
          const current = mapping[field.key] || "";
          return (
            <div key={field.key} style={{
              display: "grid",
              gridTemplateColumns: "220px 1fr",
              alignItems: "center",
              gap: 10,
              padding: "5px 20px",
              borderBottom: `1px solid ${B}`,
            }}>
              {/* Left: field label */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: T }}>{field.label}</span>
                {field.required && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: "#fff",
                    background: current ? "#10b981" : "#ef4444",
                    borderRadius: 3, padding: "1px 5px",
                    textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>
                    {current ? "MAPPED" : "REQ"}
                  </span>
                )}
              </div>

              {/* Right: dropdown + clear */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <select
                  value={current}
                  onChange={e => setField(field.key, e.target.value)}
                  style={{
                    flex: 1, height: 32, padding: "0 28px 0 8px",
                    border: `1px solid ${current ? ACC : B}`,
                    borderRadius: 5,
                    background: "var(--surface)",
                    color: current ? T : TF,
                    fontSize: 12, fontFamily: "inherit",
                    outline: "none", appearance: "none",
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 5' width='8' height='5'%3E%3Cpath d='M1 1l3 3 3-3' stroke='%239a978f' stroke-width='1.2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                    backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center",
                    backgroundSize: "8px 5px",
                  }}
                >
                  <option value="">— not mapped —</option>
                  {columns.map(col => (
                    <option
                      key={col}
                      value={col}
                      disabled={usedCols.has(col) && col !== current}
                    >
                      {col}{usedCols.has(col) && col !== current ? " (in use)" : ""}
                    </option>
                  ))}
                </select>
                {current && (
                  <button
                    onClick={() => setField(field.key, "")}
                    style={{
                      width: 26, height: 26, borderRadius: 4, border: `1px solid ${B}`,
                      background: SA, color: TD, cursor: "pointer",
                      fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                    title="Clear mapping"
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
      {unmappedSrc.length > 0 && (
        <div style={{
          padding: "8px 20px",
          borderTop: `1px solid ${B}`,
          background: SA, flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: TF, textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 8 }}>
            Unmapped source columns (will be ignored):
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
            {unmappedSrc.map(col => (
              <span key={col} style={{
                fontSize: 10, padding: "2px 8px",
                background: "var(--surface)", border: `1px solid ${B}`,
                borderRadius: 12, color: TD,
              }}>
                {col}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Preview table */}
      {previewFields.length > 0 && previewRows.length > 0 && (
        <div style={{ flexShrink: 0, borderTop: `1px solid ${B}`, padding: "10px 20px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: TF, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            Data Preview (first 3 rows)
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
              <thead>
                <tr>
                  {previewFields.map(f => (
                    <th key={f.key} style={{
                      padding: "4px 10px", textAlign: "left",
                      background: SA, border: `1px solid ${B}`,
                      fontSize: 10, fontWeight: 700, color: TD,
                      textTransform: "uppercase", letterSpacing: "0.04em",
                      whiteSpace: "nowrap",
                    }}>
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? "var(--surface)" : SA }}>
                    {previewFields.map(f => (
                      <td key={f.key} style={{
                        padding: "4px 10px", border: `1px solid ${B}`,
                        color: T, maxWidth: 160,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {mapping[f.key] ? (row[mapping[f.key]] ?? "") : ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: "10px 20px", borderTop: `1px solid ${B}`,
        background: SA, display: "flex", justifyContent: "flex-end",
        flexShrink: 0,
      }}>
        <button
          onClick={onNext}
          disabled={reqMissing > 0}
          style={{
            height: 34, padding: "0 20px", borderRadius: 5,
            background: reqMissing > 0 ? "var(--surface)" : ACC,
            border: reqMissing > 0 ? `1px solid ${B}` : "none",
            color: reqMissing > 0 ? TF : "#fff",
            fontSize: 12.5, fontWeight: 600, cursor: reqMissing > 0 ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {reqMissing > 0 ? `Map ${reqMissing} required field${reqMissing !== 1 ? "s" : ""} to continue` : "Validate →"}
        </button>
      </div>
    </div>
  );
}

function StatChip({ label, value, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: TF, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 800, color, fontFamily: "var(--font-mono)" }}>{value}</span>
    </div>
  );
}

// ── Step 3: Validation ─────────────────────────────────────────────────────────

function Step3Validation({ data, mapping, fileName, strategy, setStrategy, onBack, onNext }) {
  const issues = [];

  // Error: event_code (only truly required field) not mapped
  if (!mapping["event_code"]) {
    issues.push({ level: "error", message: `"Event Code" is required but not mapped — rows without an event code will be skipped` });
  } else {
    const emptyCode = data.filter(row => !(row[mapping["event_code"]] || "").trim()).length;
    if (emptyCode > 0) {
      issues.push({
        level: "warn",
        message: `${emptyCode.toLocaleString()} row${emptyCode !== 1 ? "s" : ""} have an empty Event Code — they will still be imported with a blank event code`,
      });
    }
  }

  // Info: optional fields not mapped
  const unmappedOptional = APP_FIELDS.filter(f => !f.required && !mapping[f.key]);
  if (unmappedOptional.length > 0) {
    issues.push({
      level: "info",
      message: `${unmappedOptional.length} optional field${unmappedOptional.length !== 1 ? "s" : ""} not mapped — will be blank (${unmappedOptional.map(f => f.label).slice(0, 3).join(", ")}${unmappedOptional.length > 3 ? "…" : ""})`,
    });
  }

  const hasErrors = issues.some(i => i.level === "error");
  const mapped    = APP_FIELDS.filter(f => mapping[f.key]).length;

  const levelStyle = {
    error: { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.3)", color: "#ef4444", icon: "✕" },
    warn:  { bg: "rgba(245,158,11,0.08)", border: "rgba(245,158,11,0.3)", color: "#f59e0b", icon: "⚠" },
    info:  { bg: "rgba(99,102,241,0.08)",  border: "rgba(99,102,241,0.3)",  color: "#6366f1", icon: "ℹ" },
  };

  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Summary */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10,
      }}>
        {[
          { label: "Rows to Import",   value: data.length.toLocaleString(),    color: T    },
          { label: "Fields Mapped",    value: `${mapped} / ${APP_FIELDS.length}`, color: ACC  },
          { label: "Source File",      value: fileName,                         color: TD   },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            background: SA, border: `1px solid ${B}`,
            borderRadius: 8, padding: "10px 14px",
          }}>
            <div style={{ fontSize: 9.5, color: TF, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>
              {label}
            </div>
            <div style={{
              fontSize: 13, fontWeight: 600, color,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Issues */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: TF, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Validation Results
        </div>
        {issues.length === 0 ? (
          <div style={{
            background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)",
            borderRadius: 7, padding: "10px 14px", fontSize: 12.5, color: "#10b981", fontWeight: 600,
          }}>
            ✓ All checks passed — ready to import
          </div>
        ) : issues.map((issue, i) => {
          const s = levelStyle[issue.level];
          return (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              background: s.bg, border: `1px solid ${s.border}`,
              borderRadius: 7, padding: "8px 12px",
            }}>
              <span style={{ fontSize: 12, color: s.color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>
                {s.icon}
              </span>
              <span style={{ fontSize: 12, color: T, lineHeight: 1.5 }}>{issue.message}</span>
            </div>
          );
        })}
      </div>

      {/* Duplicate strategy */}
      <div style={{
        background: SA, border: `1px solid ${B}`,
        borderRadius: 8, padding: "12px 16px",
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: TD, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Duplicate Handling (by Invoice Number)
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { value: "skip",            label: "Skip duplicates",          desc: "If an invoice number already exists, skip that row and continue" },
            { value: "upsert",          label: "Update existing records",  desc: "If an invoice number already exists, update it with the imported data" },
            { value: "keep_duplicate",  label: "Add as new delegate",      desc: "If an invoice number already exists, keep the booking and add this row as an additional delegate on the same invoice" },
          ].map(opt => (
            <label key={opt.value} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
              <input
                type="radio"
                name="strategy"
                value={opt.value}
                checked={strategy === opt.value}
                onChange={() => setStrategy(opt.value)}
                style={{ marginTop: 2, accentColor: ACC }}
              />
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: TF, marginTop: 1 }}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
        <button onClick={onBack} style={{
          height: 34, padding: "0 16px", borderRadius: 5,
          background: "var(--surface)", border: `1px solid ${B}`,
          color: T, fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
        }}>
          ← Edit Mapping
        </button>
        <button
          onClick={onNext}
          disabled={hasErrors}
          style={{
            height: 34, padding: "0 20px", borderRadius: 5,
            background: hasErrors ? "var(--surface)" : ACC,
            border: hasErrors ? `1px solid ${B}` : "none",
            color: hasErrors ? TF : "#fff",
            fontSize: 12.5, fontWeight: 600,
            cursor: hasErrors ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}
        >
          Start Import →
        </button>
      </div>
    </div>
  );
}

// ── Step 4: Import Progress ────────────────────────────────────────────────────

function Step4Progress({ data, mapping, strategy, fileName, onDone }) {
  const toast    = useToast();
  const started  = useRef(false);
  const [progress, setProgress] = useState({ processed: 0, total: data.length, inserted: 0, skipped: 0, errors: [], problemRows: [] });
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    runImport();
  }, []);

  const runImport = async () => {
    const total        = data.length;
    let inserted       = 0;
    let skipped        = 0;
    const allErrors    = [];
    const allProblemRows = []; // {row_index (global), invoice_number, reason/message}

    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batchRows  = data.slice(i, i + BATCH_SIZE).map(row => transformRow(row, mapping));
      const batchNum   = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(total / BATCH_SIZE);

      try {
        const result = await invoicesApi.bulkImport({
          batch_number:       batchNum,
          total_batches:      totalBatches,
          duplicate_strategy: strategy,
          rows:               batchRows,
        });
        inserted += result.inserted || 0;
        skipped  += result.skipped_duplicates || 0;
        if (result.errors?.length) {
          allErrors.push(...result.errors);
          result.errors.forEach(e => allProblemRows.push({
            row_index:      i + (e.row_index ?? 0),
            invoice_number: e.invoice_number || "",
            reason:         e.message || "error",
          }));
        }
        if (result.skipped_rows?.length) {
          result.skipped_rows.forEach(s => allProblemRows.push({
            row_index:      i + s.row_index,
            invoice_number: s.invoice_number || "",
            reason:         s.reason === "duplicate_invoice" ? "Duplicate invoice number" : s.reason,
          }));
        }
      } catch (err) {
        allErrors.push({
          batch:   batchNum,
          message: err?.response?.data?.detail || err.message || "Network error",
        });
      }

      const processed = Math.min(i + BATCH_SIZE, total);
      setProgress({ processed, total, inserted, skipped, errors: allErrors, problemRows: allProblemRows });

      // Yield between batches for a responsive UI
      await new Promise(r => requestAnimationFrame(r));
    }

    setDone(true);
    if (allErrors.length === 0) {
      toast.success(`${inserted.toLocaleString()} rows imported successfully`);
    } else {
      toast.warn(`Import complete with ${allErrors.length} error${allErrors.length !== 1 ? "s" : ""}`);
    }
  };

  const pct          = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;
  const barColor     = done ? (progress.errors.length ? "#f59e0b" : "#10b981") : ACC;

  const downloadProblemRows = () => {
    const problemRows = progress.problemRows;
    if (!problemRows.length) return;
    const srcCols = Object.keys(data[0] || {});
    const header  = ["Row #", "Invoice Number", "Reason", ...srcCols];
    const lines   = [header.join(",")];
    problemRows.forEach(({ row_index, invoice_number, reason }) => {
      const srcRow = data[row_index] || {};
      const vals   = srcCols.map(c => {
        const v = String(srcRow[c] ?? "").replace(/"/g, '""');
        return `"${v}"`;
      });
      lines.push([row_index + 1, `"${invoice_number}"`, `"${reason}"`, ...vals].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `import_problems_${fileName.replace(/\.[^.]+$/, "")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: "28px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

      {/* File info */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        background: SA, border: `1px solid ${B}`, borderRadius: 8, padding: "10px 14px",
      }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={TD} strokeWidth="1.5" strokeLinecap="round">
          <rect x="3" y="2" width="14" height="16" rx="2" />
          <path d="M7 7h6M7 10h6M7 13h4" />
        </svg>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: T }}>{fileName}</div>
          <div style={{ fontSize: 11, color: TF }}>{progress.total.toLocaleString()} rows · {Math.ceil(progress.total / BATCH_SIZE)} batch{Math.ceil(progress.total / BATCH_SIZE) !== 1 ? "es" : ""} of {BATCH_SIZE}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: T }}>
            {done ? "Import complete" : `Importing… ${Math.ceil(progress.processed / BATCH_SIZE)} / ${Math.ceil(progress.total / BATCH_SIZE)} batches`}
          </span>
          <span style={{ fontSize: 13, fontWeight: 800, color: barColor, fontFamily: "var(--font-mono)" }}>{pct}%</span>
        </div>
        <div style={{ width: "100%", height: 8, background: B, borderRadius: 4, overflow: "hidden" }}>
          <div style={{
            width: `${pct}%`, height: "100%", borderRadius: 4,
            background: barColor, transition: "width .3s ease",
          }} />
        </div>
        <div style={{ fontSize: 11, color: TF, marginTop: 5 }}>
          {progress.processed.toLocaleString()} / {progress.total.toLocaleString()} rows
        </div>
      </div>

      {/* Stats */}
      {(progress.inserted > 0 || progress.skipped > 0 || done) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {[
            { label: "Inserted",  value: progress.inserted.toLocaleString(),         color: "#10b981" },
            { label: "Skipped",   value: progress.skipped.toLocaleString(),          color: "#f59e0b" },
            { label: "Errors",    value: progress.errors.length.toLocaleString(),    color: progress.errors.length ? "#ef4444" : TF },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: SA, border: `1px solid ${B}`,
              borderRadius: 8, padding: "10px 14px", textAlign: "center",
            }}>
              <div style={{ fontSize: 9.5, color: TF, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "var(--font-mono)" }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Errors list */}
      {progress.errors.length > 0 && (
        <div style={{
          background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 8, padding: "10px 14px", maxHeight: 160, overflowY: "auto",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
            Import Errors
          </div>
          {progress.errors.slice(0, 20).map((err, i) => (
            <div key={i} style={{ fontSize: 11, color: T, padding: "2px 0" }}>
              {err.batch ? `Batch ${err.batch}: ${err.message}` : `Row ${err.row ?? i}: ${err.message}`}
            </div>
          ))}
          {progress.errors.length > 20 && (
            <div style={{ fontSize: 11, color: TF, marginTop: 4 }}>
              … and {progress.errors.length - 20} more
            </div>
          )}
        </div>
      )}

      {done && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
          {progress.problemRows.length > 0 && (
            <button onClick={downloadProblemRows} style={{
              height: 36, padding: "0 18px", borderRadius: 6,
              background: "var(--surface)", border: `1px solid ${B}`,
              color: TD, fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              display: "inline-flex", alignItems: "center", gap: 6,
            }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6.5 1v8M3 6l3.5 3.5L10 6" /><path d="M1 11h11" />
              </svg>
              Download {progress.problemRows.length} problem row{progress.problemRows.length !== 1 ? "s" : ""}
            </button>
          )}
          <button onClick={onDone} style={{
            height: 36, padding: "0 28px", borderRadius: 6,
            background: ACC, border: "none", color: "#fff",
            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>
            Done — View Bookings
          </button>
        </div>
      )}
    </div>
  );
}

// ── Step indicator ─────────────────────────────────────────────────────────────

function StepIndicator({ step }) {
  const steps = ["Upload", "Map Fields", "Validate", "Import"];
  return (
    <div style={{
      display: "flex", alignItems: "center",
      padding: "12px 24px",
      borderBottom: `1px solid ${B}`,
      background: SA, flexShrink: 0,
      gap: 0,
    }}>
      {steps.map((label, i) => {
        const num    = i + 1;
        const active = num === step;
        const done   = num < step;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: done ? "#10b981" : active ? ACC : B,
                fontSize: 10, fontWeight: 700,
                color: done || active ? "#fff" : TF,
                flexShrink: 0,
              }}>
                {done ? "✓" : num}
              </div>
              <span style={{
                fontSize: 11.5, fontWeight: active ? 700 : 500,
                color: active ? T : done ? TD : TF,
              }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 1, background: done ? "#10b981" : B, margin: "0 10px" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main modal ─────────────────────────────────────────────────────────────────

export function SmartImportModal({ open, onClose, onDone }) {
  const [step,     setStep]     = useState(1);
  const [fileData, setFileData] = useState(null);
  const [mapping,  setMapping]  = useState({});
  const [strategy, setStrategy] = useState("skip");

  const reset = () => { setStep(1); setFileData(null); setMapping({}); setStrategy("skip"); };

  const handleClose = () => { reset(); onClose(); };
  const handleDone  = () => { reset(); onDone?.(); onClose(); };

  if (!open) return null;

  const STEP_TITLES = ["", "Upload File", "Map Fields", "Validate & Configure", "Importing…"];

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 860,
          maxHeight: "calc(100vh - 48px)",
          background: "var(--surface)",
          border: `1px solid ${B}`,
          borderRadius: 12,
          boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "14px 20px",
          borderBottom: `1px solid ${B}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T }}>Smart Import</div>
            <div style={{ fontSize: 11, color: TF, marginTop: 1 }}>
              Import bookings from .xlsx, .csv, or .json files
            </div>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: 28, height: 28, borderRadius: 6,
              border: `1px solid ${B}`, background: SA,
              color: TD, cursor: "pointer", fontSize: 13,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* Step indicator */}
        <StepIndicator step={step} />

        {/* Step content */}
        <div style={{ flex: 1, minHeight: 0, overflowY: step === 2 ? "hidden" : "auto", display: "flex", flexDirection: "column" }}>
          {step === 1 && (
            <Step1Upload
              onParsed={(fd) => {
                setFileData(fd);
                setMapping(autoMap(fd.columns));
                setStep(2);
              }}
            />
          )}
          {step === 2 && fileData && (
            <Step2Mapping
              columns={fileData.columns}
              data={fileData.data}
              mapping={mapping}
              setMapping={setMapping}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && fileData && (
            <Step3Validation
              data={fileData.data}
              mapping={mapping}
              fileName={fileData.fileName}
              strategy={strategy}
              setStrategy={setStrategy}
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
            />
          )}
          {step === 4 && fileData && (
            <Step4Progress
              data={fileData.data}
              mapping={mapping}
              strategy={strategy}
              fileName={fileData.fileName}
              onDone={handleDone}
            />
          )}
        </div>
      </div>
    </div>
  );
}
