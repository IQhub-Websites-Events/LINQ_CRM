/**
 * AuthContext.jsx
 * ───────────────
 * Authentication state: token, user, role.
 * Persists to localStorage for page refresh resilience.
 */
import { createContext, useContext, useState, useCallback } from "react";
import { authApi } from "../api";

const AuthContext = createContext(null);

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

function storageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => storageGet("auth_token"));
  const [user,  setUser]  = useState(() => {
    try { return JSON.parse(storageGet("auth_user") || "null"); }
    catch { return null; }
  });

  const login = useCallback(async (username, password) => {
    const data = await authApi.login(username, password);
    storageSet("auth_token", data.token);
    // Decode user info from token response (DRF token only returns token)
    // We store basic info; full profile fetched separately if needed
    const userInfo = { username, role: data.role || "sales" };
    storageSet("auth_user", JSON.stringify(userInfo));
    setToken(data.token);
    setUser(userInfo);
    return data;
  }, []);

  const logout = useCallback(() => {
    storageRemove("auth_token");
    storageRemove("auth_user");
    setToken(null);
    setUser(null);
  }, []);

  const isAdmin = user?.role === "admin";
  const isSales = user?.role === "sales";

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAdmin, isSales, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
