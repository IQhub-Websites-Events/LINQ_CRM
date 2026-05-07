import client from "./client";

export const companiesApi = {
  list: (params) =>
    client.get("/companies/", { params }).then((r) => r.data),

  get: (id) =>
    client.get(`/companies/${id}/`).then((r) => r.data),

  delegates: (id) =>
    client.get(`/companies/${id}/delegates/`).then((r) => r.data),
};
