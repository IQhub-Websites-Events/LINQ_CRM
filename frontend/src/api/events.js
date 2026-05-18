import client from "./client";

export const eventsApi = {
  list: (params) =>
    client.get("/events/", { params }).then((r) => r.data),

  get: (id) =>
    client.get(`/events/${id}/`).then((r) => r.data),

  getByCode: (code) => {
    if (!code) return Promise.resolve(null);

    /**
     * Parse a booking event_code into { base, year }.
     *
     * Examples:
     *   "ACU - RS26"    → { base: "ACU", year: 2026 }
     *   "ACU25"         → { base: "ACU", year: 2025 }
     *   "MMU/GS - JS26" → { base: "MMU", year: 2026 }
     *   "BIC - PM"      → { base: "BIC", year: null }
     *   "BIC26"         → { base: "BIC", year: 2026 }
     *
     * Base = first contiguous run of 2–4 letters at the very start
     * Year = trailing 2-or-4 digit number (2-digit expands to 20XX)
     */
    const parseCode = (c) => {
      const baseMatch = c.match(/^([A-Za-z]{2,4})/);
      const base = baseMatch ? baseMatch[1].toUpperCase() : null;
      const yearMatch = c.match(/(\d{2,4})$/);
      let year = null;
      if (yearMatch) {
        const raw = yearMatch[1];
        year = raw.length === 2 ? 2000 + parseInt(raw, 10) : parseInt(raw, 10);
      }
      return { base, year };
    };

    const { base, year } = parseCode(code);
    if (!base) return Promise.resolve(null);

    // Strip trailing year digits for a base-code-only fallback
    // e.g. "BIC - PM26" → "BIC - PM"
    const stripYear = (c) => c.replace(/\s*\d{2,4}$/, "").trim();
    const baseCode = stripYear(code);

    /**
     * Fetch /events/ with given params, pick best match:
     * prefer an event whose code STARTS WITH `base` (case-insensitive).
     */
    const fetchBest = (params) =>
      client
        .get("/events/", { params: { ...params, page_size: 20 } })
        .then((r) => {
          const results = r.data?.results || [];
          return (
            results.find((ev) =>
              ev.event_code.toUpperCase().startsWith(base)
            ) ||
            results[0] ||
            null
          );
        })
        .catch(() => null);

    /**
     * Strategy list (tried in order, stops at first non-null result):
     *  1. base + year  → most precise   e.g. { event_code: "ACU", year: 2026 }
     *  2. baseCode     → stripped code  e.g. { event_code: "ACU - RS" }
     *  3. base only    → broadest       e.g. { event_code: "ACU" }
     */
    const strategies = [];
    if (year) strategies.push({ event_code: base, year });
    if (baseCode && baseCode !== code && baseCode !== base)
      strategies.push({ event_code: baseCode });
    strategies.push({ event_code: base });

    const tryNext = (idx) => {
      if (idx >= strategies.length) return Promise.resolve(null);
      return fetchBest(strategies[idx]).then((r) => r || tryNext(idx + 1));
    };

    return tryNext(0);
  },

  years: () =>
    client.get("/events/years/").then((r) => r.data),

  stats: (id) =>
    client.get(`/events/${id}/stats/`).then((r) => r.data),

  create: (payload) =>
    client.post("/events/", payload).then((r) => r.data),

  update: (id, payload) =>
    client.patch(`/events/${id}/`, payload).then((r) => r.data),

  delete: (id) =>
    client.delete(`/events/${id}/`).then((r) => r.data),

  bulkImport: (payload) =>
    client.post("/events/bulk_import/", payload).then((r) => r.data),

  clearAll: () =>
    client.delete("/events/clear_all/").then((r) => r.data),
};

export const historicalEventsApi = {
  getByEvent: (eventId) =>
    client
      .get("/historical-events/", { params: { event_id: eventId } })
      .then((r) => r.data),

  getByCode: (eventCode) =>
    client
      .get("/historical-events/", { params: { event_code: eventCode } })
      .then((r) => r.data),

  getEditions: (eventId) =>
    client
      .get(`/events/${eventId}/historical_editions/`)
      .then((r) => r.data),
};

export const editionBookingsApi = {
  getSummary: (eventId) =>
    client.get(`/events/${eventId}/edition_bookings/`).then((r) => r.data),

  getForYear: (eventId, year) =>
    client
      .get(`/events/${eventId}/edition_bookings/`, { params: { year } })
      .then((r) => r.data),
};

export const editionGrowthApi = {
  // Full YoY growth for one event (with validation)
  getForEvent: (eventId) =>
    client.get(`/events/${eventId}/edition_growth/`).then((r) => r.data),

  // YoY growth for all events — used in the Reports Growth table
  getAll: () =>
    client.get("/events/all_edition_growth/").then((r) => r.data),
};
