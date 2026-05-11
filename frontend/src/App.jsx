/**
 * App.jsx
 * ────────
 * Root component. Handles auth routing and the main shell layout.
 */
import { Component, useState, useEffect } from "react";
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
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { searchApi } from "./api";



function AppShell() {
  const { isAuthenticated } = useAuth();
  const [screen, setScreen] = useState("bookings");
  const [badges, setBadges] = useState({});
  const [navItem, setNavItem] = useState(null); // item from global search

  // Load pending count for sidebar badge
  useEffect(() => {
    if (!isAuthenticated) return;
    const load = () =>
      searchApi.stats().then((s) => setBadges({ pending: s.invoices?.pending || 0 })).catch(() => { });
    load();
    const interval = setInterval(load, 60_000); // refresh every minute
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  if (!isAuthenticated) return <LoginPage />;

  const navigate = (s, id) => {
    setScreen(s);
    setNavItem(id ? { id } : null);
  };

  const screenContent = {
    bookings: <BookingsPage key={navItem?.id || "bk"} navItem={navItem} />,
    events: <EventsPage key={navItem?.id || "ev"} navItem={navItem} />,
    reports: <ReportsPage />,
    companies: <CompaniesPage />,
    users: <UsersPage />,
    team: <TeamPage />,
    "teams-management":   <TeamsManagementPage />,
    "event-performance":  <EventPerformancePage />,
    "webhook-logs": <WebhookLogsPage />,
    "google-sync":  <GoogleSyncPage />,
  };

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar current={screen} onNav={(s) => { setScreen(s); setNavItem(null); }} badges={badges} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Header onNavigate={navigate} />
        <main style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
          {screenContent[screen] || <BookingsPage key="bk-fallback" navItem={null} />}
        </main>
      </div>
    </div>
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

export default function App() {


  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <AppShell />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}
