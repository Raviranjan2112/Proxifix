import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("proxifix_user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  function saveSession(token, loggedInUser) {
    localStorage.setItem("proxifix_token", token);
    localStorage.setItem("proxifix_user", JSON.stringify(loggedInUser));
    setUser(loggedInUser);
  }

  function logout() {
    localStorage.removeItem("proxifix_token");
    localStorage.removeItem("proxifix_user");
    setUser(null);
  }

  async function login(email, password) {
    const response = await api.post("/auth/login", { email, password });

    if (!response.data.success) {
      throw new Error(response.data.message || "Login failed.");
    }

    saveSession(response.data.token, response.data.user);
    return response.data.user;
  }

  async function register(formData) {
    const response = await api.post("/auth/register", formData);

    if (!response.data.success) {
      throw new Error(response.data.message || "Registration failed.");
    }

    saveSession(response.data.token, response.data.user);
    return response.data.user;
  }

  useEffect(() => {
    const token = localStorage.getItem("proxifix_token");

    if (!token) {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}