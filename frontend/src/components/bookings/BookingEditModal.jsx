import { useState, useEffect, useCallback, useRef } from "react";
import { invoicesApi, eventsApi } from "../../api";
import { useToast } from "../../contexts/ToastContext";
import { Avatar } from "../ui/Avatar";
import { StatusBadge } from "../ui/Badge";
import { SourceBadge } from "../ui/SourceBadge";
import { fmt } from "../../utils/helpers";

const BOOKING_CODES = [
  "", "Speaker", "Delegate", "Group Pass", "SPP", "SPP / Group Pass",
  "PLT SpEx", "GLD SpEx", "SLV SpEx",
  "Speaker / PLT SpEx", "Speaker / GLD SpEx", "Speaker / SLV SpEx",
  "Speaker / PTN SpEx", "Speaker / Group Pass",
  "PTN SpEx",
  "Upgraded to PLT SpEx", "Upgraded to GLD SpEx", "Upgraded to SLV SpEx",
  "Speaker Table", "Advisory Board Member", "Complimentary", "Media", "Add-Ons",
];

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
  delegate_payment_status: null, delegate_payment_type: null, delegate_payment_date: null,
});

/* ═══════════════════════════════════════════════════════════
   BookingEditModal
═══════════════════════════════════════════════════════════ */
export function BookingEditModal({ invoiceId, onClose, onSaved }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [events, setEvents] = useState([]);

  const load = useCallback(async () => {
    if (!invoiceId) return;
    setLoading(true);
    try {
      const inv = await invoicesApi.get(invoiceId);
      setForm({
        id:             inv.id,
        invoice_number: inv.invoice_number || "",
        event_code:     inv.event_code     || "",
        event_name:     inv.event_name     || "",
        booking_code:   inv.booking_code   || "",
        invoice_date:   inv.invoice_date   || null,
        paid_free:      inv.paid_free      || "Paid",
        payment_status:       inv.payment_status       || "Pending",
        payment_type:         inv.payment_type         || "",
        payment_date:         inv.payment_date         || null,
        payment_due_date:     inv.payment_due_date     || null,
        reference:            inv.reference            || "",
        add_ons:              inv.add_ons              || "",
        currency:             inv.currency             || "USD",
        discount:             inv.discount             ?? "",
        discount_code:        inv.discount_code        || "",
        pre_tax_amount:       inv.pre_tax_amount       ?? "",
        tax_amount:           inv.tax_amount           ?? "",
        total_amount:         inv.total_amount         ?? "",
        add_ons_total_amount: inv.add_ons_total_amount ?? "",
        company_name:           inv.company_name           || "",
        accounts_contact_email: inv.accounts_contact_email || "",
        sales_executive: inv.sales_executive != null ? String(inv.sales_executive) : "",
        team_leader:     inv.team_leader     != null ? String(inv.team_leader)     : "",
        source:    inv.source    || "manual",
        form_name: inv.form_name || "",
        form_url:  inv.form_url  || "",
        notes:     inv.notes     || "",
        delegates: (inv.delegates || []).map(d => ({
          id:                      d.id,
          first_name:              d.first_name              || "",
          last_name:               d.last_name               || "",
          email:                   d.email                   || "",
          phone_number:            d.phone_number            || "",
          position:                d.position                || "",
          job_title_legacy:        "",
          ticket_package:          d.ticket_package          || "",
          sponsorship_level:       d.sponsorship_level       || "",
          attendance:              d.attendance              || "Pending",
          dietary_requirements:    d.dietary_requirements    || "",
          notes:                   d.notes                   || "",
          delegate_payment_status: d.delegate_payment_status ?? null,
          delegate_payment_type:   d.delegate_payment_type   ?? null,
          delegate_payment_date:   d.delegate_payment_date   ?? null,
        })),
        created_at: inv.created_at,
        updated_at: inv.updated_at,
      });
    } catch {
      toast.error("Failed to load booking details");
      onClose();
    } finally {
      setLoading(false);
    }
  }, [invoiceId, toast, onClose]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    eventsApi.list({ page_size: 500 }).then(r => setEvents(r.results || [])).catch(() => {});
  }, []);

  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const setDelegate = (idx, field, value) => setForm(p => {
    const next = [...p.delegates];
    next[idx] = { ...next[idx], [field]: value };
    return { ...p, delegates: next };
  });
  const addDelegate = () => setForm(p => ({ ...p, delegates: [...p.delegates, BLANK_DELEGATE()] }));
  const removeDelegate = idx => setForm(p => ({ ...p, delegates: p.delegates.filter((_, i) => i !== idx) }));

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      if (payload.discount === "" || payload.discount === null) payload.discount = "0";
      for (const f of ["pre_tax_amount", "tax_amount", "total_amount", "add_ons_total_amount"]) {
        if (payload[f] === "") payload[f] = null;
      }
      await invoicesApi.update(form.id, payload);
      toast.success("Booking updated");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to update booking");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Permanently delete this booking? This cannot be undone.")) return;
    try {
      await invoicesApi.delete(form.id);
      toast.success("Booking deleted");
      onSaved();
      onClose();
    } catch {
      toast.error("Delete is not available for this booking");
    }
  };

  if (!invoiceId || loading || !form) return null;

  const d0 = form.delegates?.[0] || {};
  const leadName = [d0.first_name, d0.last_name].filter(Boolean).join(" ") || "—";

  const invoiceCtx = {
    request_date:     fmt.dateInput(form.created_at),
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
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <Avatar name={leadName} size={32} />
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                  <span style={headerTitle}>Edit Booking</span>
                  <StatusBadge status={form.payment_status} />
                  <SourceBadge source={form.source} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2, flexWrap: "wrap" }}>
                  <span style={metaText}>{leadName}</span>
                  <MetaDot />
                  <span style={metaText}>{form.company_name || "—"}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} style={closeBtn}>✕</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.55fr", gap: "0 12px", marginTop: 12 }}>
            <FGroup label="Event Code" req compact>
              <EventCodePicker
                value={form.event_code}
                events={events}
                compact
                onChange={(code, ev) => {
                  set("event_code", code);
                  set("event_name", ev?.name || "");
                }}
              />
            </FGroup>
            <FGroup label="Event Name" compact>
              <FInput value={form.event_name} readOnly compact />
            </FGroup>
            <FGroup label="Invoice Number" compact>
              <FInput mono value={form.invoice_number} onChange={v => set("invoice_number", v)} compact />
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
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={handleDelete} style={btnDelete}>Delete booking</button>
            <span style={footerMeta}>
              {form.delegates.length} delegate{form.delegates.length !== 1 ? "s" : ""}
              {form.updated_at && (
                <span style={{ marginLeft: 8, opacity: 0.7 }}>
                  · Modified {new Date(form.updated_at).toLocaleDateString("en-GB")}
                </span>
              )}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={btnOutline}>Cancel</button>
            <button onClick={handleUpdate} disabled={saving} style={btnPrimary}>
              {saving ? "Saving…" : "Save Changes"}
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
              <CellSelect value={invoiceCtx.booking_code || ""} onChange={v => onSetInvoice("booking_code", v)} options={BOOKING_CODES} />
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
   Event Code rich picker
