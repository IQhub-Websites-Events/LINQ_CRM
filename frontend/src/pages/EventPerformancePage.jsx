import { useState, useEffect, useCallback, useRef } from "react";
import { eventPerformanceApi } from "../api/eventPerformance";

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtCurrency = (n) =>
  n == null ? "—" : "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
};

const HEALTH_STYLE = {
  healthy:  { bg: "var(--success-soft)", color: "var(--success)",  label: "Healthy"  },
  on_track: { bg: "#dbeafe",            color: "#1d4ed8",          label: "On Track" },
  warning:  { bg: "var(--warn-soft)",   color: "var(--warn)",      label: "Warning"  },
  critical: { bg: "var(--danger-soft)", color: "var(--danger)",    label: "Critical" },
  unknown:  { bg: "var(--surface-alt)", color: "var(--text-faint)", label: "—"       },
};

const STATUS_STYLE = {
  Upcoming:  { bg: "#dbeafe", color: "#1d4ed8" },
  Live:      { bg: "var(--success-soft)", color: "var(--success)" },
  Completed: { bg: "var(--surface-alt)", color: "var(--text-dim)" },
  Draft:     { bg: "var(--surface-alt)", color: "var(--text-faint)" },
  Cancelled: { bg: "var(--danger-soft)", color: "var(--danger)" },
};

const FOLLOW_UP_STATUS_STYLE = {
  pending:   { bg: "var(--warn-soft)",   color: "var(--warn)"      },
  called:    { bg: "#dbeafe",            color: "#1d4ed8"           },
  emailed:   { bg: "#ede9fe",            color: "#6d28d9"           },
  voicemail: { bg: "var(--surface-alt)", color: "var(--text-dim)"   },
  converted: { bg: "var(--success-soft)", color: "var(--success)"   },
  no_answer: { bg: "var(--danger-soft)", color: "var(--danger)"     },
};

function Badge({ label, style }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 7px", borderRadius: 4,
      fontSize: 10, fontWeight: 600, whiteSpace: "nowrap",
      ...style,
    }}>{label}</span>
  );
}

function KPICard({ label, value, sub }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "14px 16px", minWidth: 140,
    }}>
      <div style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginTop: 4, fontFamily: "var(--font-mono)" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── Column definitions per tab ────────────────────────────────────────────────
const COLS_OVERVIEW = [
  { key: "event_code",    label: "Code",      sticky: true,  left: 0,   width: 90 },
  { key: "event_name",    label: "Event",     sticky: true,  left: 90,  width: 200, ellipsis: true },
  { key: "event_date",    label: "Date",      width: 90  },
  { key: "status",        label: "Status",    width: 96  },
  { key: "sub_company",   label: "Company",   width: 120, ellipsis: true },
  { key: "capacity",      label: "Cap",       width: 60  },
  { key: "paid_count",    label: "Paid",      width: 60  },
  { key: "pending_count", label: "Pend",      width: 60  },
  { key: "free_count",    label: "Free",      width: 60  },
  { key: "total_revenue", label: "Revenue",   width: 100 },
  { key: "pending_value", label: "Pend £",    width: 100 },
  { key: "benchmark",     label: "Bench %",   width: 72  },
  { key: "health",        label: "Health",    width: 90  },
];

const COLS_PAYMENTS = [
  { key: "event_code",       label: "Code",    sticky: true, left: 0,  width: 90 },
  { key: "event_name",       label: "Event",   sticky: true, left: 90, width: 200, ellipsis: true },
  { key: "today_paid",       label: "Today",   width: 72 },
  { key: "today_revenue",    label: "Today £", width: 100 },
  { key: "yesterday_paid",   label: "Yest.",   width: 72 },
  { key: "yesterday_revenue",label: "Yest. £", width: 100 },
  { key: "d7_paid",          label: "7D",      width: 60 },
  { key: "d7_revenue",       label: "7D £",    width: 100 },
  { key: "d14_paid",         label: "14D",     width: 60 },
  { key: "d14_revenue",      label: "14D £",   width: 100 },
  { key: "d21_paid",         label: "21D",     width: 60 },
  { key: "d21_revenue",      label: "21D £",   width: 100 },
  { key: "total_revenue",    label: "Total £", width: 100 },
];

