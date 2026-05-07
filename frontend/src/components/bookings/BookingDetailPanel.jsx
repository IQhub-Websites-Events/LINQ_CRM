import { useEffect } from "react";
import { fmt } from "../../utils/helpers";

export function BookingDetailPanel({ booking, onClose }) {
  useEffect(() => {
    if (!booking) return;
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [booking, onClose]);

  if (!booking) return null;

  return (
    <>
      {/* Overlay / Dimmer */}
      <div 
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.3)",
          zIndex: 1040,
          opacity: 1,
          backdropFilter: "blur(1px)",
          transition: "opacity 0.3s ease",
        }} 
      />

      {/* Sliding Panel */}
      <div 
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "38%", // ~35-40% as requested
          background: "#fff",
          zIndex: 1050,
          boxShadow: "-10px 0 30px rgba(0, 0, 0, 0.1)",
          display: "flex",
          flexDirection: "column",
          transform: "translateX(0)",
          transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          animation: "slideIn 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <style>
          {`
            @keyframes slideIn {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `}
        </style>

        {/* Panel Header */}
        <div 
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid #eee",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            background: "#fff",
            zIndex: 10,
            flexShrink: 0
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h5 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--vz-dark)" }}>
              Booking / {booking.invoice_number}
            </h5>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button 
              className="btn btn-light btn-sm"
              style={{ fontSize: 12, color: "#666", display: "flex", alignItems: "center", gap: 6 }}
              title="Print"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                <rect x="6" y="14" width="12" height="8"></rect>
              </svg>
              Print
            </button>
            <button 
              className="btn btn-light btn-sm"
              style={{ fontSize: 12, color: "#666" }}
              title="Edit"
            >
              Edit
            </button>
            <button 
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                fontSize: 20,
                color: "#999",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginLeft: 10
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Panel Body */}
        <div 
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px",
          }}
        >
          {/* SECTION: PAYMENT INFO */}
          <PanelSection title="Payment Info">
            <DataRow label="Payment Status">
              <StatusBadge status={booking.payment_status} />
            </DataRow>
            <DataRow label="Payment Type" value={booking.payment_type} />
            <DataRow label="Date Paid" value={fmt.date(booking.payment_date)} />
          </PanelSection>

          {/* SECTION: EVENT INFO */}
          <PanelSection title="Event Info">
            <DataRow label="Event Code" value={booking.event_code} />
            <DataRow label="Booking Code" value={booking.booking_code || booking.reference} />
          </PanelSection>

          {/* SECTION: DATES */}
          <PanelSection title="Dates">
            <DataRow label="Request Date" value={fmt.date(booking.created_at)} />
            <DataRow label="Invoice Date" value={fmt.date(booking.invoice_date || booking.created_at)} />
            <DataRow label="Payment Due" value={fmt.date(booking.payment_date)} />
          </PanelSection>

          {/* SECTION: DELEGATE INFO */}
          {(() => {
            const primary = booking.delegates?.[0] || {};
            return (
              <PanelSection title="Delegate Info">
                <DataRow label="Name" value={primary.full_name || booking.contact_name} />
                <DataRow label="Job Title" value={primary.position || "—"} />
                <DataRow label="Email" value={primary.email || booking.contact_email} />
                <DataRow label="Phone" value={primary.phone_number || booking.contact_phone} />
              </PanelSection>
            );
          })()}

          {/* SECTION: COMPANY INFO */}
          <PanelSection title="Company Info">
            <DataRow label="Delegate Company" value={booking.company_name} />
            <DataRow label="Account Company" value={booking.company_name} />
            <DataRow label="Accounts Contact" value={booking.accounts_contact_email || "—"} />
          </PanelSection>
        </div>
      </div>
    </>
  );
}

function PanelSection({ title, children }) {
  return (
    <div style={{ marginBottom: 30 }}>
      <h6 style={{ 
        fontSize: 11, 
        fontWeight: 700, 
        color: "#adb5bd", 
        textTransform: "uppercase", 
        letterSpacing: ".5px",
        marginBottom: 12,
        paddingBottom: 8,
        borderBottom: "1px solid #f3f6f9"
      }}>
        {title}
      </h6>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  );
}

function DataRow({ label, value, children }) {
  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      padding: "10px 0",
      borderBottom: "1px solid #f8fafc"
    }}>
      <div style={{ width: "40%", fontSize: 12, color: "#878a99" }}>
        {label}
      </div>
      <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#495057" }}>
        {children || value || "—"}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = {
    Paid: { bg: "rgba(10, 179, 156, 0.1)", text: "#0ab39c", border: "rgba(10, 179, 156, 0.2)" },
    Pending: { bg: "rgba(247, 184, 75, 0.1)", text: "#f7b84b", border: "rgba(247, 184, 75, 0.2)" },
    Cancelled: { bg: "rgba(240, 101, 72, 0.1)", text: "#f06548", border: "rgba(240, 101, 72, 0.2)" },
  };

  const style = colors[status] || { bg: "#f3f6f9", text: "#878a99", border: "#e9ebec" };

  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: "4px",
      fontSize: "11px",
      fontWeight: 700,
      backgroundColor: style.bg,
      color: style.text,
      border: `1px solid ${style.border}`,
      textTransform: "uppercase"
    }}>
      {status}
    </span>
  );
}
