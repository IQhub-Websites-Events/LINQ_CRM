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
import { useSort } from "../hooks/useSort";
import { fmt } from "../utils/helpers";
import { EVENT_STATUSES } from "../utils/constants";

const PAGE_SIZE = 50;

// Resolve a stored field value (may be a user ID or a legacy display name) to an ID string.
function resolveNameToId(val, users) {
  if (!val) return "";
  const asId = parseInt(val);
  if (!isNaN(asId) && users.some(u => u.id === asId)) return String(asId);
  const byName = users.find(u => u.full_name === val || u.username === val);
  return byName ? String(byName.id) : "";
}

export function EventsPage() {
  const toast = useToast();
  const { isAdmin } = useAuth();
  const [search, setSearch]     = useState("");
  const [status, setStatus]     = useState("");
  const [modal,  setModal]      = useState(null);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const { sort, toggle: sortToggle } = useSort("event_date", "desc");

  const [colFilters, setColFilters] = useState({
    event_code: "",
    name: "",
    official_name: "",
    city: "",
    year: "",
    accepting_web_bookings: "",
    status: "",
    sales_executive: "",
  });

  const [filterOptions, setFilterOptions] = useState({
    codes: [],
    names: [],
    officialNames: [],
    cities: [],
    years: [],
  });

  const handleColFilter = (key, val) => {
    setColFilters(prev => ({ ...prev, [key]: val }));
    setPage(1);
    setItems([]);
  };

  useEffect(() => {
    eventsApi.list({ page_size: 500 }).then(r => {
      const results = r?.results || [];
      const codes = [...new Set(results.map(e => e.event_code).filter(Boolean))].sort();
      const names = [...new Set(results.map(e => e.name).filter(Boolean))].sort();
      const officialNames = [...new Set(results.map(e => e.official_name).filter(Boolean))].sort();
      const cities = [...new Set(results.map(e => e.city).filter(Boolean))].sort();
      const years = [...new Set(results.map(e => {
        if (!e.event_date) return null;
        return new Date(e.event_date).getFullYear();
      }).filter(Boolean))].sort((a, b) => b - a);

      setFilterOptions({ codes, names, officialNames, cities, years });
    }).catch(() => {});
  }, []);

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

    const activeFilters = Object.fromEntries(
      Object.entries(colFilters).filter(([_, v]) => v !== "" && v !== null && v !== undefined)
    );

    eventsApi.list({
      page, page_size: PAGE_SIZE,
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      ...activeFilters,
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
  }, [page, search, status, sort.key, sort.dir, colFilters]);

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
  useEffect(() => {
    usersApi.list({ page_size: 500 }).then(r => setAllUsers(r?.results || [])).catch(() => {});
  }, []);

  const salesUsers        = allUsers.filter(u => u.role === "sales");
  const speakerSalesUsers = allUsers.filter(u => u.role === "speaker_sales");
  const spexUsers         = allUsers.filter(u => u.role === "spex");
  const telemarketUsers   = allUsers.filter(u => u.role === "telemarketing");
  const marketResUsers    = allUsers.filter(u => u.role === "market_research");

  const TEAM_FIELDS = [
    "speaker_sales_team", "spex_team", "tele_marketing_team",
    "market_research_team", "content_check", "marketing_check", "sales_check",
  ];

  const openCreate = () => setModal({ mode: "create", data: {
    eventType: "new",
    event_code: "", master_code: "", name: "", official_name: "", city: "", country: "",
    venue: "", event_date: "", end_date: "", sales_executive: null,
    speaker_sales_team: "", spex_team: "", tele_marketing_team: "", market_research_team: "",
    content_check: "", marketing_check: "", sales_check: "", accepting_web_bookings: false
  } });

  const yr = new Date().getFullYear().toString().slice(-2);

  // Helper to replace year in name/official_name
  const replaceYear = (str, newYear) => {
    if (!str) return "";
    const fourDigitRegex = /\b20\d{2}\b/g;
    if (fourDigitRegex.test(str)) {
      return str.replace(fourDigitRegex, String(newYear));
    }
    const twoDigitRegex = /\b\d{2}\b/g;
    if (twoDigitRegex.test(str)) {
      return str.replace(twoDigitRegex, String(newYear).slice(-2));
    }
    return `${str} ${newYear}`;
  };

  // Auto-populate when previous edition master_code is entered
  useEffect(() => {
    if (modal?.mode !== "create" || modal?.data?.eventType !== "old") return;
    const code = modal?.data?.master_code;
    if (!code || code.length < 3) return;

    const timer = setTimeout(() => {
      eventsApi.list({ event_code: code, page_size: 1 })
        .then(res => {
          const pastEvent = res.results?.[0];
          if (pastEvent) {
            const targetYear = 2000 + parseInt(yr);
            const newName = replaceYear(pastEvent.name, targetYear);
            const newOfficialName = replaceYear(pastEvent.official_name, targetYear);

            setModal(m => {
              if (m?.data?.master_code !== code) return m;
              return {
                ...m,
                data: {
                  ...m.data,
                  name: newName,
                  official_name: newOfficialName,
                  city: pastEvent.city || "",
                  country: pastEvent.country || "",
                  venue: pastEvent.venue || "",
                  sales_executive: pastEvent.sales_executive ? String(pastEvent.sales_executive) : null,
                  speaker_sales_team: pastEvent.speaker_sales_team || "",
                  spex_team: pastEvent.spex_team || "",
                  tele_marketing_team: pastEvent.tele_marketing_team || "",
                  market_research_team: pastEvent.market_research_team || "",
                  content_check: pastEvent.content_check || "",
                  marketing_check: pastEvent.marketing_check || "",
                  sales_check: pastEvent.sales_check || "",
                  accepting_web_bookings: !!pastEvent.accepting_web_bookings,
                }
              };
            });
          }
        })
        .catch(() => {});
    }, 300);

    return () => clearTimeout(timer);
  }, [modal?.data?.master_code, modal?.data?.eventType, modal?.mode, yr]);

  const setMasterCode = (v) => {
    const upper = v.toUpperCase();
    setModal(m => ({ ...m, data: { ...m.data, master_code: upper, event_code: upper + yr } }));
  };

  const openEdit = (ev) => {
    const data = { ...ev };
    const assigned = ev.assigned_sales_users || [];

    // Pre-populate role-specific dropdowns from the M2M assigned_sales_users (most reliable)
    const roleToField = {
      speaker_sales:   "speaker_sales_team",
      spex:            "spex_team",
      telemarketing:   "tele_marketing_team",
      market_research: "market_research_team",
    };
    Object.values(roleToField).forEach(f => { data[f] = ""; });
    assigned.forEach(u => {
      const field = roleToField[u.role];
      if (field && !data[field]) data[field] = String(u.id);
    });

    // sales_check: a sales-role user who isn't the sales_executive
    const salesExecId = data.sales_executive ? parseInt(data.sales_executive) : null;
    const salesCheckUser = assigned.find(u => u.role === "sales" && u.id !== salesExecId);
    data.sales_check = salesCheckUser ? String(salesCheckUser.id) : resolveNameToId(data.sales_check, allUsers);

    // content_check / marketing_check — no specific role, fall back to stored value
    ["content_check", "marketing_check"].forEach(field => {
      data[field] = resolveNameToId(data[field], allUsers);
    });

    setModal({ mode: "edit", data });
  };

  const closeModal = () => setModal(null);

  const save = async () => {
    try {
      const payload = { ...modal.data };
      delete payload.eventType;  // UI-only, not a model field

      // Build assigned_user_ids from all team dropdowns + sales_executive
      const assignedIds = [];
      if (payload.sales_executive) assignedIds.push(parseInt(payload.sales_executive));
      TEAM_FIELDS.forEach(field => {
        const id = parseInt(payload[field]);
        if (!isNaN(id)) {
          assignedIds.push(id);
          const user = allUsers.find(u => u.id === id);
          if (user) payload[field] = user.full_name;
        }
      });
      payload.assigned_user_ids = assignedIds;

      if (modal.mode === "create") await eventsApi.create(payload);
      else await eventsApi.update(modal.data.id, payload);
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
            <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "4px 8px" }}>
                <select
                  style={colFilterSelect}
                  value={colFilters.event_code}
                  onChange={(e) => handleColFilter("event_code", e.target.value)}
                >
                  <option value="">All</option>
                  {filterOptions.codes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </td>
              <td style={{ padding: "4px 8px" }}>
                <select
                  style={colFilterSelect}
                  value={colFilters.name}
                  onChange={(e) => handleColFilter("name", e.target.value)}
                >
                  <option value="">All</option>
                  {filterOptions.names.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </td>
              <td style={{ padding: "4px 8px" }}>
                <select
                  style={colFilterSelect}
                  value={colFilters.official_name}
                  onChange={(e) => handleColFilter("official_name", e.target.value)}
                >
                  <option value="">All</option>
                  {filterOptions.officialNames.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </td>
              <td style={{ padding: "4px 8px" }}>
                <select
                  style={colFilterSelect}
                  value={colFilters.city}
                  onChange={(e) => handleColFilter("city", e.target.value)}
                >
                  <option value="">All</option>
                  {filterOptions.cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </td>
              <td style={{ padding: "4px 8px" }}>
                <select
                  style={colFilterSelect}
                  value={colFilters.year}
                  onChange={(e) => handleColFilter("year", e.target.value)}
                >
                  <option value="">All</option>
                  {filterOptions.years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </td>
              <td style={{ padding: "4px 8px" }}>
                <select
                  style={colFilterSelect}
                  value={colFilters.accepting_web_bookings}
                  onChange={(e) => handleColFilter("accepting_web_bookings", e.target.value)}
                >
                  <option value="">All</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </td>
              <td style={{ padding: "4px 8px" }}>
                <select
                  style={colFilterSelect}
                  value={colFilters.status}
                  onChange={(e) => handleColFilter("status", e.target.value)}
                >
                  <option value="">All</option>
                  {EVENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </td>
              <td style={{ padding: "4px 8px" }}>
                <select
                  style={colFilterSelect}
                  value={colFilters.sales_executive}
                  onChange={(e) => handleColFilter("sales_executive", e.target.value)}
                >
                  <option value="">All</option>
                  {salesUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name || u.username}
                    </option>
                  ))}
                </select>
              </td>
              <td></td>
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

            {/* ── Event type selector (create only) ───────────────────── */}
            {modal.mode === "create" && (
              <div style={{ display: "flex", gap: 8 }}>
                {["new", "old"].map(type => (
                  <button key={type} onClick={() => setField("eventType", type)} style={{
                    flex: 1, padding: "9px 0", borderRadius: 6, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                    border: modal.data.eventType === type ? "2px solid #405189" : "2px solid var(--border)",
                    background: modal.data.eventType === type ? "#405189" : "var(--surface)",
                    color: modal.data.eventType === type ? "#fff" : "var(--text)",
                  }}>
                    {type === "new" ? "New Event" : "Previous Edition"}
                  </button>
                ))}
              </div>
            )}

            {/* ── Code fields — vary by create mode ───────────────────── */}
            {modal.mode === "create" && modal.data.eventType === "old" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="Base Event Code" required>
                  <Input
                    value={modal.data.master_code}
                    onChange={setMasterCode}
                    placeholder="SAFU - JS"
                  />
                </FormField>
                <FormField label={`Event Code (auto · ${yr})`}>
                  <Input
                    value={modal.data.event_code}
                    readOnly
                    style={{ background: "var(--surface-alt)", color: "var(--text-faint)", cursor: "default" }}
                  />
                </FormField>
              </div>
            ) : modal.mode === "create" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="Event Code" required>
                  <Input value={modal.data.event_code} onChange={(v) => setField("event_code", v.toUpperCase())} placeholder="GFS-2027" />
                </FormField>
                <FormField label="Master Code">
                  <Input value={modal.data.master_code} onChange={(v) => setField("master_code", v.toUpperCase())} placeholder="GFS" />
                </FormField>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <FormField label="Event Code" required>
                  <Input value={modal.data.event_code} onChange={(v) => setField("event_code", v.toUpperCase())} placeholder="GFS-2027" />
                </FormField>
                <FormField label="Master Code">
                  <Input value={modal.data.master_code || ""} onChange={(v) => setField("master_code", v.toUpperCase())} placeholder="GFS" />
                </FormField>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Event name" required>
                <Input value={modal.data.name} onChange={(v) => setField("name", v)} placeholder="Global Finance Summit 2027" />
              </FormField>
              <FormField label="Official Name">
                <Input value={modal.data.official_name || ""} onChange={(v) => setField("official_name", v)} placeholder="Official Name" />
              </FormField>
            </div>

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
                  options={speakerSalesUsers.map(u => ({ label: u.full_name, value: String(u.id) }))}
                  placeholder="— Unassigned —"
                />
              </FormField>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="SpEx Team">
                <Select
                  value={modal.data.spex_team || ""}
                  onChange={(v) => setField("spex_team", v)}
                  options={spexUsers.map(u => ({ label: u.full_name, value: String(u.id) }))}
                  placeholder="— Unassigned —"
                />
              </FormField>
              <FormField label="Tele Marketing Team">
                <Select
                  value={modal.data.tele_marketing_team || ""}
                  onChange={(v) => setField("tele_marketing_team", v)}
                  options={telemarketUsers.map(u => ({ label: u.full_name, value: String(u.id) }))}
                  placeholder="— Unassigned —"
                />
              </FormField>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Market Research Team">
                <Select
                  value={modal.data.market_research_team || ""}
                  onChange={(v) => setField("market_research_team", v)}
                  options={marketResUsers.map(u => ({ label: u.full_name, value: String(u.id) }))}
                  placeholder="— Unassigned —"
                />
              </FormField>
              <FormField label="Content Check">
                <Select
                  value={modal.data.content_check || ""}
                  onChange={(v) => setField("content_check", v)}
                  options={allUsers.map(u => ({ label: u.full_name, value: String(u.id) }))}
                  placeholder="— Unassigned —"
                />
              </FormField>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FormField label="Marketing Check">
                <Select
                  value={modal.data.marketing_check || ""}
                  onChange={(v) => setField("marketing_check", v)}
                  options={allUsers.map(u => ({ label: u.full_name, value: String(u.id) }))}
                  placeholder="— Unassigned —"
                />
              </FormField>
              <FormField label="Sales Check">
                <Select
                  value={modal.data.sales_check || ""}
                  onChange={(v) => setField("sales_check", v)}
                  options={salesUsers.map(u => ({ label: u.full_name, value: String(u.id) }))}
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

const colFilterSelect = {
  width: "100%",
  height: 28,
  padding: "0 4px",
  fontSize: 11,
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "var(--surface)",
  color: "var(--text)",
  fontFamily: "inherit",
  outline: "none",
  transition: "border-color 0.1s",
};
