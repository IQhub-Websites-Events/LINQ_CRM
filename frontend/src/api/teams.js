import client from "./client";

export const teamsApi = {
  list:       (params)   => client.get("/teams/", { params }).then(r => r.data),
  get:        (id)       => client.get(`/teams/${id}/`).then(r => r.data),
  create:     (data)     => client.post("/teams/", data).then(r => r.data),
  update:     (id, data) => client.patch(`/teams/${id}/`, data).then(r => r.data),
  delete:     (id)       => client.delete(`/teams/${id}/`).then(r => r.data),

  moveMember: (data)     => client.post("/teams/move-member/", data).then(r => r.data),
  bulkMove:   (id, destId) =>
    client.post(`/teams/${id}/bulk-move/`, { destination_team_id: destId }).then(r => r.data),
  assignLead: (id, userId) =>
    client.post(`/teams/${id}/assign-lead/`, { user_id: userId }).then(r => r.data),
  archive:    (id)       => client.post(`/teams/${id}/archive/`).then(r => r.data),
  activity:   (id)       => client.get(`/teams/${id}/activity/`).then(r => r.data),
};
