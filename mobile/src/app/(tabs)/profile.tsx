import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out of ProxiFix?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  if (!user) {
    return (
      <View style={styles.guestContainer}>
        <View style={styles.guestAvatar}>
          <Ionicons name="person" size={48} color="#94A3B8" />
        </View>
        <Text style={styles.guestTitle}>Welcome to ProxiFix</Text>
        <Text style={styles.guestSubtitle}>
          Sign in or create an account to book verified local workers, track bookings, or manage your service provider profile.
        </Text>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.primaryBtnText}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push("/register")}
        >
          <Text style={styles.secondaryBtnText}>Create New Account</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user.name ? user.name[0].toUpperCase() : "U"}
          </Text>
        </View>
        <View style={styles.infoCol}>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
          {user.phone && <Text style={styles.userPhone}>{user.phone}</Text>}
          <View style={styles.roleTag}>
            <Text style={styles.roleTagText}>{user.role}</Text>
          </View>
        </View>
      </View>

      {/* Role-Specific Portals */}
      {user.role === "WORKER" && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Worker Tools</Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/worker-portal")}
          >
            <View style={[styles.menuIcon, { backgroundColor: "#DCFCE7" }]}>
              <Ionicons name="briefcase" size={20} color="#16A34A" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Worker Workspace</Text>
              <Text style={styles.menuSubtitle}>
                Manage incoming jobs, online toggle & live GPS
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      )}

      {user.role === "ADMIN" && (
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Administrative Tools</Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/admin-portal")}
          >
            <View style={[styles.menuIcon, { backgroundColor: "#EEF2FF" }]}>
              <Ionicons name="shield-checkmark" size={20} color="#4F46E5" />
            </View>
            <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>Security & Audit Center</Text>
              <Text style={styles.menuSubtitle}>
                Review IP audits, approve workers & manage blocks
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      )}

      {/* General Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>Preferences & About</Text>

        <View style={styles.menuItem}>
          <View style={[styles.menuIcon, { backgroundColor: "#F1F5F9" }]}>
            <Ionicons name="shield-outline" size={20} color="#475569" />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>Security & Encryption</Text>
            <Text style={styles.menuSubtitle}>TLS/SSL, STRIDE Non-Repudiation</Text>
          </View>
        </View>

        <View style={styles.menuItem}>
          <View style={[styles.menuIcon, { backgroundColor: "#F1F5F9" }]}>
            <Ionicons name="information-circle-outline" size={20} color="#475569" />
          </View>
          <View style={styles.menuContent}>
            <Text style={styles.menuTitle}>App Version</Text>
            <Text style={styles.menuSubtitle}>v1.0.0 (ProxiFix Mobile Native)</Text>
          </View>
        </View>
      </View>

      {/* Sign Out Button */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color="#DC2626" />
        <Text style={styles.logoutBtnText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 16,
  },
  guestContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#F8FAFC",
  },
  guestAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 6,
  },
  guestSubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 24,
  },
  primaryBtn: {
    backgroundColor: "#2563EB",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 15,
  },
  secondaryBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  secondaryBtnText: {
    color: "#0F172A",
    fontWeight: "600",
    fontSize: 15,
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
  },
  infoCol: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  userEmail: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  userPhone: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  roleTag: {
    alignSelf: "flex-start",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
  },
  roleTagText: {
    color: "#2563EB",
    fontSize: 11,
    fontWeight: "700",
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  menuItem: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 8,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  menuContent: {
    marginLeft: 12,
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  menuSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  logoutBtnText: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 14,
  },
});
