import { useState, useEffect, useCallback, useRef, memo } from "react";
import { delegatesApi, invoicesApi, eventsApi } from "../../api";
import { useToast } from "../../contexts/ToastContext";
import { useAuth } from "../../contexts/AuthContext";
import { StatusBadge } from "../ui/Badge";
import { Avatar } from "../ui/Avatar";
import { Pager } from "../ui/Table";
import { fmt } from "../../utils/helpers";
import { BookingEditModal } from "./BookingEditModal";
import { AddBookingModal } from "./AddBookingModal";
import { DatePopup } from "./DatePopup";
import { MultiSelectFilter } from "../ui/MultiSelectFilter";
import { BulkUpdateModal } from "../ui/BulkUpdateModal";
import { FilterBuilderModal } from "../ui/FilterBuilderModal";
import { FilterChips } from "../ui/FilterChips";
import { useFilterSpec } from "../../hooks/useFilterSpec";
import { PAYMENT_TYPES, TICKET_TIERS, PAID_OR_FREE, PAYMENT_STATUSES, DISCOUNT_OPTIONS } from "../../utils/constants";

const PAGE_SIZE = 50;

// Column filter shape. Array-valued keys map to backend MultipleChoiceFilters and are
// sent as repeated query params ([] = no filter); string keys are single-valued.
const EMPTY_COL_FILTERS = {
  invoice_number: "",
  event_code: "",
  edition: "",
  booking_code: "",
  first_name: "",
  last_name: "",
  position: "",
  company_name: "",
  accounts_contact_email: "",
  email: "",
  phone_number: "",
  attendance: "",
  paid_or_free: [],
  ticket_tier: [],
  payment_type: [],
  request_date: "",
  invoice_date: "",
  payment_date: "",
  delegate_count: "",
  discount: "",
};

const getEditionFromCode = (code) => {
  if (!code) return "—";
  const match = code.match(/(\d{2,4})$/);
  if (match) {
    const numStr = match[1];
    return numStr.length === 2 ? `20${numStr}` : numStr;
  }
  return "—";
};

