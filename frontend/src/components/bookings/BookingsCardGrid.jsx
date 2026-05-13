import { useState, useEffect, useCallback } from "react";
import { delegatesApi, invoicesApi } from "../../api";
import { useToast } from "../../contexts/ToastContext";
import { Avatar } from "../ui/Avatar";
import { StatusBadge } from "../ui/Badge";
import { BookingEditModal } from "./BookingEditModal";
import { fmt } from "../../utils/helpers";

const PAGE_SIZE = 48;

export function BookingsCardGrid({ statusFilter = "", onTotalChange }) {
  const toast = useToast();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [editInvId, setEditInvId] = useState(null);

  const load = useCallback(async (p = 1, append = false) => {
    if (p > 1) setFetchingMore(true);
    else setLoading(true);

    try {
      const params = { page: p, page_size: PAGE_SIZE };
      if (statusFilter) params.payment_status = statusFilter;
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
  }, [statusFilter, toast]);

  useEffect(() => {
    setPage(1);
    load(1, false);
  }, [statusFilter, load]);

  const loadMore = useCallback(() => {
    if (loading || fetchingMore || !hasMore) return;
    const next = page + 1;
    setPage(next);
    load(next, true);
  }, [page, loading, fetchingMore, hasMore, load]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 100) {
      loadMore();
    }
  };
  useEffect(() => { onTotalChange?.(total); }, [total, onTotalChange]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {loading ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--text-faint)", fontSize: 13 }}>Loading…</div>
      ) : data.length === 0 ? (
        <div style={{ textAlign: "center", padding: 48, color: "var(--text-faint)", fontSize: 13 }}>No records match the current filters.</div>
      ) : (
        <div 
          onScroll={handleScroll}
          style={{
            flex: 1,
            overflowY: "auto",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 14,
          alignContent: "start",
        }}>
          {data.map((row) => (
            <BookingCard key={row.id} delegate={row} onEdit={() => setEditInvId(row.book_event_id)} />
          ))}
          {fetchingMore && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 20, color: "var(--accent)", fontSize: 13, fontWeight: 500 }}>
              Loading more…
            </div>
          )}
        </div>
      )}

      <div style={{ 
        padding: "10px 0", 
        borderTop: "1px solid var(--border)", 
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexShrink: 0,
        marginTop: 12
      }}>
        <span style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 500 }}>
          Showing {data.length} of {total} bookings
        </span>
        {!hasMore && total > 0 && (
          <span style={{ fontSize: 11, color: "var(--text-faint)" }}>All records loaded</span>
        )}
      </div>

      <BookingEditModal
        invoiceId={editInvId}
        onClose={() => setEditInvId(null)}
        onSaved={load}
      />
    </div>
  );
}


function BookingCard({ delegate, onEdit }) {
  const amount = delegate.net_total ?? delegate.amount ?? null;
  const currency = delegate.currency || "USD";
  const name = delegate.full_name || "—";

  return (
    <div style={{
      borderRadius: 12,
      border: "1px solid var(--border)",
      background: "var(--surface)",
      padding: "18px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    }}>
      {/* Header row: invoice ID + status pill */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 500,
          color: "var(--accent)",
        }}>
          {delegate.invoice_number || "—"}
        </span>
        <StatusBadge status={delegate.payment_status} />
      </div>

      {/* Identity row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar name={name} size={38} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {delegate.company_display || "—"}
          </div>
        </div>
      </div>

      {/* Meta row */}
      <div style={{
        borderTop: "1px solid var(--border)",
        paddingTop: 10,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 10, textTransform: "uppercase", color: "var(--text-faint)", letterSpacing: "0.04em", marginBottom: 2 }}>
            {delegate.event_code || "—"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
            {delegate.ticket_tier || delegate.paid_free || "Standard"} · {fmt.dateShort(delegate.invoice_date) || "—"}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {amount != null ? (
            <>
              <div style={{
                fontFamily: "var(--font-serif)",
                fontSize: 22,
                fontWeight: 500,
                color: "var(--text)",
                lineHeight: 1,
              }}>
                {fmt.currency(amount, currency)}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-faint)", fontFamily: "var(--font-mono)", marginTop: 1 }}>
                {currency}
              </div>
            </>
          ) : (
            <span style={{ color: "var(--text-faint)", fontSize: 13 }}>—</span>
          )}
        </div>
      </div>

      {/* View booking button */}
      <button
        onClick={onEdit}
        style={{
          width: "100%",
          padding: "7px 0",
          background: "var(--surface-alt)",
          border: "1px solid var(--border)",
          borderRadius: 7,
          fontSize: 12,
          fontWeight: 500,
          color: "var(--text-dim)",
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "background .15s",
        }}
        onMouseOver={(e) => e.currentTarget.style.background = "var(--border)"}
        onMouseOut={(e) => e.currentTarget.style.background = "var(--surface-alt)"}
      >
        View booking
      </button>
    </div>
  );
}

function PgBtn({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: 12, padding: "4px 10px", borderRadius: 6,
        border: "1px solid var(--border)", background: "var(--surface)",
        color: disabled ? "var(--text-faint)" : "var(--text)",
        cursor: disabled ? "default" : "pointer",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}
