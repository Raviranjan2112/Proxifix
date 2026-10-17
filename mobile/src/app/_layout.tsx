import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../context/AuthContext";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: "#2563EB",
          },
          headerTintColor: "#FFFFFF",
          headerTitleStyle: {
            fontWeight: "bold",
          },
          contentStyle: {
            backgroundColor: "#F8FAFC",
          },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="login"
          options={{
            title: "Sign In to ProxiFix",
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="register"
          options={{
            title: "Join ProxiFix",
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="worker/[id]"
          options={{
            title: "Worker Profile",
          }}
        />
        <Stack.Screen
          name="book/[id]"
          options={{
            title: "Book Service",
          }}
        />
        <Stack.Screen
          name="worker-portal"
          options={{
            title: "Worker Workspace",
          }}
        />
        <Stack.Screen
          name="admin-portal"
          options={{
            title: "Admin Security Center",
          }}
        />
      </Stack>
    </AuthProvider>
  );
}
