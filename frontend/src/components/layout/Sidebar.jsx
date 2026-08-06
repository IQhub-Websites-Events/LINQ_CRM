import { useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const Svg = ({ size = 14, children }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none"
    stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const ReceiptIcon  = () => <Svg><path d="M2 1h10a1 1 0 011 1v11l-2-1-2 1-2-1-2 1-2-1V2a1 1 0 011-1z" /><path d="M4 5h6M4 8h4" /></Svg>;
const CalendarIcon = () => <Svg><rect x="1" y="2" width="12" height="11" rx="1.5" /><path d="M9 1v3M5 1v3M1 6h12" /></Svg>;
const ChartIcon    = () => <Svg><rect x="1" y="8" width="3" height="5" /><rect x="5.5" y="5" width="3" height="8" /><rect x="10" y="2" width="3" height="11" /></Svg>;
const UsersIcon    = () => <Svg><path d="M9 12v-1a3 3 0 00-3-3H4a3 3 0 00-3 3v1" /><circle cx="5.5" cy="4" r="2.5" /><path d="M12 12v-1a3 3 0 00-2-2.5M9.5 1.5a2.5 2.5 0 010 5" /></Svg>;
const WebhookIcon  = () => <Svg><path d="M2 7c0-2.8 2.2-5 5-5s5 2.2 5 5-2.2 5-5 5" /><path d="M7 7l-2 4h4l-2 4" /></Svg>;
const TicketIcon   = () => <Svg><path d="M1 4.5A1.5 1.5 0 012.5 3h9A1.5 1.5 0 0113 4.5V6a1 1 0 000 2v1.5A1.5 1.5 0 0111.5 11h-9A1.5 1.5 0 011 9.5V8a1 1 0 000-2V4.5z" /><path d="M6 3v8" strokeDasharray="1.4 1.4" /></Svg>;
const ShieldIcon   = () => <Svg><path d="M7 1L2 3v4c0 3.3 2.2 6.3 5 7 2.8-.7 5-3.7 5-7V3L7 1z" /></Svg>;
const PaperIcon    = () => <Svg><path d="M8 1H3.5A1.5 1.5 0 002 2.5v9A1.5 1.5 0 003.5 13h7a1.5 1.5 0 001.5-1.5V5L8 1z" /><path d="M8 1v4h4M4.5 8h5M4.5 10.5h3" /></Svg>;
const SubmitIcon   = () => <Svg><path d="M7 1.5v6M4.5 4L7 1.5 9.5 4" /><path d="M1.5 8.5v3A1.5 1.5 0 003 13h8a1.5 1.5 0 001.5-1.5v-3" /></Svg>;

// module key → nav item id (route)
const MODULE_TO_NAV = {
  bookings:       { id: "bookings",          label: "Bookings",    Icon: ReceiptIcon  },
  ticket_central: { id: "ticket-central",    label: "Ticket Central", Icon: TicketIcon },
  events:         { id: "events",            label: "Events",      Icon: CalendarIcon },
  reports:        { id: "reports",           label: "Dashboard",   Icon: ChartIcon    },
  performance:    { id: "event-performance", label: "Performance", Icon: CalendarIcon },
  users:          { id: "users",             label: "Users",       Icon: UsersIcon    },
  roles:          { id: "roles",             label: "Roles",       Icon: ShieldIcon   },
  teams:          { id: "teams-management",  label: "Teams",       Icon: UsersIcon    },
  webhooks:       { id: "webhook-logs",      label: "Webhooks",    Icon: WebhookIcon  },
  paper_review:        { id: "paper-review",        label: "Paper Review",        Icon: PaperIcon  },
  proposal_submission: { id: "proposal-submission", label: "Proposal Submission", Icon: SubmitIcon },
};

// Ordered module groups for the sidebar
const PIPELINE_MODULES   = ["bookings", "ticket_central", "paper_review", "proposal_submission"];
const CATALOGUE_MODULES  = ["events"];
const INSIGHTS_MODULES   = ["reports"];
const ADMIN_MODULES      = ["performance", "users", "roles", "teams", "webhooks"];

const sectionLabel = {
  fontSize: 9, fontWeight: 600, textTransform: "uppercase",
  letterSpacing: "0.1em", color: "var(--sidebar-dim)", padding: "0 10px 6px",
};

export function Sidebar({ onNav, badges = {} }) {
  const { user, logout, canView, permissionsLoaded } = useAuth();
  const location = useLocation();
  const activeId = location.pathname.slice(1);

  const renderSection = (label, modules) => {
    const visible = modules.filter(m => canView(m));
    if (visible.length === 0) return null;
    return (
      <div key={label} style={{ marginBottom: 18 }}>
        <div style={sectionLabel}>{label}</div>
        {visible.map(m => {
          const item = MODULE_TO_NAV[m];
          return (
            <NavItem key={item.id} item={item} active={activeId === item.id}
              badge={item.id === "bookings" ? (badges.pending || null) : null}
              onClick={() => onNav(item.id)} />
          );
        })}
      </div>
    );
  };

  if (!permissionsLoaded) {
    return (
      <aside style={{ width: 232, background: "var(--sidebar-bg)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "20px 14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="/favicon.png" alt="Logo" style={{ width: "100%", height: "100%" }} />
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-serif)", color: "var(--sidebar-text)", fontSize: 18, fontWeight: 600, lineHeight: 1 }}>IQ-Hub</div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--sidebar-dim)", marginTop: 1 }}>CRM Workspace</div>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.15)", borderTopColor: "var(--accent)", animation: "spin 1s linear infinite" }} />
        </div>
      </aside>
    );
  }

  return (
    <aside style={{ width: 232, background: "var(--sidebar-bg)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      {/* Brand block */}
      <div style={{ padding: "20px 14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src="/favicon.png" alt="Logo" style={{ width: "100%", height: "100%" }} />
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-serif)", color: "var(--sidebar-text)", fontSize: 18, fontWeight: 600, lineHeight: 1 }}>IQ-Hub</div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--sidebar-dim)", marginTop: 1 }}>CRM Workspace</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "4px 0", overflowY: "auto" }}>
        {renderSection("Pipeline",  PIPELINE_MODULES)}
        {renderSection("Catalogue", CATALOGUE_MODULES)}
        {renderSection("Insights",  INSIGHTS_MODULES)}
        {renderSection("Admin",     ADMIN_MODULES)}
      </nav>

      {/* User footer */}
      <div style={{ padding: "14px", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.1)", color: "var(--sidebar-text)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
          {(user?.username || "U")[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "var(--sidebar-text)", fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user?.username}</div>
          <div style={{ color: "var(--sidebar-dim)", fontSize: 10, textTransform: "capitalize" }}>{user?.role?.replace(/_/g, " ")}</div>
        </div>
        <button onClick={logout} title="Logout" style={{ background: "none", border: "none", color: "var(--sidebar-dim)", cursor: "pointer", padding: 4, display: "flex" }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 16 16">
            <path d="M10 14H3a1 1 0 01-1-1V3a1 1 0 011-1h7M11 11l3-3-3-3M14 8H6" />
          </svg>
        </button>
      </div>
    </aside>
  );
}

function NavItem({ item, active, badge, onClick }) {
  const { Icon } = item;
  return (
    <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", color: active ? "#ffffff" : "var(--sidebar-dim)", background: active ? "rgba(52,211,153,0.18)" : "transparent", fontSize: 13, fontWeight: active ? 500 : 400, border: "none", borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent", borderRadius: "0 7px 7px 0", cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all .15s ease", marginBottom: 1 }}>
      <span style={{ color: active ? "var(--accent)" : "inherit", display: "flex", flexShrink: 0 }}><Icon /></span>
      <span style={{ flex: 1 }}>{item.label}</span>
      {badge != null && badge > 0 && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "1px 5px", borderRadius: 4, background: active ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.08)", color: active ? "var(--accent)" : "var(--sidebar-dim)" }}>{badge}</span>
      )}
    </button>
  );
}
