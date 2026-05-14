const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// Convert Excel serial number to Date
function excelSerialToDate(serial) {
  const utcDays = Math.floor(serial) - 25569;
  return new Date(utcDays * 86400 * 1000);
}

// Check if a value looks like an Excel serial date (number between 1990 and 2100)
export function isExcelSerial(val) {
  if (typeof val !== "number") return false;
  return val > 32874 && val < 73050; // ~1990 to ~2100
}

// Format a Date object as "DD Mon YYYY"
function fmtDate(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "";
  const day  = String(d.getDate()).padStart(2, "0");
  const mon  = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${mon} ${year}`;
}

// Parse any date-like string/value into "DD Mon YYYY"
export function formatDateValue(val) {
  if (val == null || val === "") return "";

  // Excel serial number
  if (isExcelSerial(val)) {
    return fmtDate(excelSerialToDate(val));
  }

  const s = String(val).trim();
  if (!s) return s;

  // Already in "DD Mon YYYY" or "D Mon YYYY" format
  if (/^\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}/.test(s)) return s;

  // ISO: YYYY-MM-DD or YYYY-MM-DDTHH:MM...
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(iso[0]);
    if (!isNaN(d.getTime())) return fmtDate(d);
  }

  // DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) {
    const d = new Date(`${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`);
    if (!isNaN(d.getTime())) return fmtDate(d);
  }

  // MM/DD/YYYY
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (mdy) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return fmtDate(d);
  }

  // Try native parse as fallback
  const d = new Date(s);
  if (!isNaN(d.getTime())) return fmtDate(d);

  return s; // return as-is if unparseable
}

// Detect which columns in sample rows likely contain date serials
export function detectSerialDateColumns(columns, sampleRows) {
  const serialCols = new Set();
  for (const col of columns) {
    let serialCount = 0;
    for (const row of sampleRows) {
      if (isExcelSerial(row[col])) serialCount++;
    }
    if (serialCount > sampleRows.length * 0.5) serialCols.add(col);
  }
  return serialCols;
}
