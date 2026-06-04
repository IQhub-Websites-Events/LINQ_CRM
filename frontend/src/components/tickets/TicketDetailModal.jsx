import { useState, useEffect, useCallback } from "react";
import { ticketCentralApi, usersApi } from "../../api";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { TicketStatusBadge, TicketPriorityBadge } from "./TicketStatusBadge";
import { fmt } from "../../utils/helpers";

const RELATIONSHIP_OPTIONS = [["direct", "Direct"], ["indirect", "Indirect"]];
const PRIORITY_OPTIONS = [
  ["AS",    "AS"],
  ["AD",    "AD"],
  ["SPEX",  "SPEX"],
  ["DD",    "DD"],
  ["ASSOC", "ASSOC"],
  ["MEDIA", "MEDIA"],
  ["AB",    "AB"],
];
const TYPE_OF_TICKET_OPTIONS = [
  ["WH",  "White"],
  ["BX",  "Blue"],
  ["GR",  "Green"],
  ["YL",  "Yellow"],
  ["LX",  "LinkedIn"],
  ["CX",  "Comp."],
  ["PX",  "Platinum"],
  ["GX",  "Gold"],
  ["ZID", "ZID"],
];

/* Field metadata — single source of truth, shared with CreateTicketModal. */
export const MR_FORM_FIELDS = [
  { key: "purpose",               label: "Purpose *",                     type: "text" },
  { key: "link_url",              label: "Link URL *",                    type: "url" },
  { key: "linkedin_keywords",     label: "LinkedIn Keywords",             type: "text" },
  { key: "duplicate_tickets",     label: "Duplicate Tickets",             type: "text" },
  { key: "competitor_event_name", label: "Competitor Event Name",         type: "text" },
  { key: "organizer",             label: "Organizer",                     type: "text" },
  { key: "event_month_year",      label: "Event Month/Year",              type: "date" },
  { key: "event_location",        label: "Event Location (City, Region)", type: "text" },
  { key: "relationship",          label: "Relationship",                  type: "select", options: RELATIONSHIP_OPTIONS },
  { key: "type_of_ticket",        label: "Type of Ticket",                type: "select", options: TYPE_OF_TICKET_OPTIONS },
  { key: "priority",              label: "Priority",                      type: "select", options: PRIORITY_OPTIONS },
  { key: "estimate",              label: "Estimate",                      type: "number" },
  { key: "assigned_mr",           label: "Assigned MR",                   type: "text" },
  { key: "mr_comments",           label: "MR Comments",                   type: "textarea", full: true },
];

export const DMD_FORM_FIELDS = [
  { key: "assign_name",           label: "Assign Name",          type: "text" },
  { key: "assign_date",           label: "Assign Date",          type: "date" },
  { key: "actual_number",         label: "Actual Number",        type: "number" },
  { key: "new_contacts_created",  label: "New Contacts Created", type: "number" },
  { key: "source_spreadsheet_id", label: "Source_Spreadsheet_ID", type: "text" },
  { key: "source_tab",            label: "Source_Tab",           type: "text" },
  { key: "source_row_number",     label: "Source_Row_Number",    type: "number" },
  { key: "idempotency_key",       label: "Idempotency_Key",      type: "text" },
  { key: "ticket_type",           label: "Ticket Type",          type: "text" },
  { key: "complete_date",         label: "Complete Date",        type: "date" },
  { key: "hubspot_entry_date",    label: "HubSpot Entry Date",   type: "date" },
  { key: "mined_count",           label: "Mined Count",          type: "number" },
  { key: "dm_comments",           label: "DM Comments",          type: "textarea", full: true },
  { key: "assign_name_lx2",       label: "Assign Name (LX-2)",   type: "text" },
  { key: "actual_count_lx2",      label: "Actual Count (LX-2)",  type: "number" },
  { key: "complete_date_lx2",     label: "Complete Date - LX2",  type: "date" },
  { key: "dm_comments_lx2",       label: "DM Comments (LX-2)",   type: "textarea", full: true },
];

