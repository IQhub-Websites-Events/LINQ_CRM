import { useState } from "react";
import { BookingsTable } from "../components/bookings/BookingsTable";
import { BookingsCardGrid } from "../components/bookings/BookingsCardGrid";

const STATUS_TABS = ["All", "Pending", "Paid"];

export function BookingsPage({ navItem }) {
  const [view, setView] = useState("table"); // "table" | "cards"
  const [statusFilter, setStatusFilter] = useState(navItem ? "" : "Pending");

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
        <div>
          <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 4 }}>CRM › Bookings</div>
          <h1 style={{
            margin: 0,
            fontFamily: "var(--font-serif)",
            fontWeight: 500,
            fontSize: 38,
            lineHeight: 1,
            letterSpacing: "-0.01em",
            color: "var(--text)",
          }}>
            Bookings.
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-dim)", maxWidth: 520 }}>
            Manage invoices, track payment statuses, and view delegate records across all events.
          </p>
        </div>

        {/* Table / Cards toggle */}
        <ViewToggle view={view} onChange={setView} />
      </div>

      {/* Filter strip */}
      <FilterStrip statusFilter={statusFilter} onStatusChange={(s) => setStatusFilter(s)} />

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, padding: "0 28px 28px" }}>
        {view === "table" ? (
          <BookingsTable statusFilter={statusFilter} />
        ) : (
          <BookingsCardGrid statusFilter={statusFilter} />
        )}
      </div>
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