// `statusFilter` is an array of payment statuses ([] = no filter). It lives on the page
// rather than in colFilters so the strip above the table and the STATUS column dropdown
// are the same piece of state and can never disagree.
export function BookingsTable({ statusFilter = [], onStatusFilterChange, onTotalChange }) {
  const toast = useToast();
  const { user, canUpdate } = useAuth();
  const isSalesOrAdmin = user?.role === "admin" || user?.role === "sales";
  const isAdmin = user?.role === "admin";
  // Mass update is an edit, not a destructive act — gate it on the same
  // permission the backend enforces (crm_permission maps bulk_update to
  // can_update), not on the hardcoded admin role that guards bulk delete.
  const canMassUpdate = canUpdate("bookings");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [sortKey, setSortKey] = useState("_sort_request_date");
  const [sortDir, setSortDir] = useState("desc");

  const [colFilters, setColFilters] = useState(EMPTY_COL_FILTERS);

  const [selected, setSelected]   = useState(new Set());
  const [deleting, setDeleting]   = useState(false);
  const [bulkOpen, setBulkOpen]   = useState(false);
  const [bulkSchema, setBulkSchema] = useState(null);
  const headerCbRef               = useRef(null);

  // ── Compound filter spec ─────────────────────────────────────────────────
  const spec = useFilterSpec("bookings");
  const [filterSchema, setFilterSchema] = useState(null);
  const [filterOpen, setFilterOpen]     = useState(false);

  // Monotonic token: only the newest request may render. Covers the
  // hydration race (an in-flight unfiltered load resolving after a filtered
  // one) and the infinite-scroll path (a stale page-2 append).
  const loadToken = useRef(0);

  // Schema is fetched on mount, not lazily — hydration depends on it.
  useEffect(() => {
    let cancelled = false;
    delegatesApi.filterSchema()
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
        // Never block the table: run unfiltered with the builder disabled.
        spec.markSchemaFailed();
        toast.error("Filters unavailable — could not load the field list.");
      });
    return () => { cancelled = true; };
    // Mount only: the schema does not change within a session, and spec's
    // identity changes on every criteria edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [events, setEvents] = useState([]);
  const [editInvId, setEditInvId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [datePopup, setDatePopup] = useState(null);

  const load = useCallback(async (p = 1, append = false) => {
    if (!append) setSelected(new Set());   // clear selection on fresh load
    if (p > 1) setFetchingMore(true);
    else setLoading(true);

    const token = ++loadToken.current;
    try {
      const activeFilters = Object.fromEntries(
        Object.entries(colFilters).filter(([_, v]) => (
          Array.isArray(v) ? v.length > 0 : (v !== "" && v !== null && v !== undefined)
        ))
      );

      const params = {
        page: p, page_size: PAGE_SIZE,
        ordering: sortDir === "desc" ? `-${sortKey}` : sortKey,
        ...activeFilters,
      };

      // Status is page-level state, not a column filter. Sent as an array so the
      // client serialiser emits payment_status=A&payment_status=B for the backend's
      // MultipleChoiceFilter.
      if (statusFilter?.length) params.payment_status = statusFilter;

      // Date exact match mapping (date_from = date_to = value)
      if (colFilters.request_date) {
        params.request_date_from = colFilters.request_date;
        params.request_date_to = colFilters.request_date;
      }
      if (colFilters.invoice_date) {
        params.invoice_date_from = colFilters.invoice_date;
        params.invoice_date_to = colFilters.invoice_date;
      }
      if (colFilters.payment_date) {
        params.payment_date_from = colFilters.payment_date;
        params.payment_date_to = colFilters.payment_date;
      }

      // Compound spec rides alongside the column filters; the backend ANDs them.
      if (spec.encodedParam) params.filter_spec = spec.encodedParam;

      const res = await delegatesApi.list(params);
      if (token !== loadToken.current) return;   // superseded — discard
      const results = res.results || [];
      const count = res.count || 0;

      setData(prev => append ? [...prev, ...results] : results);
      setTotal(count);
      setHasMore((p * PAGE_SIZE) < count);
    } catch (err) {
      if (token !== loadToken.current) return;
      // A 400 here means the spec was rejected. Surface the server's reason
      // rather than a generic failure, and do not retry.
      const detail = err.response?.status === 400 && err.response?.data?.detail;
      toast.error(detail || "Failed to load bookings");
    } finally {
      if (token === loadToken.current) {
        setLoading(false);
        setFetchingMore(false);
      }
    }
  }, [sortKey, sortDir, statusFilter, colFilters, spec.encodedParam, toast]);

  // Initial load or filter change.
  // GATED ON hydrated: with a stored spec this holds the first request until
  // sanitize() has run, so there is exactly one request and no unfiltered
  // flash. With no stored spec hydrated is true on the first render and this
  // fires immediately, unchanged from before.
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
    // Load more when 100px from bottom
    if (scrollHeight - scrollTop - clientHeight < 100) {
      loadMore();
    }
  };

  useEffect(() => { onTotalChange?.(total); }, [total, onTotalChange]);

  useEffect(() => {
    eventsApi.list({ page_size: 5000 })
      .then((res) => setEvents(res.results || []))
      .catch(() => { });
  }, []);

  const uniqueEditions = ["2024", "2025", "2026"];

  // ── Selection helpers ────────────────────────────────────────────────────
  const allSelected  = data.length > 0 && selected.size === data.length;
  const someSelected = selected.size > 0 && selected.size < data.length;

  useEffect(() => {
    if (headerCbRef.current) headerCbRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const handleToggleSelect = useCallback((id, checked) => {
    setSelected(prev => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);

  const handleBulkDelete = async () => {
    const count = Math.min(selected.size, 1000);
    if (!window.confirm(
      `Permanently delete ${count} booking record${count !== 1 ? "s" : ""}?\n\nThis cannot be undone.`
    )) return;
    const ids = [...selected].slice(0, 1000);
    setDeleting(true);
    try {
      const result = await delegatesApi.bulkDelete(ids);
      toast.success(`Deleted ${result.deleted} record${result.deleted !== 1 ? "s" : ""}.`);
      setSelected(new Set());
      load(1, false);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Bulk delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  // Schema is fetched lazily on first open rather than on mount — it never
  // changes during a session and most visits never open the modal.
  const openBulkUpdate = async () => {
    setBulkOpen(true);
    if (bulkSchema) return;
    try {
      setBulkSchema(await delegatesApi.bulkUpdateSchema());
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not load editable fields.");
      setBulkOpen(false);
    }
  };

  const handleBulkPreview = useCallback(
    (field, value) => delegatesApi.bulkUpdate([...selected], field, value, false, null),
    [selected],
  );

  const handleBulkCommit = useCallback(
    async (field, value, planHash) => {
      const result = await delegatesApi.bulkUpdate([...selected], field, value, true, planHash);
      setSelected(new Set());
      load(1, false);
      return result;
    },
    [selected, load],
  );

  const handleColFilter = (key, val) => {
    setColFilters(prev => ({ ...prev, [key]: val }));
    setPage(1);
  };

  const handleCloseEdit = useCallback(() => setEditInvId(null), []);
  const handleSaved = useCallback(() => load(), [load]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // An empty array is truthy in JS, so array filters must be length-checked.
  const isSet = (v) => (Array.isArray(v) ? v.length > 0 : !!v);
  const hasAnyFilter = isSet(statusFilter) || Object.values(colFilters).some(isSet)
    || spec.criteria.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>

      {/* Toolbar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginBottom: 12,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--text-dim)", fontWeight: 500 }}>
            {total.toLocaleString()} Records
          </span>

          {hasAnyFilter && (
            <button
              onClick={() => {
                setColFilters(EMPTY_COL_FILTERS);
                onStatusFilterChange?.([]);
                setPage(1);
              }}
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
              ...filterBtnStyle,
              opacity: filterSchema ? 1 : 0.5,
              cursor: filterSchema ? "pointer" : "not-allowed",
              borderColor: spec.criteria.length ? "var(--accent)" : "var(--border)",
              color: spec.criteria.length ? "var(--accent)" : "var(--text-dim)",
            }}
          >
            ⚙ Filters
            {spec.criteria.length > 0 && (
              <span style={filterBadgeStyle}>{spec.criteria.length}</span>
            )}
          </button>

          {isSalesOrAdmin && (
            <button onClick={() => setShowAddModal(true)} style={primaryBtnStyle}>
              + Add Booking
            </button>
          )}
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
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
      }}>
        <div
          onScroll={handleScroll}
          style={{ flex: 1, overflowX: "auto", overflowY: "auto" }}
        >
          <table style={{ width: "max-content", minWidth: "100%", borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr style={{ background: "var(--surface-alt)" }}>
                <Th style={{ width: 40 }}>
                  <input
                    type="checkbox"
                    ref={headerCbRef}
                    style={{ accentColor: "var(--accent)" }}
                    checked={allSelected}
                    onChange={e => setSelected(e.target.checked ? new Set(data.map(r => r.id)) : new Set())}
                  />
                </Th>
                <SortTh sortKey="_sort_status" current={sortKey} dir={sortDir} onSort={handleSort} style={{ minWidth: 130 }}>Status</SortTh>
                <SortTh sortKey="_sort_invoice" current={sortKey} dir={sortDir} onSort={handleSort} style={{ minWidth: 140 }}>Invoice</SortTh>
                <Th style={{ minWidth: 100 }}>Event</Th>
                <Th style={{ minWidth: 90 }}>Edition</Th>
                <Th style={{ minWidth: 130 }}>Booking Code</Th>
                <SortTh sortKey="_sort_request_date" current={sortKey} dir={sortDir} onSort={handleSort} style={{ minWidth: 120 }}>Request Date</SortTh>
                <SortTh sortKey="_sort_date" current={sortKey} dir={sortDir} onSort={handleSort} style={{ minWidth: 120 }}>Invoice Date</SortTh>
                <SortTh sortKey="_sort_name" current={sortKey} dir={sortDir} onSort={handleSort} style={{ minWidth: 180 }}>Name</SortTh>
                <SortTh sortKey="position" current={sortKey} dir={sortDir} onSort={handleSort} style={{ minWidth: 160 }}>Job Title</SortTh>
                <Th style={{ minWidth: 180 }}>Company</Th>
                <Th style={{ minWidth: 200 }}>Accounts Email</Th>
                <Th style={{ minWidth: 200 }}>Email</Th>
                <Th style={{ minWidth: 140 }}>Direct Line</Th>
                <SortTh sortKey="attendance" current={sortKey} dir={sortDir} onSort={handleSort} style={{ minWidth: 100 }}>Attendance</SortTh>
                <Th style={{ minWidth: 110 }}>Pay Date</Th>
                <Th style={{ minWidth: 80 }}>Paid/Free</Th>
                <Th style={{ minWidth: 110 }}>Ticket Tier</Th>
                <Th style={{ minWidth: 120 }}>Pay Type</Th>
                <Th style={{ minWidth: 80 }}>Count</Th>
                <Th style={{ minWidth: 100 }}>Discount</Th>
                <Th style={{ minWidth: 150 }}>Add-ons</Th>
                <Th style={{ minWidth: 150 }}>Reference</Th>
              </tr>
              {/* Filter Row */}
              <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                <td style={{ width: 40 }}></td>
                <td style={{ padding: "4px 14px" }}>
                  <MultiSelectFilter
                    options={PAYMENT_STATUSES}
                    value={statusFilter}
                    onChange={(v) => { onStatusFilterChange?.(v); setPage(1); }}
                  />
                </td>
                <td style={{ padding: "4px 14px" }}>
                  <input
                    placeholder="Filter..."
                    style={colFilterInput}
                    value={colFilters.invoice_number || ""}
                    onChange={(e) => handleColFilter("invoice_number", e.target.value)}
                  />
                </td>
                <td style={{ padding: "4px 14px" }}>
                  <input
                    placeholder="Event..."
                    style={colFilterInput}
                    value={colFilters.event_code || ""}
                    onChange={(e) => handleColFilter("event_code", e.target.value)}
                  />
                </td>
                <td style={{ padding: "4px 14px" }}>
                  <select
                    style={colFilterInput}
                    value={colFilters.edition || ""}
                    onChange={(e) => handleColFilter("edition", e.target.value)}
                  >
                    <option value="">All</option>
                    {uniqueEditions.map(yr => <option key={yr} value={yr}>{yr}</option>)}
                  </select>
                </td>
                <td style={{ padding: "4px 14px" }}>
                  <input
                    placeholder="Code..."
                    style={colFilterInput}
                    value={colFilters.booking_code || ""}
                    onChange={(e) => handleColFilter("booking_code", e.target.value)}
                  />
                </td>
                <td style={{ padding: "4px 14px" }}>
                  <input
                    type="date"
                    style={colFilterInput}
                    value={colFilters.request_date || ""}
                    onChange={(e) => handleColFilter("request_date", e.target.value)}
                  />
                </td>
                <td style={{ padding: "4px 14px" }}>
                  <input
                    type="date"
                    style={colFilterInput}
                    value={colFilters.invoice_date || ""}
                    onChange={(e) => handleColFilter("invoice_date", e.target.value)}
                  />
                </td>
                <td style={{ padding: "4px 14px" }}>
                  <input
                    placeholder="Name..."
                    style={colFilterInput}
                    value={colFilters.first_name || ""}
                    onChange={(e) => handleColFilter("first_name", e.target.value)}
                  />
                </td>
                <td style={{ padding: "4px 14px" }}>
                  <input
                    placeholder="Title..."
                    style={colFilterInput}
                    value={colFilters.position || ""}
                    onChange={(e) => handleColFilter("position", e.target.value)}
                  />
                </td>
                <td style={{ padding: "4px 14px" }}>
                  <input
                    placeholder="Company..."
                    style={colFilterInput}
                    value={colFilters.company_name || ""}
                    onChange={(e) => handleColFilter("company_name", e.target.value)}
                  />
                </td>
                <td style={{ padding: "4px 14px" }}>
                  <input
                    placeholder="Accounts..."
                    style={colFilterInput}
                    value={colFilters.accounts_contact_email || ""}
                    onChange={(e) => handleColFilter("accounts_contact_email", e.target.value)}
                  />
                </td>
                <td style={{ padding: "4px 14px" }}>
                  <input
                    placeholder="Email..."
                    style={colFilterInput}
                    value={colFilters.email || ""}
                    onChange={(e) => handleColFilter("email", e.target.value)}
                  />
                </td>
                <td style={{ padding: "4px 14px" }}>
                  <input
                    placeholder="Phone..."
                    style={colFilterInput}
                    value={colFilters.phone_number || ""}
                    onChange={(e) => handleColFilter("phone_number", e.target.value)}
                  />
                </td>
                <td style={{ padding: "4px 14px" }}>
                  <select
                    style={colFilterInput}
                    value={colFilters.attendance || ""}
                    onChange={(e) => handleColFilter("attendance", e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </td>
                <td style={{ padding: "4px 14px" }}>
                  <input
                    type="date"
                    style={colFilterInput}
                    value={colFilters.payment_date || ""}
                    onChange={(e) => handleColFilter("payment_date", e.target.value)}
                  />
                </td>
                <td style={{ padding: "4px 14px" }}>
                  <MultiSelectFilter
                    options={PAID_OR_FREE}
                    value={colFilters.paid_or_free}
                    onChange={(v) => handleColFilter("paid_or_free", v)}
                  />
                </td>
                <td style={{ padding: "4px 14px" }}>
                  <MultiSelectFilter
                    options={TICKET_TIERS}
                    value={colFilters.ticket_tier}
                    onChange={(v) => handleColFilter("ticket_tier", v)}
                  />
                </td>
                <td style={{ padding: "4px 14px" }}>
                  <MultiSelectFilter
                    options={PAYMENT_TYPES}
                    value={colFilters.payment_type}
                    onChange={(v) => handleColFilter("payment_type", v)}
                  />
                </td>
                <td style={{ padding: "4px 14px" }}>
                  <select
                    style={colFilterInput}
                    value={colFilters.delegate_count || ""}
                    onChange={(e) => handleColFilter("delegate_count", e.target.value)}
                  >
                    <option value="">All</option>
                    <option value="0">0</option>
                    <option value="1">1</option>
                  </select>
                </td>
                <td style={{ padding: "4px 14px" }}>
                  <select
                    style={colFilterInput}
                    value={colFilters.discount || ""}
                    onChange={(e) => handleColFilter("discount", e.target.value)}
                  >
                    <option value="">All</option>
                    {DISCOUNT_OPTIONS.map(o => <option key={o} value={o.replace("%", "")}>{o}</option>)}
                  </select>
                </td>
                <td style={{ padding: "4px 14px" }}></td>
                <td style={{ padding: "4px 14px" }}></td>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="19" style={{ textAlign: "center", padding: "48px 0", color: "var(--text-faint)", fontSize: 13 }}>
                    Loading…
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan="19" style={{ textAlign: "center", padding: "48px 0", color: "var(--text-faint)", fontSize: 13 }}>
                    No records match the current filters.
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <DelegateRow
                    key={row.id}
                    delegate={row}
                    onEdit={() => setEditInvId(row.book_event_id)}
                    isSelected={selected.has(row.id)}
                    onToggle={handleToggleSelect}
                  />
                ))
              )}
              {fetchingMore && (
                <tr>
                  <td colSpan="19" style={{ textAlign: "center", padding: "20px 0", color: "var(--accent)", fontSize: 13, fontWeight: 500 }}>
                    Loading more…
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{
          padding: "10px 20px",
          borderTop: "1px solid var(--border)",
          background: "var(--surface-alt)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0
        }}>
          <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500 }}>
            Showing {data.length} of {total} bookings
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
                disabled={deleting}
                style={{
                  padding: "4px 14px", borderRadius: 6, border: "none",
                  background: "rgba(220,53,69,0.9)", color: "#fff",
                  cursor: deleting ? "not-allowed" : "pointer",
                  fontWeight: 600, fontSize: 13, marginLeft: "auto",
                  opacity: deleting ? 0.7 : 1,
                }}
              >
                {deleting ? "Deleting…" : `🗑 Delete ${selected.size > 1000 ? `(max 1000 — ${selected.size} selected)` : selected.size}`}
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
        rowLabel="delegate"
        onPreview={handleBulkPreview}
        onCommit={handleBulkCommit}
      />

      <BookingEditModal
        invoiceId={editInvId}
        onClose={handleCloseEdit}
        onSaved={handleSaved}
      />

      {showAddModal && (
        <AddBookingModal
          onClose={() => setShowAddModal(false)}
          onSaved={handleSaved}
        />
      )}

      {datePopup && (
        <DatePopup
          invoice={datePopup.invoice}
          anchor={datePopup.anchor}
          onClose={() => setDatePopup(null)}
          onConfirm={async (date) => {
            await invoicesApi.updatePayment(datePopup.invId, {
              payment_status: "Paid", payment_date: date,
            });
            setDatePopup(null);
            load();
            toast.success(`Payment confirmed · ${datePopup.invoice.invoice_number}`);
          }}
        />
      )}
    </div>
  );
}


const DelegateRow = memo(({ delegate, onEdit, isSelected, onToggle }) => {
  return (
    <tr
      onClick={onEdit}
      style={{
        height: 44,
        borderTop: "1px solid var(--border)",
        background: isSelected ? "color-mix(in srgb, var(--accent) 8%, var(--surface))" : "transparent",
        cursor: "pointer",
        transition: "background 0.1s",
        fontSize: 13,
      }}
      onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--surface-alt)"; }}
      onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
    >
      <td style={{ ...cell, width: 40 }} onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          style={{ accentColor: "var(--accent)" }}
          checked={isSelected}
          onChange={e => onToggle(delegate.id, e.target.checked)}
        />
      </td>

      <td style={cell}>
        <StatusBadge status={delegate.effective_payment_status || delegate.payment_status} />
      </td>

      <td style={cell}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 500, color: "var(--accent)" }}>
          {delegate.invoice_number || "—"}
        </span>
      </td>

      <td style={cell}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>
          {delegate.event_code || "—"}
        </span>
      </td>

      <td style={cell}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>
          {delegate.edition || "—"}
        </span>
      </td>

      <td style={cell}>
        <span style={{ color: "var(--text-dim)", fontSize: 12 }}>
          {delegate.booking_code || "—"}
        </span>
      </td>

      <td style={cell}>
        <span style={{ color: "var(--text-dim)", fontSize: 12 }}>
          {delegate.request_date ? fmt.dateShort(delegate.request_date) : "—"}
        </span>
      </td>

      <td style={cell}>
        <span style={{ color: "var(--text-dim)", fontSize: 12 }}>
          {fmt.dateShort(delegate.invoice_date) || "—"}
        </span>
      </td>

      <td style={cell}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar name={delegate.full_name || ""} size={26} />
          <span style={{ fontWeight: 500, color: "var(--text)" }}>
            {delegate.full_name || "—"}
          </span>
        </div>
      </td>

      <td style={cell}>
        <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{delegate.position || "—"}</span>
      </td>

      <td style={cell}>
        <span style={{ color: "var(--text-dim)" }}>{delegate.company_display || "—"}</span>
      </td>

      <td style={cell}>
        <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{delegate.accounts_contact_email || "—"}</span>
      </td>

      <td style={cell}>
        <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{delegate.email || "—"}</span>
      </td>

      <td style={cell}>
        <span style={{ color: "var(--text-dim)", fontSize: 12, fontFamily: "var(--font-mono)" }}>
          {delegate.phone_number || "—"}
        </span>
      </td>

      <td style={{ ...cell, textAlign: "center" }}>
        {delegate.attendance === "Confirmed"
          ? <span style={{ fontSize: 11, fontWeight: 600, color: "var(--success, #16a34a)" }}>Yes</span>
          : <span style={{ fontSize: 11, color: "var(--text-faint)" }}>{delegate.attendance === "Pending" ? "—" : "No"}</span>}
      </td>

      <td style={cell}>
        <span style={{ fontSize: 12, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          {delegate.effective_payment_date || "—"}
        </span>
      </td>

      <td style={cell}>
        {delegate.effective_paid_or_free ? (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4,
            background: delegate.effective_paid_or_free === "Free" ? "#dbeafe" : "#f0fdf4",
            color: delegate.effective_paid_or_free === "Free" ? "#1d4ed8" : "#166534",
          }}>
            {delegate.effective_paid_or_free}
          </span>
        ) : <span style={{ fontSize: 12, color: "var(--text-faint)" }}>—</span>}
      </td>

      <td style={cell}>
        {delegate.effective_ticket_tier ? (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4,
            background: delegate.effective_ticket_tier === "VIP" ? "#fdf4ff" : "var(--surface-alt)",
            color: delegate.effective_ticket_tier === "VIP" ? "#7e22ce" : "var(--text-dim)",
          }}>
            {delegate.effective_ticket_tier}
          </span>
        ) : <span style={{ fontSize: 12, color: "var(--text-faint)" }}>—</span>}
      </td>

      <td style={cell}>
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
          {delegate.effective_payment_type || "—"}
        </span>
      </td>
      <td style={cell}>
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{delegate.delegate_count ?? 1}</span>
      </td>
      <td style={cell}>
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{delegate.discount != null ? `${Math.round(delegate.discount)}%` : "—"}</span>
      </td>
      <td style={cell}>
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{delegate.add_ons || "—"}</span>
      </td>
      <td style={cell}>
        <span style={{ fontSize: 12, color: "var(--text-dim)" }}>{delegate.reference || "—"}</span>
      </td>
    </tr>
  );
});


