import { useState, useEffect } from "react";
import { invoicesApi, eventsApi } from "../../api";
import { useToast } from "../../contexts/ToastContext";
import { fmt, today } from "../../utils/helpers";

const COLS = [
  { key: "delegate_payment_status", label: "Pmt Status",   width: 180, type: "select", options: ["", "Pending", "Paid", "Cancelled", "Refunded", "Credit Pending (Free)", "Credit Pending (Paid)", "Credit Transferred", "Paid (Transferred)"] },
  { key: "_booking_code",           label: "Booking Code", width: 130, invoiceLevel: true },
  { key: "_request_date",           label: "Request Date", width: 130, type: "date",   invoiceLevel: true, readOnly: true },
  { key: "_invoice_date",           label: "Invoice Date", width: 130, type: "date",   invoiceLevel: true },
  { key: "_full_name",              label: "Name",         width: 160, virtual: "name" },
  { key: "position",                label: "Job Title",    width: 180 },
  { key: "_company_name",           label: "Company",      width: 180, invoiceLevel: true },
  { key: "email",                   label: "Email",        width: 240, type: "email" },
  { key: "phone_number",            label: "Direct Line",  width: 160, mono: true },
  { key: "attendance",              label: "Attendance",   width: 80,  type: "checkbox" },
  { key: "delegate_payment_type",   label: "Pmt Type",     width: 140, type: "select", options: ["", "Bank", "Stripe"] },
  { key: "delegate_payment_date",   label: "Pmt Date",     width: 150, type: "date" },
];

const BLANK_DELEGATE = () => ({
  first_name: "", last_name: "",
  email: "", phone_number: "", position: "",
  job_title_legacy: "",
  ticket_package: "", sponsorship_level: "",
  attendance: "Pending", dietary_requirements: "", notes: "",
  delegate_payment_status: "", delegate_payment_type: "", delegate_payment_date: null,
});

/* ═══════════════════════════════════════════════════════════
   AddBookingModal
═══════════════════════════════════════════════════════════ */
export function AddBookingModal({ onClose, onSaved }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState([]);

  const [form, setForm] = useState({
    invoice_number: "", event_code: "", event_name: "", booking_code: "",
    invoice_date: today(), paid_free: "Paid",
    payment_status: "Pending", payment_type: "", payment_date: null,
    payment_due_date: null, reference: "", add_ons: "",
    currency: "USD", discount: "", discount_code: "",
    pre_tax_amount: "", tax_amount: "", total_amount: "", add_ons_total_amount: "",
    company_name: "", accounts_contact_email: "",
    sales_executive: "", team_leader: "",
    delegates: [BLANK_DELEGATE()],
  });

  useEffect(() => {
    eventsApi.list({ page_size: 100 }).then(r => setEvents(r.results || [])).catch(() => { });
  }, []);

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const setDelegate = (idx, field, value) => setForm(p => {
    const next = [...p.delegates];
    next[idx] = { ...next[idx], [field]: value };
    return { ...p, delegates: next };
  });
  const addDelegate = () => setForm(p => ({ ...p, delegates: [...p.delegates, BLANK_DELEGATE()] }));
  const removeDelegate = idx => setForm(p => ({ ...p, delegates: p.delegates.filter((_, i) => i !== idx) }));

  const handleSave = async () => {
    if (!form.invoice_number.trim()) { toast.error("Invoice number is required"); return; }
    if (!form.event_code) { toast.error("Event code is required"); return; }
    const d0 = form.delegates[0];
    if (!d0.first_name.trim()) { toast.error("First delegate name is required"); return; }
    if (!d0.email.trim()) { toast.error("First delegate email is required"); return; }
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.discount === "" || payload.discount === null) payload.discount = "0";
      for (const f of ["pre_tax_amount", "tax_amount", "total_amount", "add_ons_total_amount"]) {
        if (payload[f] === "") payload[f] = null;
      }
      await invoicesApi.create(payload);
      toast.success("Booking created");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create booking");
    } finally {
      setSaving(false);
    }
  };

  const invoiceCtx = {
    request_date:     today(),
    payment_due_date: form.payment_due_date,
    company_name:     form.company_name,
    paid_free:        form.paid_free,
    invoice_date:     form.invoice_date,
    booking_code:     form.booking_code,
    payment_status:   form.payment_status,
    payment_type:     form.payment_type,
    payment_date:     form.payment_date,
  };

  return (
    <Overlay onClose={onClose}>
      <div style={modalBox}>

        {/* ── HEADER ── */}
        <div style={headerWrap}>
          <span style={headerTitle}>Add Booking</span>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        {/* ── INVOICE INFORMATION ── */}
        <div style={sectionWrap}>
          <SectionLabel>Invoice Information</SectionLabel>
          <div style={grid3}>
            <FGroup label="Invoice Number" req>
              <FInput mono value={form.invoice_number} onChange={v => set("invoice_number", v)} placeholder="INV-XXXX" />
            </FGroup>
            <FGroup label="Event Code" req>
              <FSelect
                value={form.event_code}
                onChange={v => {
                  const ev = events.find(x => x.event_code === v);
                  set("event_code", v);
                  set("event_name", ev?.name || "");
                }}
                options={[{ value: "", label: "— select event —" }, ...events.map(e => ({ value: e.event_code, label: e.event_code }))]}
              />
            </FGroup>
            <FGroup label="Invoice Date">
              <FInput type="date" value={fmt.dateInput(form.invoice_date)} onChange={v => set("invoice_date", v)} />
            </FGroup>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0 16px", marginTop: 10 }}>
            <FGroup label="Event Name">
              <FInput value={form.event_name} onChange={v => set("event_name", v)} placeholder="Auto-filled from event" />
            </FGroup>
            <FGroup label="Booking Code">
              <FInput value={form.booking_code} onChange={v => set("booking_code", v)} />
            </FGroup>
          </div>
        </div>

        {/* ── DELEGATE DETAILS ── */}
        <div style={delegateWrap}>
          <DelegateHeader count={form.delegates.length} onAdd={addDelegate} />
          <div style={{ overflowX: "auto" }}>
            <DelegateTable
              delegates={form.delegates}
              invoiceCtx={invoiceCtx}
              onSetInvoice={set}
              onRowChange={setDelegate}
              onRemoveRow={removeDelegate}
            />
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={footerWrap}>
          <span style={footerMeta}>
            {form.delegates.length} delegate{form.delegates.length !== 1 ? "s" : ""}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={btnOutline}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={btnPrimary}>
              {saving ? "Creating…" : "Save Booking"}
            </button>
          </div>
        </div>

      </div>
    </Overlay>
  );
}


