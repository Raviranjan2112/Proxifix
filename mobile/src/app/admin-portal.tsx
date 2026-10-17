import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../services/api";

export default function AdminPortalScreen() {
  const [activeTab, setActiveTab] = useState<"audit" | "workers">("audit");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [pendingWorkers, setPendingWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  async function loadData() {
    setLoading(true);
    try {
      if (activeTab === "audit") {
        const res = await api.get("/admin/audit-logs");
        if (res.data?.success) {
          setAuditLogs(res.data.logs || []);
        }
      } else {
        const res = await api.get("/admin/workers/pending");
        if (res.data?.success) {
          setPendingWorkers(res.data.workers || []);
        }
      }
    } catch (err: any) {
      console.error("Admin data load error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const handleBlockUser = async (userId: string, email: string) => {
    Alert.alert(
      "Confirm Block",
      `Permanently block ${email} due to suspicious or unauthorized activity?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block User",
          style: "destructive",
          onPress: async () => {
            setActionLoadingId(userId);
            try {
              const res = await api.post(`/admin/users/${userId}/block`, {
                reason: "Unusual activity flagged by security administrator",
              });
              Alert.alert("Blocked", res.data?.message || "User blocked successfully.");
              loadData();
            } catch (err: any) {
              Alert.alert("Error", err.response?.data?.message || "Block failed.");
            } finally {
              setActionLoadingId(null);
            }
          },
        },
      ]
    );
  };

  const handleWorkerApproval = async (workerId: string, status: "APPROVED" | "REJECTED") => {
    setActionLoadingId(workerId);
    try {
      const res = await api.put(`/admin/workers/${workerId}/approval`, { status });
      Alert.alert("Status Updated", res.data?.message || `Worker ${status}.`);
      loadData();
    } catch (err: any) {
      Alert.alert("Error", err.response?.data?.message || "Action failed.");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Sub-nav Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "audit" && styles.tabBtnActive]}
          onPress={() => setActiveTab("audit")}
        >
          <Ionicons
            name="shield-checkmark"
            size={16}
            color={activeTab === "audit" ? "#FFFFFF" : "#64748B"}
          />
          <Text
            style={[styles.tabBtnText, activeTab === "audit" && styles.tabBtnTextActive]}
          >
            Audit Logs & IPs
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "workers" && styles.tabBtnActive]}
          onPress={() => setActiveTab("workers")}
        >
          <Ionicons
            name="people"
            size={16}
            color={activeTab === "workers" ? "#FFFFFF" : "#64748B"}
          />
          <Text
            style={[styles.tabBtnText, activeTab === "workers" && styles.tabBtnTextActive]}
          >
            Worker Approvals
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
          />
        }
      >
        {activeTab === "audit" ? (
          <>
            <Text style={styles.headerTitle}>Real-Time Security Audit Logs</Text>
            <Text style={styles.headerSubtitle}>
              STRIDE non-repudiation tracking with Layer 1 (IP) & Layer 2 (GPS)
            </Text>

            {loading ? (
              <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 20 }} />
            ) : auditLogs.length === 0 ? (
              <Text style={styles.emptyText}>No audit records found.</Text>
            ) : (
              auditLogs.map((log) => (
                <View key={log.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.strideBadge}>
                      <Text style={styles.strideText}>[{log.threat_category}]</Text>
                    </View>
                    <Text style={styles.actionText}>{log.action}</Text>
                    <Text style={styles.timeText}>
                      {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>

                  <Text style={styles.userEmail}>{log.user_email || "Anonymous Guest"}</Text>

                  <View style={styles.ipBadgeRow}>
                    <View style={styles.ipChip}>
                      <Ionicons name="globe-outline" size={13} color="#0F172A" />
                      <Text style={styles.ipChipText}>{log.ip_address || "127.0.0.1"}</Text>
                    </View>

                    {log.pin_lat && log.pin_lng ? (
                      <View style={styles.gpsChip}>
                        <Ionicons name="location" size={13} color="#047857" />
                        <Text style={styles.gpsChipText}>
                          {Number(log.pin_lat).toFixed(4)}°, {Number(log.pin_lng).toFixed(4)}°
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Block Button if user is active and has target_user_id */}
                  {log.target_user_id && log.user_role !== "ADMIN" && log.user_is_active !== false && (
                    <TouchableOpacity
                      style={styles.blockBtn}
                      onPress={() => handleBlockUser(log.target_user_id, log.user_email)}
                      disabled={actionLoadingId === log.target_user_id}
                    >
                      <Ionicons name="ban" size={14} color="#DC2626" />
                      <Text style={styles.blockBtnText}>
                        {actionLoadingId === log.target_user_id ? "Blocking..." : "Block User"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </>
        ) : (
          <>
            <Text style={styles.headerTitle}>Pending Worker Approvals</Text>
            <Text style={styles.headerSubtitle}>
              Verify credentials and approve workers to make them discoverable
            </Text>

            {loading ? (
              <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 20 }} />
            ) : pendingWorkers.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="checkmark-circle-outline" size={40} color="#10B981" />
                <Text style={styles.emptyCardTitle}>All Caught Up!</Text>
                <Text style={styles.emptyText}>No workers currently pending verification.</Text>
              </View>
            ) : (
              pendingWorkers.map((w) => (
                <View key={w.user_id} style={styles.card}>
                  <Text style={styles.workerName}>{w.name}</Text>
                  <Text style={styles.workerMeta}>{w.email} • {w.phone}</Text>
                  <Text style={styles.workerDesc}>
                    {w.experience_years} years experience • ₹{w.minimum_charge} min fee
                  </Text>

                  <View style={styles.approvalRow}>
                    <TouchableOpacity
                      style={[styles.apprBtn, styles.apprReject]}
                      onPress={() => handleWorkerApproval(w.user_id, "REJECTED")}
                      disabled={actionLoadingId === w.user_id}
                    >
                      <Text style={styles.apprRejectText}>Reject</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.apprBtn, styles.apprAccept]}
                      onPress={() => handleWorkerApproval(w.user_id, "APPROVED")}
                      disabled={actionLoadingId === w.user_id}
                    >
                      <Text style={styles.apprAcceptText}>Approve Worker</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 8,
    gap: 6,
    backgroundColor: "#F1F5F9",
  },
  tabBtnActive: {
    backgroundColor: "#4F46E5",
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  tabBtnTextActive: {
    color: "#FFFFFF",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 14,
    marginTop: 2,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  strideBadge: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  strideText: {
    color: "#0369A1",
    fontSize: 10,
    fontWeight: "700",
  },
  actionText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
  },
  timeText: {
    fontSize: 11,
    color: "#94A3B8",
  },
  userEmail: {
    fontSize: 13,
    color: "#334155",
    marginTop: 6,
  },
  ipBadgeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
  },
  ipChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  ipChipText: {
    fontSize: 11,
    fontFamily: "monospace",
    fontWeight: "600",
    color: "#0F172A",
  },
  gpsChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  gpsChipText: {
    fontSize: 11,
    fontFamily: "monospace",
    fontWeight: "600",
    color: "#047857",
  },
  blockBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 6,
    paddingVertical: 7,
    marginTop: 10,
    gap: 6,
  },
  blockBtnText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "700",
  },
  emptyText: {
    color: "#64748B",
    fontSize: 13,
    textAlign: "center",
    marginTop: 20,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    padding: 30,
    alignItems: "center",
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 8,
  },
  workerName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  workerMeta: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  workerDesc: {
    fontSize: 12,
    color: "#475569",
    marginTop: 6,
  },
  approvalRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  apprBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 6,
    alignItems: "center",
  },
  apprReject: {
    backgroundColor: "#FEE2E2",
  },
  apprRejectText: {
    color: "#DC2626",
    fontSize: 12,
    fontWeight: "700",
  },
  apprAccept: {
    backgroundColor: "#16A34A",
  },
  apprAcceptText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
});
