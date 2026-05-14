import Papa from "papaparse";
import * as XLSX from "xlsx";
import { detectSerialDateColumns, formatDateValue, isExcelSerial } from "./dateFormatter";

// Flatten one level of nested objects; join arrays to comma string
function flattenRow(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      out[k] = v.join(", ");
    } else if (v !== null && typeof v === "object") {
      for (const [k2, v2] of Object.entries(v)) {
        out[`${k}.${k2}`] = v2 == null ? "" : String(v2);
      }
    } else {
      out[k] = v == null ? "" : v;
    }
  }
  return out;
}

export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const columns = results.meta.fields || [];
        resolve({ columns, data: results.data });
      },
      error: (err) => reject(new Error(err.message)),
    });
  });
}

export function parseXLSX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array", cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];

        const rawData = XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });
        const fmtData = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false, dateNF: "dd/mm/yyyy" });

        if (!rawData.length) {
          resolve({ columns: [], data: [] });
          return;
        }

        const columns = Object.keys(rawData[0]);
        const sample  = rawData.slice(0, 10);
        const serialCols = detectSerialDateColumns(columns, sample);

        // Merge: use formatted value for serial-date columns, raw for everything else
        const data = rawData.map((rawRow, i) => {
          const fmtRow = fmtData[i] || {};
          const out = {};
          for (const col of columns) {
            const raw = rawRow[col];
            if (serialCols.has(col) && isExcelSerial(raw)) {
              out[col] = formatDateValue(raw);
            } else {
              out[col] = fmtRow[col] != null ? fmtRow[col] : raw;
            }
          }
          return out;
        });

        resolve({ columns, data });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsArrayBuffer(file);
  });
}

export function parseJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        let arr;

        if (Array.isArray(parsed)) {
          arr = parsed;
        } else if (typeof parsed === "object" && parsed !== null) {
          // Find first array value
          const arrayKey = Object.keys(parsed).find((k) => Array.isArray(parsed[k]));
          arr = arrayKey ? parsed[arrayKey] : [parsed];
        } else {
          throw new Error("Unrecognised JSON structure");
        }

        const flat = arr.map(flattenRow);
        const columns = flat.length > 0 ? Object.keys(flat[0]) : [];
        resolve({ columns, data: flat });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsText(file);
  });
}

export function parseFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv"))  return parseCSV(file);
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return parseXLSX(file);
  if (name.endsWith(".json")) return parseJSON(file);
  return Promise.reject(new Error("Unsupported file type. Please upload .csv, .xlsx, or .json"));
}
