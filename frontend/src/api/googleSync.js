import client from "./client";

export const googleSyncApi = {
  logs:   (params) => client.get("/google-sync/logs/",     { params }).then(r => r.data),
  get:    (id)     => client.get(`/google-sync/logs/${id}/`).then(r => r.data),
  status: ()       => client.get("/google-sync/status/").then(r => r.data),
  run:    (body)   => client.post("/google-sync/run/",     body).then(r => r.data),
  retry:  (id)     => client.post(`/google-sync/retry/${id}/`).then(r => r.data),
};
