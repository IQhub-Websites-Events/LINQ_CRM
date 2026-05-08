import { useState, useCallback } from "react";
import { eventsApi, usersApi } from "../api";
import { EventDetailDrawer } from "../components/events/EventDetailDrawer";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import { SortableTh, Pager, EmptyState, Td } from "../components/ui/Table";
import { EventStatusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input, Select, FormField } from "../components/ui/Input";
import { useFetch } from "../hooks/useFetch";
import { useSort } from "../hooks/useSort";
import { usePagination } from "../hooks/usePagination";
import { fmt } from "../utils/helpers";

const PAGE_SIZE = 50;

export function EventsPage() {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [search, setSearch]     = useState("");
  const [status, setStatus]     = useState("");
  const [modal,  setModal]      = useState(null); // null | { mode, data }
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [salesUsers, setSalesUsers] = useState([]);
  const { sort, toggle: sortToggle } = useSort("event_date", "asc");
  const { page, setPage }        = usePagination();

  const { data, loading, refetch } = useFetch(
    () => eventsApi.list({
      page, page_size: PAGE_SIZE,
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      ordering: sort.dir === "asc" ? sort.key : `-${sort.key}`,
    }),
    [page, search, status, sort.key, sort.dir]
  );

  // Fetch sales users for dropdown
  useFetch(() => isAdmin ? usersApi.list({ role: "sales", page_size: 200 }) : Promise.resolve(null), [isAdmin], {
    onSuccess: (r) => setSalesUsers(r?.results || []),
  });

  const openCreate = () => setModal({ mode: "create", data: { 
    event_code: "", name: "", official_name: "", city: "", country: "",
    venue: "", event_date: "", end_date: "", capacity: 500, sales_executive: null,
    speaker_sales_team: "", spex_team: "", tele_marketing_team: "", market_research_team: "",
    content_check: "", marketing_check: "", sales_check: "", accepting_web_bookings: false
  } });
  const openEdit   = (ev) => setModal({ mode: "edit", data: { ...ev } });
  const closeModal = () => setModal(null);

  const save = async () => {
    try {
      if (modal.mode === "create") await eventsApi.create(modal.data);
      else await eventsApi.update(modal.data.id, modal.data);
      toast.success(modal.mode === "create" ? "Event created" : "Event updated");
      closeModal(); refetch();
    } catch (err) {
      toast.error("Save failed: " + (err.response?.data?.event_code?.[0] || err.message));
    }
  };

  const del = async (ev) => {
    if (!window.confirm(`Delete ${ev.event_code}?`)) return;
    try { await eventsApi.delete(ev.id); toast.success("Deleted"); refetch(); }
    catch { toast.error("Delete failed"); }
  };

  const setField = (k, v) => setModal((m) => ({ ...m, data: { ...m.data, [k]: v } }));

  const items = data?.results || [];
  const total = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h4 style={{ margin: 0, fontSize: 18, color: "#495057", textTransform: "uppercase", fontWeight: 700 }}>Events</h4>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#878a99" }}>Manage and track all company events and their capacities.</p>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={openCreate}>+ New Event</button>}
      </div>


      <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <div style={{ padding: "20px", background: "#fff", borderBottom: "1px solid var(--vz-card-border-color)",
          display: "flex", alignItems: "center", gap: 15, flexWrap: "wrap", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#f3f3f9",
            border: "1px solid #e9ebec", borderRadius: 4, padding: "8px 12px", flex: 1, maxWidth: 300 }}>
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round">
              <circle cx="5" cy="5" r="4"/><path d="M9 9l2.5 2.5"/>
            </svg>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search events..." style={{ background: "none", border: "none", outline: "none",
                fontSize: 13, color: "#495057", width: "100%", fontFamily: "inherit" }} />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            style={{ background: "#fff", border: "1px solid #e9ebec", borderRadius: 4,
              padding: "8px 30px 8px 12px", fontSize: 13, color: "#495057", appearance: "none", cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
            <option value="">All Statuses</option>
            <option value="Live">Live</option>
            <option value="Completed">Completed</option>
          </select>
        </div>


      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "#f3f6f9" }}>
              <SortableTh sortKey="event_code" sort={sort} onSort={sortToggle}>Code</SortableTh>
              <SortableTh sortKey="name"        sort={sort} onSort={sortToggle}>Name</SortableTh>
              <SortableTh sortKey="official_name" sort={sort} onSort={sortToggle}>Official Name</SortableTh>
              <SortableTh sortKey="city"        sort={sort} onSort={sortToggle}>City</SortableTh>
              <SortableTh sortKey="event_date"  sort={sort} onSort={sortToggle}>Date</SortableTh>
              <SortableTh sortKey="accepting_web_bookings" sort={sort} onSort={sortToggle}>Web Bookings</SortableTh>
              <SortableTh noSort>Status</SortableTh>
              <SortableTh sortKey="sales_executive" sort={sort} onSort={sortToggle}>Sales Executive</SortableTh>
              <SortableTh noSort></SortableTh>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>Loading…</td></tr>
            ) : items.length === 0 ? (
              <EmptyState title="No events found" />
            ) : items?.map((ev) => (
              <tr key={ev.id}
                onClick={() => setSelectedEventId(ev.id)}
                style={{ borderBottom: "1px solid var(--vz-card-border-color)", cursor: "pointer", transition: "background .2s ease" }}
                onMouseEnter={(e) => e.currentTarget.style.background = "#f3f3f9"}
                onMouseLeave={(e) => e.currentTarget.style.background = ""}
              >
                <Td><span className="badge badge-soft-primary" style={{ fontSize: 11, fontWeight: 700 }}>{ev.event_code}</span></Td>
                <Td><span style={{ fontWeight: 600, fontSize: 13 }}>{ev.name}</span></Td>
                <Td muted>{ev.official_name || "—"}</Td>
                <Td muted>{ev.city}</Td>
                <Td mono>{fmt.date(ev.event_date)}</Td>
                <Td><span className={`badge badge-soft-${ev.accepting_web_bookings ? 'success' : 'secondary'}`}>{ev.accepting_web_bookings ? 'YES' : 'NO'}</span></Td>
                <Td><EventStatusBadge status={ev.event_status} /></Td>
                <Td muted>{ev.sales_executive_name || "—"}</Td>
                  <Td>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); openEdit(ev); }} 
                        className="btn-icon" 
                        title="Edit Event"
                        style={{ 
                          background: "#f0f2f5", border: "none", borderRadius: 6, padding: "6px", 
                          color: "#405189", cursor: "pointer", display: "flex", alignItems: "center" 
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                        </svg>
                      </button>
                      {isAdmin && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); del(ev); }} 
                          className="btn-icon" 
                          title="Delete Event"
                          style={{ 
                            background: "#fff5f5", border: "none", borderRadius: 6, padding: "6px", 
                            color: "#f06548", cursor: "pointer", display: "flex", alignItems: "center" 
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                        </button>
                      )}
                    </div>
                  </Td>
              </tr>

            ))}
          </tbody>
        </table>
        </div>
      </div>

      <Pager page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPage={setPage} />

      <EventDetailDrawer
        eventId={selectedEventId}
        onClose={() => setSelectedEventId(null)}
      />

      <Modal open={!!modal} onClose={closeModal}
        title={modal?.mode === "create" ? "New event" : `Edit ${modal?.data?.event_code}`}
        footer={<><Button onClick={closeModal}>Cancel</Button><Button variant="primary" onClick={save}>Save event</Button></>}>
        {modal && (
          <div style={{ display: "grid", gap: 12, maxHeight: "70vh", overflowY: "auto", padding: "4px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Event code" required>
                <Input value={modal.data.event_code} onChange={(v) => setField("event_code", v.toUpperCase())} placeholder="GFS-2027" />
              </FormField>
              <FormField label="Event name" required>
                <Input value={modal.data.name} onChange={(v) => setField("name", v)} placeholder="Global Finance Summit 2027" />
              </FormField>
            </div>

            <FormField label="Official Name">
              <Input value={modal.data.official_name || ""} onChange={(v) => setField("official_name", v)} placeholder="Official Name" />
            </FormField>

            <FormField label="City">
              <Input value={modal.data.city} onChange={(v) => setField("city", v)} placeholder="London" />
            </FormField>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Country">
                <Input value={modal.data.country || ""} onChange={(v) => setField("country", v)} placeholder="United Kingdom" />
              </FormField>
              <FormField label="Venue">
                <Input value={modal.data.venue || ""} onChange={(v) => setField("venue", v)} placeholder="ExCeL London" />
              </FormField>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Start Date" required>
                <Input type="date" value={modal.data.event_date} onChange={(v) => setField("event_date", v)} />
              </FormField>
              <FormField label="End Date">
                <Input type="date" value={modal.data.end_date || ""} onChange={(v) => setField("end_date", v)} />
              </FormField>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Capacity">
                <Input type="number" value={String(modal.data.capacity || 0)} onChange={(v) => setField("capacity", Number(v))} />
              </FormField>
              <FormField label="Accepting Web Bookings">
                <Select value={String(modal.data.accepting_web_bookings)} onChange={(v) => setField("accepting_web_bookings", v === 'true')} options={[{label:'Yes', value:'true'}, {label:'No', value:'false'}]} />
              </FormField>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Sales Executive">
                <select value={modal.data.sales_executive || ""} onChange={(e) => setField("sales_executive", e.target.value || null)}
                  style={{ width: "100%", background: "#fff", border: "1px solid #e2e8f0",
                    borderRadius: 7, padding: "7px 10px", fontSize: 13, color: "#1e293b",
                    fontFamily: "inherit", outline: "none", cursor: "pointer" }}>
                  <option value="">— Unassigned —</option>
                  {salesUsers.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </FormField>
              <FormField label="Speaker Sales Team">
                <Input value={modal.data.speaker_sales_team || ""} onChange={(v) => setField("speaker_sales_team", v)} />
              </FormField>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="SpEx Team">
                <Input value={modal.data.spex_team || ""} onChange={(v) => setField("spex_team", v)} />
              </FormField>
              <FormField label="Tele Marketing Team">
                <Input value={modal.data.tele_marketing_team || ""} onChange={(v) => setField("tele_marketing_team", v)} />
              </FormField>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Market Research Team">
                <Input value={modal.data.market_research_team || ""} onChange={(v) => setField("market_research_team", v)} />
              </FormField>
              <FormField label="Content Check">
                <Input value={modal.data.content_check || ""} onChange={(v) => setField("content_check", v)} />
              </FormField>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Marketing Check">
                <Input value={modal.data.marketing_check || ""} onChange={(v) => setField("marketing_check", v)} />
              </FormField>
              <FormField label="Sales Check">
                <Input value={modal.data.sales_check || ""} onChange={(v) => setField("sales_check", v)} />
              </FormField>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

const iconBtn = {
  border: "none", background: "none", cursor: "pointer",
  padding: "3px 5px", borderRadius: 4, color: "#94a3b8", fontSize: 12,
};