const COLS_HEALTH = [
  { key: "event_code",      label: "Code",     sticky: true, left: 0,  width: 90 },
  { key: "event_name",      label: "Event",    sticky: true, left: 90, width: 200, ellipsis: true },
  { key: "event_date",      label: "Date",     width: 90 },
  { key: "status",          label: "Status",   width: 96 },
  { key: "capacity",        label: "Cap",      width: 60 },
  { key: "paid_count",      label: "Paid",     width: 60 },
  { key: "pending_count",   label: "Pending",  width: 70 },
  { key: "total_delegates", label: "Delegates",width: 80 },
  { key: "confirmed_delegates", label: "Confirmed", width: 90 },
  { key: "benchmark",       label: "Bench %",  width: 80 },
  { key: "health",          label: "Health",   width: 90 },
];

const TAB_COLS = { overview: COLS_OVERVIEW, payments: COLS_PAYMENTS, health: COLS_HEALTH };

function cellValue(col, row) {
  const v = row[col.key];
  if (col.key === "event_date")    return fmtDate(v);
  if (col.key === "status")        return <Badge label={v || "—"} style={STATUS_STYLE[v] || { bg: "var(--surface-alt)", color: "var(--text-faint)" }} />;
  if (col.key === "health")        return <Badge label={(HEALTH_STYLE[v] || HEALTH_STYLE.unknown).label} style={{ bg: (HEALTH_STYLE[v] || HEALTH_STYLE.unknown).bg, color: (HEALTH_STYLE[v] || HEALTH_STYLE.unknown).color }} />;
  if (col.key === "benchmark")     return <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: (HEALTH_STYLE[row.health] || HEALTH_STYLE.unknown).color }}>{v != null ? v + "%" : "—"}</span>;
  if (col.key.includes("revenue") || col.key.includes("value")) return <span style={{ fontFamily: "var(--font-mono)" }}>{fmtCurrency(v)}</span>;
  if (col.key === "sub_company")   return <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{v}</span>;
  if (typeof v === "number")       return <span style={{ fontFamily: "var(--font-mono)" }}>{v}</span>;
  return v ?? "—";
}

