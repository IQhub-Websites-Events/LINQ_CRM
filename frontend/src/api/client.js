/**
 * api/client.js
 * ─────────────
 * Axios instance with token auth, automatic 401 redirect,
 * and request/response interceptors.
 */
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

// Global error handling
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      safeStorageRemove("auth_token");
      safeStorageRemove("auth_user");
      if (window.location.pathname !== "/") {
        window.location.replace("/");
      } else {
        window.location.reload();
      }
    }
    return Promise.reject(err);
  }
);

export default client;
