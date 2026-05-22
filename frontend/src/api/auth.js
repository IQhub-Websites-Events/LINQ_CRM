import client from "./client";

export const authApi = {
  login: (username, password) =>
    client.post("auth/token/", { username, password }).then((r) => r.data),

  requestOtp: (email) =>
    client.post("auth/request-otp/", { email }).then((r) => r.data),

  verifyOtp: (email, otp) =>
    client.post("auth/verify-otp/", { email, otp }).then((r) => r.data),

  me: () =>
    client.get("users/me/").then((r) => r.data).catch(() => null),
};
