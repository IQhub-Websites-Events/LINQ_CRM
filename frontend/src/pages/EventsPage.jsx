import { useState, useEffect, useRef } from "react";
import { eventsApi, usersApi } from "../api";
import { EventDetailDrawer } from "../components/events/EventDetailDrawer";
import { EventSmartImportModal } from "../components/events/EventSmartImportModal";
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

// Ensures a URL always has a protocol so the browser treats it as absolute.
// e.g. "www.example.com" → "https://www.example.com"
function toAbsoluteUrl(url) {
  if (!url) return "";
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;  // already has protocol
  return "https://" + trimmed;
}

export function EventsPage() {
  const toast = useToast();
  const { isAdmin, user } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [modal, setModal] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
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
    team_leader: "",
  });

  // filterKey is incremented on every filter change to guarantee the fetch
  // useEffect re-runs even if page is already 1 (React won't re-run on same state value)
  const [filterKey, setFilterKey] = useState(0);

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
    setFilterKey(k => k + 1);
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
    }).catch(() => { });
  }, []);

  // ── Infinite scroll state ────────────────────────────────────────────────
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
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
    }).catch(() => {
      if (!cancelled) setHasMore(false);
    }).finally(() => {
      if (!cancelled) { setLoading(false); setLoadingMore(false); }
    });

    return () => { cancelled = true; };
    // filterKey ensures effect re-runs on filter change even if page stays 1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, status, sort.key, sort.dir, colFilters, filterKey]);

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
  const handleSort = (key) => { sortToggle(key); setPage(1); setItems([]); };

  // After create/update/delete — reload from scratch
  const refetch = () => { setPage(1); setItems([]); };

  // Fetch all users for dropdown — sales exec (by ID) and team name fields (by full_name)
  useEffect(() => {
    usersApi.list({ page_size: 500 }).then(r => setAllUsers(r?.results || [])).catch(() => { });
  }, []);

  const salesUsers = allUsers.filter(u => u.role === "sales");
  const speakerSalesUsers = allUsers.filter(u => u.role === "speaker_sales");
  const spexUsers = allUsers.filter(u => u.role === "spex");
  const telemarketUsers = allUsers.filter(u => u.role === "telemarketing");
  const marketResUsers = allUsers.filter(u => u.role === "market_research");

  const TEAM_FIELDS = [
    "speaker_sales_team", "spex_team", "telemarketing_team",
    "market_research_senior", "market_research_junior", "event_management_team",
    "sales_check", "team_leader"
  ];

  const openCreate = () => setModal({
    mode: "create", data: {
      event_code: "", event_date: "", end_date: "", location: "", website: "", web_bookings: false,
      nearest_related_event: "", event_type: "", website_live_date: "", sales_check: "", vr1_sent_status: "",
      sales_team: "", team_leader: "", speaker_sales_team: "", telemarketing_team: "", spex_team: "",
      market_research_senior: "", market_research_junior: "", event_management_team: "", official_event_name: "",
      email_marketing_name: "", branding_name: "", annualisation: "", date_format: "", related_event_1: "",
      related_event_2: "", related_event_3: "", upcoming_event_1: "", upcoming_event_2: "", upcoming_event_3: "",
      status: "Draft", sales_executive: null
    }
  });

  const openEdit = (ev) => {
    const data = { ...ev };
    const assigned = ev.assigned_sales_users || [];

    // Pre-populate role-specific dropdowns from the M2M assigned_sales_users (most reliable)
    const roleToField = {
      speaker_sales: "speaker_sales_team",
      spex: "spex_team",
      telemarketing: "telemarketing_team",
    };
    Object.values(roleToField).forEach(f => { data[f] = ""; });
    assigned.forEach(u => {
      const field = roleToField[u.role];
      if (field && !data[field]) data[field] = String(u.id);
    });

    // Market Research fields
    const mrUsers = assigned.filter(x => x.role === "market_research");
    data.market_research_senior = mrUsers[0] ? String(mrUsers[0].id) : resolveNameToId(ev.market_research_senior, allUsers);
    data.market_research_junior = mrUsers[1] ? String(mrUsers[1].id) : resolveNameToId(ev.market_research_junior, allUsers);

    // sales_check: a sales-role user who isn't the sales_executive
    const salesExecId = data.sales_executive ? parseInt(data.sales_executive) : null;
    const salesCheckUser = assigned.find(u => u.role === "sales" && u.id !== salesExecId);
    data.sales_check = salesCheckUser ? String(salesCheckUser.id) : resolveNameToId(ev.sales_check, allUsers);

    // Other names
    ["team_leader", "event_management_team"].forEach(field => {
      data[field] = resolveNameToId(ev[field], allUsers);
    });

    setModal({ mode: "edit", data });
  };

  const closeModal = () => setModal(null);

  const save = async () => {
    try {
      const payload = { ...modal.data };

      // Strip UI-only and read-only fields the backend serializer doesn't accept
      delete payload.eventType;
      delete payload.event_status;
      delete payload.assigned_sales_users;
      delete payload.sales_executive_name;
      delete payload.created_at;
      delete payload.updated_at;

      // Nullable date fields must be null, not "", when cleared
      if (!payload.end_date) payload.end_date = null;
      if (!payload.event_date) payload.event_date = null;

      // FK field — must be null (not "") when unassigned
      if (!payload.sales_executive) payload.sales_executive = null;

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

      const saved = modal.mode === "create"
        ? await eventsApi.create(payload)
        : await eventsApi.update(modal.data.id, payload);
      toast.success(modal.mode === "create" ? "Event created" : "Event updated");
      closeModal();
      if (modal.mode === "create") {
        setItems(prev => [saved, ...prev]);
      } else {
        setItems(prev => prev.map(item => item.id === saved.id ? saved : item));
      }
    } catch (err) {
      const data = err.response?.data;
      let msg = err.message;
      if (data && typeof data === "object") {
        const firstKey = Object.keys(data)[0];
        const firstVal = data[firstKey];
        msg = Array.isArray(firstVal) ? `${firstKey}: ${firstVal[0]}` : String(firstVal);
      } else if (typeof data === "string") {
        msg = data;
      }
      toast.error("Save failed: " + msg);
    }
  };

  const del = async (ev) => {
    if (!window.confirm(`Delete ${ev.event_code}?`)) return;
    try {
      await eventsApi.delete(ev.id);
      toast.success("Deleted");
      setItems(prev => prev.filter(item => item.id !== ev.id));
    } catch { toast.error("Delete failed"); }
  };

  const handleClearAll = async () => {
    if (!window.confirm("WARNING: This will delete ALL events from the database. This action cannot be undone. Are you sure you want to proceed?")) return;

    try {
      await eventsApi.clearAll();
      toast.success("Successfully cleared all event data.");
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to clear event data.");
    }
  };

  const setField = (k, v) => setModal((m) => ({ ...m, data: { ...m.data, [k]: v } }));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div>
          <h4 style={{ margin: 0, fontSize: 18, color: "var(--text)", textTransform: "uppercase", fontWeight: 700 }}>Events</h4>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-faint)" }}>Manage and track all company events and their capacities.</p>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", gap: 10 }}>
            {user?.username === 'HP' && (
              <button
                onClick={handleClearAll}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "7px 16px", fontSize: 12.5, fontWeight: 600,
                  background: "var(--danger-soft)", border: "1px solid var(--danger)",
                  borderRadius: 8, cursor: "pointer", color: "var(--danger)",
                  fontFamily: "inherit", transition: "all 0.15s", flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--danger)"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--danger-soft)"; e.currentTarget.style.color = "var(--danger)"; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                </svg>
                Clear All Data
              </button>
            )}
            <button
              onClick={() => setImportOpen(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 16px", fontSize: 12.5, fontWeight: 600,
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 8, cursor: "pointer", color: "var(--text-dim)",
                fontFamily: "inherit", transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-dim)"; }}
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6.5 1v8M3 6l3.5 3.5L10 6" />
                <path d="M1 11h11" />
              </svg>
              Import Events
            </button>
            <button className="btn btn-primary" onClick={openCreate}>+ New Event</button>
          </div>
        )}
      </div>


      <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        <div style={{
          padding: "20px", background: "var(--surface)", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 15, flexWrap: "wrap", flexShrink: 0
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, background: "var(--surface-alt)",
            border: "1px solid var(--border)", borderRadius: 4, padding: "8px 12px", flex: 1, maxWidth: 300
          }}>
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="var(--text-faint)" strokeWidth="2" strokeLinecap="round">
              <circle cx="5" cy="5" r="4" /><path d="M9 9l2.5 2.5" />
            </svg>
            <input value={search} onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search events..." style={{
                background: "none", border: "none", outline: "none",
                fontSize: 13, color: "var(--text)", width: "100%", fontFamily: "inherit"
              }} />
          </div>
          <select value={status} onChange={(e) => handleStatus(e.target.value)}
            style={{
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 4,
              padding: "8px 30px 8px 12px", fontSize: 13, color: "var(--text)", appearance: "none", cursor: "pointer", fontFamily: "inherit", outline: "none"
            }}>
            <option value="">All Statuses</option>
            {EVENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>


        <div style={{ flex: 1, overflowX: "auto", overflowY: "auto", minHeight: 0 }}>
          <table style={{ width: "max-content", minWidth: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr style={{ background: "var(--surface-alt)" }}>
                {/* Fixed first col — always visible */}
                <SortableTh sortKey="event_code" sort={sort} onSort={handleSort} style={{ minWidth: 110, position: "sticky", left: 0, zIndex: 11, background: "var(--surface-alt)" }}>Code</SortableTh>
                {/* 31 field columns */}
                <SortableTh sortKey="name" sort={sort} onSort={handleSort} style={{ minWidth: 220 }}>Official Event Name</SortableTh>
                <SortableTh sortKey="event_date" sort={sort} onSort={handleSort} style={{ minWidth: 110 }}>Start Date</SortableTh>
                <SortableTh noSort style={{ minWidth: 110 }}>End Date</SortableTh>
                <SortableTh sortKey="city" sort={sort} onSort={handleSort} style={{ minWidth: 150 }}>Location</SortableTh>
                <SortableTh noSort style={{ minWidth: 130 }}>Website</SortableTh>
                <SortableTh noSort style={{ minWidth: 110 }}>Web Bookings</SortableTh>
                <SortableTh noSort style={{ minWidth: 150 }}>Nearest Related Event</SortableTh>
                <SortableTh noSort style={{ minWidth: 120 }}>Event Type</SortableTh>
                <SortableTh noSort style={{ minWidth: 120 }}>Website Live Date</SortableTh>
                <SortableTh noSort style={{ minWidth: 140 }}>Sales Check</SortableTh>
                <SortableTh noSort style={{ minWidth: 120 }}>VR1 Sent Status</SortableTh>
                <SortableTh noSort style={{ minWidth: 140 }}>Sales Team</SortableTh>
                <SortableTh noSort style={{ minWidth: 150 }}>Sales Team Leader</SortableTh>
                <SortableTh noSort style={{ minWidth: 160 }}>Speaker Sales Team</SortableTh>
                <SortableTh noSort style={{ minWidth: 160 }}>Telemarketing Team</SortableTh>
                <SortableTh noSort style={{ minWidth: 120 }}>SpEx Team</SortableTh>
                <SortableTh noSort style={{ minWidth: 170 }}>Market Research Sr.</SortableTh>
                <SortableTh noSort style={{ minWidth: 170 }}>Market Research Jr.</SortableTh>
                <SortableTh noSort style={{ minWidth: 170 }}>Event Management</SortableTh>
                <SortableTh noSort style={{ minWidth: 220 }}>Email Marketing Name</SortableTh>
                <SortableTh noSort style={{ minWidth: 180 }}>Branding Name</SortableTh>
                <SortableTh noSort style={{ minWidth: 120 }}>Annualisation</SortableTh>
                <SortableTh noSort style={{ minWidth: 120 }}>Date Format</SortableTh>
                <SortableTh noSort style={{ minWidth: 130 }}>Related Event 1</SortableTh>
                <SortableTh noSort style={{ minWidth: 130 }}>Related Event 2</SortableTh>
                <SortableTh noSort style={{ minWidth: 130 }}>Related Event 3</SortableTh>
                <SortableTh noSort style={{ minWidth: 140 }}>Upcoming Event 1</SortableTh>
                <SortableTh noSort style={{ minWidth: 140 }}>Upcoming Event 2</SortableTh>
                <SortableTh noSort style={{ minWidth: 140 }}>Upcoming Event 3</SortableTh>
                <SortableTh noSort style={{ minWidth: 110 }}>Status</SortableTh>
                {/* Actions */}
                <SortableTh noSort style={{ minWidth: 80 }}></SortableTh>
              </tr>
              {/* Filter row */}
              <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "4px 8px", position: "sticky", left: 0, zIndex: 9, background: "var(--surface)" }}>
                  <select style={colFilterSelect} value={colFilters.event_code} onChange={(e) => handleColFilter("event_code", e.target.value)}>
                    <option value="">All</option>
                    {filterOptions.codes.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td style={{ padding: "4px 8px" }}>
                  <select style={colFilterSelect} value={colFilters.name} onChange={(e) => handleColFilter("name", e.target.value)}>
                    <option value="">All</option>
                    {filterOptions.names.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </td>
                {/* Start Date — year filter */}
                <td style={{ padding: "4px 8px" }}>
                  <select style={colFilterSelect} value={colFilters.year} onChange={(e) => handleColFilter("year", e.target.value)}>
                    <option value="">All</option>
                    {filterOptions.years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </td>
                {/* End Date — no filter */}
                <td style={{ padding: "4px 8px" }} />
                {/* Location */}
                <td style={{ padding: "4px 8px" }}>
                  <select style={colFilterSelect} value={colFilters.city} onChange={(e) => handleColFilter("city", e.target.value)}>
                    <option value="">All</option>
                    {filterOptions.cities.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                {/* Website — no filter */}
                <td style={{ padding: "4px 8px" }} />
                {/* Web Bookings */}
                <td style={{ padding: "4px 8px" }}>
                  <select style={colFilterSelect} value={colFilters.accepting_web_bookings} onChange={(e) => handleColFilter("accepting_web_bookings", e.target.value)}>
                    <option value="">All</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </td>
                {/* Nearest Related, Event Type, Website Live Date, Sales Check, VR1, Sales Team — no filter cells */}
                <td /><td /><td /><td /><td /><td />
                {/* Sales Team Leader filter */}
                <td style={{ padding: "4px 8px" }}>
                  <select
                    id="filter-team-leader"
                    style={colFilterSelect}
                    value={colFilters.team_leader || ""}
                    onChange={(e) => handleColFilter("team_leader", e.target.value)}
                  >
                    <option value="">All</option>
                    {allUsers.filter(u => u.team_name === "Sales Team" && u.is_team_lead).map(u => (
                      <option key={u.id} value={u.full_name}>{u.full_name || u.username}</option>
                    ))}
                  </select>
                </td>
                {/* Speaker Sales, Telemarketing, SpEx, MR Sr, MR Jr, Event Mgmt, Email Mktg, Branding, Annualisation, Date Format, Related 1-3, Upcoming 1-3 — no filters */}
                <td /><td /><td /><td /><td /><td /><td /><td /><td /><td /><td /><td /><td /><td /><td />
                {/* Status filter */}
                <td style={{ padding: "4px 8px" }}>
                  <select style={colFilterSelect} value={colFilters.status} onChange={(e) => handleColFilter("status", e.target.value)}>
                    <option value="">All</option>
                    {EVENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td />
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan={33} style={{ padding: "40px", textAlign: "center", color: "#94a3b8" }}>Loading…</td></tr>
              ) : items.length === 0 ? (
                <EmptyState title="No events found" />
              ) : items?.map((ev) => (
                <tr key={ev.id}
                  onClick={() => setSelectedEventId(ev.id)}
                  style={{ borderBottom: "1px solid var(--vz-card-border-color)", cursor: "pointer", transition: "background .2s ease" }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-alt)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = ""}
                >
                  {/* 1. Event Code — sticky */}
                  <Td style={{ position: "sticky", left: 0, background: "inherit", zIndex: 2 }}>
                    <span className="badge badge-soft-primary" style={{ fontSize: 11, fontWeight: 700 }}>{ev.event_code}</span>
                  </Td>
                  {/* 2. Official Event Name */}
                  <Td><span style={{ fontWeight: 600, fontSize: 13 }}>{ev.official_event_name || ev.name || "—"}</span></Td>
                  {/* 3. Start Date */}
                  <Td mono>{fmt.date(ev.event_date) || "—"}</Td>
                  {/* 4. End Date */}
                  <Td mono>{fmt.date(ev.end_date) || "—"}</Td>
                  {/* 5. Location */}
                  <Td muted>{ev.location || ev.city || "—"}</Td>
                  {/* 6. Website */}
                  <Td>
                    {ev.website
                      ? <a
                          href={toAbsoluteUrl(ev.website)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: "var(--accent)", fontSize: 11, textDecoration: "underline", whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", display: "block" }}
                        >{ev.website}</a>
                      : <span style={{ color: "var(--text-faint)" }}>—</span>
                    }
                  </Td>
                  {/* 7. Web Bookings */}
                  <Td><span className={`badge badge-soft-${ev.web_bookings || ev.accepting_web_bookings ? 'success' : 'secondary'}`}>{ev.web_bookings || ev.accepting_web_bookings ? 'YES' : 'NO'}</span></Td>
                  {/* 8. Nearest Related Event */}
                  <Td muted>{ev.nearest_related_event || "—"}</Td>
                  {/* 9. Event Type */}
                  <Td muted>{ev.event_type || "—"}</Td>
                  {/* 10. Website Live Date */}
                  <Td mono>{fmt.date(ev.website_live_date) || "—"}</Td>
                  {/* 11. Sales Check */}
                  <Td muted>{ev.sales_check || "—"}</Td>
                  {/* 12. VR1 Sent Status */}
                  <Td muted>{ev.vr1_sent_status || "—"}</Td>
                  {/* 13. Sales Team */}
                  <Td muted>{ev.sales_team || "—"}</Td>
                  {/* 14. Sales Team Leader */}
                  <Td>
                    {ev.team_leader
                      ? <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 20, background: "rgba(64,81,137,0.1)", color: "var(--accent)", whiteSpace: "nowrap" }}>{ev.team_leader}</span>
                      : <span style={{ color: "var(--text-faint)" }}>—</span>
                    }
                  </Td>
                  {/* 15. Speaker Sales Team */}
                  <Td muted>{ev.speaker_sales_team || "—"}</Td>
                  {/* 16. Telemarketing Team */}
                  <Td muted>{ev.telemarketing_team || "—"}</Td>
                  {/* 17. SpEx Team */}
                  <Td muted>{ev.spex_team || "—"}</Td>
                  {/* 18. Market Research Sr. */}
                  <Td muted>{ev.market_research_senior || "—"}</Td>
                  {/* 19. Market Research Jr. */}
                  <Td muted>{ev.market_research_junior || "—"}</Td>
                  {/* 20. Event Management Team */}
                  <Td muted>{ev.event_management_team || "—"}</Td>
                  {/* 21. Email Marketing Name */}
                  <Td muted>{ev.email_marketing_name || "—"}</Td>
                  {/* 22. Branding Name */}
                  <Td muted>{ev.branding_name || "—"}</Td>
                  {/* 23. Annualisation */}
                  <Td muted>{ev.annualisation || "—"}</Td>
                  {/* 24. Date Format */}
                  <Td muted>{ev.date_format || "—"}</Td>
                  {/* 25. Related Event 1 */}
                  <Td muted>{ev.related_event_1 || "—"}</Td>
                  {/* 26. Related Event 2 */}
                  <Td muted>{ev.related_event_2 || "—"}</Td>
                  {/* 27. Related Event 3 */}
                  <Td muted>{ev.related_event_3 || "—"}</Td>
                  {/* 28. Upcoming Event 1 */}
                  <Td muted>{ev.upcoming_event_1 || "—"}</Td>
                  {/* 29. Upcoming Event 2 */}
                  <Td muted>{ev.upcoming_event_2 || "—"}</Td>
                  {/* 30. Upcoming Event 3 */}
                  <Td muted>{ev.upcoming_event_3 || "—"}</Td>
                  {/* 31. Status */}
                  <Td><EventStatusBadge status={ev.event_status || ev.status} /></Td>
                  {/* Actions */}
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
          {!loading && hasMore && items.length > 0 && (
            <div ref={sentinelRef} style={{ height: 1 }} />
          )}
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

            {/* 1. Event Code */}
            <FormField label="Event Code" required>
              <Input value={modal.data.event_code} onChange={(v) => setField("event_code", v.toUpperCase())} placeholder="GFS-2027" />
            </FormField>

            {/* 2. Event Start Date */}
            <FormField label="Event Start Date" required>
              <Input type="date" value={modal.data.event_date || ""} onChange={(v) => setField("event_date", v)} />
            </FormField>

            {/* 3. Event End Date */}
            <FormField label="Event End Date">
              <Input type="date" value={modal.data.end_date || ""} onChange={(v) => setField("end_date", v)} />
            </FormField>

            {/* 4. Location */}
            <FormField label="Location">
              <Input value={modal.data.location || ""} onChange={(v) => setField("location", v)} placeholder="London, United Kingdom" />
            </FormField>

            {/* 5. Website */}
            <FormField label="Website">
              <Input value={modal.data.website || ""} onChange={(v) => setField("website", v)} placeholder="https://example.com" />
            </FormField>

            {/* 6. Web Bookings */}
            <FormField label="Web Bookings">
              <Select
                value={String(modal.data.web_bookings)}
                onChange={(v) => setField("web_bookings", v === 'true')}
                options={[{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }]}
              />
            </FormField>

            {/* 7. Nearest Related Event */}
            <FormField label="Nearest Related Event">
              <Input value={modal.data.nearest_related_event || ""} onChange={(v) => setField("nearest_related_event", v)} placeholder="GFS-2026" />
            </FormField>

            {/* 8. Event Type */}
            <FormField label="Event Type">
              <Input value={modal.data.event_type || ""} onChange={(v) => setField("event_type", v)} placeholder="Conference" />
            </FormField>

            {/* 9. Website Live Date */}
            <FormField label="Website Live Date">
              <Input type="date" value={modal.data.website_live_date || ""} onChange={(v) => setField("website_live_date", v)} />
            </FormField>

            {/* 10. Sales Check */}
            <FormField label="Sales Check">
              <Select
                value={modal.data.sales_check || ""}
                onChange={(v) => setField("sales_check", v)}
                options={salesUsers.map(u => ({ label: u.full_name, value: String(u.id) }))}
                placeholder="— Unassigned —"
              />
            </FormField>

            {/* 11. VR1 Sent Status */}
            <FormField label="VR1 Sent Status">
              <Input value={modal.data.vr1_sent_status || ""} onChange={(v) => setField("vr1_sent_status", v)} placeholder="Sent" />
            </FormField>

            {/* 12. Sales Team */}
            <FormField label="Sales Team">
              <Input value={modal.data.sales_team || ""} onChange={(v) => setField("sales_team", v)} placeholder="Sales Team A" />
            </FormField>

            {/* 13. Sales Team Leader */}
            <FormField label="Sales Team Leader">
              <Select
                value={modal.data.team_leader || ""}
                onChange={(v) => setField("team_leader", v)}
                options={allUsers.filter(u => u.team_name === "Sales Team" && u.is_team_lead).map(u => ({ label: u.full_name, value: String(u.id) }))}
                placeholder="— Unassigned —"
              />
            </FormField>

            {/* 14. Speaker Sales Team */}
            <FormField label="Speaker Sales Team">
              <Select
                value={modal.data.speaker_sales_team || ""}
                onChange={(v) => setField("speaker_sales_team", v)}
                options={speakerSalesUsers.map(u => ({ label: u.full_name, value: String(u.id) }))}
                placeholder="— Unassigned —"
              />
            </FormField>

            {/* 15. Telemarketing Team */}
            <FormField label="Telemarketing Team">
              <Select
                value={modal.data.telemarketing_team || ""}
                onChange={(v) => setField("telemarketing_team", v)}
                options={telemarketUsers.map(u => ({ label: u.full_name, value: String(u.id) }))}
                placeholder="— Unassigned —"
              />
            </FormField>

            {/* 16. SpEx Team */}
            <FormField label="SpEx Team">
              <Select
                value={modal.data.spex_team || ""}
                onChange={(v) => setField("spex_team", v)}
                options={spexUsers.map(u => ({ label: u.full_name, value: String(u.id) }))}
                placeholder="— Unassigned —"
              />
            </FormField>

            {/* 17. Market Research (Senior) */}
            <FormField label="Market Research (Senior)">
              <Select
                value={modal.data.market_research_senior || ""}
                onChange={(v) => setField("market_research_senior", v)}
                options={marketResUsers.map(u => ({ label: u.full_name, value: String(u.id) }))}
                placeholder="— Unassigned —"
              />
            </FormField>

            {/* 18. Market Research (Junior) */}
            <FormField label="Market Research (Junior)">
              <Select
                value={modal.data.market_research_junior || ""}
                onChange={(v) => setField("market_research_junior", v)}
                options={marketResUsers.map(u => ({ label: u.full_name, value: String(u.id) }))}
                placeholder="— Unassigned —"
              />
            </FormField>

            {/* 19. Event Management Team */}
            <FormField label="Event Management Team">
              <Select
                value={modal.data.event_management_team || ""}
                onChange={(v) => setField("event_management_team", v)}
                options={allUsers.map(u => ({ label: u.full_name, value: String(u.id) }))}
                placeholder="— Unassigned —"
              />
            </FormField>

            {/* 20. Official Event Name */}
            <FormField label="Official Event Name" required>
              <Input value={modal.data.official_event_name || modal.data.name || ""} onChange={(v) => { setField("official_event_name", v); setField("name", v); }} placeholder="Global Finance Summit 2027" />
            </FormField>

            {/* 21. Event Name for Email Marketing */}
            <FormField label="Event Name for Email Marketing">
              <Input value={modal.data.email_marketing_name || ""} onChange={(v) => setField("email_marketing_name", v)} placeholder="Global Finance Summit" />
            </FormField>

            {/* 22. Event Name for Branding */}
            <FormField label="Event Name for Branding">
              <Input value={modal.data.branding_name || ""} onChange={(v) => setField("branding_name", v)} placeholder="GFS 27" />
            </FormField>

            {/* 23. Annualisation */}
            <FormField label="Annualisation">
              <Input value={modal.data.annualisation || ""} onChange={(v) => setField("annualisation", v)} placeholder="Annual" />
            </FormField>

            {/* 24. Date Format */}
            <FormField label="Date Format">
              <Input value={modal.data.date_format || ""} onChange={(v) => setField("date_format", v)} placeholder="DD-MM-YYYY" />
            </FormField>

            {/* 25. Related Event 1 */}
            <FormField label="Related Event 1">
              <Input value={modal.data.related_event_1 || ""} onChange={(v) => setField("related_event_1", v)} placeholder="Related Event A" />
            </FormField>

            {/* 26. Related Event 2 */}
            <FormField label="Related Event 2">
              <Input value={modal.data.related_event_2 || ""} onChange={(v) => setField("related_event_2", v)} placeholder="Related Event B" />
            </FormField>

            {/* 27. Related Event 3 */}
            <FormField label="Related Event 3">
              <Input value={modal.data.related_event_3 || ""} onChange={(v) => setField("related_event_3", v)} placeholder="Related Event C" />
            </FormField>

            {/* 28. Upcoming Event 1 */}
            <FormField label="Upcoming Event 1">
              <Input value={modal.data.upcoming_event_1 || ""} onChange={(v) => setField("upcoming_event_1", v)} placeholder="Upcoming Event A" />
            </FormField>

            {/* 29. Upcoming Event 2 */}
            <FormField label="Upcoming Event 2">
              <Input value={modal.data.upcoming_event_2 || ""} onChange={(v) => setField("upcoming_event_2", v)} placeholder="Upcoming Event B" />
            </FormField>

            {/* 30. Upcoming Event 3 */}
            <FormField label="Upcoming Event 3">
              <Input value={modal.data.upcoming_event_3 || ""} onChange={(v) => setField("upcoming_event_3", v)} placeholder="Upcoming Event C" />
            </FormField>

            {/* 31. Event Status */}
            <FormField label="Event Status">
              <Select
                value={modal.data.status || "Draft"}
                onChange={(v) => setField("status", v)}
                options={[
                  { label: "Draft", value: "Draft" },
                  { label: "Upcoming", value: "Upcoming" },
                  { label: "Live", value: "Live" },
                  { label: "Completed", value: "Completed" },
                  { label: "Cancelled", value: "Cancelled" },
                  { label: "Postponed", value: "Postponed" }
                ]}
              />
            </FormField>

          </div>
        )}
      </Modal>

      <EventSmartImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={refetch}
      />
    </div>
  );
}

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
