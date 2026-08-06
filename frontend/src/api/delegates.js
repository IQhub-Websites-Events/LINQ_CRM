import client, { assertIdArray } from "./client";

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

  bulkDelete: (ids) => {
    assertIdArray(ids, "delegatesApi.bulkDelete");
    return client.post("/delegates/bulk_delete/", { ids }).then((r) => r.data);
  },

  // The backend reads KEY PRESENCE, not truthiness: omitting `value` means
  // "not chosen yet" (preview only), while sending it as null means "clear the
  // field". Pass undefined for the former so the key is left out entirely.
  bulkUpdate: (ids, field, value, commit, planHash) => {
    assertIdArray(ids, "delegatesApi.bulkUpdate");
    const body = { ids, field, commit, plan_hash: planHash };
    if (value !== undefined) body.value = value;
    return client.post("/delegates/bulk_update/", body).then((r) => r.data);
  },

  bulkUpdateSchema: () =>
    client.get("/delegates/bulk_update_schema/").then((r) => r.data),

  filterSchema: () =>
    client.get("/delegates/filter_schema/").then((r) => r.data),
};
