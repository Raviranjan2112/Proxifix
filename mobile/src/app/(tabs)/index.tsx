import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";

const CATEGORIES = [
  { id: "all", name: "All", icon: "apps" },
  { id: "Electrician", name: "Electrician", icon: "flash" },
  { id: "Plumber", name: "Plumber", icon: "water" },
  { id: "Appliance Repair", name: "Appliance", icon: "construct" },
  { id: "Carpenter", name: "Carpenter", icon: "hammer" },
  { id: "Painter", name: "Painter", icon: "color-palette" },
  { id: "Cleaning", name: "Cleaning", icon: "sparkles" },
  { id: "AC Repair", name: "AC Repair", icon: "snow" },
];

const RADIUS_OPTIONS = [5, 10, 15, 25, 50];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [radius, setRadius] = useState(15);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationName, setLocationName] = useState("Detecting location...");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    requestDeviceLocation();
  }, []);

  useEffect(() => {
    if (coords) {
      loadNearbyWorkers();
    }
  }, [coords, selectedCategory, radius]);

  async function requestDeviceLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location Permission",
          "Permission denied. Using default location (New Delhi)."
        );
        const fallback = { latitude: 28.6139, longitude: 77.2090 };
        setCoords(fallback);
        setLocationName("New Delhi, IN (Default)");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const current = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setCoords(current);

      try {
        const reverse = await Location.reverseGeocodeAsync(current);
        if (reverse && reverse.length > 0) {
          const item = reverse[0];
          setLocationName(
            `${item.city || item.district || item.subregion || "Near you"}, ${item.region || item.country || ""}`
          );
        } else {
          setLocationName(`${current.latitude.toFixed(3)}°N, ${current.longitude.toFixed(3)}°E`);
        }
      } catch {
        setLocationName(`${current.latitude.toFixed(3)}°N, ${current.longitude.toFixed(3)}°E`);
      }
    } catch (err) {
      console.warn("Location error:", err);
      const fallback = { latitude: 28.6139, longitude: 77.2090 };
      setCoords(fallback);
      setLocationName("Default Location");
    }
  }

  async function loadNearbyWorkers() {
    if (!coords) return;
    setLoading(true);
    try {
      const params: any = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        radius,
      };

      if (selectedCategory !== "all") {
        params.service = selectedCategory;
      }

      const res = await api.get("/workers/nearby", { params });
      if (res.data?.success) {
        setWorkers(res.data.workers || []);
      }
    } catch (err) {
      console.error("Failed to load nearby workers:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = () => {
    setRefreshing(true);
    requestDeviceLocation();
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Role Banner for Workers or Admins */}
      {user?.role === "WORKER" && (
        <TouchableOpacity
          style={styles.roleBanner}
          onPress={() => router.push("/worker-portal")}
        >
          <Ionicons name="briefcase" size={20} color="#FFFFFF" />
          <Text style={styles.roleBannerText}>Switch to Worker Workspace (Incoming Jobs & GPS)</Text>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {user?.role === "ADMIN" && (
        <TouchableOpacity
          style={[styles.roleBanner, { backgroundColor: "#4F46E5" }]}
          onPress={() => router.push("/admin-portal")}
        >
          <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
          <Text style={styles.roleBannerText}>Open Admin Security & Audit Center</Text>
          <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* GPS Location Bar */}
      <View style={styles.locationCard}>
        <View style={styles.locationInfo}>
          <Ionicons name="location" size={20} color="#2563EB" />
          <View style={{ marginLeft: 8, flex: 1 }}>
            <Text style={styles.locationLabel}>Your Hardware GPS Location</Text>
            <Text style={styles.locationValue} numberOfLines={1}>
              {locationName}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.refreshLocButton}
          onPress={requestDeviceLocation}
        >
          <Ionicons name="locate" size={18} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {/* Category Pills */}
      <Text style={styles.sectionTitle}>Service Categories</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
      >
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryPill, isActive && styles.categoryPillActive]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Ionicons
                name={cat.icon as any}
                size={16}
                color={isActive ? "#FFFFFF" : "#475569"}
              />
              <Text
                style={[
                  styles.categoryPillText,
                  isActive && styles.categoryPillTextActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Radius Filters */}
      <View style={styles.radiusRow}>
        <Text style={styles.radiusLabel}>Search Radius:</Text>
        <View style={styles.radiusButtons}>
          {RADIUS_OPTIONS.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.radiusBtn, radius === r && styles.radiusBtnActive]}
              onPress={() => setRadius(r)}
            >
              <Text
                style={[
                  styles.radiusBtnText,
                  radius === r && styles.radiusBtnTextActive,
                ]}
              >
                {r} km
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Worker List */}
      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>
          Nearby Service Providers ({workers.length})
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Finding nearest verified professionals...</Text>
        </View>
      ) : workers.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="search-outline" size={48} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No workers found nearby</Text>
          <Text style={styles.emptySubtitle}>
            Try expanding your search radius to 25 km or 50 km, or choose another service category.
          </Text>
        </View>
      ) : (
        workers.map((worker) => (
          <View key={worker.id || worker.user_id} style={styles.workerCard}>
            <View style={styles.workerTopRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {worker.name ? worker.name[0].toUpperCase() : "W"}
                </Text>
              </View>
              <View style={styles.workerInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.workerName}>{worker.name}</Text>
                  {worker.verification_status === "APPROVED" && (
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  )}
                </View>
                <Text style={styles.workerMeta}>
                  {worker.experience_years || 0} yrs exp • ⭐ {Number(worker.rating || 5.0).toFixed(1)}
                </Text>
              </View>
              <View style={styles.distanceBadge}>
                <Text style={styles.distanceText}>
                  {worker.distance_km ? `${Number(worker.distance_km).toFixed(1)} km` : "Nearby"}
                </Text>
              </View>
            </View>

            {/* Services badges */}
            <View style={styles.servicesRow}>
              {(worker.services || []).map((srv: string, idx: number) => (
                <View key={idx} style={styles.serviceChip}>
                  <Text style={styles.serviceChipText}>{srv}</Text>
                </View>
              ))}
            </View>

            {/* Bottom Row */}
            <View style={styles.cardFooter}>
              <View>
                <Text style={styles.chargeLabel}>Starting Charge</Text>
                <Text style={styles.chargeValue}>
                  ₹{worker.minimum_charge || 250}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.bookButton}
                onPress={() => {
                  if (!user) {
                    Alert.alert(
                      "Login Required",
                      "Please sign in or create an account to book this service provider.",
                      [
                        { text: "Cancel", style: "cancel" },
                        { text: "Sign In", onPress: () => router.push("/login") },
                      ]
                    );
                  } else {
                    router.push(`/book/${worker.user_id || worker.id}`);
                  }
                }}
              >
                <Text style={styles.bookButtonText}>Book Now</Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
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
  roleBanner: {
    backgroundColor: "#16A34A",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  roleBannerText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 13,
    flex: 1,
    marginHorizontal: 8,
  },
  locationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  locationInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  locationLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  locationValue: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "700",
    marginTop: 2,
  },
  refreshLocButton: {
    backgroundColor: "#EFF6FF",
    padding: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 10,
  },
  categoryScroll: {
    paddingBottom: 12,
    gap: 8,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginRight: 8,
  },
  categoryPillActive: {
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
    marginLeft: 6,
  },
  categoryPillTextActive: {
    color: "#FFFFFF",
  },
  radiusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 12,
  },
  radiusLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  radiusButtons: {
    flexDirection: "row",
    gap: 6,
  },
  radiusBtn: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  radiusBtnActive: {
    backgroundColor: "#2563EB",
  },
  radiusBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  radiusBtnTextActive: {
    color: "#FFFFFF",
  },
  listHeader: {
    marginTop: 8,
    marginBottom: 8,
  },
  loadingBox: {
    padding: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#64748B",
    fontSize: 13,
  },
  emptyBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 32,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  workerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  workerTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#DBEAFE",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1D4ED8",
  },
  workerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  workerName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
  },
  workerMeta: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  distanceBadge: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  distanceText: {
    color: "#065F46",
    fontSize: 12,
    fontWeight: "700",
  },
  servicesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginVertical: 10,
  },
  serviceChip: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  serviceChipText: {
    fontSize: 11,
    color: "#334155",
    fontWeight: "500",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 10,
    marginTop: 4,
  },
  chargeLabel: {
    fontSize: 11,
    color: "#64748B",
  },
  chargeValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  bookButton: {
    backgroundColor: "#2563EB",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  bookButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
});
