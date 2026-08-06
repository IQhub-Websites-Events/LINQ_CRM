import { Component, useState, useEffect, createContext, useContext } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ToastProvider } from "./contexts/ToastContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LoginPage } from "./pages/LoginPage";
import { BookingsPage } from "./pages/BookingsPage";
import { EventsPage } from "./pages/EventsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { CompaniesPage } from "./pages/CompaniesPage";
import { UsersPage } from "./pages/UsersPage";
import { TeamPage } from "./pages/TeamPage";
import { TeamsManagementPage } from "./pages/TeamsManagementPage";
import { WebhookLogsPage } from "./pages/WebhookLogsPage";
import { GoogleSyncPage }         from "./pages/GoogleSyncPage";
import { EventPerformancePage }   from "./pages/EventPerformancePage";
import { TicketCentralPage }       from "./pages/TicketCentralPage";
import { RolesPage }               from "./pages/RolesPage";
import { NoAccessPage }            from "./pages/NoAccessPage";
import { PaperReviewPage, ProposalSubmissionPage } from "./pages/ComingSoonPage";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { searchApi } from "./api";

const NavItemContext = createContext(null);
const useNavItem = () => useContext(NavItemContext);

// Thin wrappers so navItem (from context) still drives key + prop for the three pages that need it
function BookingsRoute()      { const n = useNavItem(); return <BookingsPage      key={n?.id || "bk"} navItem={n} />; }
function EventsRoute()        { const n = useNavItem(); return <EventsPage        key={n?.id || "ev"} navItem={n} />; }
function TicketCentralRoute() { const n = useNavItem(); return <TicketCentralPage key={n?.id || "tc"} navItem={n} />; }

function AppLayout() {
  const routerNav = useNavigate();
  const { isAuthenticated } = useAuth();
  const [badges, setBadges] = useState({});
  const [navItem, setNavItem] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    const load = () =>
      searchApi.stats().then((s) => setBadges({ pending: s.invoices?.pending || 0 })).catch(() => { });
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  if (!isAuthenticated) return <LoginPage />;

  const handleNav = (s) => { routerNav(`/${s}`); setNavItem(null); };
  const handleSearchNav = (s, id) => { routerNav(`/${s}`); setNavItem(id ? { id } : null); };

  return (
    <NavItemContext.Provider value={navItem}>
      <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
        <Sidebar onNav={handleNav} badges={badges} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <Header onNavigate={handleSearchNav} />
          <main style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
            <Outlet />
          </main>
        </div>
      </div>
    </NavItemContext.Provider>
  );
}

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("App crashed during render", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f8fafc",
          padding: 24,
        }}>
          <div style={{
            width: "100%",
            maxWidth: 560,
            background: "#fff",
            border: "1px solid #fecaca",
            borderRadius: 12,
            padding: 24,
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
          }}>
            <h1 style={{ margin: 0, fontSize: 20, color: "#991b1b" }}>Frontend render error</h1>
            <p style={{ margin: "8px 0 0", color: "#475569", lineHeight: 1.5 }}>
              The app hit a runtime error while rendering. Refresh the page after the latest code changes, and if it still happens this screen will show the exact error instead of a blank page.
            </p>
            <pre style={{
              margin: "16px 0 0",
              padding: 12,
              background: "#f8fafc",
              borderRadius: 8,
              overflowX: "auto",
              color: "#1e293b",
              fontSize: 12,
              whiteSpace: "pre-wrap",
            }}>
              {this.state.error?.message || "Unknown render error"}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function PermissionGate({ module, children }) {
  const { canView, permissionsLoaded } = useAuth();
  if (!permissionsLoaded) return null;
  if (!canView(module)) return <NoAccessPage module={module} />;
  return children;
}

function PermissionDefaultRedirect() {
  const { canView, permissionsLoaded, hasAnyPermission } = useAuth();
  if (!permissionsLoaded) return null;
  if (!hasAnyPermission) return <NoAccessPage />;
  // Navigate to first accessible module
  // The placeholder modules sit last: a user who can see anything real should
  // land on that, not on a Coming Soon page. They are still listed, otherwise
  // a role granted ONLY a placeholder would fall through to No Access despite
  // having a visible sidebar entry.
  const ORDER = ["bookings", "ticket_central", "events", "reports", "performance", "users", "teams", "webhooks", "roles", "paper_review", "proposal_submission"];
  const MODULE_ROUTE = {
    bookings: "bookings", ticket_central: "ticket-central", events: "events",
    reports: "reports", performance: "event-performance", users: "users",
    teams: "teams-management", webhooks: "webhook-logs", roles: "roles",
    paper_review: "paper-review", proposal_submission: "proposal-submission",
  };
  for (const mod of ORDER) {
    if (canView(mod)) return <Navigate to={MODULE_ROUTE[mod]} replace />;
  }
  return <NoAccessPage />;
}

export default function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <Routes>
                <Route path="/" element={<AppLayout />}>
                  <Route index element={<PermissionDefaultRedirect />} />
                  <Route path="bookings"          element={<PermissionGate module="bookings">       <BookingsRoute /></PermissionGate>} />
                  <Route path="events"            element={<PermissionGate module="events">         <EventsRoute /></PermissionGate>} />
                  <Route path="reports"           element={<PermissionGate module="reports">        <ReportsPage /></PermissionGate>} />
                  <Route path="companies"         element={<CompaniesPage />} />
                  <Route path="users"             element={<PermissionGate module="users">          <UsersPage /></PermissionGate>} />
                  <Route path="team"              element={<TeamPage />} />
                  <Route path="teams-management"  element={<PermissionGate module="teams">          <TeamsManagementPage /></PermissionGate>} />
                  <Route path="event-performance" element={<PermissionGate module="performance">    <EventPerformancePage /></PermissionGate>} />
                  <Route path="ticket-central"    element={<PermissionGate module="ticket_central"> <TicketCentralRoute /></PermissionGate>} />
                  <Route path="webhook-logs"      element={<PermissionGate module="webhooks">       <WebhookLogsPage /></PermissionGate>} />
                  <Route path="roles"             element={<PermissionGate module="roles">          <RolesPage /></PermissionGate>} />
                  <Route path="paper-review"        element={<PermissionGate module="paper_review">        <PaperReviewPage /></PermissionGate>} />
                  <Route path="proposal-submission" element={<PermissionGate module="proposal_submission"><ProposalSubmissionPage /></PermissionGate>} />
                  <Route path="*"                 element={<Navigate to="bookings" replace />} />
                </Route>
              </Routes>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </AppErrorBoundary>
  );
}
