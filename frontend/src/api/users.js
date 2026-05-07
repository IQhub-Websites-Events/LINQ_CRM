import client from "./client";

export const usersApi = {
  list: (params) =>
    client.get("/users/", { params }).then((r) => r.data),

  get: (id) =>
    client.get(`/users/${id}/`).then((r) => r.data),

  create: (payload) =>
    client.post("/users/", payload).then((r) => r.data),

  update: (id, payload) =>
    client.patch(`/users/${id}/`, payload).then((r) => r.data),

  assignEvents: (id, eventIds) =>
    client.post(`/users/${id}/assign_events/`, { event_ids: eventIds }).then((r) => r.data),

  eventsStats: (id) =>
    client.get(`/users/${id}/events_stats/`).then((r) => r.data),

  logs: (id) =>
    client.get(`/users/${id}/logs/`).then((r) => r.data),

  moveTeam: (id, teamId) =>
    client.patch(`/users/${id}/move-team/`, { team_id: teamId }).then((r) => r.data),

  toggleStatus: (id, status) =>
    client.patch(`/users/${id}/toggle-status/`, { status }).then((r) => r.data),

  resetPassword: (id, password, confirmPassword) =>
    client.patch(`/users/${id}/reset-password/`, { password, confirm_password: confirmPassword }).then((r) => r.data),

  delete: (id) =>
    client.delete(`/users/${id}/`).then((r) => r.data),
};
