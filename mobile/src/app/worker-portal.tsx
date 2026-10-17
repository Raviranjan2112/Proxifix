import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

export default function WorkerPortalScreen() {
  const { user } = useAuth();

  const [isOnline, setIsOnline] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    loadWorkerData();
  }, []);

  async function loadWorkerData() {
    setLoading(true);
    try {
      const [profRes, bookRes] = await Promise.all([
        api.get("/workers/me"),
        api.get("/bookings/worker"),
      ]);

      if (profRes.data?.success) {
        setProfile(profRes.data.worker);
        setIsOnline(profRes.data.worker.online_status !== "OFFLINE");
      }

      if (bookRes.data?.success) {
        setBookings(bookRes.data.bookings || []);
      }
    } catch (err: any) {
      console.error("Worker load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Toggle online and broadcast GPS
  const handleToggleOnline = async (value: boolean) => {
    setIsOnline(value);
    try {
      const status = value ? "ONLINE" : "OFFLINE";
      await api.put("/workers/me/availability", {
        onlineStatus: status,
        availabilityStatus: value ? "AVAILABLE" : "OFFLINE",
      });

      if (value) {
        // Broadcast fresh GPS coordinates to PostGIS
        const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
        if (permStatus === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          await api.post("/workers/location", {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracyMeters: loc.coords.accuracy,
          });
        }
      }
    } catch (err: any) {
      Alert.alert("Status Error", "Failed to update availability status.");
      setIsOnline(!value);
    }
  };

  // Update booking status: ACCEPTED, REJECTED, IN_PROGRESS, COMPLETED
  const handleStatusUpdate = async (bookingId: string, status: string) => {
    setActionLoadingId(bookingId);
    try {
      const res = await api.put(`/bookings/${bookingId}/status`, { status });
      if (res.data?.success) {
        Alert.alert("Updated", `Booking status updated to ${status}.`);
        loadWorkerData();
      }
    } catch (err: any) {
      Alert.alert("Update Failed", err.response?.data?.message || "Action failed.");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadWorkerData(); }} />
      }
    >
      {/* Online / Offline Status Toggle Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusLeft}>
          <View
            style={[
              styles.statusIndicator,
              { backgroundColor: isOnline ? "#10B981" : "#94A3B8" },
            ]}
          />
          <View>
            <Text style={styles.statusTitle}>
              {isOnline ? "You Are ONLINE" : "You Are OFFLINE"}
            </Text>
            <Text style={styles.statusSubtitle}>
              {isOnline
                ? "Visible to customers within search radius"
                : "Not receiving on-demand requests"}
            </Text>
          </View>
        </View>
        <Switch
          value={isOnline}
          onValueChange={handleToggleOnline}
          trackColor={{ false: "#CBD5E1", true: "#93C5FD" }}
          thumbColor={isOnline ? "#2563EB" : "#F1F5F9"}
        />
      </View>

      {/* Metrics Row */}
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricVal}>
            {bookings.filter((b) => b.status === "PENDING").length}
          </Text>
          <Text style={styles.metricLabel}>New Requests</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={styles.metricVal}>
            {bookings.filter((b) => b.status === "IN_PROGRESS" || b.status === "ACCEPTED").length}
          </Text>
          <Text style={styles.metricLabel}>Active Jobs</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={[styles.metricVal, { color: "#059669" }]}>
            {bookings.filter((b) => b.status === "COMPLETED").length}
          </Text>
          <Text style={styles.metricLabel}>Completed</Text>
        </View>
      </View>

      {/* Booking Requests */}
      <Text style={styles.sectionTitle}>Incoming Booking Requests</Text>

      {loading ? (
        <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 20 }} />
      ) : bookings.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="notifications-off-outline" size={36} color="#94A3B8" />
          <Text style={styles.emptyText}>No customer bookings assigned yet.</Text>
        </View>
      ) : (
        bookings.map((b) => (
          <View key={b.id} style={styles.jobCard}>
            <View style={styles.jobHeader}>
              <View>
                <Text style={styles.customerName}>{b.customer_name || "Customer"}</Text>
                <Text style={styles.customerPhone}>{b.customer_phone || "Contact via App"}</Text>
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{b.status}</Text>
              </View>
            </View>

            {b.description && (
              <Text style={styles.desc}>"{b.description}"</Text>
            )}

            <View style={styles.locRow}>
              <Ionicons name="location-outline" size={14} color="#64748B" />
              <Text style={styles.locText} numberOfLines={1}>
                {b.address || "Customer delivery address"}
              </Text>
            </View>

            {/* Actions based on status */}
            {b.status === "PENDING" && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnReject]}
                  onPress={() => handleStatusUpdate(b.id, "REJECTED")}
                  disabled={actionLoadingId === b.id}
                >
                  <Text style={styles.btnRejectText}>Decline</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.btnAccept]}
                  onPress={() => handleStatusUpdate(b.id, "ACCEPTED")}
                  disabled={actionLoadingId === b.id}
                >
                  <Text style={styles.btnAcceptText}>Accept Request</Text>
                </TouchableOpacity>
              </View>
            )}

            {b.status === "ACCEPTED" && (
              <TouchableOpacity
                style={[styles.btn, styles.btnStart]}
                onPress={() => handleStatusUpdate(b.id, "IN_PROGRESS")}
                disabled={actionLoadingId === b.id}
              >
                <Ionicons name="play" size={16} color="#FFFFFF" />
                <Text style={styles.btnStartText}>Start Service Job</Text>
              </TouchableOpacity>
            )}

            {b.status === "IN_PROGRESS" && (
              <TouchableOpacity
                style={[styles.btn, styles.btnComplete]}
                onPress={() => handleStatusUpdate(b.id, "COMPLETED")}
                disabled={actionLoadingId === b.id}
              >
                <Ionicons name="checkmark-done" size={16} color="#FFFFFF" />
                <Text style={styles.btnCompleteText}>Mark Job Completed</Text>
              </TouchableOpacity>
            )}
          </View>
        ))
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
  statusBar: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  statusLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
  },
  statusSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  metricVal: {
    fontSize: 22,
    fontWeight: "800",
    color: "#2563EB",
  },
  metricLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 10,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 30,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyText: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 8,
  },
  jobCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
  },
  jobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  customerName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  customerPhone: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  badge: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    color: "#2563EB",
    fontWeight: "700",
    fontSize: 11,
  },
  desc: {
    fontSize: 13,
    color: "#334155",
    fontStyle: "italic",
    marginVertical: 8,
  },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 12,
  },
  locText: {
    fontSize: 12,
    color: "#64748B",
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  btnReject: {
    backgroundColor: "#FEE2E2",
  },
  btnRejectText: {
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 13,
  },
  btnAccept: {
    backgroundColor: "#2563EB",
  },
  btnAcceptText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  btnStart: {
    backgroundColor: "#4F46E5",
    marginTop: 8,
  },
  btnStartText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  btnComplete: {
    backgroundColor: "#16A34A",
    marginTop: 8,
  },
  btnCompleteText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
});