export function TicketDetailModal({ ticketId, onClose, onSaved }) {
  const { user } = useAuth();
  const toast = useToast();
  const [ticket, setTicket] = useState(null);
  const [form, setForm] = useState({});
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    ticketCentralApi.get(ticketId)
      .then((t) => { if (active) { setTicket(t); setForm({ ...t }); } })
      .catch(() => { if (active) toast.error("Failed to load ticket"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ticketId, toast]);

  useEffect(() => {
    usersApi.list({ page_size: 1000, status: "active" })
      .then((res) => {
        const list = Array.isArray(res) ? res : (res.results || []);
        setUsers(list.map((u) => ({
          id: u.id,
          label: ([u.first_name, u.last_name].filter(Boolean).join(" ").trim()) || u.username || u.email || `User ${u.id}`,
        })));
      })
      .catch(() => {});
  }, []);

  const status = ticket?.status;
  const isMR    = user?.role === "market_research";
  const isDMD   = user?.role === "data_mining";
  const isAdmin = user?.role === "admin";

  const canEditMR    = isAdmin || (isMR  && ["draft", "returned"].includes(status));
  const canEditDMD   = isAdmin || (isDMD && status === "mr_submitted");
  const canSubmitMR  = (isAdmin || isMR)  && ["draft", "returned"].includes(status);
  const canSubmitDMD = (isAdmin || isDMD) && status === "mr_submitted";
  const canReturn    = (isAdmin || isDMD) && status === "mr_submitted";

  const setField = useCallback((key, val) => setForm((p) => ({ ...p, [key]: val })), []);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload = {};
      const collect = (fields) => fields.forEach((f) => { payload[f.key] = form[f.key]; });
      if (isAdmin) { collect(MR_FORM_FIELDS); collect(DMD_FORM_FIELDS); }
      else if (canEditMR) collect(MR_FORM_FIELDS);
      else if (canEditDMD) collect(DMD_FORM_FIELDS);
      else { setSaving(false); return; }

      const updated = await ticketCentralApi.update(ticketId, payload);
      setTicket(updated);
      setForm({ ...updated });
      toast.success("Ticket saved");
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save ticket");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (fn, successMsg) => {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await fn();
      setTicket(updated);
      setForm({ ...updated });
      toast.success(successMsg);
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Action failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitMR  = () => runAction(() => ticketCentralApi.submitMR(ticketId), "Submitted to Data Mining");
  const handleSubmitDMD = () => runAction(() => ticketCentralApi.submitDMD(ticketId), "Ticket completed");
  const handleReturn = () => {
    const reason = window.prompt("Reason for returning this ticket to Market Research:");
    if (reason === null) return;
    runAction(() => ticketCentralApi.returnToMR(ticketId, reason), "Returned to Market Research");
  };

  return (
    <Overlay onClose={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        {loading || !ticket ? (
          <div style={{ padding: 48, textAlign: "center", color: "var(--text-faint)" }}>Loading…</div>
        ) : (
          <>
            {/* Header */}
            <div style={header}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 600, color: "var(--accent)" }}>
                  {ticket.ticket_number}
                </span>
                <TicketStatusBadge status={ticket.status} />
                <TicketPriorityBadge priority={ticket.priority} />
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  {ticket.event_code}{ticket.event_name ? ` · ${ticket.event_name}` : ""}
                </span>
              </div>
              <button onClick={onClose} style={closeBtn} title="Close">✕</button>
            </div>

            <div style={{ overflowY: "auto", padding: "16px 24px", flex: 1, minHeight: 0 }}>
              {ticket.status === "returned" && ticket.return_reason && (
                <div style={{
                  marginBottom: 16, padding: "10px 12px", borderRadius: 8,
                  background: "var(--danger-soft)", border: "1px solid var(--danger)",
                  color: "var(--danger)", fontSize: 12,
                }}>
                  <strong>Returned:</strong> {ticket.return_reason}
                </div>
              )}

              {/* Section: Market Research */}
              <Section title="Market Research"
                action={canSubmitMR && (
                  <button style={primaryBtn} onClick={handleSubmitMR} disabled={saving}>
                    Submit to Data Mining
                  </button>
                )}>
                {MR_FORM_FIELDS.map((f) => (
                  <FieldRow key={f.key} label={f.label} full={f.full}>
                    <TicketField field={f} value={form[f.key]} editable={canEditMR} users={users}
                      onChange={(v) => setField(f.key, v)} />
                  </FieldRow>
                ))}
              </Section>

              {/* Section: Data Mining */}
              <Section title="Data Mining"
                locked={["draft", "returned"].includes(ticket.status)}
                lockedHint="Locked until Market Research submits"
                action={(canSubmitDMD || canReturn) && (
                  <div style={{ display: "flex", gap: 8 }}>
                    {canSubmitDMD && <button style={primaryBtn} onClick={handleSubmitDMD} disabled={saving}>Complete</button>}
                    {canReturn && <button style={dangerBtn} onClick={handleReturn} disabled={saving}>Return to MR</button>}
                  </div>
                )}>
                {DMD_FORM_FIELDS.map((f) => (
                  <FieldRow key={f.key} label={f.label} full={f.full}>
                    <TicketField field={f} value={form[f.key]} editable={canEditDMD} users={users}
                      onChange={(v) => setField(f.key, v)} />
                  </FieldRow>
                ))}
              </Section>

              {/* Audit trail */}
              <Section title="Audit Trail">
                <AuditLine label="Created"       who={ticket.created_by_name}       when={ticket.created_at} />
                <AuditLine label="MR submitted"  who={ticket.mr_submitted_by_name}  when={ticket.mr_submitted_at} />
                <AuditLine label="DMD completed" who={ticket.dmd_submitted_by_name} when={ticket.dmd_submitted_at} />
                <AuditLine label="Returned"      who={ticket.returned_by_name}      when={ticket.returned_at} />
              </Section>
            </div>

            {/* Footer */}
            <div style={footer}>
              <button style={ghostBtn} onClick={onClose}>Close</button>
              {(canEditMR || canEditDMD) && (
                <button style={primaryBtn} onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </Overlay>
  );
}

/* ─── Shared field control (exported for CreateTicketModal) ─── */

export function TicketField({ field, value, editable, users = [], onChange }) {
  if (field.type === "select" || field.type === "user") {
    const opts = field.type === "user" ? users.map((u) => [u.id, u.label]) : field.options;
    return (
      <select style={inputStyle} disabled={!editable}
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(field.type === "user" ? (v === "" ? null : Number(v)) : v);
        }}>
        <option value="">—</option>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    );
  }
  if (!editable) {
    return <ReadOnly value={value} multiline={field.type === "textarea"} />;
  }
  if (field.type === "textarea") {
    return <textarea style={{ ...inputStyle, minHeight: 56, resize: "vertical" }} value={value || ""} onChange={(e) => onChange(e.target.value)} />;
  }
  if (field.type === "date") {
    return <input type="date" style={inputStyle} value={value || ""} onChange={(e) => onChange(e.target.value || null)} />;
  }
  if (field.type === "number") {
    return <input type="number" style={inputStyle} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />;
  }
  const t = field.type === "email" ? "email" : field.type === "url" ? "url" : "text";
  return <input type={t} style={inputStyle} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
}

/* ─── Pieces ─── */

function Overlay({ children, onClose }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24,
    }}>
      {children}
    </div>
  );
}

