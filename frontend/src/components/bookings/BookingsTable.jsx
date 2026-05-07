import { useState, useEffect, useCallback, memo } from "react";
import { delegatesApi, invoicesApi, eventsApi } from "../../api";
import { useToast } from "../../contexts/ToastContext";
import { StatusBadge } from "../ui/Badge";
import { Avatar } from "../ui/Avatar";
import { Pager } from "../ui/Table";
import { fmt } from "../../utils/helpers";
import { BookingDetailPanel } from "./BookingDetailPanel";
import { BookingEditModal } from "./BookingEditModal";
import { AddBookingModal } from "./AddBookingModal";
import { DatePopup } from "./DatePopup";

const PAGE_SIZE = 50;

export function BookingsTable({ navItemId, statusFilter = "Pending", onTotalChange }) {
  const toast = useToast();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState("invoice__invoice_number");
  const [sortDir, setSortDir] = useState("asc");
  const [eventFilter, setEvFilter] = useState("");
  const [search, setSearch] = useState("");
  const [events, setEvents] = useState([]);

  const [selectedBooking, setSelectedBooking] = useState(null);
  const [activeInvId, setActiveInvId] = useState(navItemId || null);
  const [editInvId, setEditInvId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [datePopup, setDatePopup] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page, page_size: PAGE_SIZE,
        ordering: sortDir === "desc" ? `-${sortKey}` : sortKey,
      };
      if (search) params.search = search;
      if (statusFilter) params.payment_status = statusFilter;
      if (eventFilter) params.event_code = eventFilter;
      const res = await delegatesApi.list(params);
      setData(res.results || []);
      setTotal(res.count || 0);
    } catch {
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, [page, sortKey, sortDir, search, statusFilter, eventFilter, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => { onTotalChange?.(total); }, [total, onTotalChange]);

  useEffect(() => {
    eventsApi.list({ page_size: 100 })
      .then((res) => setEvents(res.results || []))
      .catch(() => {});
  }, []);

  const handleCloseEdit = useCallback(() => setEditInvId(null), []);
  const handleSaved = useCallback(() => load(), [load]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const openDrawer = async (bookEventId) => {
    setActiveInvId(bookEventId);
    try {
      const res = await invoicesApi.get(bookEventId);
      setSelectedBooking(res);
    } catch {
      toast.error("Failed to load booking details");
    }
  };

  const closeDrawer = () => { setSelectedBooking(null); setActiveInvId(null); };

  const handleStatusClick = (inv, e) => {
    if (inv.payment_status === "Paid") { openDrawer(inv.id); return; }
    setDatePopup({ invId: inv.id, anchor: e.currentTarget.getBoundingClientRect(), invoice: inv });
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
          {/* Search */}
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "0 10px",
            height: 32,
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--text-faint)" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="5" cy="5" r="4"/><path d="M9 9l2 2"/>
            </svg>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search bookings…"
              style={{
                border: "none", outline: "none", fontSize: 12,
                background: "none", color: "var(--text)",
                fontFamily: "inherit", width: 200,
              }}
            />
          </div>

          {/* Event filter */}
          <div style={{ position: "relative" }}>
            <select
              value={eventFilter}
              onChange={(e) => { setEvFilter(e.target.value); setPage(1); }}
              style={selectStyle}
            >
              <option value="">All Events</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.event_code}>{ev.event_code}</option>
              ))}
            </select>
          </div>

          {(search || eventFilter) && (
            <button
              onClick={() => { setSearch(""); setEvFilter(""); setPage(1); }}
              style={{ fontSize: 11, color: "var(--text-faint)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
            >
              Clear filters ×
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
        <div style={{ flex: 1, overflowX: "auto", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr style={{ background: "var(--surface-alt)" }}>
                <Th style={{ width: 32 }}>
                  <input type="checkbox" style={{ accentColor: "var(--accent)" }} />
                </Th>
                <SortTh sortKey="payment_status" current={sortKey} dir={sortDir} onSort={handleSort}>Status</SortTh>
                <SortTh sortKey="invoice__invoice_number" current={sortKey} dir={sortDir} onSort={handleSort}>Invoice</SortTh>
                <Th>Event</Th>
                <Th>Type</Th>
                <SortTh sortKey="full_name" current={sortKey} dir={sortDir} onSort={handleSort}>Delegate</SortTh>
                <Th>Company</Th>
                <SortTh sortKey="net_total" current={sortKey} dir={sortDir} onSort={handleSort} align="right">Amount</SortTh>
                <SortTh sortKey="invoice__invoice_date" current={sortKey} dir={sortDir} onSort={handleSort}>Invoice date</SortTh>
                <Th style={{ width: 110 }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: "center", padding: "48px 0", color: "var(--text-faint)", fontSize: 13 }}>
                    Loading…
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: "center", padding: "48px 0", color: "var(--text-faint)", fontSize: 13 }}>
                    No records match the current filters.
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <DelegateRow
                    key={row.id}
                    delegate={row}
                    onOpen={() => openDrawer(row.book_event_id)}
                    onEdit={() => setEditInvId(row.book_event_id)}
                    onStatusClick={handleStatusClick}
                    isActive={activeInvId === row.book_event_id}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <Pager page={page} totalPages={totalPages} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
        </div>
      </div>

      <BookingDetailPanel booking={selectedBooking} onClose={closeDrawer} />

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


const DelegateRow = memo(({ delegate, onOpen, onEdit, isActive }) => {
  const amount = delegate.net_total ?? delegate.amount ?? null;
  const currency = delegate.currency || "USD";

  return (
    <tr
      onClick={onOpen}
      style={{
        height: 44,
        borderTop: "1px solid var(--border)",
        background: isActive ? "var(--accent-soft)" : "transparent",
        cursor: "pointer",
        transition: "background 0.1s",
        fontSize: 13,
      }}
      onMouseOver={(e) => { if (!isActive) e.currentTarget.style.background = "var(--surface-alt)"; }}
      onMouseOut={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
    >
      <td style={{ ...cell, width: 32 }}>
        <input type="checkbox" style={{ accentColor: "var(--accent)" }} onClick={(e) => e.stopPropagation()} />
      </td>

      <td style={cell}>
        <StatusBadge status={delegate.payment_status} />
      </td>

      <td style={cell}>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          fontWeight: 500,
          color: "var(--accent)",
        }}>
          {delegate.invoice_number || "—"}
        </span>
      </td>

      <td style={cell}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-dim)" }}>
          {delegate.event_code || "—"}
        </span>
      </td>

      <td style={cell}>
        <span style={{ color: "var(--text-dim)", fontSize: 12 }}>
          {delegate.ticket_tier || delegate.paid_free || "—"}
        </span>
      </td>

      <td style={cell}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar name={delegate.full_name || ""} size={26} />
          <div>
            <div style={{ fontWeight: 500, color: "var(--text)", lineHeight: 1.3 }}>
              {delegate.full_name || "—"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-faint)", lineHeight: 1.2 }}>
              {delegate.email}
            </div>
          </div>
        </div>
      </td>

      <td style={cell}>
        <span style={{ color: "var(--text-dim)" }}>{delegate.company_display || "—"}</span>
      </td>

      <td style={{ ...cell, textAlign: "right" }}>
        {amount != null ? (
          <span>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, color: "var(--text)" }}>
              {fmt.currency(amount, currency)}
            </span>
            {" "}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-faint)" }}>{currency}</span>
          </span>
        ) : (
          <span style={{ color: "var(--text-faint)" }}>—</span>
        )}
      </td>

      <td style={cell}>
        <span style={{ color: "var(--text-dim)" }}>{fmt.dateShort(delegate.invoice_date) || "—"}</span>
      </td>

      <td style={{ ...cell, width: 110 }}>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          style={viewBtnStyle}
        >
          View booking
        </button>
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

const selectStyle = {
  height: 32,
  padding: "0 28px 0 10px",
  fontSize: 12,
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text)",
  background: "var(--surface)",
  fontFamily: "inherit",
  outline: "none",
  cursor: "pointer",
  appearance: "none",
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239a978f' stroke-width='1.3' fill='none'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 8px center",
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
