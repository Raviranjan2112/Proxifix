import React, { createContext, useContext, useState, useEffect } from "react";
import api, {
  getStoredToken,
  setStoredToken,
  clearStoredToken,
  getStoredUser,
  setStoredUser,
} from "../services/api";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: "CUSTOMER" | "WORKER" | "ADMIN";
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  register: (payload: any) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadAuth() {
      try {
        const storedToken = await getStoredToken();
        const storedUser = await getStoredUser();
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(storedUser);
        }
      } catch (err) {
        console.error("Failed to restore auth session:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadAuth();
  }, []);

  async function login(email: string, password: string) {
    try {
      const response = await api.post("/auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });

      if (response.data.success && response.data.token) {
        const receivedToken = response.data.token;
        const receivedUser = response.data.user;

        setToken(receivedToken);
        setUser(receivedUser);

        await setStoredToken(receivedToken);
        await setStoredUser(receivedUser);

        return { success: true };
      }
      return { success: false, message: response.data.message || "Invalid credentials" };
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Login failed. Please check network.";
      return { success: false, message: msg };
    }
  }

  async function register(payload: any) {
    try {
      const response = await api.post("/auth/register", payload);

      if (response.data.success && response.data.token) {
        const receivedToken = response.data.token;
        const receivedUser = response.data.user;

        setToken(receivedToken);
        setUser(receivedUser);

        await setStoredToken(receivedToken);
        await setStoredUser(receivedUser);

        return { success: true };
      }
      return { success: false, message: response.data.message || "Registration failed" };
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Registration failed.";
      return { success: false, message: msg };
    }
  }

  async function logout() {
    setToken(null);
    setUser(null);
    await clearStoredToken();
  }

  async function refreshUser() {
    try {
      const response = await api.get("/auth/me");
      if (response.data.success && response.data.user) {
        setUser(response.data.user);
        await setStoredUser(response.data.user);
      }
    } catch (err) {
      console.warn("Could not refresh current user:", err);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
