import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();

  const [role, setRole] = useState<"CUSTOMER" | "WORKER">("CUSTOMER");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [minimumCharge, setMinimumCharge] = useState("300");
  const [experienceYears, setExperienceYears] = useState("3");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password || !phone.trim()) {
      Alert.alert("Missing Fields", "Please fill in all required fields.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters.");
      return;
    }

    setSubmitting(true);
    const payload: any = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      password,
      role,
    };

    if (role === "WORKER") {
      payload.minimumCharge = Number(minimumCharge) || 250;
      payload.experienceYears = Number(experienceYears) || 1;
      payload.description = description.trim() || "Experienced home services professional";
    }

    const res = await register(payload);
    setSubmitting(false);

    if (res.success) {
      Alert.alert(
        "Account Created",
        role === "WORKER"
          ? "Welcome to ProxiFix Worker Network! Your profile is submitted for instant review."
          : "Your customer account has been registered successfully!"
      );
      router.replace(role === "WORKER" ? "/worker-portal" : "/(tabs)");
    } else {
      Alert.alert("Registration Failed", res.message || "Could not register account.");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>
            Join ProxiFix to discover or offer verified on-demand local services
          </Text>
        </View>

        {/* Role Selector Tabs */}
        <View style={styles.roleToggle}>
          <TouchableOpacity
            style={[styles.roleTab, role === "CUSTOMER" && styles.roleTabActive]}
            onPress={() => setRole("CUSTOMER")}
          >
            <Ionicons
              name="person"
              size={18}
              color={role === "CUSTOMER" ? "#FFFFFF" : "#64748B"}
            />
            <Text
              style={[
                styles.roleTabText,
                role === "CUSTOMER" && styles.roleTabTextActive,
              ]}
            >
              I Need Services
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roleTab, role === "WORKER" && styles.roleTabActive]}
            onPress={() => setRole("WORKER")}
          >
            <Ionicons
              name="hammer"
              size={18}
              color={role === "WORKER" ? "#FFFFFF" : "#64748B"}
            />
            <Text
              style={[
                styles.roleTabText,
                role === "WORKER" && styles.roleTabTextActive,
              ]}
            >
              I Am a Worker
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Full Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ravi Kumar"
            placeholderTextColor="#94A3B8"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Email Address *</Text>
          <TextInput
            style={styles.input}
            placeholder="ravi@example.com"
            placeholderTextColor="#94A3B8"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Mobile Phone *</Text>
          <TextInput
            style={styles.input}
            placeholder="+91 98765 43210"
            placeholderTextColor="#94A3B8"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          <Text style={styles.label}>Password (min 6 chars) *</Text>
          <TextInput
            style={styles.input}
            placeholder="Create password"
            placeholderTextColor="#94A3B8"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {role === "WORKER" && (
            <>
              <View style={styles.divider} />
              <Text style={styles.workerSectionHeader}>Professional Profile</Text>

              <Text style={styles.label}>Starting Service Fee (₹) *</Text>
              <TextInput
                style={styles.input}
                placeholder="300"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={minimumCharge}
                onChangeText={setMinimumCharge}
              />

              <Text style={styles.label}>Years of Experience *</Text>
              <TextInput
                style={styles.input}
                placeholder="4"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={experienceYears}
                onChangeText={setExperienceYears}
              />

              <Text style={styles.label}>Service Experience Bio</Text>
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: "top" }]}
                placeholder="Certified electrician specializing in residential repairs..."
                placeholderTextColor="#94A3B8"
                multiline
                value={description}
                onChangeText={setDescription}
              />
            </>
          )}

          <TouchableOpacity
            style={[styles.registerBtn, submitting && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.registerBtnText}>
                {role === "WORKER" ? "Register as Professional" : "Create Customer Account"}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginPrompt}>
            <Text style={styles.loginText}>Already registered? </Text>
            <TouchableOpacity onPress={() => router.push("/login")}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#F8FAFC",
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
    marginTop: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
    maxWidth: 290,
  },
  roleToggle: {
    flexDirection: "row",
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  roleTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  roleTabActive: {
    backgroundColor: "#2563EB",
  },
  roleTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  roleTabTextActive: {
    color: "#FFFFFF",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 5,
    marginTop: 10,
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
  },
  divider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 14,
  },
  workerSectionHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
  },
  registerBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 22,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  registerBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  loginPrompt: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 18,
  },
  loginText: {
    fontSize: 13,
    color: "#64748B",
  },
  loginLink: {
    fontSize: 13,
    color: "#2563EB",
    fontWeight: "700",
  },
});
