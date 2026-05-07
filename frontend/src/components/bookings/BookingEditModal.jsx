import { useState, useEffect, useCallback } from "react";
import { invoicesApi, eventsApi } from "../../api";
import { useToast } from "../../contexts/ToastContext";
import { Avatar } from "../ui/Avatar";
import { StatusBadge } from "../ui/Badge";
import { fmt } from "../../utils/helpers";

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
      const [inv, evs] = await Promise.all([
        invoicesApi.get(invoiceId),
        eventsApi.list({ page_size: 100 }),
      ]);
      setForm({
        department: "", city: "", country: "", dietary_requirements: "",
        amount: "", currency: "USD", tax: "", notes: "",
        ...inv,
      });
      setEvents(evs.results || []);
    } catch (err) {
      toast.error("Failed to load booking details");
      onClose();
    } finally {
      setLoading(false);
    }
  }, [invoiceId, toast, onClose]);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = async () => {
    setSaving(true);
    try {
      await invoicesApi.update(form.id, form);
      toast.success("Booking updated successfully");
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

  const handleDelegateChange = (idx, field, value) => {
    const next = [...form.delegates];
    next[idx] = { ...next[idx], [field]: value };
    setForm((f) => ({ ...f, delegates: next }));
  };

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  if (!invoiceId || loading || !form) return null;

  const d0 = form.delegates?.[0] || {};
  const delegateName = d0.full_name || `${d0.first_name || ""} ${d0.last_name || ""}`.trim() || "—";
  const netTotal = form.amount && form.tax
    ? (parseFloat(form.amount) * (1 - parseFloat(form.discount || 0) / 100) * (1 + parseFloat(form.tax) / 100)).toFixed(2)
    : form.amount || "";

  return (
    <div
      style={{
        position: "fixed", inset: 0,
        background: "rgba(15,12,8,0.55)",
        backdropFilter: "blur(4px)",
        zIndex: 1100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        width: "100%",
        maxWidth: 940,
        maxHeight: "calc(100vh - 48px)",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 24px 80px rgba(20,20,15,0.18)",
        overflow: "hidden",
      }}>

        {/* ── Modal header ── */}
        <div style={{
          padding: "22px 32px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexShrink: 0,
        }}>
          <Avatar name={delegateName} size={52} />

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{
                fontFamily: "var(--font-serif)",
                fontStyle: "italic",
                fontSize: 26,
                fontWeight: 400,
                color: "var(--text)",
              }}>
                Edit booking
              </span>
              <StatusBadge status={form.payment_status} />
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", display: "flex", flexWrap: "wrap", gap: "0 6px" }}>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent)", fontWeight: 500 }}>
                {form.invoice_number}
              </span>
              <Sep />
              <span>{delegateName}</span>
              <Sep />
              <span>{form.company_name || "—"}</span>
              <Sep />
              <span>{form.event_code || "—"}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 7,
              background: "var(--surface-alt)",
              border: "1px solid var(--border)",
              color: "var(--text-dim)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* ── Modal body (scrolls) ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>

          {/* Section 1 — Booking */}
          <FormSection
            title="Booking"
            desc="Which event and what kind of pass."
          >
            <Field label="Invoice number" span={2}>
              <MInput mono value={form.invoice_number} onChange={(v) => set("invoice_number", v)} />
            </Field>
            <Field label="Booking code" span={2}>
              <MInput value={form.booking_code} onChange={(v) => set("booking_code", v)} />
            </Field>
            <Field label="Status" span={2}>
              <MSelect
                value={form.payment_status}
                onChange={(v) => set("payment_status", v)}
                options={["Pending", "Paid", "Cancelled", "Refunded", "Free"]}
              />
            </Field>

            <Field label="Event" span={3}>
              <MSelect
                value={form.event_code}
                onChange={(v) => set("event_code", v)}
                options={events.map((e) => ({ value: e.event_code, label: `${e.event_code} — ${e.name}` }))}
              />
            </Field>
            <Field label="Booking type" span={3}>
              <MSelect
                value={form.ticket_tier || form.paid_free}
                onChange={(v) => set("ticket_tier", v)}
                options={["Standard", "VIP", "Free", "Complimentary", "Sponsorship"]}
              />
            </Field>

            <Field label="Request date" span={2}>
              <MInput type="date" value={fmt.dateInput(form.created_at)} onChange={(v) => set("created_at", v)} />
            </Field>
            <Field label="Invoice date" span={2}>
              <MInput type="date" value={fmt.dateInput(form.invoice_date)} onChange={(v) => set("invoice_date", v)} />
            </Field>
            <Field label="Paid date" span={2} hint="Not paid yet">
              <MInput type="date" value={fmt.dateInput(form.payment_date)} onChange={(v) => set("payment_date", v)} />
            </Field>
          </FormSection>

          {/* Section 2 — Delegate */}
          <FormSection
            title="Delegate"
            desc="The person attending. They'll receive all confirmation emails."
          >
            <Field label="Full name" span={3}>
              <MInput
                value={d0.full_name || `${d0.first_name || ""} ${d0.last_name || ""}`.trim()}
                onChange={(v) => {
                  const sp = v.indexOf(" ");
                  const f = sp === -1 ? v : v.slice(0, sp);
                  const l = sp === -1 ? "" : v.slice(sp + 1);
                  handleDelegateChange(0, "full_name", v);
                  handleDelegateChange(0, "first_name", f);
                  handleDelegateChange(0, "last_name", l);
                }}
              />
            </Field>
            <Field label="Job title" span={3}>
              <MInput value={d0.position || ""} onChange={(v) => handleDelegateChange(0, "position", v)} />
            </Field>

            <Field label="Company" span={3}>
              <MInput value={form.company_name || ""} onChange={(v) => set("company_name", v)} />
            </Field>
            <Field label="Department" span={3}>
              <MInput value={form.department || ""} onChange={(v) => set("department", v)} />
            </Field>

            <Field label="Email" span={3}>
              <MInput type="email" value={d0.email || ""} onChange={(v) => handleDelegateChange(0, "email", v)} />
            </Field>
            <Field label="Direct line" span={3}>
              <MInput mono value={d0.phone_number || ""} onChange={(v) => handleDelegateChange(0, "phone_number", v)} />
            </Field>

            <Field label="City" span={2}>
              <MInput value={form.city || ""} onChange={(v) => set("city", v)} />
            </Field>
            <Field label="Country" span={2}>
              <MInput value={form.country || ""} onChange={(v) => set("country", v)} />
            </Field>
            <Field label="Dietary requirements" span={2} hint="Shown to catering team">
              <MInput value={form.dietary_requirements || ""} onChange={(v) => set("dietary_requirements", v)} />
            </Field>
          </FormSection>

          {/* Section 3 — Payment */}
          <FormSection
            title="Payment"
            desc="Amounts, taxes, and who's responsible internally."
            last
          >
            <Field label="Amount" span={2}>
              <MInput mono value={form.amount || ""} onChange={(v) => set("amount", v)} />
            </Field>
            <Field label="Currency" span={1}>
              <MSelect value={form.currency || "USD"} onChange={(v) => set("currency", v)}
                options={["USD", "GBP", "EUR", "AED", "SGD", "INR"]} />
            </Field>
            <Field label="Discount %" span={1}>
              <MInput mono value={form.discount || ""} onChange={(v) => set("discount", v)} />
            </Field>
            <Field label="Tax %" span={1}>
              <MInput mono value={form.tax || ""} onChange={(v) => set("tax", v)} />
            </Field>
            <Field label="Net total" span={1} hint="Auto-calculated">
              <MInput mono value={netTotal} readOnly />
            </Field>

            <Field label="Payment method" span={2}>
              <MSelect value={form.payment_type || ""} onChange={(v) => set("payment_type", v)}
                options={["", "Bank", "Stripe"]} />
            </Field>
            <Field label="Reference / PO" span={2}>
              <MInput value={form.reference || ""} onChange={(v) => set("reference", v)} />
            </Field>
            <Field label="Assigned executive" span={2}>
              <MInput value={form.sales_executive_name || ""} readOnly />
            </Field>

            <Field label="Notes" span={6} hint="Internal — not shown to delegate">
              <textarea
                value={form.notes || ""}
                onChange={(e) => set("notes", e.target.value)}
                style={{
                  width: "100%",
                  minHeight: 64,
                  padding: "9px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  background: "var(--surface)",
                  color: "var(--text)",
                  fontSize: 13,
                  fontFamily: "var(--font-sans)",
                  lineHeight: 1.5,
                  outline: "none",
                  resize: "vertical",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--accent)";
                  e.target.style.boxShadow = "0 0 0 3px var(--accent-soft)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--border)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </Field>
          </FormSection>
        </div>

        {/* ── Modal footer ── */}
        <div style={{
          padding: "14px 32px",
          background: "var(--surface-alt)",
          borderTop: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexShrink: 0,
        }}>
          <button onClick={handleDelete} style={dangerTextBtn}>Delete booking</button>

          <span style={{ flex: 1, fontSize: 11, color: "var(--text-faint)", textAlign: "center" }}>
            Last edited by {form.sales_executive_name || "—"}
          </span>

          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button onClick={handleUpdate} disabled={saving} style={primaryBtn}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ─── Layout helpers ─── */

function Sep() {
  return <span style={{ color: "var(--border-strong)" }}>·</span>;
}

function FormSection({ title, desc, children, last }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "220px 1fr",
      gap: 32,
      paddingBottom: 24,
      marginBottom: last ? 0 : 24,
      borderBottom: last ? "none" : "1px solid var(--border)",
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--text-dim)", lineHeight: 1.5 }}>{desc}</div>
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)",
        gap: 14,
        alignContent: "start",
      }}>
        {children}
      </div>
    </div>
  );
}

