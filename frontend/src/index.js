import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

const rootElement = document.getElementById("root");

function showFatalScreen(title, detail = "") {
  if (!rootElement) return;
  rootElement.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;padding:24px;font-family:system-ui,-apple-system,sans-serif;">
      <div style="width:100%;max-width:640px;background:#fff;border:1px solid #fecaca;border-radius:12px;padding:24px;box-shadow:0 10px 30px rgba(15,23,42,.08);">
        <h1 style="margin:0;font-size:20px;color:#991b1b;">${title}</h1>
        <pre style="margin:16px 0 0;padding:12px;background:#f8fafc;border-radius:8px;overflow:auto;color:#1e293b;font-size:12px;white-space:pre-wrap;">${String(detail || "No extra error details available.")}</pre>
      </div>
    </div>
  `;
}

if (!rootElement) {
  throw new Error("React root element #root was not found in index.html");
}

let reactMounted = false;

window.addEventListener("error", (event) => {
  if (!reactMounted) {
    showFatalScreen("Frontend bootstrap error", event.error?.stack || event.message);
  }
});

window.addEventListener("unhandledrejection", (event) => {
  if (!reactMounted) {
    const reason = event.reason;
    showFatalScreen(
      "Unhandled promise rejection",
      reason?.stack || reason?.message || String(reason)
    );
  }
});

// React will clear the root element and render the app.

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<React.StrictMode><App /></React.StrictMode>);
  reactMounted = true;
} catch (error) {
  showFatalScreen("React failed to start", error?.stack || error?.message || error);
}
