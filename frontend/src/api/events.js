import client from "./client";

export const eventsApi = {
  list: (params) =>
    client.get("/events/", { params }).then((r) => r.data),

  get: (id) =>
    client.get(`/events/${id}/`).then((r) => r.data),

  stats: (id) =>
    client.get(`/events/${id}/stats/`).then((r) => r.data),

  create: (payload) =>
    client.post("/events/", payload).then((r) => r.data),

  update: (id, payload) =>
    client.patch(`/events/${id}/`, payload).then((r) => r.data),

  delete: (id) =>
    client.delete(`/events/${id}/`).then((r) => r.data),
};
