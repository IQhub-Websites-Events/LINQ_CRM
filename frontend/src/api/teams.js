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
  assignLead: (id, userIds) => {
    const payload = Array.isArray(userIds) ? { user_ids: userIds } : { user_id: userIds };
    return client.post(`/teams/${id}/assign-lead/`, payload).then(r => r.data);
  },
  archive:    (id)       => client.post(`/teams/${id}/archive/`).then(r => r.data),
  activity:   (id)       => client.get(`/teams/${id}/activity/`).then(r => r.data),
};
