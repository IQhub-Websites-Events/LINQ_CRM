/**
 * AuthContext.jsx
 * ───────────────
 * Authentication state + permission matrix.
 * Persists to localStorage for page refresh resilience.
 */
import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { authApi, usersApi } from "../api";
import { markTokenFreshness } from "../api/client";

const AuthContext = createContext(null);

// Mirrors CRM_MODULES in backend/accounts/models.py — keep the two in sync.
const ALL_MODULES = [
  "bookings", "ticket_central", "events", "reports",
  "users", "teams", "performance", "webhooks", "roles",
  "paper_review", "proposal_submission",
];

function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}
function storageRemove(key) {
  try { localStorage.removeItem(key); } catch {}
}

function fullAccess() {
  const m = {};
  ALL_MODULES.forEach(mod => { m[mod] = { view: true, create: true, update: true, delete: true }; });
  return { is_all_access: true, modules: m };
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => storageGet("auth_token"));
  const [user,  setUser]  = useState(() => {
    try { return JSON.parse(storageGet("auth_user") || "null"); } catch { return null; }
  });
  const [permissions,      setPermissions]      = useState(() => {
    try { return JSON.parse(storageGet("auth_perms") || "null"); } catch { return null; }
  });
  const [permissionsLoaded, setPermissionsLoaded] = useState(() => !!storageGet("auth_perms"));

  // Resolve permissions after login.
  // Admin role → full access immediately (no API call, no race risk).
  // Other roles  → fetch from API using axios.
  const _resolvePerms = useCallback(async (role) => {
    if (role === "admin") return fullAccess();
    try {
      const data = await usersApi.myPermissions();
      return data || null;
    } catch {
      return null;
    }
  }, []);

  // Page-refresh path: load permissions for an already-authenticated session.
  const loadPermissions = useCallback(async () => {
    try {
      // Read cached user role to skip API for admin
      let storedUser = null;
      try { storedUser = JSON.parse(storageGet("auth_user") || "null"); } catch {}
      const role = storedUser?.role || "sales";

      const data = role === "admin" ? fullAccess() : await usersApi.myPermissions();
      if (data) {
        setPermissions(data);
        storageSet("auth_perms", JSON.stringify(data));
      }
    } catch {
      // Keep any cached permissions on error
    } finally {
      setPermissionsLoaded(true);
    }
  }, []);

  // Load permissions on mount if authenticated but no cached permissions
  useEffect(() => {
    if (token && !permissionsLoaded) {
      loadPermissions();
    }
  }, [token, permissionsLoaded, loadPermissions]);

  const login = useCallback(async (username, password) => {
    const data = await authApi.login(username, password);
    storageSet("auth_token", data.token);
    markTokenFreshness();                                   // suppress 401 redirect window
    const userInfo = { username, role: data.role || "sales" };
    storageSet("auth_user", JSON.stringify(userInfo));
    // Resolve permissions eagerly — admin gets full access instantly
    const permsData = await _resolvePerms(data.role || "sales");
    if (permsData) storageSet("auth_perms", JSON.stringify(permsData));
    setToken(data.token);
    setUser(userInfo);
    setPermissions(permsData);
    setPermissionsLoaded(true);
    return data;
  }, [_resolvePerms]);

  const loginWithOtp = useCallback(async (email, otp) => {
    const data = await authApi.verifyOtp(email, otp);
    storageSet("auth_token", data.token);
    markTokenFreshness();                                   // suppress 401 redirect window
    const userInfo = {
      username: data.username || data.email,
      email:    data.email,
      role:     data.role || "sales",
      user_id:  data.user_id,
    };
    storageSet("auth_user", JSON.stringify(userInfo));
    // Resolve permissions eagerly — admin gets full access instantly
    const permsData = await _resolvePerms(data.role || "sales");
    if (permsData) storageSet("auth_perms", JSON.stringify(permsData));
    setToken(data.token);
    setUser(userInfo);
    setPermissions(permsData);
    setPermissionsLoaded(true);
    return data;
  }, [_resolvePerms]);

  const logout = useCallback(() => {
    storageRemove("auth_token");
    storageRemove("auth_user");
    storageRemove("auth_perms");
    setToken(null);
    setUser(null);
    setPermissions(null);
    setPermissionsLoaded(false);
  }, []);

  // Permission helpers — default to false if permissions not loaded yet
  const canView   = useCallback((module) => {
    if (!permissions) return false;
    if (permissions.is_all_access) return true;
    return !!permissions.modules?.[module]?.view;
  }, [permissions]);

  const canCreate = useCallback((module) => {
    if (!permissions) return false;
    if (permissions.is_all_access) return true;
    return !!permissions.modules?.[module]?.create;
  }, [permissions]);

  const canUpdate = useCallback((module) => {
    if (!permissions) return false;
    if (permissions.is_all_access) return true;
    return !!permissions.modules?.[module]?.update;
  }, [permissions]);

  const canDelete = useCallback((module) => {
    if (!permissions) return false;
    if (permissions.is_all_access) return true;
    return !!permissions.modules?.[module]?.delete;
  }, [permissions]);

  const hasAnyPermission = permissions
    ? (permissions.is_all_access || Object.values(permissions.modules || {}).some(m => m.view))
    : false;

  const isAdmin = user?.role === "admin";
  const isSales = user?.role === "sales";

  return (
    <AuthContext.Provider value={{
      token, user, login, loginWithOtp, logout,
      isAdmin, isSales,
      isAuthenticated: !!token,
      permissions,
      permissionsLoaded,
      canView, canCreate, canUpdate, canDelete,
      hasAnyPermission,
      reloadPermissions: loadPermissions,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
