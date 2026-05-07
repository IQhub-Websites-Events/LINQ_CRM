import client from "./client";

export const teamsApi = {
  list: (params) => client.get("/teams/", { params }).then(r => r.data),
  get: (id) => client.get(`/teams/${id}/`).then(r => r.data),
  create: (data) => client.post("/teams/", data).then(r => r.data),
  update: (id, data) => client.patch(`/teams/${id}/`, data).then(r => r.data),
  delete: (id) => client.delete(`/teams/${id}/`).then(r => r.data),
};
