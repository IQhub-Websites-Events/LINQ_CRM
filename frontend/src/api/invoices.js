import client from "./client";

export const invoicesApi = {
  list: (params) =>
    client.get("invoices/", { params }).then((r) => r.data),

  stats: (period) =>
    client.get("invoices/stats/", { params: { period } }).then((r) => r.data),

  get: (id) =>
    client.get(`invoices/${id}/`).then((r) => r.data),

  pending: (params) =>
    client.get("invoices/pending/", { params }).then((r) => r.data),

  updatePayment: (id, payload) =>
    client.patch(`invoices/${id}/update_payment/`, payload).then((r) => r.data),

  update: (id, payload) =>
    client.patch(`invoices/${id}/`, payload).then((r) => r.data),

  create: (payload) =>
    client.post("invoices/", payload).then((r) => r.data),

  delete: (id) =>
    client.delete(`invoices/${id}/`).then((r) => r.data),

  createFromWebsite: (payload) =>
    client.post("invoices/create_from_website/", payload).then((r) => r.data),

  webhookLogs: (params) =>
    client.get("invoices/webhook_logs/", { params }).then((r) => r.data),
};
