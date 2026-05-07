/**
 * ToastContext.jsx
 * ─────────────────
 * Global toast notification system.
 * Usage: const toast = useToast(); toast.success("Payment updated");
 */
import { createContext, useContext, useState, useCallback, useMemo } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const add = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const toast = useMemo(() => ({
    success: (msg) => add(msg, "success"),
    error:   (msg) => add(msg, "error"),
    warn:    (msg) => add(msg, "warn"),
    info:    (msg) => add(msg, "info"),
  }), [add]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: "fixed", bottom: 20, left: "50%",
      transform: "translateX(-50%)", zIndex: 999,
      display: "flex", flexDirection: "column", gap: 8, alignItems: "center",
      pointerEvents: "none",
    }}>
      {toasts.map((t) => {
        const bg = { success: "#166534", error: "#991b1b", warn: "#854d0e", info: "#1e293b" }[t.type] || "#1e293b";
        return (
          <div key={t.id} style={{
            background: bg, color: "#fff", padding: "9px 16px", borderRadius: 9,
            fontSize: 12.5, fontWeight: 500, display: "flex", alignItems: "center",
            gap: 8, boxShadow: "0 4px 20px rgba(0,0,0,.25)", whiteSpace: "nowrap",
            animation: "slideUp .22s ease",
          }}>
            {t.type === "success" && (
              <span style={{ width: 14, height: 14, borderRadius: "50%", background: "#22c55e",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                ✓
              </span>
            )}
            {t.message}
          </div>
        );
      })}
    </div>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be inside ToastProvider");
  return ctx;
};
