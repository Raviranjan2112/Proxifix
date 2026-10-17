import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";

export default function BookScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [description, setDescription] = useState("");
  const [scheduledTime, setScheduledTime] = useState("Today, within 2 hours");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [address, setAddress] = useState("Acquiring current GPS location...");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function getLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          const c = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
          setCoords(c);

          try {
            const rev = await Location.reverseGeocodeAsync(c);
            if (rev && rev.length > 0) {
              const r = rev[0];
              setAddress(
                `${r.name || r.street || "Current Address"}, ${r.city || r.district || ""}`
              );
            } else {
              setAddress(`${c.latitude.toFixed(4)}°N, ${c.longitude.toFixed(4)}°E`);
            }
          } catch {
            setAddress(`${c.latitude.toFixed(4)}°N, ${c.longitude.toFixed(4)}°E`);
          }
        } else {
          setCoords({ latitude: 28.6139, longitude: 77.2090 });
          setAddress("New Delhi, IN (Default Location)");
        }
      } catch {
        setCoords({ latitude: 28.6139, longitude: 77.2090 });
        setAddress("Default Location");
      }
    }
    getLocation();
  }, []);

  const handleCreateBooking = async () => {
    if (!description.trim()) {
      Alert.alert("Job Details", "Please briefly explain the issue or service required.");
      return;
    }

    if (!coords) {
      Alert.alert("Location Error", "Could not capture your location coordinates.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post("/bookings", {
        workerId: id,
        description: description.trim(),
        scheduledTime,
        latitude: coords.latitude,
        longitude: coords.longitude,
        address,
      });

      if (res.data?.success) {
        Alert.alert(
          "Booking Confirmed! 🚀",
          "Your service request has been sent to the professional. You can track progress in the Bookings tab.",
          [
            {
              text: "View Bookings",
              onPress: () => router.replace("/(tabs)/bookings"),
            },
          ]
        );
      } else {
        Alert.alert("Booking Failed", res.data?.message || "Could not complete booking.");
      }
    } catch (err: any) {
      Alert.alert(
        "Booking Error",
        err.response?.data?.message || "Network error. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Ionicons name="calendar" size={24} color="#2563EB" />
          <Text style={styles.cardTitle}>Schedule Appointment</Text>
        </View>

        {/* Location Confirmation */}
        <View style={styles.locBox}>
          <Ionicons name="location-sharp" size={18} color="#059669" />
          <View style={{ marginLeft: 8, flex: 1 }}>
            <Text style={styles.locLabel}>Service Delivery Location</Text>
            <Text style={styles.locText} numberOfLines={2}>
              {address}
            </Text>
          </View>
        </View>

        {/* Schedule Time */}
        <Text style={styles.label}>Requested Time</Text>
        <TextInput
          style={styles.input}
          value={scheduledTime}
          onChangeText={setScheduledTime}
          placeholder="e.g. Today at 4:00 PM"
          placeholderTextColor="#94A3B8"
        />

        {/* Job Details */}
        <Text style={styles.label}>Describe the issue or task *</Text>
        <TextInput
          style={[styles.input, { height: 90, textAlignVertical: "top" }]}
          placeholder="e.g. Main switch tripping in kitchen whenever microwave runs..."
          placeholderTextColor="#94A3B8"
          multiline
          value={description}
          onChangeText={setDescription}
        />

        {/* Platform Transparency notice */}
        <View style={styles.infoBanner}>
          <Ionicons name="shield-checkmark" size={16} color="#2563EB" />
          <Text style={styles.infoBannerText}>
            Direct on-demand dispatch with STRIDE non-repudiation audit logging.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.confirmBtn, submitting && styles.btnDisabled]}
          onPress={handleCreateBooking}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.confirmBtnText}>Confirm Service Request</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    padding: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
  },
  locBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    marginBottom: 16,
  },
  locLabel: {
    fontSize: 11,
    color: "#047857",
    fontWeight: "600",
  },
  locText: {
    fontSize: 13,
    color: "#065F46",
    fontWeight: "700",
    marginTop: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
    marginBottom: 10,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    padding: 10,
    borderRadius: 6,
    marginVertical: 12,
    gap: 8,
  },
  infoBannerText: {
    fontSize: 11,
    color: "#1D4ED8",
    flex: 1,
    lineHeight: 16,
  },
  confirmBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 10,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
});
