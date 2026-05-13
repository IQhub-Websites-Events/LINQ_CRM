import client from "./client";

const BASE = "/event-performance";

export const eventPerformanceApi = {
  list:    (params) => client.get(`${BASE}/`,          { params }).then(r => r.data),
  get:     (code)   => client.get(`${BASE}/${code}/`).then(r => r.data),
  summary: ()       => client.get(`${BASE}/summary/`).then(r => r.data),

  // Active-edition view: one row per master event (DDU, WSE, BNZ…)
  activeEditions: (params) =>
    client.get(`${BASE}/active-editions/`, { params }).then(r => r.data),

  // Full history + intelligence for a master event
  masterHistory: (masterCode) =>
    client.get(`${BASE}/${masterCode}/master-history/`).then(r => r.data),

  reps: (code) => client.get(`${BASE}/${code}/reps/`).then(r => r.data),

  followUps: {
    list:   (code)         => client.get(`${BASE}/${code}/follow-ups/`).then(r => r.data),
    create: (code, data)   => client.post(`${BASE}/${code}/follow-ups/`, data).then(r => r.data),
    update: (code, id, data) => client.patch(`${BASE}/${code}/follow-ups/${id}/`, data).then(r => r.data),
    delete: (code, id)     => client.delete(`${BASE}/${code}/follow-ups/${id}/`).then(r => r.data),
  },

  mailshots: {
    list:   (code)           => client.get(`${BASE}/${code}/mailshots/`).then(r => r.data),
    create: (code, data)     => client.post(`${BASE}/${code}/mailshots/`, data).then(r => r.data),
    update: (code, id, data) => client.patch(`${BASE}/${code}/mailshots/${id}/`, data).then(r => r.data),
    delete: (code, id)       => client.delete(`${BASE}/${code}/mailshots/${id}/`).then(r => r.data),
  },

  notes: {
    list:   (code)       => client.get(`${BASE}/${code}/notes/`).then(r => r.data),
    create: (code, data) => client.post(`${BASE}/${code}/notes/`, data).then(r => r.data),
    delete: (code, id)   => client.delete(`${BASE}/${code}/notes/${id}/`).then(r => r.data),
  },
};
