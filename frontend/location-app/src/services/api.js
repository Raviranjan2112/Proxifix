import axios from "axios";

const api = axios.create({
  // Use one origin in production so Cloudflare Tunnel can expose the app and
  // API through a single public hostname. Vite proxies this path in local dev.
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("proxifix_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
