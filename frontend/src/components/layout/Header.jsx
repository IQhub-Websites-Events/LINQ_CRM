import { useState, useRef, useEffect } from "react";
import { searchApi } from "../../api";
import { useTheme } from "../../contexts/ThemeContext";

export function Header({ onNavigate }) {
  const { mode, toggle } = useTheme();
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const ref = useRef(null);

  // Search debounce
  useEffect(() => {
    if (q.length < 2) { setResults(null); setOpen(false); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchApi.global(q);
        setResults(data.results);
        setOpen(true);
      } catch { }
      finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  // Close dropdown on outside click
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // ⌘K focus
  useEffect(() => {
    const fn = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        ref.current?.querySelector("input")?.focus();
      }
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, []);



  const jump = (screen, id) => { onNavigate(screen, id); setQ(""); setOpen(false); };

  return (
    <header style={{
      height: 56,
      background: "var(--surface)",
      borderBottom: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      padding: "0 20px",
      gap: 14,
      flexShrink: 0,
      position: "sticky",
      top: 0,
      zIndex: 900,
    }}>

      {/* Search */}
      <div ref={ref} style={{ flex: 1, maxWidth: 480, position: "relative" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--surface-alt)",
          borderRadius: 8,
          padding: "0 10px",
          height: 34,
          border: "1px solid var(--border)",
        }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="var(--text-faint)" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="5.5" cy="5.5" r="4.5" /><path d="M10 10l2 2" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => q.length >= 2 && setOpen(true)}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            placeholder="Search invoice, delegate, company…"
            style={{
              background: "none", border: "none", outline: "none",
              fontSize: 13, color: "var(--text)", width: "100%", fontFamily: "inherit",
            }}
          />
          <kbd style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-faint)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            padding: "2px 5px",
            borderRadius: 4,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}>⌘K</kbd>
        </div>

        {open && results && (
          <div style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0, right: 0,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
            zIndex: 100,
            maxHeight: 400,
            overflowY: "auto",
            animation: "slideUp 0.15s ease-out",
          }}>
            <SearchResults results={results} onJump={jump} loading={loading} />
          </div>
        )}
      </div>

      {/* Right cluster */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>


        {/* Theme toggle */}
        <button
          onClick={toggle}
          title={mode === "light" ? "Switch to dark" : "Switch to light"}
          style={{
            width: 32, height: 32, borderRadius: 7,
            background: "var(--surface-alt)",
            border: "1px solid var(--border)",
            color: "var(--text-dim)",
            cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {mode === "light" ? (
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 14 14">
              <circle cx="7" cy="7" r="3" /><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.9 2.9l1.1 1.1M10 10l1.1 1.1M10 4l1.1-1.1M2.9 11.1L4 10" />
            </svg>
          ) : (
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 14 14">
              <path d="M12 7.8A5 5 0 016.2 2a5 5 0 100 10 5 5 0 005.8-4.2z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  );
}


function SearchResults({ results, onJump, loading }) {
  const { invoices = {}, delegates = {}, events = {} } = results || {};
  if (loading) return <div style={emptyStyle}>Searching…</div>;
  if (!invoices.count && !delegates.count && !events.count) {
    return <div style={emptyStyle}>No results found</div>;
  }
  return (
    <>
      {invoices.count > 0 && (
        <>
          <SRSection>Invoices</SRSection>
          {invoices.items?.map((i) => (
            <SRItem key={i.id} onClick={() => onJump("bookings", i.id)}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, fontWeight: 600, color: "var(--accent)" }}>{i.invoice_number}</span>
              <span style={{ color: "var(--text-faint)", fontSize: 11, marginLeft: 8 }}>{i.company_name} · {i.event_code}</span>
            </SRItem>
          ))}
        </>
      )}
      {delegates.count > 0 && (
        <>
          <SRSection>Delegates</SRSection>
          {delegates.items?.map((d) => (
            <SRItem key={d.id} onClick={() => onJump("bookings", d.invoice_id)}>
              <span style={{ fontWeight: 500, fontSize: 12 }}>{d.full_name}</span>
              <span style={{ color: "var(--text-faint)", fontSize: 11, marginLeft: 8 }}>{d.email}</span>
            </SRItem>
          ))}
        </>
      )}
      {events.count > 0 && (
        <>
          <SRSection>Events</SRSection>
          {events.items?.map((e) => (
            <SRItem key={e.id} onClick={() => onJump("events", e.id)}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, background: "var(--accent-soft)", color: "var(--accent)", padding: "2px 6px", borderRadius: 4 }}>
                {e.event_code}
              </span>
              <span style={{ color: "var(--text)", fontSize: 12, marginLeft: 8 }}>{e.name}</span>
            </SRItem>
          ))}
        </>
      )}
    </>
  );
}

const emptyStyle = { padding: "16px", textAlign: "center", fontSize: 12, color: "var(--text-faint)" };

const SRSection = ({ children }) => (
  <div style={{
    padding: "4px 12px",
    background: "var(--surface-alt)",
    fontSize: 9,
    fontWeight: 600,
    color: "var(--text-faint)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    borderBottom: "1px solid var(--border)",
  }}>{children}</div>
);

const SRItem = ({ children, onClick }) => (
  <button
    onClick={onClick}
    style={{
      width: "100%",
      display: "flex",
      alignItems: "center",
      padding: "8px 12px",
      borderBottom: "1px solid var(--border)",
      cursor: "pointer",
      background: "none",
      border: "none",
      fontFamily: "inherit",
      textAlign: "left",
      transition: "background .1s",
    }}
    onMouseOver={(e) => e.currentTarget.style.background = "var(--surface-alt)"}
    onMouseOut={(e) => e.currentTarget.style.background = "none"}
  >
    {children}
  </button>
);


const primaryBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  background: "var(--accent)",
  border: "none",
  color: "#fff",
  padding: "7px 14px",
  borderRadius: 7,
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};
