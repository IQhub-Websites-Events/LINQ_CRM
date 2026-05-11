import client from "./client";

export const webhooksApi = {
  list:  (params) => client.get("/webhooks/logs/", { params }).then(r => r.data),
  get:   (id)     => client.get(`/webhooks/logs/${id}/`).then(r => r.data),
  retry: (id)     => client.post(`/webhooks/logs/${id}/retry/`).then(r => r.data),

  keys: {
    list:       (params)    => client.get("/webhooks/keys/", { params }).then(r => r.data),
    get:        (id)        => client.get(`/webhooks/keys/${id}/`).then(r => r.data),
    create:     (data)      => client.post("/webhooks/keys/", data).then(r => r.data),
    update:     (id, data)  => client.patch(`/webhooks/keys/${id}/`, data).then(r => r.data),
    delete:     (id)        => client.delete(`/webhooks/keys/${id}/`).then(r => r.data),
    regenerate: (id)        => client.post(`/webhooks/keys/${id}/regenerate/`).then(r => r.data),
    toggle:     (id)        => client.post(`/webhooks/keys/${id}/toggle/`).then(r => r.data),
  },
};
