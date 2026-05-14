import { useEffect } from "react";
import { Button } from "./Button";

export function Modal({ open, onClose, title, children, footer, width = 520 }) {
  useEffect(() => {
    if (!open) return;
    const fn = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.35)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: "60px 16px", zIndex: 100,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border)",
        width, maxWidth: "95vw", maxHeight: "88vh",
        display: "flex", flexDirection: "column",
        boxShadow: "0 20px 60px rgba(0,0,0,.25)",
      }}>
        <div style={{ padding: "15px 18px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--text)", letterSpacing: "-.2px" }}>
            {title}
          </h3>
          <button onClick={onClose} style={{
            width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border)",
            background: "var(--surface-alt)", cursor: "pointer", fontSize: 14, color: "var(--text-dim)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px" }}>{children}</div>
        {footer && (
          <div style={{ padding: "11px 18px", borderTop: "1px solid var(--border)",
            display: "flex", justifyContent: "flex-end", gap: 7,
            background: "var(--surface-alt)", borderRadius: "0 0 12px 12px", flexShrink: 0 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
