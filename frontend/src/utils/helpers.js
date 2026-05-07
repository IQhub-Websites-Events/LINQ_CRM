/**
 * Utility functions — formatting, validation, data helpers.
 */

export const fmt = {
  currency: (n, currency = "USD") => {
    if (n == null) return "—";
    const amount = Number(n);
    const code = String(currency || "USD").trim().toUpperCase();
    const fallback = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0,
    }).format(Number.isFinite(amount) ? amount : 0);

    if (code === "OTHER" || !/^[A-Z]{3}$/.test(code)) {
      return fallback;
    }

    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: code,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      return fallback;
    }
  },

  date: (d) => {
    if (!d) return "—";
    return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
  },

  dateShort: (d) => {
    if (!d) return "—";
    return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
      day: "2-digit", month: "short",
    });
  },

  dateInput: (d) => {
    if (!d) return "";
    try {
      return new Date(d).toISOString().slice(0, 10);
    } catch {
      return "";
    }
  },

  initials: (name = "") =>
    name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?",

  fullName: (first = "", last = "") => `${first} ${last}`.trim() || "—",
};

export const today = () => new Date().toISOString().slice(0, 10);

export const clsx = (...classes) => classes.filter(Boolean).join(" ");

export const exportToCSV = (rows, headers, filename) => {
  const csv = [headers, ...rows]
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename;
  a.click();
};
