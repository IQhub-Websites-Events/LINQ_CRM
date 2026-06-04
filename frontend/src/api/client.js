import axios from "axios";

const BASE_URL = process.env.REACT_APP_API_URL || "/api/";

const client = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeStorageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

// Attach token on every request
client.interceptors.request.use((config) => {
  const token = safeStorageGet("auth_token");
  if (token) {
    config.headers.Authorization = `Token ${token}`;
  }
  return config;
});

// Mark the moment a token is stored so the interceptor can suppress
// spurious 401s that fire in the first few seconds after login.
export function markTokenFreshness() {
  try { localStorage.setItem("auth_token_set_at", String(Date.now())); } catch {}
}

function tokenIsFreslhySet() {
  try {
    const t = localStorage.getItem("auth_token_set_at");
    return t && (Date.now() - parseInt(t, 10)) < 5000;
  } catch { return false; }
}

// Global error handling — retry on network/503, redirect on 401 (unless token was just set)
client.interceptors.response.use(
  (res) => res,
  async (err) => {
    const config = err.config;
    const status = err.response?.status;
    const isBackendDown = !err.response || status === 503;

    // Retry up to 2 times (1.2s apart) when Django is restarting
    if (isBackendDown && config && !config._retried) {
      config._retried = true;
      for (let i = 0; i < 2; i++) {
        await new Promise(r => setTimeout(r, 1200));
        try { return await client(config); } catch (_) {}
      }
    }

    if (status === 401) {
      // Suppress redirect if the token was just stored (login race window)
      if (tokenIsFreslhySet()) {
        return Promise.reject(err);
      }
      safeStorageRemove("auth_token");
      safeStorageRemove("auth_user");
      safeStorageRemove("auth_perms");
      window.location.replace("/");
    }

    return Promise.reject(err);
  }
);

export default client;
