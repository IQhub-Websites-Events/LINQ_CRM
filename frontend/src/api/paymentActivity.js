import client from "./client";

const BASE = "/event-performance/payment-activity";

export const paymentActivityApi = {
  list:     (params)        => client.get(`${BASE}/`,                    { params }).then(r => r.data),
  bookings: (code, params)  => client.get(`${BASE}/${code}/bookings/`,   { params }).then(r => r.data),
};
