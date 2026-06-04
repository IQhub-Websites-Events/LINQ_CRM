import { useState } from "react";
import { ticketCentralApi } from "../../api";
import { useToast } from "../../contexts/ToastContext";
import { MR_FORM_FIELDS, TicketField } from "./TicketDetailModal";

export function CreateTicketModal({ onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm]   = useState({});
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  const setField = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      await ticketCentralApi.create(form);
      toast.success("Ticket created. Number will be assigned overnight.");
      onSaved?.();
    } catch (err) {
      // D28: render server errors inline — field-keyed DRF errors are surfaced.
      const data = err.response?.data;
      let message;
      if (typeof data === "string") {
        message = data;
      } else if (data?.detail) {
        message = data.detail;
      } else if (data && typeof data === "object") {
        message = Object.entries(data)
          .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(", ") : msgs}`)
          .join("\n");
      } else {
        message = err.message || "Failed to create ticket";
      }
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={panel}>
        <div style={header}>
          <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>New Ticket</span>
          <button onClick={onClose} style={closeBtn} title="Close">✕</button>
        </div>

        <div style={{ overflowY: "auto", padding: "16px 24px", flex: 1, minHeight: 0 }}>
          {/* Shared fields */}
          <div style={grid}>
            <FieldRow label="Event Code">
              <input style={input} value={form.event_code || ""} onChange={(e) => setField("event_code", e.target.value)} />
            </FieldRow>
            <FieldRow label="Event Name">
              <input style={input} value={form.event_name || ""} onChange={(e) => setField("event_name", e.target.value)} />
            </FieldRow>
          </div>

          {/* MR fields */}
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", margin: "16px 0 10px" }}>
            Market Research
          </div>
          <div style={grid}>
            {MR_FORM_FIELDS.map((f) => (
              <FieldRow key={f.key} label={f.label} full={f.full}>
                <TicketField field={f} value={form[f.key]} editable
                  onChange={(v) => setField(f.key, v)} />
              </FieldRow>
            ))}
          </div>
        </div>

        <div style={footer}>
          {error && (
            <div style={{
              flex: 1, background: "var(--danger-bg, #fee2e2)", color: "var(--danger, #b91c1c)",
              padding: "8px 12px", borderRadius: 6, fontSize: 12, whiteSpace: "pre-line",
              border: "1px solid var(--danger-border, #fca5a5)", alignSelf: "center",
            }}>
              {error}
            </div>
          )}
          <button style={ghostBtn} onClick={onClose}>Cancel</button>
          <button style={primaryBtn} onClick={handleSave} disabled={saving}>
            {saving ? "Creating…" : "Create Ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, children, full }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: full ? "1 / -1" : "auto" }}>
      <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-dim)" }}>{label}</span>
      {children}
    </label>
  );
}

const panel = {
  width: "100%", maxWidth: 920, maxHeight: "88vh", background: "var(--surface)",
  border: "1px solid var(--border)", borderRadius: 16, display: "flex",
  flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(15,23,42,0.25)",
};
const header = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "16px 24px", borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--surface-alt)",
};
const footer = {
  display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px",
  borderTop: "1px solid var(--border)", flexShrink: 0, background: "var(--surface-alt)",
};
const grid = { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px 18px" };
const closeBtn = { background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 4 };
const input = {
  width: "100%", height: 34, padding: "0 10px", fontSize: 13,
  border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface)",
  color: "var(--text)", fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
const primaryBtn = {
  background: "var(--accent)", border: "none", color: "#fff", padding: "7px 14px",
  borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
};
const ghostBtn = {
  background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-dim)",
  padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
};
