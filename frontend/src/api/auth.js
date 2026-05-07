import client from "./client";

export const authApi = {
  login: (username, password) =>
    client.post("auth/token/", { username, password }).then((r) => r.data),

  me: () =>
    client.get("users/me/").then((r) => r.data).catch(() => null),
};