function Field({ label, hint, span = 6, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, gridColumn: `span ${span}` }}>
      <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500, letterSpacing: "0.02em" }}>
        {label}
      </span>
      {children}
      {hint && <span style={{ fontSize: 10, color: "var(--text-faint)" }}>{hint}</span>}
    </label>
  );
}

function MInput({ value, onChange, type = "text", mono, readOnly, placeholder, hint }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value ?? ""}
      readOnly={readOnly}
      placeholder={placeholder || hint}
      onChange={(e) => onChange?.(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        height: 36,
        padding: "0 12px",
        border: `1px solid ${focused ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 8,
        background: readOnly ? "var(--surface-alt)" : "var(--surface)",
        color: readOnly ? "var(--text-dim)" : "var(--text)",
        fontSize: 13,
        fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
        outline: "none",
        width: "100%",
        boxShadow: focused ? "0 0 0 3px var(--accent-soft)" : "none",
        cursor: readOnly ? "default" : "text",
        transition: "border-color .15s, box-shadow .15s",
      }}
    />
  );
}

function MSelect({ value, onChange, options }) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange?.(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        height: 36,
        padding: "0 28px 0 12px",
        border: `1px solid ${focused ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 8,
        background: "var(--surface)",
        color: "var(--text)",
        fontSize: 13,
        fontFamily: "var(--font-sans)",
        outline: "none",
        width: "100%",
        appearance: "none",
        cursor: "pointer",
        boxShadow: focused ? "0 0 0 3px var(--accent-soft)" : "none",
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%235a5853' stroke-width='1.3' fill='none'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
        transition: "border-color .15s, box-shadow .15s",
      }}
    >
      {options.map((o) => {
        const val = typeof o === "string" ? o : o.value;
        const lbl = typeof o === "string" ? o : o.label;
        return <option key={val} value={val}>{lbl || "(none)"}</option>;
      })}
    </select>
  );
}

/* ─── Footer button styles ─── */

const dangerTextBtn = {
  background: "none", border: "none",
  color: "var(--danger)", fontSize: 12, fontWeight: 500,
  cursor: "pointer", fontFamily: "inherit", padding: "4px 0",
};

const ghostBtn = {
  background: "var(--surface)", border: "1px solid var(--border)",
  color: "var(--text)", fontSize: 12, fontWeight: 500,
  padding: "7px 14px", borderRadius: 7,
  cursor: "pointer", fontFamily: "inherit",
};

const primaryBtn = {
  background: "var(--accent)", border: "none",
  color: "#fff", fontSize: 12, fontWeight: 500,
  padding: "7px 14px", borderRadius: 7,
  cursor: "pointer", fontFamily: "inherit",
};
