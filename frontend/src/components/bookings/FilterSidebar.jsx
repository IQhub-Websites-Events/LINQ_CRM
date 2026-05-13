import { useState } from "react";
import { PAYMENT_STATUSES, PAYMENT_TYPES, TICKET_TIERS, PAID_OR_FREE } from "../../utils/constants";

export function FilterSidebar({ filters, onFilterChange, onClear, onClose }) {
  const handleChange = (key, value) => {
    onFilterChange({ ...filters, [key]: value });
  };

  return (
    <div style={{
      width: 280,
      background: "var(--surface)",
      borderRight: "1px solid var(--border)",
      display: "flex",
      flexDirection: "column",
      height: "100%",
      flexShrink: 0,
      animation: "slideIn 0.2s ease-out",
    }}>
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Advanced Filters</span>
        <button 
          onClick={onClear}
          style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}
        >
          Clear All
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          
          {/* Status Selection (Multi-select simulation) */}
          <FilterSection label="Payment Status">
            <select 
              value={filters.payment_status || ""} 
              onChange={(e) => handleChange("payment_status", e.target.value)}
              style={selectStyle}
            >
              <option value="">All Statuses</option>
              {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </FilterSection>

          {/* Date Ranges */}
          <FilterSection label="Request Date">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input 
                type="date" 
                value={filters.request_date_from || ""} 
                onChange={(e) => handleChange("request_date_from", e.target.value)}
                style={inputStyle}
              />
              <span style={{ fontSize: 10, color: "var(--text-faint)", textAlign: "center" }}>to</span>
              <input 
                type="date" 
                value={filters.request_date_to || ""} 
                onChange={(e) => handleChange("request_date_to", e.target.value)}
                style={inputStyle}
              />
            </div>
          </FilterSection>

          <FilterSection label="Invoice Date">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input 
                type="date" 
                value={filters.invoice_date_from || ""} 
                onChange={(e) => handleChange("invoice_date_from", e.target.value)}
                style={inputStyle}
              />
              <span style={{ fontSize: 10, color: "var(--text-faint)", textAlign: "center" }}>to</span>
              <input 
                type="date" 
                value={filters.invoice_date_to || ""} 
                onChange={(e) => handleChange("invoice_date_to", e.target.value)}
                style={inputStyle}
              />
            </div>
          </FilterSection>

          <FilterSection label="Payment Date">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input 
                type="date" 
                value={filters.payment_date_from || ""} 
                onChange={(e) => handleChange("payment_date_from", e.target.value)}
                style={inputStyle}
              />
              <span style={{ fontSize: 10, color: "var(--text-faint)", textAlign: "center" }}>to</span>
              <input 
                type="date" 
                value={filters.payment_date_to || ""} 
                onChange={(e) => handleChange("payment_date_to", e.target.value)}
                style={inputStyle}
              />
            </div>
          </FilterSection>

          {/* Other Dropdowns */}
          <FilterSection label="Paid / Free">
            <select 
              value={filters.paid_or_free || ""} 
              onChange={(e) => handleChange("paid_or_free", e.target.value)}
              style={selectStyle}
            >
              <option value="">Both</option>
              {PAID_OR_FREE.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </FilterSection>

          <FilterSection label="Ticket Tier">
            <select 
              value={filters.ticket_tier || ""} 
              onChange={(e) => handleChange("ticket_tier", e.target.value)}
              style={selectStyle}
            >
              <option value="">All Tiers</option>
              {TICKET_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </FilterSection>

          <FilterSection label="Payment Type">
            <select 
              value={filters.payment_type || ""} 
              onChange={(e) => handleChange("payment_type", e.target.value)}
              style={selectStyle}
            >
              <option value="">All Types</option>
              {PAYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </FilterSection>

        </div>
      </div>
    </div>
  );
}

function FilterSection({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  height: 32,
  padding: "0 10px",
  fontSize: 12,
  border: "1px solid var(--border)",
  borderRadius: 6,
  background: "var(--surface-alt)",
  color: "var(--text)",
  fontFamily: "inherit",
  outline: "none",
};

const selectStyle = {
  ...inputStyle,
  cursor: "pointer",
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239a978f' stroke-width='1.3' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  backgroundSize: "10px 6px",
};
