import { useState, useEffect, useCallback, useRef } from "react";
import { ticketCentralApi } from "../../api";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { TicketStatusBadge, TicketPriorityBadge } from "./TicketStatusBadge";
import { TicketDetailModal } from "./TicketDetailModal";
import { MultiSelectFilter } from "../ui/MultiSelectFilter";
import { BulkUpdateModal } from "../ui/BulkUpdateModal";
import { FilterBuilderModal } from "../ui/FilterBuilderModal";
import { FilterChips } from "../ui/FilterChips";
import { useFilterSpec } from "../../hooks/useFilterSpec";

const PAGE_SIZE = 50;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const COLUMNS = [
  // ── Identifier (primary) ──────────────────────────────────────────
  { key: "status",               label: "Status",               minWidth: 130, filterType: "multiselect", section: "Identifier", defaultVisible: true,
    options: [
      { value: "draft",        label: "Draft" },
      { value: "mr_submitted", label: "MR Submitted" },
      { value: "completed",    label: "Completed" },
      { value: "returned",     label: "Returned" },
    ] },
  { key: "ticket_number",        label: "Ticket #",             minWidth: 160, filterType: "text",   section: "Identifier",  defaultVisible: true  },
  // ── MR Section ────────────────────────────────────────────────────
  { key: "purpose",              label: "Purpose",              minWidth: 100, filterType: "text",   section: "MR Section",  defaultVisible: true  },
  { key: "type_of_ticket",       label: "Type of Ticket",       minWidth: 140, filterType: "text",   section: "MR Section",  defaultVisible: true  },
  { key: "competitor_event_name",label: "Competitor Event",     minWidth: 180, filterType: "text",   section: "MR Section",  defaultVisible: true  },
  { key: "organizer",            label: "Organizer",            minWidth: 140, filterType: "text",   section: "MR Section",  defaultVisible: true  },
  { key: "event_month_year",     label: "Event Month/Year",     minWidth: 130, filterType: "date",   section: "MR Section",  defaultVisible: true  },
  { key: "event_location",       label: "Event Location",       minWidth: 160, filterType: "text",   section: "MR Section",  defaultVisible: true  },
  { key: "relationship",         label: "Relationship",         minWidth: 120, filterType: "text",   section: "MR Section",  defaultVisible: true  },
  { key: "priority",             label: "Priority",             minWidth: 110, filterType: "text",   section: "MR Section",  defaultVisible: true  },
  { key: "estimate",             label: "Estimate",             minWidth: 100, filterType: "number", section: "MR Section",  defaultVisible: true  },
  { key: "assigned_mr",          label: "Assigned MR",          minWidth: 160, filterType: "text",   section: "MR Section",  defaultVisible: true  },
  { key: "link_url",             label: "Link URL",             minWidth: 180, filterType: "text",   section: "MR Section",  defaultVisible: true  },
  { key: "linkedin_keywords",    label: "LinkedIn Keywords",    minWidth: 160, filterType: "text",   section: "MR Section",  defaultVisible: true  },
  { key: "duplicate_tickets",    label: "Duplicate Tickets",    minWidth: 140, filterType: "text",   section: "MR Section",  defaultVisible: true  },
  { key: "mr_comments",          label: "MR Comments",          minWidth: 180, filterType: "text",   section: "MR Section",  defaultVisible: true  },
  // ── DMD Section ───────────────────────────────────────────────────
  { key: "assign_name",          label: "Assign Name",          minWidth: 150, filterType: "text",   section: "DMD Section", defaultVisible: true  },
  { key: "assign_date",          label: "Assign Date",          minWidth: 120, filterType: "date",   section: "DMD Section", defaultVisible: true  },
  { key: "ticket_type",          label: "Ticket Type",          minWidth: 120, filterType: "text",   section: "DMD Section", defaultVisible: true  },
  { key: "actual_number",        label: "Actual Number",        minWidth: 120, filterType: "number", section: "DMD Section", defaultVisible: true  },
  { key: "new_contacts_created", label: "New Contacts",         minWidth: 130, filterType: "number", section: "DMD Section", defaultVisible: true  },
  { key: "mined_count",          label: "Mined Count",          minWidth: 120, filterType: "number", section: "DMD Section", defaultVisible: true  },
  { key: "complete_date",        label: "Complete Date",        minWidth: 130, filterType: "date",   section: "DMD Section", defaultVisible: true  },
  { key: "hubspot_entry_date",   label: "HubSpot Entry Date",   minWidth: 150, filterType: "date",   section: "DMD Section", defaultVisible: true  },
  { key: "dm_comments",          label: "DM Comments",          minWidth: 180, filterType: "text",   section: "DMD Section", defaultVisible: true  },
  { key: "assign_name_lx2",      label: "Assign Name (LX-2)",   minWidth: 150, filterType: "text",   section: "DMD Section", defaultVisible: true  },
  { key: "actual_count_lx2",     label: "Actual Count (LX-2)",  minWidth: 140, filterType: "number", section: "DMD Section", defaultVisible: true  },
  { key: "complete_date_lx2",    label: "Complete Date - LX2",  minWidth: 150, filterType: "date",   section: "DMD Section", defaultVisible: true  },
  { key: "dm_comments_lx2",      label: "DM Comments (LX-2)",   minWidth: 180, filterType: "text",   section: "DMD Section", defaultVisible: true  },
  // ── Identifier (audit) ────────────────────────────────────────────
  { key: "created_at",           label: "Created",              minWidth: 120, filterType: "date",   section: "Identifier",  defaultVisible: true  },
  { key: "updated_at",           label: "Last Updated",         minWidth: 120, filterType: "date",   section: "Identifier",  defaultVisible: true  },
  { key: "external_id",          label: "Zoho ID",              minWidth: 160, filterType: "text",   section: "Identifier",  defaultVisible: true  },
  // ── DMD Section (source) ─────────────────────────────────────────
  { key: "source_spreadsheet_id",label: "Source Sheet ID",      minWidth: 140, filterType: "text",   section: "DMD Section", defaultVisible: true  },
  { key: "source_tab",           label: "Source Tab",           minWidth: 120, filterType: "text",   section: "DMD Section", defaultVisible: true  },
  { key: "idempotency_key",      label: "Idempotency Key",      minWidth: 150, filterType: "text",   section: "DMD Section", defaultVisible: true  },
];

