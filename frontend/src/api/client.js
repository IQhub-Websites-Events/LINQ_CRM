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

// Global error handling — retry on network/503, redirect (never reload) on 401
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
      safeStorageRemove("auth_token");
      safeStorageRemove("auth_user");
      window.location.replace("/");
    }

    return Promise.reject(err);
  }
);

export default client;
