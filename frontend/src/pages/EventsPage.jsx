import { useState, useEffect, useRef } from "react";
import { eventsApi, usersApi } from "../api";
import { EventDetailDrawer } from "../components/events/EventDetailDrawer";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import { SortableTh, EmptyState, Td } from "../components/ui/Table";
import { EventStatusBadge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input, Select, FormField } from "../components/ui/Input";
import { useFetch } from "../hooks/useFetch";
import { useSort } from "../hooks/useSort";
import { fmt } from "../utils/helpers";
import { EVENT_STATUSES } from "../utils/constants";

const PAGE_SIZE = 50;

export function EventsPage() {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [search, setSearch]     = useState("");
  const [status, setStatus]     = useState("");
  const [modal,  setModal]      = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [salesUsers, setSalesUsers] = useState([]);
  const { sort, toggle: sortToggle } = useSort("event_date", "desc");

  // ── Infinite scroll state ────────────────────────────────────────────────
  const [items,       setItems]       = useState([]);
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(true);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef(null);

  // Fetch a page and accumulate
  useEffect(() => {
    let cancelled = false;
    if (page === 1) {
      setLoading(true);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    eventsApi.list({
      page, page_size: PAGE_SIZE,
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      ordering: sort.dir === "asc" ? sort.key : `-${sort.key}`,
    }).then(data => {
      if (cancelled) return;
      const newItems = data?.results || [];
      setItems(prev => page === 1 ? newItems : [...prev, ...newItems]);
      setHasMore(!!data?.next);
    }).catch(() => {}).finally(() => {
      if (!cancelled) { setLoading(false); setLoadingMore(false); }
    });

    return () => { cancelled = true; };
  }, [page, search, status, sort.key, sort.dir]);

  // IntersectionObserver — fires setPage(+1) when sentinel comes into view
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasMore && !loadingMore && !loading) {
          setPage(p => p + 1);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading]);

  // Reset to page 1 on filter/sort change (setPage triggers the fetch effect)
  const handleSearch = (v) => { setSearch(v); setPage(1); setItems([]); };
  const handleStatus = (v) => { setStatus(v); setPage(1); setItems([]); };
  const handleSort   = (key) => { sortToggle(key); setPage(1); setItems([]); };

  // After create/update/delete — reload from scratch
  const refetch = () => { setPage(1); setItems([]); };

  // Fetch all users for dropdown — sales exec (by ID) and team name fields (by full_name)
  useFetch(() => usersApi.list({ page_size: 200 }), [], {
    onSuccess: (r) => setSalesUsers(r?.results || []),
  });

  const openCreate = () => setModal({ mode: "create", data: { 
    event_code: "", name: "", official_name: "", city: "", country: "",
    venue: "", event_date: "", end_date: "", sales_executive: null,
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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h4 style={{ margin: 0, fontSize: 18, color: "var(--text)", textTransform: "uppercase", fontWeight: 700 }}>Events</h4>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-faint)" }}>Manage and track all company events and their capacities.</p>
        </div>
        {isAdmin && <button className="btn btn-primary" onClick={openCreate}>+ New Event</button>}
      </div>


      <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <div style={{ padding: "20px", background: "var(--surface)", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 15, flexWrap: "wrap", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--surface-alt)",
            border: "1px solid var(--border)", borderRadius: 4, padding: "8px 12px", flex: 1, maxWidth: 300 }}>
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round">
              <circle cx="5" cy="5" r="4"/><path d="M9 9l2.5 2.5"/>
            </svg>
            <input value={search} onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search events..." style={{ background: "none", border: "none", outline: "none",
                fontSize: 13, color: "var(--text)", width: "100%", fontFamily: "inherit" }} />
          </div>
          <select value={status} onChange={(e) => handleStatus(e.target.value)}
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4,
              padding: "8px 30px 8px 12px", fontSize: 13, color: "var(--text)", appearance: "none", cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
            <option value="">All Statuses</option>
            {EVENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>


      <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: "var(--surface-alt)" }}>
              <SortableTh sortKey="event_code" sort={sort} onSort={handleSort}>Code</SortableTh>
              <SortableTh sortKey="name"        sort={sort} onSort={handleSort}>Name</SortableTh>
              <SortableTh sortKey="official_name" sort={sort} onSort={handleSort}>Official Name</SortableTh>
              <SortableTh sortKey="city"        sort={sort} onSort={handleSort}>City</SortableTh>
              <SortableTh sortKey="event_date"  sort={sort} onSort={handleSort}>Date</SortableTh>
              <SortableTh sortKey="accepting_web_bookings" sort={sort} onSort={handleSort}>Web Bookings</SortableTh>
              <SortableTh noSort>Status</SortableTh>
              <SortableTh sortKey="sales_executive" sort={sort} onSort={handleSort}>Sales Executive</SortableTh>
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
                onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-alt)"}
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
                          background: "var(--surface-alt)", border: "none", borderRadius: 6, padding: "6px",
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
                            background: "rgba(240,101,72,0.1)", border: "none", borderRadius: 6, padding: "6px",
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

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} style={{ height: 1 }} />
        {loadingMore && (
          <div style={{ padding: "16px", textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>
            Loading more…
          </div>
        )}
        {!hasMore && items.length > 0 && (
          <div style={{ padding: "14px", textAlign: "center", color: "var(--text-faint)", fontSize: 12 }}>
            All {items.length} events loaded
          </div>
        )}
        </div>
      </div>

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
              <FormField label="Accepting Web Bookings">
                <Select value={String(modal.data.accepting_web_bookings)} onChange={(v) => setField("accepting_web_bookings", v === 'true')} options={[{label:'Yes', value:'true'}, {label:'No', value:'false'}]} />
              </FormField>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Sales Executive">
                <Select 
                  value={modal.data.sales_executive ? String(modal.data.sales_executive) : ""} 
                  onChange={(v) => setField("sales_executive", v || null)}
                  options={salesUsers.map(u => ({ label: u.full_name, value: String(u.id) }))}
                  placeholder="— Unassigned —"
                />
              </FormField>
              <FormField label="Speaker Sales Team">
                <Select 
                  value={modal.data.speaker_sales_team || ""} 
                  onChange={(v) => setField("speaker_sales_team", v)}
                  options={salesUsers.map(u => ({ label: u.full_name, value: u.full_name }))}
                  placeholder="— Unassigned —"
                />
              </FormField>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="SpEx Team">
                <Select 
                  value={modal.data.spex_team || ""} 
                  onChange={(v) => setField("spex_team", v)}
                  options={salesUsers.map(u => ({ label: u.full_name, value: u.full_name }))}
                  placeholder="— Unassigned —"
                />
              </FormField>
              <FormField label="Tele Marketing Team">
                <Select 
                  value={modal.data.tele_marketing_team || ""} 
                  onChange={(v) => setField("tele_marketing_team", v)}
                  options={salesUsers.map(u => ({ label: u.full_name, value: u.full_name }))}
                  placeholder="— Unassigned —"
                />
              </FormField>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Market Research Team">
                <Select 
                  value={modal.data.market_research_team || ""} 
                  onChange={(v) => setField("market_research_team", v)}
                  options={salesUsers.map(u => ({ label: u.full_name, value: u.full_name }))}
                  placeholder="— Unassigned —"
                />
              </FormField>
              <FormField label="Content Check">
                <Select 
                  value={modal.data.content_check || ""} 
                  onChange={(v) => setField("content_check", v)}
                  options={salesUsers.map(u => ({ label: u.full_name, value: u.full_name }))}
                  placeholder="— Unassigned —"
                />
              </FormField>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Marketing Check">
                <Select 
                  value={modal.data.marketing_check || ""} 
                  onChange={(v) => setField("marketing_check", v)}
                  options={salesUsers.map(u => ({ label: u.full_name, value: u.full_name }))}
                  placeholder="— Unassigned —"
                />
              </FormField>
              <FormField label="Sales Check">
                <Select 
                  value={modal.data.sales_check || ""} 
                  onChange={(v) => setField("sales_check", v)}
                  options={salesUsers.map(u => ({ label: u.full_name, value: u.full_name }))}
                  placeholder="— Unassigned —"
                />
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