const SORTABLE = new Set(["created_at", "updated_at", "status", "priority"]);

// Maps single-column date/number filter keys → backend query param names
const DATE_TO_PARAM = {
  event_month_year:   "event_month_from",
  complete_date:      "complete_date_from",
  assign_date:        "assign_date_from",
  hubspot_entry_date: "hubspot_date_from",
  created_at:         "created_at_from",
  updated_at:         "updated_at_from",
  complete_date_lx2:  "complete_date_lx2_from",
};

const NUM_TO_PARAM = {
  actual_number: "actual_number_gte",
  mined_count:   "mined_count_gte",
};

function buildFilterParams(colFilters) {
  const params = {};
  for (const [key, val] of Object.entries(colFilters)) {
    if (val === "" || val == null) continue;
    // Multi-select filters hold arrays; an empty one means "no filter". Non-empty
    // arrays pass straight through and the client serialiser repeats the key.
    if (Array.isArray(val)) {
      if (val.length) params[key] = val;
      continue;
    }
    if (key in DATE_TO_PARAM)  params[DATE_TO_PARAM[key]] = val;
    else if (key in NUM_TO_PARAM) params[NUM_TO_PARAM[key]] = val;
    else params[key] = val;
  }
  return params;
}

function renderCell(ticket, col) {
  const val = ticket[col.key];

  if (col.key === "ticket_number") {
    return val
      ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500, color: "var(--accent)" }}>{val}</span>
      : <span style={{ color: "var(--text-faint)", fontStyle: "italic" }}>Pending</span>;
  }
  if (col.key === "status")   return <TicketStatusBadge status={val} />;
  if (col.key === "priority") return <TicketPriorityBadge priority={val} />;

  if (col.filterType === "date" && val) {
    try {
      const d = new Date(val);
      return `${String(d.getDate()).padStart(2, "0")}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
    } catch { return val; }
  }
  if (col.key === "link_url" && val) {
    return (
      <a href={val} target="_blank" rel="noreferrer"
        style={{ color: "var(--accent)", textDecoration: "none" }} title={val}>
        {val.length > 40 ? val.substring(0, 37) + "…" : val}
      </a>
    );
  }
  if (col.filterType === "number" && val != null && val !== "") {
    return Number(val).toLocaleString();
  }
  return val || "—";
}

function FilterCell({ col, value, onChange, disabled }) {
  if (col.filterType === "multiselect") {
    // MultiSelectFilter coerces a non-array value to [], so an unset "" is safe here.
    return (
      <MultiSelectFilter
        options={col.options || []}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    );
  }
  if (col.filterType === "select") {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} style={colFilterInput} disabled={disabled}>
        <option value="">All</option>
        {(col.options || []).map(o => {
          const v = typeof o === "object" ? o.value : o;
          const l = typeof o === "object" ? o.label : o;
          return <option key={v} value={v}>{l}</option>;
        })}
      </select>
    );
  }
  if (col.filterType === "date") {
    return <input type="date" value={value} onChange={e => onChange(e.target.value)} style={colFilterInput} />;
  }
  if (col.filterType === "number") {
    return <input type="number" placeholder="≥" value={value} onChange={e => onChange(e.target.value)} style={colFilterInput} />;
  }
  return <input type="text" placeholder={`${col.label}…`} value={value} onChange={e => onChange(e.target.value)} style={colFilterInput} />;
}

export function TicketTable({ statusFilter = "", onChanged }) {
  const toast = useToast();
  const { user, canUpdate } = useAuth();
  const isAdmin = user?.role === "admin";
  // Mass update is an edit, so gate it on the permission the backend actually
  // enforces (crm_permission maps bulk_update to can_update), not the
  // hardcoded admin role that guards the destructive delete.
  const canMassUpdate = canUpdate("ticket_central");

  const [data, setData]                 = useState([]);
  const [loading, setLoading]           = useState(true);
  const [total, setTotal]               = useState(0);
  const [page, setPage]                 = useState(1);
  const [hasMore, setHasMore]           = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [sortKey, setSortKey]           = useState("created_at");
  const [sortDir, setSortDir]           = useState("desc");
  const [detailId, setDetailId]         = useState(null);
  const [colFilters, setColFilters]     = useState({});
  const [selected, setSelected]         = useState(new Set());
  const [pickerOpen, setPickerOpen]     = useState(false);
  const [bulkOpen, setBulkOpen]         = useState(false);
  const [bulkSchema, setBulkSchema]     = useState(null);
  const pickerRef = useRef(null);

  // ── Compound filter spec (mirrors BookingsTable) ─────────────────────────
  const spec = useFilterSpec("ticket_central");
  const [filterSchema, setFilterSchema] = useState(null);
  const [filterOpen, setFilterOpen]     = useState(false);
  const loadToken = useRef(0);

  useEffect(() => {
    let cancelled = false;
    ticketCentralApi.filterSchema()
      .then((s) => {
        if (cancelled) return;
        setFilterSchema(s);
        const { dropped } = spec.sanitize(s);
        if (dropped.length > 0) {
          toast.info("Some saved filters were removed because fields changed.");
        }
      })
      .catch(() => {
        if (cancelled) return;
        spec.markSchemaFailed();
        toast.error("Filters unavailable — could not load the field list.");
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [visibleKeys, setVisibleKeys] = useState(() => {
    try {
      const saved = localStorage.getItem("tc_visible_columns_v2");
      return saved ? JSON.parse(saved) : COLUMNS.filter(c => c.defaultVisible).map(c => c.key);
    } catch {
      return COLUMNS.filter(c => c.defaultVisible).map(c => c.key);
    }
  });

  const visibleColumns = COLUMNS.filter(c => visibleKeys.includes(c.key));
  const colCount = visibleColumns.length + 1;

  // Close column picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  const toggleColumn = (key) => {
    const next = visibleKeys.includes(key)
      ? visibleKeys.filter(k => k !== key)
      : [...visibleKeys, key];
    setVisibleKeys(next);
    localStorage.setItem("tc_visible_columns_v2", JSON.stringify(next));
  };

  const load = useCallback(async (p = 1, append = false) => {
    if (!append) setSelected(new Set());
    if (p > 1) setFetchingMore(true);
    else setLoading(true);

    const token = ++loadToken.current;
    try {
      const filterParams = buildFilterParams(colFilters);
      const params = {
        page: p, page_size: PAGE_SIZE,
        ordering: sortDir === "desc" ? `-${sortKey}` : sortKey,
        ...filterParams,
      };
      if (statusFilter) params.status = statusFilter;
      if (spec.encodedParam) params.filter_spec = spec.encodedParam;

      const res = await ticketCentralApi.list(params);
      if (token !== loadToken.current) return;   // superseded — discard
      const results = res.results || [];
      const count = res.count || 0;

      setData(prev => append ? [...prev, ...results] : results);
      setTotal(count);
      setHasMore((p * PAGE_SIZE) < count);
    } catch (err) {
      if (token !== loadToken.current) return;
      const detail = err.response?.status === 400 && err.response?.data?.detail;
      toast.error(detail || "Failed to load tickets");
    } finally {
      if (token === loadToken.current) {
        setLoading(false);
        setFetchingMore(false);
      }
    }
  }, [sortKey, sortDir, statusFilter, colFilters, spec.encodedParam, toast]);

  // Gated on hydrated — see the note in BookingsTable.
  useEffect(() => {
    if (!spec.hydrated) return;
    setPage(1);
    load(1, false);
  }, [statusFilter, colFilters, sortKey, sortDir, load, spec.hydrated]);

  const loadMore = useCallback(() => {
    if (loading || fetchingMore || !hasMore) return;
    const next = page + 1;
    setPage(next);
    load(next, true);
  }, [page, loading, fetchingMore, hasMore, load]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 100) loadMore();
  };

  const handleColFilter = (key, val) => {
    setColFilters(prev => ({ ...prev, [key]: val }));
    setPage(1);
  };

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const handleSaved = useCallback(() => {
    load(1, false);
    onChanged?.();
  }, [load, onChanged]);

  // Schema is fetched lazily on first open — it never changes during a session
  // and most visits never open the modal.
  const openBulkUpdate = async () => {
    setBulkOpen(true);
    if (bulkSchema) return;
    try {
      setBulkSchema(await ticketCentralApi.bulkUpdateSchema());
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not load editable fields.");
      setBulkOpen(false);
    }
  };

  const handleBulkPreview = useCallback(
    (field, value) => ticketCentralApi.bulkUpdate([...selected], field, value, false, null),
    [selected],
  );

  const handleBulkCommit = useCallback(
    async (field, value, planHash) => {
      const result = await ticketCentralApi.bulkUpdate([...selected], field, value, true, planHash);
      setSelected(new Set());
      load(1, false);
      onChanged?.();
      return result;
    },
    [selected, load, onChanged],
  );

  const handleBulkDelete = async () => {
    const count = Math.min(selected.size, 1000);
    const confirmed = window.confirm(
      `Permanently delete ${count} ticket${count !== 1 ? "s" : ""}?\n\nThis cannot be undone.`
    );
    if (!confirmed) return;
    const ids = [...selected].slice(0, 1000);
    try {
      const result = await ticketCentralApi.bulkDelete(ids);
      toast.success(`Deleted ${result.deleted} tickets.`);
      setSelected(new Set());
      load(1, false);
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Bulk delete failed.");
    }
  };

  // An empty array is truthy, so multi-select filters must be length-checked.
  const hasAnyFilter = Object.values(colFilters)
    .some(v => (Array.isArray(v) ? v.length > 0 : !!v));
  const allSelected  = data.length > 0 && selected.size === data.length;
  const someSelected = selected.size > 0 && selected.size < data.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>

      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        gap: 10, marginBottom: 12, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--text-dim)", fontWeight: 500 }}>
            {total.toLocaleString()} Tickets
          </span>
          {hasAnyFilter && (
            <button
              onClick={() => { setColFilters({}); setPage(1); }}
              style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              Reset Column Filters
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => setFilterOpen(true)}
          disabled={!filterSchema}
          title={filterSchema ? "Build a compound filter" : "Filters unavailable"}
          style={{
            ...secondaryBtnStyle,
            display: "inline-flex", alignItems: "center", gap: 6,
            opacity: filterSchema ? 1 : 0.5,
            cursor: filterSchema ? "pointer" : "not-allowed",
            borderColor: spec.criteria.length ? "var(--accent)" : undefined,
            color: spec.criteria.length ? "var(--accent)" : undefined,
          }}
        >
          ⚙ Filters
          {spec.criteria.length > 0 && (
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              minWidth: 17, height: 17, padding: "0 5px", borderRadius: 9,
              background: "var(--accent)", color: "#fff", fontSize: 10.5, fontWeight: 700,
            }}>{spec.criteria.length}</span>
          )}
        </button>

        {/* Column picker */}
        <div ref={pickerRef} style={{ position: "relative" }}>
          <button onClick={() => setPickerOpen(p => !p)} style={secondaryBtnStyle}>
            ⊞ Columns ({visibleKeys.length})
          </button>

          {pickerOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50,
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 10, padding: 16, width: 280,
              boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
              maxHeight: 400, overflowY: "auto",
            }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Show / Hide Columns</div>

              {["Identifier", "MR Section", "DMD Section"].map(section => (
                <div key={section} style={{ marginBottom: 12 }}>
                  <div style={{
                    fontSize: 11, color: "var(--text-dim)", fontWeight: 600,
                    textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6,
                  }}>
                    {section}
                  </div>
                  {COLUMNS.filter(col => col.section === section).map(col => (
                    <label key={col.key} style={{
                      display: "flex", alignItems: "center",
                      gap: 8, padding: "3px 0", cursor: "pointer", fontSize: 13,
                    }}>
                      <input
                        type="checkbox"
                        checked={visibleKeys.includes(col.key)}
                        onChange={() => toggleColumn(col.key)}
                        style={{ accentColor: "var(--accent)" }}
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              ))}

              <button
                onClick={() => {
                  const defaults = COLUMNS.filter(c => c.defaultVisible).map(c => c.key);
                  setVisibleKeys(defaults);
                  localStorage.setItem("tc_visible_columns_v2", JSON.stringify(defaults));
                }}
                style={{ marginTop: 4, fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
              >
                Reset to default
              </button>
            </div>
          )}
        </div>
        </div>
      </div>

      <FilterChips
        criteria={spec.criteria}
        schema={filterSchema}
        onRemove={spec.removeCriterion}
        onClearAll={spec.clearAll}
      />

      {/* Table container */}
      <div style={{
        flex: 1, minHeight: 0, display: "flex", flexDirection: "column",
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 12, overflow: "hidden",
      }}>
        <div onScroll={handleScroll} style={{ flex: 1, overflowX: "auto", overflowY: "auto" }}>
          <table style={{ width: "max-content", minWidth: "100%", borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              {/* Column headers */}
              <tr style={{ background: "var(--surface-alt)" }}>
                <th style={{ width: 40, padding: "0 12px", background: "var(--surface-alt)", borderBottom: "1px solid var(--border)" }}>
                  <input
                    type="checkbox"
                    style={{ accentColor: "var(--accent)" }}
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected; }}
                    onChange={e => setSelected(e.target.checked ? new Set(data.map(t => t.id)) : new Set())}
                  />
                </th>
                {visibleColumns.map(col =>
                  SORTABLE.has(col.key)
                    ? <SortTh key={col.key} sortKey={col.key} current={sortKey} dir={sortDir} onSort={handleSort} style={{ minWidth: col.minWidth }}>{col.label}</SortTh>
                    : <Th key={col.key} style={{ minWidth: col.minWidth }}>{col.label}</Th>
                )}
              </tr>
              {/* Filter row */}
              <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "4px 12px" }} />
                {visibleColumns.map(col => (
                  <td key={col.key} style={{ padding: "4px 8px" }}>
                    <FilterCell
                      col={col}
                      value={colFilters[col.key] || ""}
                      onChange={val => handleColFilter(col.key, val)}
                      disabled={col.key === "status" && !!statusFilter}
                    />
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={colCount} style={emptyCell}>Loading…</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={colCount} style={emptyCell}>No tickets match the current filters.</td></tr>
              ) : (
                data.map(ticket => (
                  <tr
                    key={ticket.id}
                    onClick={() => setDetailId(ticket.id)}
                    style={{
                      height: 44, borderTop: "1px solid var(--border)",
                      background: selected.has(ticket.id) ? "color-mix(in srgb, var(--accent) 8%, var(--surface))" : "transparent",
                      cursor: "pointer", transition: "background 0.1s", fontSize: 13,
                    }}
                    onMouseOver={e => { if (!selected.has(ticket.id)) e.currentTarget.style.background = "var(--surface-alt)"; }}
                    onMouseOut={e => { if (!selected.has(ticket.id)) e.currentTarget.style.background = "transparent"; }}
                  >
                    <td style={{ padding: "0 12px" }} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        style={{ accentColor: "var(--accent)" }}
                        checked={selected.has(ticket.id)}
                        onChange={e => {
                          const next = new Set(selected);
                          e.target.checked ? next.add(ticket.id) : next.delete(ticket.id);
                          setSelected(next);
                        }}
                      />
                    </td>
                    {visibleColumns.map(col => (
                      <td key={col.key} style={cell}>{renderCell(ticket, col)}</td>
                    ))}
                  </tr>
                ))
              )}
              {fetchingMore && (
                <tr><td colSpan={colCount} style={{ textAlign: "center", padding: "20px 0", color: "var(--accent)", fontSize: 13, fontWeight: 500 }}>Loading more…</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer bar */}
        <div style={{
          padding: "10px 20px", borderTop: "1px solid var(--border)",
          background: "var(--surface-alt)", display: "flex",
          justifyContent: "space-between", alignItems: "center", flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500 }}>
            Showing {data.length} of {total} tickets
          </span>
          {!hasMore && total > 0 && (
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>All records loaded</span>
          )}
        </div>

        {/* Sticky bulk-action bar */}
        {selected.size > 0 && (
          <div style={{
            position: "sticky", bottom: 0, zIndex: 20,
            background: "var(--accent)", color: "#fff",
            padding: "10px 20px",
            display: "flex", alignItems: "center", gap: 14,
            borderTop: "1px solid rgba(255,255,255,0.2)",
          }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {/* "Select all" only reaches rows scrolled into memory, so say so
                  whenever more rows match than are currently loaded. */}
              {data.length < total
                ? `${selected.size.toLocaleString()} selected of ${data.length.toLocaleString()} loaded (${total.toLocaleString()} total — scroll for more)`
                : `${selected.size.toLocaleString()} selected`}
            </span>
            <button
              onClick={() => setSelected(new Set())}
              style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.5)", background: "transparent", color: "#fff", cursor: "pointer", fontSize: 13 }}
            >
              ✕ Deselect all
            </button>
            {canMassUpdate && (
              <button
                onClick={openBulkUpdate}
                style={{ padding: "4px 14px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.5)", background: "transparent", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
              >
                ✎ Update {selected.size.toLocaleString()}
              </button>
            )}
            {isAdmin && (
              <button
                onClick={handleBulkDelete}
                style={{ padding: "4px 14px", borderRadius: 6, border: "none", background: "rgba(220,53,69,0.9)", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13, marginLeft: "auto" }}
              >
                🗑 Delete {selected.size > 1000 ? `(max 1000 — ${selected.size} selected, first 1000 will be deleted)` : selected.size}
              </button>
            )}
          </div>
        )}
      </div>

      <FilterBuilderModal
        open={filterOpen && !!filterSchema}
        onClose={() => setFilterOpen(false)}
        schema={filterSchema}
        criteria={spec.criteria}
        onApply={spec.replaceAll}
      />

      <BulkUpdateModal
        open={bulkOpen && !!bulkSchema}
        onClose={() => setBulkOpen(false)}
        selectedIds={[...selected]}
        schema={bulkSchema}
        rowLabel="ticket"
        onPreview={handleBulkPreview}
        onCommit={handleBulkCommit}
      />

      {detailId && (
        <TicketDetailModal
          ticketId={detailId}
          onClose={() => setDetailId(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function Th({ children, style = {} }) {
  return (
    <th style={{
      padding: "10px 14px", fontSize: 10, fontWeight: 500, textTransform: "uppercase",
      letterSpacing: "0.05em", color: "var(--text-dim)", textAlign: "left",
      whiteSpace: "nowrap", border: "none", borderBottom: "1px solid var(--border)", ...style,
    }}>
      {children}
    </th>
  );
}

function SortTh({ sortKey, current, dir, onSort, children, style = {} }) {
  const active = current === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{
        padding: "10px 14px", fontSize: 10, fontWeight: 500, textTransform: "uppercase",
        letterSpacing: "0.05em", color: active ? "var(--accent)" : "var(--text-dim)",
        textAlign: "left", whiteSpace: "nowrap", cursor: "pointer", border: "none",
        borderBottom: "1px solid var(--border)", userSelect: "none", ...style,
      }}
    >
      {children}
      {active && <span style={{ marginLeft: 3, opacity: 0.7 }}>{dir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}

/* ─── Styles ─── */

const cell = {
  padding: "0 14px", color: "var(--text)", whiteSpace: "nowrap",
  overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220,
};

const emptyCell = {
  textAlign: "center", padding: "48px 0",
  color: "var(--text-faint)", fontSize: 13,
};

const colFilterInput = {
  width: "100%", height: 26, padding: "0 8px", fontSize: 11,
  border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface-alt)",
  color: "var(--text)", fontFamily: "inherit", outline: "none", transition: "border-color 0.1s",
};

const secondaryBtnStyle = {
  padding: "6px 12px", fontSize: 12, borderRadius: 7, fontWeight: 500,
  background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-dim)",
  cursor: "pointer", fontFamily: "inherit",
};