═══════════════════════════════════════════════════════════ */

function EventCodePicker({ value, events, onChange, compact }) {
  const [open, setOpen]     = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef(null);

  const selected = events.find(e => e.event_code === value);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const q = search.toLowerCase();
  const filtered = q
    ? events.filter(e =>
        e.event_code.toLowerCase().includes(q) ||
        (e.name  || "").toLowerCase().includes(q) ||
        (e.city  || "").toLowerCase().includes(q))
    : events;

  const chevron = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236b7280' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setSearch(""); }}
        style={{
          width: "100%", height: compact ? 34 : 38, padding: "0 32px 0 10px",
          border: `1px solid ${open ? "var(--accent)" : BORDER}`,
          borderRadius: 4, background: "#fff",
          display: "flex", alignItems: "center", gap: 8,
          cursor: "pointer", textAlign: "left",
          boxShadow: open ? "0 0 0 2px var(--accent-soft)" : "none",
          transition: "border-color .12s, box-shadow .12s",
          boxSizing: "border-box", fontFamily: "var(--font-sans)",
          backgroundImage: chevron,
          backgroundRepeat: "no-repeat", backgroundPosition: "right 9px center",
          overflow: "hidden",
        }}
      >
        {selected ? (
          <>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
              color: "var(--accent)", background: "rgba(64,81,137,.1)",
              padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap", flexShrink: 0,
            }}>
              {selected.event_code}
            </span>
            <span style={{ fontSize: 12.5, color: TEXT_DIM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {selected.name}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 13, color: TEXT_FAINT }}>— select event —</span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
          background: "#fff", border: `1px solid ${BORDER}`,
          borderRadius: 6, boxShadow: "0 4px 20px rgba(0,0,0,.13)",
          zIndex: 200, overflow: "hidden",
        }}>
          {/* Search bar */}
          <div style={{ padding: "8px 10px", borderBottom: `1px solid ${BORDER}` }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search code, name or city…"
              style={{
                width: "100%", height: 30, padding: "0 8px",
                border: `1px solid ${BORDER}`, borderRadius: 4,
                fontSize: 12, fontFamily: "var(--font-sans)", color: TEXT,
                outline: "none", boxSizing: "border-box", background: "#fff",
              }}
            />
          </div>

          {/* List */}
          <div style={{ maxHeight: 280, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "14px 12px", fontSize: 12, color: TEXT_FAINT, textAlign: "center" }}>
                No events found
              </div>
            ) : filtered.map(ev => {
              const isActive = ev.event_code === value;
              return (
                <div
                  key={ev.event_code}
                  onClick={() => { onChange(ev.event_code, ev); setOpen(false); setSearch(""); }}
                  style={{
                    padding: "8px 12px", cursor: "pointer",
                    background: isActive ? "rgba(64,81,137,.07)" : "#fff",
                    borderBottom: `1px solid ${BORDER}`,
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#f8fafc"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isActive ? "rgba(64,81,137,.07)" : "#fff"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700,
                      color: "var(--accent)", background: "rgba(64,81,137,.1)",
                      padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap", flexShrink: 0,
                    }}>
                      {ev.event_code}
                    </span>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: TEXT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {ev.name}
                    </span>
                    {isActive && (
                      <span style={{ marginLeft: "auto", flexShrink: 0, fontSize: 11, color: "var(--accent)", fontWeight: 600 }}>✓</span>
                    )}
                  </div>
                  {(ev.event_date || ev.city) && (
                    <div style={{ fontSize: 11, color: TEXT_DIM, marginTop: 3, display: "flex", gap: 6 }}>
                      {ev.event_date && <span>{fmt.date(ev.event_date)}</span>}
                      {ev.event_date && ev.city && <span>·</span>}
                      {ev.city && <span>{ev.city}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   Form-level inputs
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
   Table cell inputs
═══════════════════════════════════════════════════════════ */

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
      spellCheck={false}
      autoComplete="off"
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

function CellSelectOverride({ value, onChange, options }) {
  const [f, setF] = useState(false);
  const isEmpty = !value;
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
        color: isEmpty ? TEXT_FAINT : TEXT,
        fontStyle: isEmpty ? "italic" : "normal",
        fontSize: 12, fontFamily: "var(--font-sans)",
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
      <option value="">Inherited</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function CellDateOverride({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState(false);
  const isEmpty = !value;
  if (!editing && isEmpty) {
    return (
      <div
        onClick={() => setEditing(true)}
        style={{
          width: "100%", height: 32, padding: "0 6px",
          display: "flex", alignItems: "center",
          color: TEXT_FAINT, fontSize: 12, fontStyle: "italic",
          cursor: "text", boxSizing: "border-box",
        }}
      >
        Inherited
      </div>
    );
  }
  return (
    <input
      type="date"
      autoFocus={editing && isEmpty}
      value={value ?? ""}
      onChange={e => onChange?.(e.target.value)}
      onFocus={() => setF(true)}
      onBlur={() => { setF(false); if (!value) setEditing(false); }}
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

function MetaDot() {
  return <span style={{ color: TEXT_FAINT, fontSize: 10, lineHeight: 1 }}>·</span>;
}

function AdminDivider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0 8px" }}>
      <span style={{ fontSize: 9.5, fontWeight: 700, color: TEXT_FAINT, textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>
        Financial — Admin Only
      </span>
      <div style={{ flex: 1, height: 1, background: BORDER, opacity: 0.5 }} />
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════
   Design tokens
═══════════════════════════════════════════════════════════ */

const BORDER     = "var(--border)";
const BG_ALT     = "var(--surface-alt)";
const TEXT       = "var(--text)";
const TEXT_DIM   = "var(--text-dim)";
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
  display: "flex", flexDirection: "column",
  padding: "11px 20px 14px",
  borderBottom: `1px solid ${BORDER}`,
  background: "#fff",
  position: "sticky", top: 0, zIndex: 20,
};

const headerTitle = {
  fontSize: 15, fontWeight: 700, color: TEXT,
  fontFamily: "var(--font-sans)", letterSpacing: "-0.01em",
};

const metaChip = {
  fontFamily: "var(--font-mono)",
  fontSize: 11, fontWeight: 600,
  color: "var(--accent)",
};

const metaText = {
  fontSize: 11, color: TEXT_DIM,
};

const helperText = {
  display: "block",
  fontSize: 10.5, color: TEXT_FAINT,
  marginTop: 3, marginBottom: 10,
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
  paddingBottom: 16,
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

const btnDelete = {
  background: "none", border: "none",
  color: "var(--danger)", fontSize: 12, fontWeight: 500,
  cursor: "pointer", fontFamily: "inherit", padding: 0,
};

const removeDelegateBtn = {
  width: 22, height: 22, borderRadius: 4,
  background: "none", border: "none",
  color: "var(--danger)", fontSize: 15, lineHeight: 1,
  cursor: "pointer", fontFamily: "inherit",
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  opacity: 0.7,
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

const tdNum = {
  padding: "0 8px", textAlign: "center",
  fontSize: 11, color: TEXT_DIM, fontWeight: 500,
  borderBottom: `1px solid ${BORDER}`,
  borderRight: `1px solid ${BORDER}`,
  verticalAlign: "middle",
  background: BG_ALT, userSelect: "none",
  minWidth: 50,
};
