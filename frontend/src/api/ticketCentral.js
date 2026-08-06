import client, { assertIdArray } from "./client";

export const ticketCentralApi = {
  list:       (params)     => client.get("tickets/", { params }).then((r) => r.data),
  get:        (id)         => client.get(`tickets/${id}/`).then((r) => r.data),
  create:     (data)       => client.post("tickets/", data).then((r) => r.data),
  update:     (id, data)   => client.patch(`tickets/${id}/`, data).then((r) => r.data),
  submitMR:   (id)         => client.post(`tickets/${id}/submit_mr/`).then((r) => r.data),
  submitDMD:  (id)         => client.post(`tickets/${id}/submit_dmd/`).then((r) => r.data),
  returnToMR: (id, reason) => client.post(`tickets/${id}/return_to_mr/`, { reason }).then((r) => r.data),
  stats:      ()           => client.get("tickets/stats/").then((r) => r.data),
  bulkImport: (payload)    => client.post("tickets/bulk_import/", payload).then((r) => r.data),
  delete:     (id)         => client.delete(`tickets/${id}/`).then((r) => r.data),
  bulkDelete: (ids)        => {
    assertIdArray(ids, "ticketCentralApi.bulkDelete");
    return client.post("tickets/bulk_delete/", { ids }).then((r) => r.data);
  },

  // Omit `value` entirely when undefined — the backend reads KEY PRESENCE, so an
  // always-sent value would make a preview fail validation.
  bulkUpdate: (ids, field, value, commit, planHash) => {
    assertIdArray(ids, "ticketCentralApi.bulkUpdate");
    const body = { ids, field, commit, plan_hash: planHash };
    if (value !== undefined) body.value = value;
    return client.post("tickets/bulk_update/", body).then((r) => r.data);
  },
  bulkUpdateSchema: ()     => client.get("tickets/bulk_update_schema/").then((r) => r.data),
  filterSchema:     ()     => client.get("tickets/filter_schema/").then((r) => r.data),
  clearAll:   ()           => client.post("tickets/clear_all/").then((r) => r.data),
};
