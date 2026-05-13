import { useState, useEffect } from "react";
import { invoicesApi, delegatesApi } from "../../api";
import { useToast } from "../../contexts/ToastContext";
import { Drawer } from "../ui/Drawer";
import { Button } from "../ui/Button";
import { InfoSection, InfoGrid, InfoItem } from "../ui/InfoCard";
import { StatusBadge, TierBadge } from "../ui/Badge";
import { Avatar } from "../ui/Avatar";
import { Select } from "../ui/Input";
import { fmt, today } from "../../utils/helpers";
import { PAYMENT_STATUSES, PAYMENT_TYPES, TICKET_TIERS, PAID_OR_FREE } from "../../utils/constants";

export function BookingDrawer({ invId, onClose, onSaved }) {
  const toast = useToast();
  const [invoice,  setInvoice]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [payStatus,   setPayStatus]   = useState("");
  const [payDate,     setPayDate]     = useState("");
  const [payType,     setPayType]     = useState("");
  const [paidOrFree,  setPaidOrFree]  = useState("");
  const [ticketTier,  setTicketTier]  = useState("");

  useEffect(() => {
    if (!invId) { setInvoice(null); return; }
    setLoading(true);
    invoicesApi.get(invId).then((data) => {
      setInvoice(data);
      setPayStatus(data.payment_status);
      setPayDate(data.payment_date || "");
      setPayType(data.payment_type || "");
      setPaidOrFree(data.paid_or_free || "");
      setTicketTier(data.ticket_tier || "");
    }).catch(() => toast.error("Failed to load invoice"))
      .finally(() => setLoading(false));
  }, [invId]);

  const save = async () => {
    if (payStatus === "Paid" && !payDate) {
      toast.warn("Payment date is required when status is Paid");
      return;
    }
    setSaving(true);
    try {
      await invoicesApi.updatePayment(invId, {
        payment_status: payStatus,
        payment_date:   payStatus === "Paid" ? (payDate || today()) : payDate || null,
        payment_type:   payType,
        paid_or_free:   paidOrFree,
        ticket_tier:    ticketTier,
      });
      await onSaved();
      toast.success(`${invoice.invoice_number} updated`);
    } catch (err) {
      toast.error(err.response?.data?.payment_date?.[0] || "Save failed");
    } finally { setSaving(false); }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") save();
  };

  if (!invId) return null;

  return (
    <Drawer
      open={!!invId}
      onClose={onClose}
      title={loading ? "Loading…" : (invoice?.invoice_number || "Invoice")}
      subtitle={invoice ? `${invoice.event_name || invoice.event_code} · ${invoice.company_name}` : ""}
      footer={
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ display: "flex", gap: 7 }}>
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="success" onClick={save} loading={saving}
              style={{ flex: 1, justifyContent: "center" }}>
              ✓ Save payment
            </Button>
          </div>
          <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "center" }}>
            Enter to save · ESC to close · Tab to navigate
          </div>
        </div>
      }
    >
      {loading ? (
        <div style={{ color: "#94a3b8", fontSize: 12, textAlign: "center", padding: "20px" }}>Loading…</div>
      ) : invoice ? (
        <>
          {/* Invoice info */}
          <InfoSection title="Invoice">
            <InfoGrid>
              <InfoItem label="Invoice #"  value={invoice.invoice_number} mono />
              <InfoItem label="Sales Exec" value={invoice.sales_executive_name || "Unassigned"} />
              <InfoItem label="Event"      value={invoice.event_code} />
              <InfoItem label="Company"    value={invoice.company_name} />
              <InfoItem label="Tier"       value={invoice.ticket_tier} />
              <InfoItem label="Total"      value={fmt.currency(invoice.total_amount, invoice.currency)} mono />
              <InfoItem label="Registered" value={fmt.date(invoice.created_at)} />
              {invoice.reference && <InfoItem label="Reference" value={invoice.reference} mono span />}
            </InfoGrid>
          </InfoSection>

          {/* Delegates */}
          {invoice.delegates?.length > 0 && (
            <InfoSection title={`Delegates (${invoice.delegates.length})`}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {invoice.delegates?.map((d, i) => (
                  <div key={d.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: i === 0 ? "#eff6ff" : "#f8fafc",
                    border: `1px solid ${i === 0 ? "#bfdbfe" : "#e2e8f0"}`,
                    borderRadius: 8, padding: "10px 12px",
                  }}>
                    <Avatar name={d.full_name} size={30} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>
                        {d.full_name}
                        {i === 0 && (
                          <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 600,
                            background: "#eff6ff", color: "#1e40af", padding: "1px 5px", borderRadius: 3 }}>
                            PRIMARY
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "Courier New, monospace",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {d.email}
                      </div>
                      <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 1 }}>{d.position}</div>
                    </div>
                    <DelegateAttendance delegate={d} />
                  </div>
                ))}
              </div>
            </InfoSection>
          )}

          {/* Payment — editable */}
          <InfoSection title="Payment">
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14 }}>
              {invoice.payment_status !== "Paid" && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: 7,
                  background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6,
                  padding: "7px 10px", marginBottom: 12, fontSize: 11.5, color: "#92400e" }}>
                  <span>ℹ</span>
                  <span>Update status below — applies to all {invoice.delegates?.length || 0} delegate{invoice.delegates?.length !== 1 ? "s" : ""} on this invoice.</span>
                </div>
              )}

              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#94a3b8",
                  textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 5 }}>Status</label>
                <select value={payStatus} onChange={(e) => setPayStatus(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={{ width: "100%", background: "#fff", border: "1px solid #e2e8f0",
                    borderRadius: 7, padding: "7px 10px", fontSize: 13, color: "#1e293b",
                    fontFamily: "inherit", outline: "none", cursor: "pointer" }}>
                  {PAYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#94a3b8",
                  textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 5 }}>Payment date</label>
                <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={{ width: "100%", background: "#fff", border: "1px solid #e2e8f0",
                    borderRadius: 7, padding: "7px 10px", fontSize: 13, color: "#1e293b",
                    fontFamily: "inherit", outline: "none" }} />
              </div>

              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#94a3b8",
                  textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 5 }}>Payment type</label>
                <select value={payType} onChange={(e) => setPayType(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={{ width: "100%", background: "#fff", border: "1px solid #e2e8f0",
                    borderRadius: 7, padding: "7px 10px", fontSize: 13, color: "#1e293b",
                    fontFamily: "inherit", outline: "none", cursor: "pointer" }}>
                  <option value="">— Select —</option>
                  {PAYMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: 0 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#94a3b8",
                    textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 5 }}>Paid / Free</label>
                  <select value={paidOrFree} onChange={(e) => setPaidOrFree(e.target.value)}
                    style={{ width: "100%", background: "#fff", border: "1px solid #e2e8f0",
                      borderRadius: 7, padding: "7px 10px", fontSize: 13, color: "#1e293b",
                      fontFamily: "inherit", outline: "none", cursor: "pointer" }}>
                    <option value="">— Select —</option>
                    {PAID_OR_FREE.map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#94a3b8",
                    textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 5 }}>Ticket Tier</label>
                  <select value={ticketTier} onChange={(e) => setTicketTier(e.target.value)}
                    style={{ width: "100%", background: "#fff", border: "1px solid #e2e8f0",
                      borderRadius: 7, padding: "7px 10px", fontSize: 13, color: "#1e293b",
                      fontFamily: "inherit", outline: "none", cursor: "pointer" }}>
                    <option value="">— Select —</option>
                    {TICKET_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              {invoice.payment_status === "Paid" && (
                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 7,
                  background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "7px 10px",
                  fontSize: 11.5, color: "#166534" }}>
                  ✓ Confirmed on {fmt.date(invoice.payment_date)}
                </div>
              )}
            </div>
          </InfoSection>
        </>
      ) : null}
    </Drawer>
  );
}

function DelegateAttendance({ delegate }) {
  const toast = useToast();
  const [att, setAtt] = useState(delegate.attendance);

  const cycle = async (e) => {
    e.stopPropagation();
    const c = ["Pending","Confirmed","No-show"];
    const next = c[(c.indexOf(att) + 1) % c.length];
    try {
      await delegatesApi.updateAttendance(delegate.id, next);
      setAtt(next);
    } catch { toast.error("Failed to update"); }
  };

  const colors = { Confirmed: "#166534", Pending: "#92400e", "No-show": "#991b1b" };
  const bgs    = { Confirmed: "#f0fdf4", Pending: "#fffbeb", "No-show": "#fef2f2" };

  return (
    <button onClick={cycle} style={{
      border: "none", borderRadius: 20, padding: "2px 8px",
      fontSize: 10.5, fontWeight: 500, cursor: "pointer",
      background: bgs[att] || "#f1f5f9", color: colors[att] || "#475569",
      flexShrink: 0,
    }} title="Click to cycle attendance">{att}</button>
  );
}
