import { useState, useEffect, useCallback, memo } from "react";
import { delegatesApi, invoicesApi, eventsApi } from "../../api";
import { useToast } from "../../contexts/ToastContext";
import { StatusBadge } from "../ui/Badge";
import { Avatar } from "../ui/Avatar";
import { Pager } from "../ui/Table";
import { fmt } from "../../utils/helpers";
import { BookingEditModal } from "./BookingEditModal";
import { AddBookingModal } from "./AddBookingModal";
import { DatePopup } from "./DatePopup";
import { PAYMENT_TYPES, TICKET_TIERS, PAID_OR_FREE, PAYMENT_STATUSES, DISCOUNT_OPTIONS } from "../../utils/constants";

const PAGE_SIZE = 50;

const getEditionFromCode = (code) => {
  if (!code) return "—";
  const match = code.match(/(\d{2,4})$/);
  if (match) {
    const numStr = match[1];
    return numStr.length === 2 ? `20${numStr}` : numStr;
  }
  return "—";
};

export function BookingsTable({ statusFilter = "Pending", onTotalChange }) {
  const toast = useToast();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [sortKey, setSortKey] = useState("_sort_request_date");
  const [sortDir, setSortDir] = useState("desc");

  // Column Filters
  const [colFilters, setColFilters] = useState({
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
    payment_status: "",
    attendance: "",
    paid_or_free: "",
    ticket_tier: "",
    payment_type: "",
    request_date: "",
    invoice_date: "",
    payment_date: "",
    delegate_count: "",
    discount: "",
  });

  const [events, setEvents] = useState([]);
  const [editInvId, setEditInvId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [datePopup, setDatePopup] = useState(null);

  const load = useCallback(async (p = 1, append = false) => {
    if (p > 1) setFetchingMore(true);
    else setLoading(true);

    try {
      const activeFilters = Object.fromEntries(
        Object.entries(colFilters).filter(([_, v]) => v !== "" && v !== null && v !== undefined)
      );

      const params = {
        page: p, page_size: PAGE_SIZE,
        ordering: sortDir === "desc" ? `-${sortKey}` : sortKey,
        ...activeFilters,
      };

      // Map frontend column filter keys to backend filterset keys
      if (statusFilter) params.payment_status = statusFilter;
      if (colFilters.payment_status) params.payment_status = colFilters.payment_status;

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

      const res = await delegatesApi.list(params);
      const results = res.results || [];
      const count = res.count || 0;

      setData(prev => append ? [...prev, ...results] : results);
      setTotal(count);
      setHasMore((p * PAGE_SIZE) < count);
    } catch {
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
      setFetchingMore(false);
    }
  }, [sortKey, sortDir, statusFilter, colFilters, toast]);

  // Initial load or filter change
  useEffect(() => {
    setPage(1);
    load(1, false);
  }, [statusFilter, colFilters, sortKey, sortDir, load]);

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

  const hasAnyFilter = statusFilter || Object.values(colFilters).some(v => v);

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
                setColFilters({});
                setPage(1);
              }}
              style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              Reset Column Filters
            </button>
          )}
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          style={primaryBtnStyle}
        >
          + Add Booking
        </button>
      </div>

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
                <Th style={{ width: 32 }}>
                  <input type="checkbox" style={{ accentColor: "var(--accent)" }} />
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
                <td style={{ width: 32 }}></td>
                <td style={{ padding: "4px 14px" }}>
                  <select
                    style={colFilterInput}
                    value={colFilters.payment_status || ""}
                    onChange={(e) => handleColFilter("payment_status", e.target.value)}
                  >
                    <option value="">All</option>
                    {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
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
                  <select
                    style={colFilterInput}
                    value={colFilters.paid_or_free || ""}
                    onChange={(e) => handleColFilter("paid_or_free", e.target.value)}
                  >
                    <option value="">All</option>
                    {PAID_OR_FREE.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td style={{ padding: "4px 14px" }}>
                  <select
                    style={colFilterInput}
                    value={colFilters.ticket_tier || ""}
                    onChange={(e) => handleColFilter("ticket_tier", e.target.value)}
                  >
                    <option value="">All</option>
                    {TICKET_TIERS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
                <td style={{ padding: "4px 14px" }}>
                  <select
                    style={colFilterInput}
                    value={colFilters.payment_type || ""}
                    onChange={(e) => handleColFilter("payment_type", e.target.value)}
                  >
                    <option value="">All</option>
                    {PAYMENT_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
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
      </div>

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


const DelegateRow = memo(({ delegate, onEdit }) => {
  return (
    <tr
      onClick={onEdit}
      style={{
        height: 44,
        borderTop: "1px solid var(--border)",
        background: "transparent",
        cursor: "pointer",
        transition: "background 0.1s",
        fontSize: 13,
      }}
      onMouseOver={(e) => { e.currentTarget.style.background = "var(--surface-alt)"; }}
      onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <td style={{ ...cell, width: 32 }}>
        <input type="checkbox" style={{ accentColor: "var(--accent)" }} onClick={(e) => e.stopPropagation()} />
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
