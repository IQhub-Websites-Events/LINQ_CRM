import { useState, useCallback } from "react";
import { BookingsTable } from "../components/bookings/BookingsTable";
import { BookingsCardGrid } from "../components/bookings/BookingsCardGrid";
import { FilterSidebar } from "../components/bookings/FilterSidebar";
import { SmartImportModal } from "../components/bookings/SmartImportModal";
import { invoicesApi } from "../api";
import { useFetch } from "../hooks/useFetch";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

const STATUS_TABS = ["All", "Pending", "Paid"];

export function BookingsPage({ navItem }) {
  const [view,         setView]         = useState("table"); // "table" | "cards"
  const [statusFilter, setStatusFilter] = useState(navItem ? "" : "Pending");
  const [period,       setPeriod]       = useState("total");
  const [importOpen,   setImportOpen]   = useState(false);
  const [refreshKey,   setRefreshKey]   = useState(0);

  const { user } = useAuth();
  const toast = useToast();

  const { data: stats, loading: statsLoading } = useFetch(
    () => invoicesApi.stats(period),
    [period]
  );

  const handleClearFilters = useCallback(() => {
    setStatusFilter("");
  }, []);

  const handleClearAll = async () => {
    if (!window.confirm("WARNING: This will delete ALL bookings and related data from the database. This action cannot be undone. Are you sure you want to proceed?")) return;
    
    try {
      await invoicesApi.clearAll();
      toast.success("Successfully cleared all booking data.");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to clear booking data.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg)" }}>

      {/* Page header */}
      <div style={{
        padding: "24px 28px 16px",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 16,
        flexShrink: 0,
      }}>
        <div className="hello" style={{ flex: 1, display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Filter by
            </span>
            <select 
              value={period} 
              onChange={(e) => setPeriod(e.target.value)}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "6px 32px 6px 12px",
                fontSize: 13,
                fontWeight: 500,
                color: "var(--text)",
                appearance: "none",
                cursor: "pointer",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239a978f' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 10px center",
                backgroundSize: "10px 6px",
                outline: "none",
              }}
            >
              <option value="today">Today</option>
              <option value="month">This Month</option>
              <option value="total">Total</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 16, flex: 1 }}>
            <StatCard key="total" label="Total bookings" value={stats?.total} loading={statsLoading} />
            <StatCard key="paid" label="Paid" value={stats?.paid} loading={statsLoading} />
            <StatCard key="confirmed" label="Confirmed" value={stats?.confirmed} loading={statsLoading} />
            <StatCard key="free" label="Free" value={stats?.free} loading={statsLoading} />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user?.username === 'HP' && (
            <button
              onClick={handleClearAll}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 16px", fontSize: 12, fontWeight: 600,
                background: "var(--danger-soft)", border: "1px solid var(--danger)",
                borderRadius: 8, cursor: "pointer", color: "var(--danger)",
                fontFamily: "inherit", transition: "all 0.15s", flexShrink: 0,
                alignSelf: "flex-start", marginTop: 6,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--danger)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--danger-soft)";  e.currentTarget.style.color = "var(--danger)"; }}
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
              padding: "7px 16px", fontSize: 12, fontWeight: 600,
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 8, cursor: "pointer", color: "var(--text-dim)",
              fontFamily: "inherit", transition: "all 0.15s", flexShrink: 0,
              alignSelf: "flex-start", marginTop: 6,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)";  e.currentTarget.style.color = "var(--text-dim)"; }}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6.5 1v8M3 6l3.5 3.5L10 6" />
              <path d="M1 11h11" />
            </svg>
            Import Data
          </button>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <FilterStrip statusFilter={statusFilter} onStatusChange={(s) => setStatusFilter(s)} />

          <div key={refreshKey} style={{ flex: 1, minHeight: 0, padding: "0 28px 28px" }}>
            {view === "table" ? (
              <BookingsTable
                statusFilter={statusFilter}
              />
            ) : (
              <BookingsCardGrid
                statusFilter={statusFilter}
              />
            )}
          </div>
        </div>
      </div>

      <SmartImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}



function FilterStrip({ statusFilter, onStatusChange }) {
  const active = statusFilter || "All";
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "0 28px 12px",
      flexShrink: 0,
    }}>
      {/* Status segmented control */}
      <div style={{
        display: "inline-flex",
        border: "1px solid var(--border)",
        borderRadius: 8,
        overflow: "hidden",
        padding: 3,
        gap: 2,
        background: "var(--surface-alt)",
      }}>
        {STATUS_TABS.map((tab) => {
          const isActive = active === tab;
          return (
            <button
              key={tab}
              onClick={() => onStatusChange(tab === "All" ? "" : tab)}
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 12,
                fontWeight: isActive ? 500 : 400,
                padding: "4px 10px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                background: isActive ? "var(--surface)" : "transparent",
                color: isActive ? "var(--text)" : "var(--text-dim)",
                boxShadow: isActive ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                transition: "all .15s",
              }}
            >
              {tab}
            </button>
          );
        })}
      </div>
    </div>
  );
}


function ViewToggle({ view, onChange }) {
  return (
    <div style={{
      display: "inline-flex",
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: 3,
      gap: 2,
      background: "var(--surface-alt)",
      flexShrink: 0,
      alignSelf: "flex-start",
      marginTop: 6,
    }}>
      <ToggleBtn active={view === "table"} onClick={() => onChange("table")} title="Table view">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M1 3h10M1 6h10M1 9h10" />
        </svg>
        Table
      </ToggleBtn>
      <ToggleBtn active={view === "cards"} onClick={() => onChange("cards")} title="Card view">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <rect x="1" y="1" width="4" height="4" rx="1" /><rect x="7" y="1" width="4" height="4" rx="1" />
          <rect x="1" y="7" width="4" height="4" rx="1" /><rect x="7" y="7" width="4" height="4" rx="1" />
        </svg>
        Cards
      </ToggleBtn>
    </div>
  );
}

function ToggleBtn({ active, onClick, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12,
        fontWeight: active ? 500 : 400,
        padding: "4px 10px",
        borderRadius: 6,
        border: "none",
        cursor: "pointer",
        background: active ? "var(--surface)" : "transparent",
        color: active ? "var(--text)" : "var(--text-dim)",
        boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
        fontFamily: "inherit",
        transition: "all .15s",
      }}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value, loading }) {
  const displayValue = loading ? "..." : (value ?? 0).toLocaleString();
  return (
    <div style={{
      flex: 1,
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 12,
      padding: "12px 16px",
      display: "flex",
      flexDirection: "column",
      gap: 4,
    }}>
      <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.02em" }}>
        {label}
      </span>
      <div style={{ fontSize: 24, fontWeight: 600, color: "var(--text)", fontFamily: "var(--font-serif)" }}>
        <span>{displayValue}</span>
      </div>
    </div>
  );
}

const chipStyle = {
  fontSize: 12,
  padding: "4px 10px",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-dim)",
  cursor: "pointer",
  fontFamily: "inherit",
};

const ghostFilterStyle = {
  fontSize: 12,
  padding: "4px 10px",
  background: "none",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-dim)",
  cursor: "pointer",
  fontFamily: "inherit",
};
