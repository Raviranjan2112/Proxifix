import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";

export default function BookingsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      loadBookings();
    } else {
      setLoading(false);
    }
  }, [user]);

  async function loadBookings() {
    setLoading(true);
    try {
      const res = await api.get("/bookings/customer");
      if (res.data?.success) {
        setBookings(res.data.bookings || []);
      }
    } catch (err: any) {
      console.error("Failed to load customer bookings:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = () => {
    setRefreshing(true);
    loadBookings();
  };

  if (!user) {
    return (
      <View style={styles.centerBox}>
        <Ionicons name="lock-closed-outline" size={48} color="#94A3B8" />
        <Text style={styles.guestTitle}>Sign in to view your bookings</Text>
        <Text style={styles.guestSubtitle}>
          Track your active service appointments, live worker arrivals, and work history.
        </Text>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.loginBtnText}>Sign In / Register</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Your Appointments</Text>
        <Text style={styles.subtitle}>
          Real-time tracking and job progress
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Fetching your bookings...</Text>
        </View>
      ) : bookings.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="calendar-outline" size={44} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptyText}>
            Find a verified technician or service worker on the home tab to schedule an appointment.
          </Text>
          <TouchableOpacity
            style={styles.findWorkerBtn}
            onPress={() => router.push("/(tabs)")}
          >
            <Text style={styles.findWorkerBtnText}>Find Services Nearby</Text>
          </TouchableOpacity>
        </View>
      ) : (
        bookings.map((b) => {
          let statusColor = "#64748B";
          let statusBg = "#F1F5F9";
          if (b.status === "PENDING") {
            statusColor = "#D97706";
            statusBg = "#FEF3C7";
          } else if (b.status === "ACCEPTED" || b.status === "IN_PROGRESS") {
            statusColor = "#2563EB";
            statusBg = "#DBEAFE";
          } else if (b.status === "COMPLETED") {
            statusColor = "#059669";
            statusBg = "#D1FAE5";
          } else if (b.status === "CANCELLED" || b.status === "REJECTED") {
            statusColor = "#DC2626";
            statusBg = "#FEE2E2";
          }

          return (
            <View key={b.id} style={styles.bookingCard}>
              <View style={styles.bookingHeader}>
                <View>
                  <Text style={styles.serviceName}>{b.service_name || "Home Service"}</Text>
                  <Text style={styles.workerName}>Worker: {b.worker_name || "Assigned Pro"}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                  <Text style={[styles.statusText, { color: statusColor }]}>
                    {b.status}
                  </Text>
                </View>
              </View>

              <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                  <Ionicons name="time-outline" size={14} color="#64748B" />
                  <Text style={styles.detailText}>
                    {new Date(b.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="cash-outline" size={14} color="#64748B" />
                  <Text style={styles.detailText}>
                    ₹{b.total_amount || b.minimum_charge || 250}
                  </Text>
                </View>
              </View>

              {b.description && (
                <Text style={styles.descText} numberOfLines={2}>
                  "{b.description}"
                </Text>
              )}

              {b.status === "IN_PROGRESS" && (
                <View style={styles.liveBanner}>
                  <Ionicons name="radio" size={16} color="#2563EB" />
                  <Text style={styles.liveText}>
                    Job in progress • Worker on site
                  </Text>
                </View>
              )}
            </View>
          );
        })
      )}

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
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "#F8FAFC",
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 16,
  },
  guestSubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 18,
  },
  loginBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  loginBtnText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
  centerLoading: {
    padding: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#64748B",
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 12,
  },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  findWorkerBtn: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  findWorkerBtnText: {
    color: "#2563EB",
    fontWeight: "600",
    fontSize: 13,
  },
  bookingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },
  bookingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  serviceName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  workerName: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  detailsRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "500",
  },
  descText: {
    fontSize: 12,
    color: "#475569",
    fontStyle: "italic",
    marginTop: 8,
  },
  liveBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 6,
    padding: 8,
    marginTop: 10,
    gap: 6,
  },
  liveText: {
    fontSize: 12,
    color: "#1D4ED8",
    fontWeight: "600",
  },
});
