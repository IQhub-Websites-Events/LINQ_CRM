import client from "./client";

export const searchApi = {
  global: (q, type = "all", limit = 20) =>
    client.get("/search/", { params: { q, type, limit } }).then((r) => r.data),

  stats: () =>
    client.get("/stats/dashboard/").then((r) => r.data),
};
