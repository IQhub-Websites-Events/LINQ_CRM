import { useAuth } from "../../contexts/AuthContext";

const Svg = ({ size = 14, children }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none"
    stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);

const ReceiptIcon = () => <Svg><path d="M2 1h10a1 1 0 011 1v11l-2-1-2 1-2-1-2 1-2-1V2a1 1 0 011-1z" /><path d="M4 5h6M4 8h4" /></Svg>;
const CalendarIcon = () => <Svg><rect x="1" y="2" width="12" height="11" rx="1.5" /><path d="M9 1v3M5 1v3M1 6h12" /></Svg>;
const BuildingIcon = () => <Svg><path d="M2 13V4a1 1 0 011-1h8a1 1 0 011 1v9M2 13h10M2 13H1M12 13h1" /><path d="M5 7h1M8 7h1M5 10h1M8 10h1" /></Svg>;
const ChartIcon = () => <Svg><rect x="1" y="8" width="3" height="5" /><rect x="5.5" y="5" width="3" height="8" /><rect x="10" y="2" width="3" height="11" /></Svg>;
const UsersIcon = () => <Svg><path d="M9 12v-1a3 3 0 00-3-3H4a3 3 0 00-3 3v1" /><circle cx="5.5" cy="4" r="2.5" /><path d="M12 12v-1a3 3 0 00-2-2.5M9.5 1.5a2.5 2.5 0 010 5" /></Svg>;
const WebhookIcon = () => <Svg><path d="M2 7c0-2.8 2.2-5 5-5s5 2.2 5 5-2.2 5-5 5" /><path d="M7 7l-2 4h4l-2 4" /></Svg>;

const NAV = [
  {
    section: "Pipeline",
    items: [
      { id: "bookings", label: "Bookings", Icon: ReceiptIcon },
    ],
  },
  {
    section: "Catalogue",
    items: [
      { id: "events", label: "Events", Icon: CalendarIcon },
    ],
  },
  {
    section: "Insights",
    items: [
      { id: "reports", label: "Reports", Icon: ChartIcon },
    ],
  },
];

const ADMIN_NAV = [
  { id: "users", label: "Users", Icon: UsersIcon },
  { id: "teams-management", label: "Teams", Icon: UsersIcon },
  { id: "webhook-logs", label: "Webhooks", Icon: WebhookIcon },
];

const sectionLabel = {
  fontSize: 9,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "var(--sidebar-dim)",
  padding: "0 10px 6px",
};

export function Sidebar({ current, onNav, badges = {} }) {
  const { user, logout, isAdmin } = useAuth();

  return (
    <aside style={{
      width: 232,
      background: "var(--sidebar-bg)",
      display: "flex",
      flexDirection: "column",
      flexShrink: 0,
    }}>
      {/* Brand block */}
      <div style={{ padding: "20px 14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
        {/* Logo tile */}
        <div style={{
          width: 26, height: 26, borderRadius: 6, flexShrink: 0,
          background: "linear-gradient(135deg,#34d399 0%,#0d7a4f 100%)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "#fff", fontSize: 15, lineHeight: 1 }}>L</span>
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--sidebar-text)", fontSize: 18, lineHeight: 1 }}>
            Linq
          </div>
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--sidebar-dim)", marginTop: 1 }}>
            CRM Workspace
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "4px 0", overflowY: "auto" }}>
        {NAV.map(({ section, items }) => (
          <div key={section} style={{ marginBottom: 18 }}>
            <div style={sectionLabel}>{section}</div>
            {items.map((item) => (
              <NavItem key={item.id} item={item} active={current === item.id}
                badge={item.badgeKey ? badges[item.badgeKey] : null}
                onClick={() => onNav(item.id)} />
            ))}
          </div>
        ))}

        {isAdmin && (
          <div style={{ marginBottom: 18 }}>
            <div style={sectionLabel}>Admin</div>
            {ADMIN_NAV.map((item) => (
              <NavItem key={item.id} item={item} active={current === item.id}
                onClick={() => onNav(item.id)} />
            ))}
          </div>
        )}
      </nav>

      {/* User footer */}
      <div style={{
        padding: "14px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: "50%",
          background: "rgba(255,255,255,0.1)",
          color: "var(--sidebar-text)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 600, flexShrink: 0,
        }}>
          {(user?.username || "U")[0].toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "var(--sidebar-text)", fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user?.username}
          </div>
          <div style={{ color: "var(--sidebar-dim)", fontSize: 10, textTransform: "capitalize" }}>
            {user?.role}
          </div>
        </div>
        <button onClick={logout} title="Logout" style={{
          background: "none", border: "none", color: "var(--sidebar-dim)",
          cursor: "pointer", padding: 4, display: "flex",
        }}>
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
    <button
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "7px 10px",
        color: active ? "#ffffff" : "var(--sidebar-dim)",
        background: active ? "rgba(52,211,153,0.18)" : "transparent",
        fontSize: 13,
        fontWeight: active ? 500 : 400,
        border: "none",
        borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
        borderRadius: "0 7px 7px 0",
        cursor: "pointer",
        fontFamily: "inherit",
        textAlign: "left",
        transition: "all .15s ease",
        marginBottom: 1,
      }}
    >
      <span style={{ color: active ? "var(--accent)" : "inherit", display: "flex", flexShrink: 0 }}>
        <Icon />
      </span>
      <span style={{ flex: 1 }}>{item.label}</span>
      {badge != null && (
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          padding: "1px 5px",
          borderRadius: 4,
          background: active ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.08)",
          color: active ? "var(--accent)" : "var(--sidebar-dim)",
        }}>
          {badge}
        </span>
      )}
    </button>
  );
}
