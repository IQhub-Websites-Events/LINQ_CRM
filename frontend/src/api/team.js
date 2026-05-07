import client from "./client";

export const teamApi = {
  list: () => client.get("/team/").then(r => r.data),
  get: (id) => client.get(`/team/${id}/`).then(r => r.data),
};
