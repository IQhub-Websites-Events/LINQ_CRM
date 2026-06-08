import client from "./client";

export const delegatesApi = {
  list: (params) =>
    client.get("/delegates/", { params }).then((r) => r.data),

  get: (id) =>
    client.get(`/delegates/${id}/`).then((r) => r.data),

  byInvoice: (invoiceNumber) =>
    client.get(`/delegates/by_invoice/${invoiceNumber}/`).then((r) => r.data),

  updateAttendance: (id, attendance) =>
    client.patch(`/delegates/${id}/update_attendance/`, { attendance }).then((r) => r.data),

  update: (id, payload) =>
    client.patch(`/delegates/${id}/`, payload).then((r) => r.data),

  bulkDelete: (ids) =>
    client.post("/delegates/bulk_delete/", { ids }).then((r) => r.data),
};
