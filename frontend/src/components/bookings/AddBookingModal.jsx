import { useState, useEffect, useCallback } from "react";
import { invoicesApi, eventsApi } from "../../api";
import { useToast } from "../../contexts/ToastContext";
import { fmt, today } from "../../utils/helpers";

export function AddBookingModal({ onClose, onSaved }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({
    invoice_number: "",
    event_code: "",
    event_name: "",
    event_date: null,
    invoice_date: today(),
    payment_due_date: null,
    ticket_tier: "Delegate",
    delegate_count: 1,
    pre_tax_amount: 0,
    tax_amount: 0,
    total_amount: 0,
    discount: 0,
    currency: "USD",
    company_name: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    payment_status: "Pending",
    payment_type: "",
    payment_date: null,
    booking_code: "",
    paid_free: "Paid",
    reference: "",
    parent_code: "",
    notes: "",
    add_ons: "",
    accounts_contact_email: "",
    delegates: [
      { first_name: "", last_name: "", full_name: "", email: "", position: "", attendance: "Pending" }
    ]
  });

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const res = await eventsApi.list({ page_size: 100 });
        setEvents(res.results || []);
      } catch (err) {
        console.error("Failed to load events", err);
      }
    };
    loadEvents();
  }, []);

  const handleSave = async () => {
    if (!form.invoice_number || !form.event_code || !form.delegates[0].first_name || !form.delegates[0].email) {
      toast.error("Please fill in all required fields (*)");
      return;
    }

    setSaving(true);
    try {
      await invoicesApi.create(form);
      toast.success("Booking created successfully");
      onSaved();
      onClose();
    } catch (err) {
      console.error("Save error:", err.response?.data || err.message);
      toast.error(err.response?.data?.detail || "Failed to create booking");
    } finally {
      setSaving(false);
    }
  };

  const handleDelegateChange = (idx, field, value) => {
    const nextDelegates = [...form.delegates];
    nextDelegates[idx] = { ...nextDelegates[idx], [field]: value };
    setForm({ ...form, delegates: nextDelegates });
  };

  const addDelegate = () => {
    setForm({ 
      ...form, 
      delegates: [...form.delegates, { first_name: "", last_name: "", full_name: "", email: "", position: "", attendance: "Pending" }] 
    });
  };

  const removeDelegate = (idx) => {
    if (form.delegates.length <= 1) return;
    const nextDelegates = form.delegates.filter((_, i) => i !== idx);
    setForm({ ...form, delegates: nextDelegates });
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* HEADER */}
        <div style={headerStyle}>
          <div style={{ display: "flex", gap: "24px" }}>
            <div>
              <div style={labelStyle}>Event Code*:</div>
              <select
                value={form.event_code}
                onChange={(e) => {
                  const ev = events.find(x => x.event_code === e.target.value);
                  setForm({ ...form, event_code: e.target.value, event_name: ev?.name || "" });
                }}
                style={{ ...headerInputStyle, minWidth: "180px" }}
              >
                <option value="">Select Event</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.event_code}>{ev.event_code} - {ev.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div style={labelStyle}>Invoice Number*:</div>
              <input
                value={form.invoice_number}
                onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                style={{ ...headerInputStyle, minWidth: "150px", fontWeight: "600" }}
                placeholder="INV-XXXX"
              />
            </div>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>×</button>
        </div>

        {/* BODY */}
        <div style={bodyStyle}>
          <div style={{ marginBottom: "20px" }}>
            <h3 style={sectionTitleStyle}>Delegate Detail</h3>

            <div style={gridContainerStyle}>
              <table style={subformTableStyle}>
                <thead>
                  <tr style={subformHeaderRowStyle}>
                    <th style={subformThStyle}>#</th>
                    <th style={subformThStyle}>Request Date</th>
                    <th style={subformThStyle}>Payment Due Date</th>
                    <th style={subformThStyle}>Invoice Date</th>
                    <th style={subformThStyle}>Sponsorship Level</th>
                    <th style={subformThStyle}>Delegate Company</th>
                    <th style={subformThStyle}>Name*</th>
                    <th style={subformThStyle}>Job Title</th>
                    <th style={subformThStyle}>Delegate Email*</th>
                    <th style={subformThStyle}>Direct Line</th>
                    <th style={subformThStyle}>Account Company*</th>
                    <th style={subformThStyle}>Account Emails*</th>
                    <th style={subformThStyle}>Booking Code</th>
                    <th style={subformThStyle}>Attendance - IN?</th>
                    <th style={subformThStyle}>Paid/Free</th>
                    <th style={subformThStyle}>Payment Date</th>
                    <th style={subformThStyle}>Payment Type</th>
                    <th style={subformThStyle}>Ticket Tier</th>
                    <th style={subformThStyle}>Discount</th>
                    <th style={subformThStyle}>Add-Ons</th>
                    <th style={subformThStyle}>Reference Number</th>
                    <th style={subformThStyle}>Delegate Count</th>
                    <th style={subformThStyle}>Payment Status*</th>
                    <th style={subformThStyle}>Sales Executive</th>
                    <th style={subformThStyle}>Team Leader</th>
                    <th style={subformThStyle}>Parent Code</th>
                    <th style={subformThStyle}>Book Event</th>
                    <th style={{ ...subformThStyle, width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {form.delegates.map((d, idx) => (
                    <tr key={idx} style={subformRowStyle}>
                      <td style={subformTdStyle}>{idx + 1}</td>
                      <td style={subformTdStyle}>
                        <input type="date" value={fmt.dateInput(form.invoice_date)} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} style={inputStyle} />
                      </td>
                      <td style={subformTdStyle}>
                        <input type="date" value={fmt.dateInput(form.payment_due_date)} onChange={(e) => setForm({ ...form, payment_due_date: e.target.value })} style={inputStyle} />
                      </td>
                      <td style={subformTdStyle}>
                        <input type="date" value={fmt.dateInput(form.invoice_date)} onChange={(e) => setForm({ ...form, invoice_date: e.target.value })} style={inputStyle} />
                      </td>
                      <td style={subformTdStyle}>
                        <input value={form.ticket_tier} onChange={(e) => setForm({ ...form, ticket_tier: e.target.value })} style={inputStyle} />
                      </td>
                      <td style={subformTdStyle}>
                        <input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} style={inputStyle} />
                      </td>
                      <td style={subformTdStyle}>
                        <input value={d.full_name}
                          onChange={(e) => {
                            const val = e.target.value;
                            const firstSpaceIndex = val.indexOf(" ");
                            let f = val, l = "";
                            if (firstSpaceIndex !== -1) {
                              f = val.substring(0, firstSpaceIndex);
                              l = val.substring(firstSpaceIndex + 1);
                            }
                            const nextDelegates = [...form.delegates];
                            nextDelegates[idx] = { ...nextDelegates[idx], full_name: val, first_name: f, last_name: l };
                            setForm({ ...form, delegates: nextDelegates });
                          }}
                          style={inputStyle} placeholder="Name*"
                        />
                      </td>
                      <td style={subformTdStyle}>
                        <input value={d.position} onChange={(e) => handleDelegateChange(idx, "position", e.target.value)} style={inputStyle} />
                      </td>
                      <td style={subformTdStyle}>
                        <input value={d.email} onChange={(e) => handleDelegateChange(idx, "email", e.target.value)} style={inputStyle} placeholder="Email*" />
                      </td>
                      <td style={subformTdStyle}>
                        <input value={d.phone_number} onChange={(e) => handleDelegateChange(idx, "phone_number", e.target.value)} style={inputStyle} />
                      </td>
                      <td style={subformTdStyle}>
                        <input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} style={inputStyle} />
                      </td>
                      <td style={subformTdStyle}>
                        <input value={form.accounts_contact_email} onChange={(e) => setForm({ ...form, accounts_contact_email: e.target.value })} style={inputStyle} />
                      </td>
                      <td style={subformTdStyle}>
                        <input value={form.booking_code} onChange={(e) => setForm({ ...form, booking_code: e.target.value })} style={inputStyle} />
                      </td>
                      <td style={subformTdStyle}>
                        <select value={d.attendance} onChange={(e) => handleDelegateChange(idx, "attendance", e.target.value)} style={inputStyle}>
                          <option value="Pending">Pending</option>
                          <option value="Attended">Attended</option>
                          <option value="No Show">No Show</option>
                        </select>
                      </td>
                      <td style={subformTdStyle}>
                        <select value={form.paid_free} onChange={(e) => setForm({ ...form, paid_free: e.target.value })} style={inputStyle}>
                          <option value="Paid">Paid</option>
                          <option value="Free">Free</option>
                        </select>
                      </td>
                      <td style={subformTdStyle}>
                        <input type="date" value={fmt.dateInput(form.payment_date)} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} style={inputStyle} />
                      </td>
                      <td style={subformTdStyle}>
                        <select value={form.payment_type} onChange={(e) => setForm({ ...form, payment_type: e.target.value })} style={inputStyle}>
                          <option value="">—</option>
                          <option value="Bank">Bank</option>
                          <option value="Stripe">Stripe</option>
                        </select>
                      </td>
                      <td style={subformTdStyle}>
                        <input value={form.ticket_tier} onChange={(e) => setForm({ ...form, ticket_tier: e.target.value })} style={inputStyle} />
                      </td>
                      <td style={subformTdStyle}>
                        <input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} style={inputStyle} />
                      </td>
                      <td style={subformTdStyle}>
                        <input value={form.add_ons} onChange={(e) => setForm({ ...form, add_ons: e.target.value })} style={inputStyle} />
                      </td>
                      <td style={subformTdStyle}>
                        <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} style={inputStyle} />
                      </td>
                      <td style={subformTdStyle}>
                        <input type="number" value={form.delegates.length} readOnly style={{ ...inputStyle, background: "#f8f9fa" }} />
                      </td>
                      <td style={subformTdStyle}>
                        <select value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value })} style={inputStyle}>
                          <option value="Pending">Pending</option>
                          <option value="Paid">Paid</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td style={subformTdStyle}>
                        <input value="Auto-assign" readOnly style={{ ...inputStyle, background: "#f8f9fa" }} />
                      </td>
                      <td style={subformTdStyle}>
                        <input value="—" readOnly style={{ ...inputStyle, background: "#f8f9fa" }} />
                      </td>
                      <td style={subformTdStyle}>
                        <input value={form.parent_code} onChange={(e) => setForm({ ...form, parent_code: e.target.value })} style={inputStyle} />
                      </td>
                      <td style={subformTdStyle}>
                        <input value={form.event_name} onChange={(e) => setForm({ ...form, event_name: e.target.value })} style={inputStyle} />
                      </td>
                      <td style={subformTdStyle}>
                        <button onClick={() => removeDelegate(idx)} style={delBtnStyle}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
              <button onClick={addDelegate} style={addBtnStyle}>+ Add New</button>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div style={footerStyle}>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <button onClick={handleSave} disabled={saving} style={saveBtnStyle}>
              {saving ? "Creating..." : "Save Booking"}
            </button>
            <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          </div>
          <div style={{ color: "#6c757d", fontSize: "12px" }}>
            Delegate Number: <span style={{ fontWeight: "700", color: "#495057" }}>{form.delegates.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// STYLES
const overlayStyle = {
  position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
  background: "rgba(0,0,0,0.5)", zIndex: 1100,
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "20px"
};

const modalStyle = {
  background: "#fff", width: "95%", maxWidth: "1400px", height: "80vh",
  borderRadius: "8px", display: "flex", flexDirection: "column",
  boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  overflow: "hidden"
};

const headerStyle = {
  padding: "16px 24px", borderBottom: "1px solid #e9ecef",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  background: "#fff"
};

const labelStyle = { fontSize: "11px", color: "#878a99", textTransform: "uppercase", marginBottom: "2px" };

const bodyStyle = { flex: 1, overflowY: "auto", padding: "24px" };

const sectionTitleStyle = { fontSize: "15px", fontWeight: "600", marginBottom: "16px", color: "#495057" };

const gridContainerStyle = { overflowX: "auto", border: "1px solid #e9ecef", borderRadius: "4px" };

const subformTableStyle = { width: "max-content", minWidth: "100%", borderCollapse: "collapse" };
const subformHeaderRowStyle = { background: "#f8f9fa", borderBottom: "1px solid #e9ecef" };
const subformThStyle = { padding: "8px 12px", fontSize: "12px", color: "#495057", textAlign: "left", fontWeight: "600" };
const subformRowStyle = { borderBottom: "1px solid #f1f3f5" };
const subformTdStyle = { padding: "6px 8px", fontSize: "12px" };

const inputStyle = {
  width: "100%", padding: "6px 12px", border: "1px solid #ced4da",
  borderRadius: "20px", fontSize: "12px", outline: "none",
  minWidth: "100px", transition: "border-color 0.15s ease"
};

const headerInputStyle = {
  ...inputStyle,
  background: "#f8f9fa",
  borderColor: "#e9ecef",
  padding: "4px 10px",
  borderRadius: "4px"
};

const footerStyle = {
  padding: "16px 24px", borderTop: "1px solid #e9ecef",
  display: "flex", justifyContent: "space-between", alignItems: "center",
  background: "#f8f9fa"
};

const saveBtnStyle = {
  background: "#405189", color: "#fff", border: "none",
  padding: "8px 24px", borderRadius: "4px", fontSize: "13px",
  fontWeight: "600", cursor: "pointer"
};
const cancelBtnStyle = {
  background: "#fff", color: "#495057", border: "1px solid #ced4da",
  padding: "8px 24px", borderRadius: "4px", fontSize: "13px",
  fontWeight: "600", cursor: "pointer"
};
const addBtnStyle = {
  background: "none", color: "#007bff", border: "none",
  fontSize: "13px", fontWeight: "600", cursor: "pointer", padding: 0
};
const delBtnStyle = {
  background: "#fff5f5", color: "#fa5252", border: "1px solid #ffc9c9",
  width: "24px", height: "24px", borderRadius: "50%",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", fontSize: "16px"
};
const closeBtnStyle = {
  background: "none", border: "none", fontSize: "24px",
  color: "#878a99", cursor: "pointer", padding: 0
};