/* ═══════════════════════════════════════════════════════════
   Delegate sub-components
═══════════════════════════════════════════════════════════ */

function DelegateHeader({ count, onAdd }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "7px 16px",
      background: BG_ALT,
      borderBottom: `1px solid ${BORDER}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={sectionLabelStyle}>Delegate Details</span>
        <span style={countBadge}>{count}</span>
      </div>
      <button onClick={onAdd} style={addDelegateBtn}>+ Add Delegate</button>
    </div>
  );
}

function DelegateTable({ delegates, invoiceCtx, onSetInvoice, onRowChange, onRemoveRow }) {
  return (
    <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
      <thead>
        <tr style={{ background: BG_ALT, position: "sticky", top: 0, zIndex: 3 }}>
          <th style={th({ width: 36 })} />
          <th style={th({ width: 50 })}>#</th>
          {COLS.map(c => <th key={c.key} style={th({ width: c.width })}>{c.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {delegates.map((d, idx) => (
          <DelegateRow
            key={d.id ?? `new-${idx}`}
            idx={idx}
            delegate={d}
            invoiceCtx={invoiceCtx}
            onSetInvoice={onSetInvoice}
            onChange={(field, val) => onRowChange(idx, field, val)}
            onRemove={delegates.length > 1 ? () => onRemoveRow(idx) : null}
          />
        ))}
      </tbody>
    </table>
  );
}

function DelegateRow({ idx, delegate, invoiceCtx, onSetInvoice, onChange, onRemove }) {
  return (
    <tr style={{ background: idx % 2 === 0 ? "#fff" : BG_ALT }}>
      <td style={{ ...tdCell, textAlign: "center", width: 36, padding: 0 }}>
        {onRemove && (
          <button onClick={onRemove} style={removeDelegateBtn} title="Remove delegate">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        )}
      </td>
      <td style={tdNum}>{idx + 1}</td>
      {COLS.map(c => {
        if (c.key === "_request_date") {
          return (
            <td key={c.key} style={tdCell}>
              <CellInput type="date" value={fmt.dateInput(invoiceCtx.request_date)} readOnly />
            </td>
          );
        }
        if (c.key === "_booking_code") {
          return (
            <td key={c.key} style={tdCell}>
              <CellInput value={invoiceCtx.booking_code || ""} onChange={v => onSetInvoice("booking_code", v)} />
            </td>
          );
        }
        if (c.key === "_invoice_date") {
          return (
            <td key={c.key} style={tdCell}>
              <CellInput type="date" value={fmt.dateInput(invoiceCtx.invoice_date || "")} onChange={v => onSetInvoice("invoice_date", v)} />
            </td>
          );
        }
        if (c.key === "_company_name") {
          return (
            <td key={c.key} style={tdCell}>
              <CellInput value={invoiceCtx.company_name || ""} onChange={v => onSetInvoice("company_name", v)} />
            </td>
          );
        }
        if (c.virtual === "name") {
          return (
            <td key={c.key} style={tdCell}>
              <NameCellInput delegate={delegate} onChange={onChange} />
            </td>
          );
        }
        if (c.type === "checkbox") {
          return (
            <td key={c.key} style={{ ...tdCell, textAlign: "center" }}>
              <input
                type="checkbox"
                checked={delegate[c.key] === "Attended"}
                onChange={e => onChange(c.key, e.target.checked ? "Attended" : "Pending")}
                style={{ width: 14, height: 14, cursor: "pointer", accentColor: "var(--accent)" }}
              />
            </td>
          );
        }
        if (c.key === "delegate_payment_status") {
          const eff = delegate.delegate_payment_status || invoiceCtx.payment_status || "";
          return (
            <td key={c.key} style={tdCell}>
              <CellSelect value={eff} onChange={v => onChange(c.key, v || null)} options={c.options} />
            </td>
          );
        }
        if (c.key === "delegate_payment_type") {
          const eff = delegate.delegate_payment_type || invoiceCtx.payment_type || "";
          return (
            <td key={c.key} style={tdCell}>
              <CellSelect value={eff} onChange={v => onChange(c.key, v || null)} options={c.options} />
            </td>
          );
        }
        if (c.key === "delegate_payment_date") {
          const eff = fmt.dateInput(delegate.delegate_payment_date || invoiceCtx.payment_date || "");
          return (
            <td key={c.key} style={tdCell}>
              <CellInput type="date" value={eff} onChange={v => onChange(c.key, v || null)} />
            </td>
          );
        }
        if (c.type === "select") {
          return (
            <td key={c.key} style={tdCell}>
              <CellSelect value={delegate[c.key] ?? ""} onChange={v => onChange(c.key, v)} options={c.options} />
            </td>
          );
        }
        return (
          <td key={c.key} style={tdCell}>
            <CellInput type={c.type || "text"} mono={c.mono}
              value={delegate[c.key] ?? ""} onChange={v => onChange(c.key, v)} />
          </td>
        );
      })}
    </tr>
  );
}


/* ═══════════════════════════════════════════════════════════
   Form-level inputs (Invoice / Payment sections)
═══════════════════════════════════════════════════════════ */

function FInput({ value, onChange, type = "text", mono, readOnly, placeholder, compact }) {
  const [f, setF] = useState(false);
  const h = compact ? 34 : 38;
  return (
    <input
      type={type}
      value={value ?? ""}
      readOnly={readOnly}
      placeholder={placeholder}
      onChange={e => onChange?.(e.target.value)}
      onFocus={() => setF(true)}
      onBlur={() => setF(false)}
      style={{
        width: "100%", height: h, padding: "0 10px",
        border: `1px solid ${f ? "var(--accent)" : BORDER}`,
        borderRadius: 4,
        background: readOnly ? BG_ALT : "#fff",
        color: readOnly ? TEXT_DIM : TEXT,
        fontSize: compact ? 12 : 13,
        fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
        outline: "none",
        boxShadow: f ? "0 0 0 2px var(--accent-soft)" : "none",
        cursor: readOnly ? "default" : "text",
        transition: "border-color .12s, box-shadow .12s",
        boxSizing: "border-box",
      }}
    />
  );
}

function FSelect({ value, onChange, options, compact }) {
  const [f, setF] = useState(false);
  const h = compact ? 34 : 38;
  return (
    <select
      value={value ?? ""}
      onChange={e => onChange?.(e.target.value)}
      onFocus={() => setF(true)}
      onBlur={() => setF(false)}
      style={{
        width: "100%", height: h, padding: "0 26px 0 10px",
        border: `1px solid ${f ? "var(--accent)" : BORDER}`,
        borderRadius: 4, background: "#fff", color: TEXT,
        fontSize: compact ? 12 : 13, fontFamily: "var(--font-sans)",
        outline: "none", appearance: "none", cursor: "pointer",
        boxShadow: f ? "0 0 0 2px var(--accent-soft)" : "none",
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236b7280' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat", backgroundPosition: "right 9px center",
        transition: "border-color .12s, box-shadow .12s",
        boxSizing: "border-box",
      }}
    >
      {options.map(o => {
        const val = typeof o === "string" ? o : o.value;
        const lbl = typeof o === "string" ? o : o.label;
        return <option key={val} value={val}>{lbl || "(none)"}</option>;
      })}
    </select>
  );
}

function FGroup({ label, req, compact, children }) {
  return (
    <div style={{ marginBottom: compact ? 6 : 0 }}>
      <label style={{
        display: "block",
        fontSize: 10.5, fontWeight: 600, color: TEXT_DIM,
        textTransform: "uppercase", letterSpacing: "0.05em",
        marginBottom: 4,
      }}>
        {label}{req && <span style={{ color: "var(--danger)", marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   Table cell inputs — transparent until focused
═══════════════════════════════════════════════════════════ */

function CellInput({ value, onChange, type = "text", mono, readOnly, placeholder }) {
  const [f, setF] = useState(false);
  return (
    <input
      type={type}
      value={value ?? ""}
      readOnly={readOnly}
      placeholder={placeholder ?? ""}
      spellCheck={false}
      autoComplete="off"
      onChange={e => onChange?.(e.target.value)}
      onFocus={() => setF(true)}
      onBlur={() => setF(false)}
      style={{
        width: "100%", height: 32, padding: "0 6px",
        border: `1px solid ${f ? "var(--accent)" : "transparent"}`,
        borderRadius: 3,
        background: readOnly ? "transparent" : (f ? "#fff" : "transparent"),
        color: readOnly ? TEXT_DIM : TEXT,
        fontSize: 12,
        fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
        outline: "none",
        boxShadow: f ? "0 0 0 2px var(--accent-soft)" : "none",
        cursor: readOnly ? "default" : "text",
        transition: "border-color .1s, background .1s",
        boxSizing: "border-box",
      }}
    />
  );
}

function NameCellInput({ delegate, onChange }) {
  const computed = [delegate.first_name, delegate.last_name].filter(Boolean).join(" ");
  const [val, setVal] = useState(computed);
  const [f, setF] = useState(false);

  useEffect(() => {
    if (!f) setVal(computed);
  }, [computed]);

  return (
    <input
      type="text"
      value={val}
      placeholder="First Last"
      onChange={e => {
        const v = e.target.value;
        setVal(v);
        const sp = v.indexOf(" ");
        if (sp === -1) {
          onChange("first_name", v);
          onChange("last_name", "");
        } else {
          onChange("first_name", v.slice(0, sp));
          onChange("last_name", v.slice(sp + 1));
        }
      }}
      onFocus={() => setF(true)}
      onBlur={() => {
        setF(false);
        const parts = val.trim().split(/\s+/);
        const fn = parts[0] || "";
        const ln = parts.slice(1).join(" ");
        onChange("first_name", fn);
        onChange("last_name", ln);
        setVal([fn, ln].filter(Boolean).join(" "));
      }}
      style={{
        width: "100%", height: 32, padding: "0 6px",
        border: `1px solid ${f ? "var(--accent)" : "transparent"}`,
        borderRadius: 3,
        background: f ? "#fff" : "transparent",
        color: TEXT, fontSize: 12, fontFamily: "var(--font-sans)",
        outline: "none",
        boxShadow: f ? "0 0 0 2px var(--accent-soft)" : "none",
        cursor: "text",
        transition: "border-color .1s, background .1s",
        boxSizing: "border-box",
      }}
    />
  );
}

function CellSelect({ value, onChange, options }) {
  const [f, setF] = useState(false);
  return (
    <select
      value={value ?? ""}
      onChange={e => onChange?.(e.target.value)}
      onFocus={() => setF(true)}
      onBlur={() => setF(false)}
      style={{
        width: "100%", height: 32, padding: "0 18px 0 6px",
        border: `1px solid ${f ? "var(--accent)" : "transparent"}`,
        borderRadius: 3,
        background: f ? "#fff" : "transparent",
        color: TEXT, fontSize: 12, fontFamily: "var(--font-sans)",
        outline: "none", appearance: "none", cursor: "pointer",
        boxShadow: f ? "0 0 0 2px var(--accent-soft)" : "none",
        backgroundImage: f
          ? "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5'%3E%3Cpath d='M1 1l3 3 3-3' stroke='%236b7280' stroke-width='1.2' fill='none'/%3E%3C/svg%3E\")"
          : "none",
        backgroundRepeat: "no-repeat", backgroundPosition: "right 4px center",
        transition: "border-color .1s, background .1s",
        boxSizing: "border-box",
      }}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}


/* ═══════════════════════════════════════════════════════════
   Layout atoms
═══════════════════════════════════════════════════════════ */

function Overlay({ onClose, children }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px 0",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <span style={sectionLabelStyle}>{children}</span>
      <div style={{ flex: 1, height: 1, background: BORDER }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Design tokens
═══════════════════════════════════════════════════════════ */

const BORDER = "var(--border)";
const BG_ALT = "var(--surface-alt)";
const TEXT = "var(--text)";
const TEXT_DIM = "var(--text-dim)";
const TEXT_FAINT = "var(--text-faint)";


/* ═══════════════════════════════════════════════════════════
   Style objects
═══════════════════════════════════════════════════════════ */

const modalBox = {
  width: "98%",
  maxWidth: 1650,
  maxHeight: "92vh",
  background: "#fff",
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  boxShadow: "0 4px 24px rgba(0,0,0,0.1)",
  overflowY: "auto",
};

const headerWrap = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "12px 20px",
  borderBottom: `1px solid ${BORDER}`,
  background: "#fff",
  position: "sticky", top: 0, zIndex: 20,
};

const headerTitle = {
  fontSize: 16, fontWeight: 700, color: TEXT,
  fontFamily: "var(--font-sans)", letterSpacing: "-0.01em",
};

const closeBtn = {
  width: 28, height: 28, borderRadius: 5,
  background: "transparent", border: `1px solid ${BORDER}`,
  color: TEXT_DIM, cursor: "pointer",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  fontSize: 12, flexShrink: 0, fontFamily: "var(--font-sans)",
};

const sectionWrap = {
  padding: "14px 20px 12px",
  borderBottom: `1px solid ${BORDER}`,
};

const sectionLabelStyle = {
  fontSize: 10, fontWeight: 700, color: TEXT_DIM,
  textTransform: "uppercase", letterSpacing: "0.07em",
  whiteSpace: "nowrap",
};

const delegateWrap = {
  borderBottom: `1px solid ${BORDER}`,
};

const footerWrap = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "10px 20px",
  background: "#fff",
  position: "sticky", bottom: 0, zIndex: 20,
  borderTop: `1px solid ${BORDER}`,
};

const footerMeta = {
  fontSize: 12, color: TEXT_FAINT,
};

const btnOutline = {
  height: 36, padding: "0 16px", borderRadius: 5,
  background: "#fff", border: `1px solid ${BORDER}`,
  color: TEXT, fontSize: 12.5, fontWeight: 500,
  cursor: "pointer", fontFamily: "inherit",
};

const btnPrimary = {
  height: 36, padding: "0 18px", borderRadius: 5,
  background: "var(--accent)", border: "none",
  color: "#fff", fontSize: 12.5, fontWeight: 500,
  cursor: "pointer", fontFamily: "inherit",
};

const addDelegateBtn = {
  height: 30, padding: "0 12px", borderRadius: 4,
  background: "#fff", border: `1px solid var(--accent)`,
  color: "var(--accent)", fontSize: 11.5, fontWeight: 500,
  cursor: "pointer", fontFamily: "inherit",
  display: "inline-flex", alignItems: "center",
};

const countBadge = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  minWidth: 20, height: 20, borderRadius: 10,
  background: "var(--accent)", color: "#fff",
  fontSize: 10, fontWeight: 700, padding: "0 5px",
};

const grid3 = {
  display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 16px",
};

const th = (extra = {}) => ({
  padding: "0 8px", height: 32,
  textAlign: "left", verticalAlign: "middle",
  fontSize: 10, fontWeight: 700, color: TEXT_DIM,
  fontFamily: "var(--font-sans)", letterSpacing: "0.05em",
  textTransform: "uppercase",
  borderBottom: `2px solid ${BORDER}`,
  borderRight: `1px solid ${BORDER}`,
  whiteSpace: "nowrap",
  background: BG_ALT,
  userSelect: "none",
  ...extra,
});

const tdCell = {
  padding: "2px 2px",
  borderBottom: `1px solid ${BORDER}`,
  borderRight: `1px solid ${BORDER}`,
  verticalAlign: "middle",
};

const removeDelegateBtn = {
  width: 22, height: 22, borderRadius: 4,
  background: "none", border: "none",
  color: "var(--danger)", fontSize: 15, lineHeight: 1,
  cursor: "pointer", fontFamily: "inherit",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  opacity: 0.7,
};

const tdNum = {
  padding: "0 8px", textAlign: "center",
  fontSize: 11, color: TEXT_DIM, fontWeight: 500,
  borderBottom: `1px solid ${BORDER}`,
  borderRight: `1px solid ${BORDER}`,
  verticalAlign: "middle",
  background: BG_ALT, userSelect: "none",
  minWidth: 50,
};
