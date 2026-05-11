import client from "./client";

export const reportsApi = {
  // ── Sheet Sources ──────────────────────────────────────────────────────────
  sources: {
    list:           (params)   => client.get("/reports/sources/", { params }).then(r => r.data),
    get:            (id)       => client.get(`/reports/sources/${id}/`).then(r => r.data),
    create:         (data)     => client.post("/reports/sources/", data).then(r => r.data),
    update:         (id, data) => client.patch(`/reports/sources/${id}/`, data).then(r => r.data),
    delete:         (id)       => client.delete(`/reports/sources/${id}/`).then(r => r.data),
    sync:           (id)       => client.post(`/reports/sources/${id}/sync/`).then(r => r.data),
    syncAll:        ()         => client.post("/reports/sources/sync-all/").then(r => r.data),
    rows:           (id, p)    => client.get(`/reports/sources/${id}/rows/`, { params: p }).then(r => r.data),
    preview:        (id)       => client.get(`/reports/sources/${id}/preview/`).then(r => r.data),
    detectColumns:  (id)       => client.post(`/reports/sources/${id}/detect-columns/`).then(r => r.data),
    listWorksheets: (data)     => client.post("/reports/sources/list-worksheets/", data).then(r => r.data),
  },

  // ── Report Definitions ─────────────────────────────────────────────────────
  definitions: {
    list:   (params)   => client.get("/reports/definitions/", { params }).then(r => r.data),
    get:    (id)       => client.get(`/reports/definitions/${id}/`).then(r => r.data),
    create: (data)     => client.post("/reports/definitions/", data).then(r => r.data),
    update: (id, data) => client.patch(`/reports/definitions/${id}/`, data).then(r => r.data),
    delete: (id)       => client.delete(`/reports/definitions/${id}/`).then(r => r.data),
  },

  // ── Sync Logs ──────────────────────────────────────────────────────────────
  syncLogs: {
    list: (params) => client.get("/reports/sync-logs/", { params }).then(r => r.data),
    get:  (id)     => client.get(`/reports/sync-logs/${id}/`).then(r => r.data),
  },

  // ── Documentation ─────────────────────────────────────────────────────────
  docs: {
    list: ()         => client.get("/reports/docs/").then(r => r.data),
    get:  (filename) => client.get(`/reports/docs/${filename}/`).then(r => r.data),
  },
};
