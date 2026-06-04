import { useState, useCallback } from "react";
import { TicketTable } from "../components/tickets/TicketTable";
import { CreateTicketModal } from "../components/tickets/CreateTicketModal";
import { SmartImportModal } from "../components/tickets/SmartImportModal";
import { ticketCentralApi } from "../api";
import { useFetch } from "../hooks/useFetch";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

const STATUS_TABS = [
  { label: "All",             value: "" },
  { label: "Draft",           value: "draft",            countKey: "draft" },
  { label: "MR Submitted",    value: "mr_submitted",     countKey: "mr_submitted" },
  { label: "Completed",       value: "completed",        countKey: "completed" },
  { label: "Returned",        value: "returned",         countKey: "returned" },
];

export function TicketCentralPage({ navItem }) {
  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const toast = useToast();
  const { user } = useAuth();
  const canCreate = user?.role === "market_research" || user?.role === "admin";
  const canImport = user?.role === "admin";  // D24 — bulk import is admin-only
  const isHP = user?.username === "HP";

  const { data: stats, loading: statsLoading } = useFetch(
    () => ticketCentralApi.stats(),
    [refreshKey]
  );

  const handleChanged = useCallback(() => setRefreshKey((k) => k + 1), []);

  const handleClearAll = async () => {
    const step1 = window.confirm(
      "WARNING: This will permanently delete ALL tickets and reset all sequences.\n\nThis cannot be undone. Continue?"
    );
    if (!step1) return;
    const typed = window.prompt('Type "CLEAR" to confirm:');
    if (typed?.trim() !== "CLEAR") {
      toast.error("Cancelled — confirmation text did not match.");
      return;
    }
    try {
      const result = await ticketCentralApi.clearAll();
      toast.success(`Cleared ${result.deleted} tickets. Sequences reset.`);
      handleChanged();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Clear failed.");
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
        <div>
          <div style={{ fontFamily: "var(--font-serif)", fontSize: 22, fontWeight: 600, color: "var(--text)" }}>
            Ticket Central
          </div>
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
            Market Research → Data Mining
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexShrink: 0, marginTop: 6 }}>
          {isHP && (
            <button
              onClick={handleClearAll}
              style={{
                padding: "7px 14px", fontSize: 12, borderRadius: 7, fontWeight: 500,
                background: "var(--danger, #dc3545)", color: "#fff",
                border: "none", cursor: "pointer", fontFamily: "inherit",
              }}
            >
              ⚠ Clear All Ticket Data
            </button>
          )}
          {canImport && (
            <button
              onClick={() => setImportOpen(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-dim)",
                padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              ↓ Smart Import
            </button>
          )}
          {canCreate && (
            <button
              onClick={() => setCreateOpen(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                background: "var(--accent)", border: "none", color: "#fff",
                padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 500,
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              + New Ticket
            </button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: "flex", gap: 12, padding: "0 28px 16px", flexShrink: 0 }}>
        <StatCard label="Total"            value={stats?.total}            loading={statsLoading} />
        <StatCard label="Draft"            value={stats?.draft}            loading={statsLoading} />
        <StatCard label="MR Submitted"     value={stats?.mr_submitted}     loading={statsLoading} />
        <StatCard label="Completed"        value={stats?.completed}        loading={statsLoading} />
        <StatCard label="Returned"         value={stats?.returned}         loading={statsLoading} />
      </div>

      {/* Status tabs */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 28px 12px", flexShrink: 0 }}>
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
            const isActive = statusFilter === tab.value;
            return (
              <button
                key={tab.value || "all"}
                onClick={() => setStatusFilter(tab.value)}
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
                {tab.label}
                {tab.countKey && stats?.[tab.countKey] != null && (
                  <span style={{ marginLeft: 6, opacity: 0.7, fontFamily: "var(--font-mono)", fontSize: 11 }}>
                    {stats[tab.countKey]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, minHeight: 0, padding: "0 28px 28px" }}>
        <TicketTable
          key={refreshKey}
          statusFilter={statusFilter}
          onChanged={handleChanged}
        />
      </div>

      {createOpen && (
        <CreateTicketModal
          onClose={() => setCreateOpen(false)}
          onSaved={() => { setCreateOpen(false); handleChanged(); }}
        />
      )}

      <SmartImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={() => { setImportOpen(false); handleChanged(); }}
      />
    </div>
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
        {displayValue}
      </div>
    </div>
  );
}
