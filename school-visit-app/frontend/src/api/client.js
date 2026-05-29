import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  try {
    const savedUser = localStorage.getItem("schoolVisitUser");
    if (savedUser) {
      const user = JSON.parse(savedUser);
      if (user?.email) config.headers["x-user-email"] = user.email;
      if (user?.credential) config.headers["x-google-credential"] = user.credential;
    }
  } catch {
    localStorage.removeItem("schoolVisitUser");
  }

  return config;
});