function Section({ title, children, action, locked, lockedHint }) {
  return (
    <div style={{
      border: "1px solid var(--border)", borderRadius: 12, marginBottom: 16,
      background: locked ? "var(--surface-alt)" : "var(--surface)", opacity: locked ? 0.65 : 1,
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderBottom: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{title}</span>
          {locked && <span style={{ fontSize: 11, color: "var(--text-faint)" }}>· {lockedHint}</span>}
        </div>
        {action}
      </div>
      <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px 18px" }}>
        {children}
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

function ReadOnly({ value, multiline }) {
  const display = (value === 0 ? "0" : value) || "—";
  return (
    <div style={{
      ...inputStyle, background: "var(--surface-alt)", color: "var(--text-dim)",
      minHeight: multiline ? 56 : undefined, display: "flex", alignItems: multiline ? "flex-start" : "center",
      whiteSpace: multiline ? "pre-wrap" : "nowrap", overflow: "hidden", textOverflow: "ellipsis",
    }}>
      {display}
    </div>
  );
}

function AuditLine({ label, who, when }) {
  return (
    <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, fontSize: 12, color: "var(--text-dim)" }}>
      <span style={{ minWidth: 110, fontWeight: 500 }}>{label}:</span>
      <span>{who || "—"}{when ? ` · ${fmt.dateShort(when)}` : ""}</span>
    </div>
  );
}

/* ─── Styles ─── */

const panel = {
  width: "100%", maxWidth: 980, maxHeight: "88vh", background: "var(--surface)",
  border: "1px solid var(--border)", borderRadius: 16, display: "flex",
  flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 60px rgba(15,23,42,0.25)",
};
const header = {
  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
  padding: "16px 24px", borderBottom: "1px solid var(--border)", flexShrink: 0, background: "var(--surface-alt)",
};
const footer = {
  display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px",
  borderTop: "1px solid var(--border)", flexShrink: 0, background: "var(--surface-alt)",
};
const closeBtn = { background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 4 };
const inputStyle = {
  width: "100%", height: 34, padding: "0 10px", fontSize: 13,
  border: "1px solid var(--border)", borderRadius: 7, background: "var(--surface)",
  color: "var(--text)", fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
const primaryBtn = {
  background: "var(--accent)", border: "none", color: "#fff", padding: "7px 14px",
  borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
};
const dangerBtn = {
  background: "var(--danger-soft)", border: "1px solid var(--danger)", color: "var(--danger)",
  padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
};
const ghostBtn = {
  background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-dim)",
  padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
};
