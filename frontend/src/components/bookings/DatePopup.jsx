import { useState, useEffect, useRef, useCallback } from "react";
import { today } from "../../utils/helpers";

export function DatePopup({ invoice, anchor, onClose, onConfirm }) {
  const [date, setDate]     = useState(today());
  const [saving, setSaving] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const fn = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter")  handleConfirm();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose, handleConfirm]);

  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const handleConfirm = useCallback(async () => {
    setSaving(true);
    try { await onConfirm(date); }
    finally { setSaving(false); }
  }, [onConfirm, date]);

  // Position near the clicked element
  const top  = Math.min((anchor?.bottom || 100) + 6, window.innerHeight - 200);
  const left = Math.min((anchor?.left || 100), window.innerWidth - 290);

  return (
    <div ref={ref} style={{
      position: "fixed", top, left, zIndex: 80,
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
      padding: "14px 16px", boxShadow: "0 8px 30px rgba(0,0,0,.14)", minWidth: 270,
    }}>
      <h4 style={{ margin: "0 0 6px", fontSize: 12.5, fontWeight: 600, color: "#1e293b" }}>
        Confirm payment
      </h4>
      <p style={{ margin: "0 0 12px", fontFamily: "Courier New, monospace", fontSize: 11.5, color: "#475569" }}>
        {invoice?.invoice_number} · {invoice?.company_name}
      </p>
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#94a3b8",
          textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 5 }}>Payment date</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} autoFocus
          style={{ width: "100%", border: "1px solid #e2e8f0", borderRadius: 6,
            padding: "6px 9px", fontSize: 13, fontFamily: "inherit", outline: "none",
            color: "#1e293b" }}
          onFocus={(e) => e.target.style.borderColor = "#94a3b8"}
          onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
        />
      </div>
      <div style={{ display: "flex", gap: 7, justifyContent: "flex-end" }}>
        <button onClick={onClose} style={{ padding: "5px 11px", borderRadius: 7, fontSize: 11.5,
          border: "1px solid #e2e8f0", background: "#fff", color: "#475569", cursor: "pointer" }}>
          Cancel
        </button>
        <button onClick={handleConfirm} disabled={saving} style={{
          padding: "5px 13px", borderRadius: 7, fontSize: 11.5, fontWeight: 500,
          border: "none", background: "#166534", color: "#fff", cursor: "pointer" }}>
          {saving ? "…" : "✓ Confirm paid"}
        </button>
      </div>
      <div style={{ marginTop: 8, fontSize: 10, color: "#94a3b8", textAlign: "center" }}>
        Enter to confirm · ESC to cancel
      </div>
    </div>
  );
}
