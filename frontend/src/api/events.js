import client from "./client";

export const eventsApi = {
  list: (params) =>
    client.get("/events/", { params }).then((r) => r.data),

  get: (id) =>
    client.get(`/events/${id}/`).then((r) => r.data),

  getByCode: (code) =>
    client.get("/events/", { params: { event_code: code, page_size: 10 } })
      .then((r) => {
        const results = r.data?.results || [];
        return results.find(ev => ev.event_code === code) || results[0] || null;
      }),

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
