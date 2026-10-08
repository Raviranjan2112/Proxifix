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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403 && error.response?.data?.isBlocked) {
      alert(`⚠️ ACCOUNT ACCESS DENIED:\n\n${error.response.data.message}`);
      localStorage.removeItem("proxifix_token");
      localStorage.removeItem("proxifix_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;