/* ─── Sub-components ─── */

function Th({ children, style = {} }) {
  return (
    <th style={{
      padding: "10px 14px",
      fontSize: 10,
      fontWeight: 500,
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      color: "var(--text-dim)",
      textAlign: "left",
      whiteSpace: "nowrap",
      border: "none",
      borderBottom: "1px solid var(--border)",
      ...style,
    }}>
      {children}
    </th>
  );
}

function SortTh({ sortKey, current, dir, onSort, children, align = "left", style = {} }) {
  const active = current === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{
        padding: "10px 14px",
        fontSize: 10,
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: active ? "var(--accent)" : "var(--text-dim)",
        textAlign: align,
        whiteSpace: "nowrap",
        cursor: "pointer",
        border: "none",
        borderBottom: "1px solid var(--border)",
        userSelect: "none",
        ...style,
      }}
    >
      {children}
      {active && <span style={{ marginLeft: 3, opacity: 0.7 }}>{dir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}

/* ─── Styles ─── */

const cell = {
  padding: "0 14px",
  color: "var(--text)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: 220,
};

const viewBtnStyle = {
  fontSize: 11,
  fontWeight: 500,
  padding: "4px 10px",
  borderRadius: 6,
  border: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-dim)",
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "all .15s",
  whiteSpace: "nowrap",
};

const filterBtnStyle = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "7px 14px", fontSize: 12, fontWeight: 600,
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 8, fontFamily: "inherit", transition: "all 0.15s",
};

const filterBadgeStyle = {
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  minWidth: 17, height: 17, padding: "0 5px", borderRadius: 9,
  background: "var(--accent)", color: "#fff", fontSize: 10.5, fontWeight: 700,
};

const colFilterInput = {
  width: "100%",
  height: 26,
  padding: "0 8px",
  fontSize: 11,
  border: "1px solid var(--border)",
  borderRadius: 4,
  background: "var(--surface-alt)",
  color: "var(--text)",
  fontFamily: "inherit",
  outline: "none",
  transition: "border-color 0.1s",
};

const primaryBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  background: "var(--accent)",
  border: "none",
  color: "#fff",
  padding: "7px 14px",
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
  flexShrink: 0,
};
