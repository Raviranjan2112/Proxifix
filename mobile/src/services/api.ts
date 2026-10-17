import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { Platform, Alert } from "react-native";

// Live Production Render Backend API URL
export const API_BASE_URL = "https://proxifix-api.onrender.com/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 15000,
});

// Helper for cross-platform secure token access
export async function getStoredToken(): Promise<string | null> {
  try {
    if (Platform.OS === "web") {
      return typeof localStorage !== "undefined" ? localStorage.getItem("proxifix_token") : null;
    }
    return await SecureStore.getItemAsync("proxifix_token");
  } catch {
    return null;
  }
}

export async function setStoredToken(token: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") localStorage.setItem("proxifix_token", token);
    } else {
      await SecureStore.setItemAsync("proxifix_token", token);
    }
  } catch (e) {
    console.error("Failed to persist auth token:", e);
  }
}

export async function clearStoredToken(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("proxifix_token");
        localStorage.removeItem("proxifix_user");
      }
    } else {
      await SecureStore.deleteItemAsync("proxifix_token");
      await SecureStore.deleteItemAsync("proxifix_user");
    }
  } catch (e) {
    console.error("Failed to clear auth storage:", e);
  }
}

export async function getStoredUser(): Promise<any | null> {
  try {
    let raw: string | null = null;
    if (Platform.OS === "web") {
      raw = typeof localStorage !== "undefined" ? localStorage.getItem("proxifix_user") : null;
    } else {
      raw = await SecureStore.getItemAsync("proxifix_user");
    }
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function setStoredUser(user: any): Promise<void> {
  try {
    const raw = JSON.stringify(user);
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") localStorage.setItem("proxifix_user", raw);
    } else {
      await SecureStore.setItemAsync("proxifix_user", raw);
    }
  } catch (e) {
    console.error("Failed to persist user object:", e);
  }
}

// Request Interceptor: Attach JWT bearer token
api.interceptors.request.use(async (config) => {
  const token = await getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response Interceptor: Catch blocks or 401s
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 403 && error.response?.data?.isBlocked) {
      Alert.alert(
        "Account Suspended",
        error.response?.data?.message || "This account has been permanently blocked by the security administrator due to unusual activity."
      );
      await clearStoredToken();
    }
    return Promise.reject(error);
  }
);

export default api;
