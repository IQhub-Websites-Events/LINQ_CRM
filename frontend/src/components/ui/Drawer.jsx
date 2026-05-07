import { useEffect } from "react";

export function Drawer({ open, onClose, title, subtitle, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [open, onClose]);

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.4)",
        zIndex: 1040, display: open ? "block" : "none",
        backdropFilter: "blur(2px)",
        transition: "all .3s ease"
      }} />
      {/* Panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 450,
        background: "#fff", 
        display: "flex", flexDirection: "column", zIndex: 1050,
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform .3s ease-in-out",
        boxShadow: "-5px 0 20px rgba(0,0,0,.1)",
      }}>
        {/* Header */}
        <div style={{ padding: "1.25rem", borderBottom: "1px solid #e9ebec",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h5 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#495057" }}>
              {title}
            </h5>
            {subtitle && <div style={{ fontSize: 13, color: "#878a99", marginTop: 4 }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{
            width: 32, height: 32, borderRadius: "50%", border: "none",
            background: "#f3f3f9", cursor: "pointer", fontSize: 16, color: "#878a99",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>
        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>{children}</div>
        {/* Footer */}
        {footer && (
          <div style={{ padding: "1.25rem", borderTop: "1px solid #e9ebec",
            background: "#fff", flexShrink: 0 }}>
            {footer}
          </div>
        )}
      </div>
    </>
  );
}