// ── Event Detail Drawer ───────────────────────────────────────────────────────
function EventDetailDrawer({ code, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drawerTab, setDrawerTab] = useState("reps");
  const [adding, setAdding] = useState(null); // 'followup' | 'mailshot' | 'note'
  const [formData, setFormData] = useState({});

  const load = useCallback(() => {
    if (!code) return;
    setLoading(true);
    eventPerformanceApi.get(code)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [code]);

  useEffect(() => { load(); }, [load]);

  const submitFollowUp = async () => {
    await eventPerformanceApi.followUps.create(code, formData);
    setAdding(null); setFormData({});
    load();
  };

  const submitMailshot = async () => {
    await eventPerformanceApi.mailshots.create(code, formData);
    setAdding(null); setFormData({});
    load();
  };

  const submitNote = async () => {
    await eventPerformanceApi.notes.create(code, { note: formData.note });
    setAdding(null); setFormData({});
    load();
  };

  const deleteFollowUp = async (id) => { await eventPerformanceApi.followUps.delete(code, id); load(); };
  const deleteMailshot = async (id) => { await eventPerformanceApi.mailshots.delete(code, id); load(); };
  const deleteNote     = async (id) => { await eventPerformanceApi.notes.delete(code, id); load(); };

  const e = data?.event;
  const hs = HEALTH_STYLE[e?.health] || HEALTH_STYLE.unknown;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.28)", zIndex: 900 }}
      />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: 860, background: "var(--surface)",
        borderLeft: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        zIndex: 901, overflowY: "auto",
      }}>
        {/* Drawer header */}
        <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-faint)", background: "var(--surface-alt)", border: "1px solid var(--border)", padding: "2px 7px", borderRadius: 4 }}>{code}</span>
                {e && <Badge label={(STATUS_STYLE[e.status] ? e.status : e.status) || "—"} style={STATUS_STYLE[e?.status] || {}} />}
                {e && <Badge label={hs.label} style={{ bg: hs.bg, color: hs.color }} />}
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: 0 }}>
                {loading ? "Loading…" : (e?.event_name || code)}
              </h2>
              {e && <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 3 }}>{e.sub_company} · {e.city} · {fmtDate(e.event_date)}</div>}
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 20, padding: 4, lineHeight: 1 }}>✕</button>
          </div>

          {/* Quick metric pills */}
          {e && (
            <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
              {[
                { label: "Capacity", value: e.capacity },
                { label: "Paid",     value: e.paid_count },
                { label: "Pending",  value: e.pending_count },
                { label: "Revenue",  value: fmtCurrency(e.total_revenue) },
                { label: "Pend £",   value: fmtCurrency(e.pending_value) },
                { label: "Benchmark",value: e.benchmark + "%" },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-faint)", fontWeight: 600 }}>{label}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: "var(--text)", marginTop: 2 }}>{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Drawer tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)", flexShrink: 0, paddingLeft: 24 }}>
          {["reps", "follow-ups", "mailshots", "notes"].map((t) => (
            <button
              key={t}
              onClick={() => { setDrawerTab(t); setAdding(null); }}
              style={{
                padding: "10px 14px", border: "none", background: "none",
                fontSize: 12, fontWeight: drawerTab === t ? 600 : 400,
                color: drawerTab === t ? "var(--accent)" : "var(--text-faint)",
                borderBottom: drawerTab === t ? "2px solid var(--accent)" : "2px solid transparent",
                cursor: "pointer", textTransform: "capitalize",
              }}
            >{t.replace("-", " ")}</button>
          ))}
        </div>

        {/* Drawer content */}
        <div style={{ flex: 1, padding: "16px 24px", overflowY: "auto" }}>
          {loading && <div style={{ color: "var(--text-faint)", padding: "24px 0", textAlign: "center" }}>Loading…</div>}

          {/* Reps tab */}
          {!loading && drawerTab === "reps" && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Rep Performance</div>
              {(!data?.reps || data.reps.length === 0) ? (
                <div style={{ color: "var(--text-faint)", fontSize: 12, padding: "20px 0" }}>No rep data available.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>{["Rep","Paid","Pending","Revenue","Pend £"].map(h => (
                      <th key={h} style={{ textAlign: h === "Rep" ? "left" : "right", padding: "6px 10px", borderBottom: "1px solid var(--border)", color: "var(--text-faint)", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {data.reps.map((r, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "8px 10px", fontWeight: 500 }}>{r.rep_name}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--success)" }}>{r.paid_bookings}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--warn)" }}>{r.pending_bookings}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--font-mono)" }}>{fmtCurrency(r.total_revenue)}</td>
                        <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--warn)" }}>{fmtCurrency(r.pending_value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Follow-Ups tab */}
          {!loading && drawerTab === "follow-ups" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Follow-Up Records</div>
                <button onClick={() => setAdding(adding === "followup" ? null : "followup")} style={addBtnStyle}>+ Add</button>
              </div>
              {adding === "followup" && (
                <div style={formCardStyle}>
                  {[
                    ["contact_name","Contact Name","text"],
                    ["company","Company","text"],
                    ["email","Email","email"],
                    ["phone","Phone","text"],
                  ].map(([k,l,t]) => (
                    <div key={k} style={{ marginBottom: 8 }}>
                      <label style={labelStyle}>{l}</label>
                      <input type={t} value={formData[k] || ""} onChange={e => setFormData(p => ({...p, [k]: e.target.value}))} style={inputStyle} />
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Date</label>
                      <input type="date" value={formData.follow_up_date || ""} onChange={e => setFormData(p => ({...p, follow_up_date: e.target.value}))} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Status</label>
                      <select value={formData.status || "pending"} onChange={e => setFormData(p => ({...p, status: e.target.value}))} style={inputStyle}>
                        {["pending","called","emailed","voicemail","converted","no_answer"].map(s => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Notes</label>
                    <textarea value={formData.notes || ""} onChange={e => setFormData(p => ({...p, notes: e.target.value}))} rows={2} style={{...inputStyle, resize: "vertical"}} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={submitFollowUp} style={saveBtnStyle}>Save</button>
                    <button onClick={() => { setAdding(null); setFormData({}); }} style={cancelBtnStyle}>Cancel</button>
                  </div>
                </div>
              )}
              {(!data?.follow_ups || data.follow_ups.length === 0) && adding !== "followup" && (
                <div style={{ color: "var(--text-faint)", fontSize: 12, padding: "16px 0" }}>No follow-ups recorded.</div>
              )}
              {data?.follow_ups?.map(fu => (
                <div key={fu.id} style={recordCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{fu.contact_name || "—"} {fu.company && <span style={{ fontWeight: 400, color: "var(--text-dim)", fontSize: 11 }}>· {fu.company}</span>}</div>
                      <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{fu.email} {fu.phone && "· " + fu.phone}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Badge label={fu.status} style={FOLLOW_UP_STATUS_STYLE[fu.status] || {}} />
                      <span style={{ fontSize: 10, color: "var(--text-faint)" }}>{fmtDate(fu.follow_up_date)}</span>
                      <button onClick={() => deleteFollowUp(fu.id)} style={deleteBtnStyle}>✕</button>
                    </div>
                  </div>
                  {fu.notes && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6, lineHeight: 1.5 }}>{fu.notes}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Mailshots tab */}
          {!loading && drawerTab === "mailshots" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Mailshot Records</div>
                <button onClick={() => setAdding(adding === "mailshot" ? null : "mailshot")} style={addBtnStyle}>+ Add</button>
              </div>
              {adding === "mailshot" && (
                <div style={formCardStyle}>
                  <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Type</label>
                      <select value={formData.mailshot_type || "invite"} onChange={e => setFormData(p => ({...p, mailshot_type: e.target.value}))} style={inputStyle}>
                        {["invite","reminder","thank_you","follow_up","promotional","other"].map(t => <option key={t} value={t}>{t.replace("_"," ")}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={labelStyle}>Date Sent</label>
                      <input type="date" value={formData.sent_at || ""} onChange={e => setFormData(p => ({...p, sent_at: e.target.value}))} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={labelStyle}>Subject</label>
                    <input type="text" value={formData.subject || ""} onChange={e => setFormData(p => ({...p, subject: e.target.value}))} style={inputStyle} />
                  </div>
                  <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                    {[["target_count","Sent"],["opened_count","Opened"],["clicked_count","Clicked"]].map(([k,l]) => (
                      <div key={k} style={{ flex: 1 }}>
                        <label style={labelStyle}>{l}</label>
                        <input type="number" min="0" value={formData[k] || ""} onChange={e => setFormData(p => ({...p, [k]: parseInt(e.target.value) || 0}))} style={inputStyle} />
                      </div>
                    ))}
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <label style={labelStyle}>Notes</label>
                    <textarea value={formData.notes || ""} onChange={e => setFormData(p => ({...p, notes: e.target.value}))} rows={2} style={{...inputStyle, resize: "vertical"}} />
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={submitMailshot} style={saveBtnStyle}>Save</button>
                    <button onClick={() => { setAdding(null); setFormData({}); }} style={cancelBtnStyle}>Cancel</button>
                  </div>
                </div>
              )}
              {(!data?.mailshots || data.mailshots.length === 0) && adding !== "mailshot" && (
                <div style={{ color: "var(--text-faint)", fontSize: 12, padding: "16px 0" }}>No mailshots recorded.</div>
              )}
              {data?.mailshots?.map(ms => (
                <div key={ms.id} style={recordCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{ms.subject || ms.mailshot_type.replace("_"," ")}</div>
                      <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                        Sent: {fmtDate(ms.sent_at)} ·
                        <span style={{ color: "var(--text-dim)" }}> {ms.target_count} sent</span> ·
                        <span style={{ color: "var(--success)" }}> {ms.opened_count} opened ({ms.open_rate}%)</span> ·
                        <span style={{ color: "#1d4ed8" }}> {ms.clicked_count} clicked</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <Badge label={ms.mailshot_type.replace("_"," ")} style={{ bg: "var(--surface-alt)", color: "var(--text-dim)" }} />
                      <button onClick={() => deleteMailshot(ms.id)} style={deleteBtnStyle}>✕</button>
                    </div>
                  </div>
                  {ms.notes && <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 6 }}>{ms.notes}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Notes tab */}
          {!loading && drawerTab === "notes" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Notes</div>
                <button onClick={() => setAdding(adding === "note" ? null : "note")} style={addBtnStyle}>+ Add</button>
              </div>
              {adding === "note" && (
                <div style={formCardStyle}>
                  <textarea
                    placeholder="Add a note…"
                    value={formData.note || ""}
                    onChange={e => setFormData(p => ({...p, note: e.target.value}))}
                    rows={3}
                    style={{...inputStyle, resize: "vertical", marginBottom: 10}}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={submitNote} style={saveBtnStyle}>Save</button>
                    <button onClick={() => { setAdding(null); setFormData({}); }} style={cancelBtnStyle}>Cancel</button>
                  </div>
                </div>
              )}
              {(!data?.notes || data.notes.length === 0) && adding !== "note" && (
                <div style={{ color: "var(--text-faint)", fontSize: 12, padding: "16px 0" }}>No notes recorded.</div>
              )}
              {data?.notes?.map(n => (
                <div key={n.id} style={recordCardStyle}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1, fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>{n.note}</div>
                    <button onClick={() => deleteNote(n.id)} style={deleteBtnStyle}>✕</button>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-faint)", marginTop: 6 }}>{n.created_by_name} · {new Date(n.created_at).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Shared drawer styles ──────────────────────────────────────────────────────
const addBtnStyle = {
  fontSize: 11, padding: "4px 10px", borderRadius: 5, border: "1px solid var(--border)",
  background: "var(--surface-alt)", color: "var(--text)", cursor: "pointer", fontWeight: 500,
};
const saveBtnStyle = {
  padding: "6px 14px", borderRadius: 6, border: "none",
  background: "var(--accent)", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 12,
};
const cancelBtnStyle = {
  padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)",
  background: "var(--surface-alt)", color: "var(--text-dim)", cursor: "pointer", fontSize: 12,
};
const deleteBtnStyle = {
  background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 13,
  padding: "2px 4px", flexShrink: 0,
};
const formCardStyle = {
  background: "var(--surface-alt)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "14px", marginBottom: 14,
};
const recordCardStyle = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 8, padding: "12px 14px", marginBottom: 8,
};
const inputStyle = {
  width: "100%", padding: "6px 9px", borderRadius: 6,
  border: "1px solid var(--border)", background: "var(--surface)",
  fontSize: 12, color: "var(--text)", fontFamily: "inherit", outline: "none",
};
const labelStyle = {
  display: "block", fontSize: 10, fontWeight: 600, color: "var(--text-faint)",
  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4,
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export function EventPerformancePage() {
  const [events, setEvents]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState("overview");
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatusFilter]         = useState("");
  const [subCompanyFilter, setSubCompanyFilter] = useState("");
  const [selectedCode, setSelectedCode]         = useState(null);
  const debounceRef = useRef(null);

  const loadEvents = useCallback(() => {
    setLoading(true);
    const params = {};
    if (search)           params.search      = search;
    if (statusFilter)     params.status      = statusFilter;
    if (subCompanyFilter) params.sub_company = subCompanyFilter;
    eventPerformanceApi.list(params)
      .then(data => setEvents(Array.isArray(data) ? data : (data.results || [])))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, statusFilter, subCompanyFilter]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(loadEvents, 300);
    return () => clearTimeout(debounceRef.current);
  }, [loadEvents]);

  // Aggregate KPIs from loaded data
  const kpis = events.reduce((acc, e) => {
    acc.totalEvents++;
    acc.totalPaid      += e.paid_count || 0;
    acc.totalPending   += e.pending_count || 0;
    acc.totalRevenue   += e.total_revenue || 0;
    acc.pendingValue   += e.pending_value || 0;
    acc.todayPaid      += e.today_paid || 0;
    acc.todayRevenue   += e.today_revenue || 0;
    return acc;
  }, { totalEvents: 0, totalPaid: 0, totalPending: 0, totalRevenue: 0, pendingValue: 0, todayPaid: 0, todayRevenue: 0 });

  const cols = TAB_COLS[tab] || COLS_OVERVIEW;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg)", overflow: "hidden" }}>

      {/* Top bar */}
      <div style={{ padding: "16px 20px 12px", flexShrink: 0, borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", margin: 0 }}>Event Performance</h1>
            <p style={{ fontSize: 11, color: "var(--text-faint)", margin: "2px 0 0" }}>Live metrics computed from bookings, payments and delegates</p>
          </div>
          <button
            onClick={loadEvents}
            style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-alt)", fontSize: 12, color: "var(--text)", cursor: "pointer", fontWeight: 500 }}
          >↺ Refresh</button>
        </div>

        {/* KPI Cards */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <KPICard label="Events"        value={kpis.totalEvents}                 />
          <KPICard label="Paid Today"    value={kpis.todayPaid}    sub={fmtCurrency(kpis.todayRevenue) + " today"} />
          <KPICard label="Total Paid"    value={kpis.totalPaid}                   />
          <KPICard label="Total Revenue" value={fmtCurrency(kpis.totalRevenue)}   />
          <KPICard label="Pending Value" value={fmtCurrency(kpis.pendingValue)} sub={kpis.totalPending + " pending bookings"} />
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Search event name or code…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: 240 }}
          />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inputStyle, width: 130 }}>
            <option value="">All Statuses</option>
            {["Draft","Upcoming","Live","Completed","Cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={subCompanyFilter} onChange={e => setSubCompanyFilter(e.target.value)} style={{ ...inputStyle, width: 160 }}>
            <option value="">All Sub-Companies</option>
            {["Linq Conferences","Linq Training","Linq Summits","Linq Live"].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {(search || statusFilter || subCompanyFilter) && (
            <button onClick={() => { setSearch(""); setStatusFilter(""); setSubCompanyFilter(""); }} style={{ ...cancelBtnStyle, fontSize: 11 }}>Clear</button>
          )}
        </div>
      </div>

      {/* View Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "var(--surface)", flexShrink: 0, paddingLeft: 20 }}>
        {[
          { id: "overview", label: "Overview" },
          { id: "payments", label: "Payments Timeline" },
          { id: "health",   label: "Health & Delegates" },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              padding: "10px 16px", border: "none", background: "none",
              fontSize: 12, fontWeight: tab === id ? 600 : 400,
              color: tab === id ? "var(--accent)" : "var(--text-faint)",
              borderBottom: tab === id ? "2px solid var(--accent)" : "2px solid transparent",
              cursor: "pointer",
            }}
          >{label}</button>
        ))}
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>Loading…</div>
        ) : events.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>No events found.</div>
        ) : (
          <table style={{ borderCollapse: "collapse", fontSize: 12, width: "max-content", minWidth: "100%" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, background: "var(--surface)" }}>
              <tr>
                {cols.map(col => (
                  <th
                    key={col.key}
                    style={{
                      padding: "9px 12px",
                      textAlign: "left",
                      fontWeight: 600,
                      fontSize: 10,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      color: "var(--text-faint)",
                      borderBottom: "1px solid var(--border)",
                      whiteSpace: "nowrap",
                      background: "var(--surface)",
                      ...(col.sticky ? { position: "sticky", left: col.left, zIndex: 11, boxShadow: "1px 0 0 var(--border)" } : {}),
                      width: col.width,
                      minWidth: col.width,
                    }}
                  >{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((row, idx) => (
                <tr
                  key={row.event_code}
                  onClick={() => setSelectedCode(row.event_code)}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: idx % 2 === 0 ? "var(--surface)" : "var(--bg)",
                    cursor: "pointer",
                    transition: "background .1s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--surface-alt)"}
                  onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? "var(--surface)" : "var(--bg)"}
                >
                  {cols.map(col => (
                    <td
                      key={col.key}
                      style={{
                        padding: "8px 12px",
                        whiteSpace: "nowrap",
                        maxWidth: col.width,
                        ...(col.ellipsis ? { overflow: "hidden", textOverflow: "ellipsis" } : {}),
                        background: "inherit",
                        ...(col.sticky ? { position: "sticky", left: col.left, zIndex: 1, boxShadow: "1px 0 0 var(--border)" } : {}),
                      }}
                    >
                      {cellValue(col, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Event Detail Drawer */}
      {selectedCode && (
        <EventDetailDrawer
          code={selectedCode}
          onClose={() => setSelectedCode(null)}
        />
      )}
    </div>
  );
}
