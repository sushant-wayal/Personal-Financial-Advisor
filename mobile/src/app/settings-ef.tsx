import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL } from "../lib/apiBaseUrl";
import { formatCurrencyAmount, useCurrency } from "../providers/CurrencyProvider";
import { SettingsSkeleton } from "../components/LoadingSkeleton";
import { clearClientCache } from "../lib/clientCache";

type Profile = {
  emergencyFundMonths?: number | null;
  efStrategy?: string | null;
};

type EmergencyFundData = {
  targetMonths: number;
  avgMonthlyExpenses: number;
  targetAmount: number;
  savedAmount: number;
  availableBalance?: number;
  progressPct: number;
  isComplete: boolean;
  tier?: number;
  efMonthlyDrip?: number;
  availableGoalCapacity?: number;
};

function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

const fs = (size: number) => Math.round(size * 0.9 * 10) / 10;

export default function EFSettingsScreen() {
  useCurrency();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile>({});
  const [efStatus, setEfStatus] = useState<EmergencyFundData | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [resProfile, resEf] = await Promise.all([
        fetch(apiUrl("/api/profile")),
        fetch(apiUrl("/api/emergency-fund")),
      ]);

      const dataProfile = await resProfile.json();
      const dataEf = await resEf.json();

      if (dataProfile.ok && dataProfile.profile) {
        setProfile(dataProfile.profile);
      }
      if (dataEf.ok) {
        setEfStatus(dataEf);
      }
    } catch (e: any) {
      console.error("Failed to load EF settings", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const updateProfile = (patch: Partial<Profile>) => {
    setProfile((current) => ({ ...current, ...patch }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          emergencyFundMonths: Math.max(3, Number(profile.emergencyFundMonths ?? 6)),
          efStrategy: profile.efStrategy || "BALANCED",
        }),
      });

      const payload = await res.json();
      if (!res.ok || payload.ok === false) throw new Error(payload.error || "Failed to save EF settings");

      clearClientCache();
      Alert.alert("Emergency Reserve Saved", "Emergency Fund coverage target and strategy updated.");
      loadData();
    } catch (e: any) {
      Alert.alert("Error", e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#131313" />

      {/* Top Bar Navigation */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={24} color="#ffffff" />
          <Text style={styles.backButtonText}>PROFILE</Text>
        </Pressable>
      </View>

      {loading ? (
        <SettingsSkeleton />
      ) : (
        <KeyboardAwareScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
          extraScrollHeight={24}
        >
          <View style={styles.headerBlock}>
            <Text style={styles.eyebrow}>Emergency Safety Coverage</Text>
            <Text style={styles.screenTitle}>Emergency Fund Settings</Text>
            <Text style={styles.screenSub}>
              Configure safety reserve target months and capital allocation splits between emergency fund and financial goals.
            </Text>
          </View>

          {/* Emergency Reserve & Strategy Section */}
          <View style={styles.panelCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionKicker}>Reserve Target & Strategy</Text>
              <Text style={styles.sectionSubtext}>Safety coverage and capital allocation split.</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Coverage Target (Months, Min 3)</Text>
              <TextInput
                style={styles.input}
                value={String(profile.emergencyFundMonths ?? 6)}
                placeholder="6"
                placeholderTextColor="#5f6368"
                keyboardType="numeric"
                onChangeText={(v) => updateProfile({ emergencyFundMonths: Math.max(3, Number(v || 0)) })}
              />
            </View>

            <View style={{ gap: 10 }}>
              <Text style={styles.smallLabel}>Allocation Strategy</Text>
              <View style={styles.segmentGrid}>
                {[
                  { id: "BALANCED", label: "Balanced" },
                  { id: "AGGRESSIVE_EF", label: "Aggressive" },
                  { id: "ACCELERATED_GOALS", label: "Accelerated" },
                  { id: "STRICT", label: "Strict" },
                ].map((tab) => {
                  const active = (profile.efStrategy || "BALANCED") === tab.id;
                  return (
                    <Pressable
                      key={tab.id}
                      onPress={() => updateProfile({ efStrategy: tab.id })}
                      style={[styles.segmentButton, active ? styles.segmentActive : styles.segmentInactive]}
                    >
                      <Text style={[styles.segmentText, active && { color: "#ffffff", fontWeight: "700" }]}>
                        {tab.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.splitHint}>
                {profile.efStrategy === "AGGRESSIVE_EF" && "85% EF • 15% Goals"}
                {profile.efStrategy === "ACCELERATED_GOALS" && "50% EF • 50% Goals"}
                {profile.efStrategy === "STRICT" && "100% EF • 0% Goals"}
                {(!profile.efStrategy || profile.efStrategy === "BALANCED") && "70% EF • 30% Goals"}
              </Text>
            </View>

            {efStatus && (
              <View style={styles.metricsList}>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Monthly Expenses</Text>
                  <Text style={styles.metricValue}>{formatCurrencyAmount(efStatus.avgMonthlyExpenses, "INR")}</Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Target Reserve ({profile.emergencyFundMonths ?? 6} mo)</Text>
                  <Text style={styles.metricTarget}>{formatCurrencyAmount(efStatus.targetAmount, "INR")}</Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>EF Reserved Cash</Text>
                  <Text style={styles.metricValue}>{formatCurrencyAmount(efStatus.savedAmount, "INR")}</Text>
                </View>
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Goals Pool</Text>
                  <Text style={styles.metricGreen}>{formatCurrencyAmount(efStatus.availableBalance ?? 0, "INR")}</Text>
                </View>

                <View style={styles.progressContainer}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.metricLabel}>EF Funding Level (Tier {efStatus.tier ?? 2})</Text>
                    <Text style={styles.progressPctText}>{efStatus.progressPct.toFixed(1)}%</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.min(100, efStatus.progressPct)}%`,
                          backgroundColor: efStatus.isComplete ? "#34d399" : "#fbbf24",
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Save Action Button */}
          <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, saving && styles.saveBtnDisabled]}>
            <Text style={styles.saveBtnText}>{saving ? "Saving Changes..." : "Save Emergency Fund Settings"}</Text>
          </Pressable>
        </KeyboardAwareScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#131313" },
  topBar: {
    height: 80,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(68,71,72,0.20)",
    backgroundColor: "rgba(19,19,19,0.94)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  backButtonText: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(11), letterSpacing: 1.4, fontWeight: "700" },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 160, gap: 24 },
  headerBlock: { gap: 6 },
  eyebrow: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(10), letterSpacing: 1.6, textTransform: "uppercase", fontWeight: "700" },
  screenTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(30), lineHeight: 38, fontWeight: "700" },
  screenSub: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(13), lineHeight: 19 },
  panelCard: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(68,71,72,0.35)", backgroundColor: "#0e0e0e", padding: 22, gap: 16 },
  cardHeader: { gap: 4 },
  sectionKicker: { color: "#fbbf24", fontFamily: "JetBrains Mono", fontSize: fs(11), letterSpacing: 1.6, textTransform: "uppercase", fontWeight: "700" },
  sectionSubtext: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(12) },
  inputGroup: { gap: 6 },
  inputLabel: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(11), fontWeight: "600" },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(68,71,72,0.40)",
    backgroundColor: "#171819",
    color: "#ffffff",
    fontFamily: "Inter",
    fontSize: fs(14),
    paddingHorizontal: 14,
  },
  smallLabel: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(11), fontWeight: "700" },
  segmentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  segmentButton: { flex: 1, minWidth: "45%", height: 38, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  segmentActive: { backgroundColor: "rgba(245, 158, 11, 0.2)", borderColor: "#fbbf24" },
  segmentInactive: { backgroundColor: "#171819", borderColor: "rgba(68,71,72,0.35)" },
  segmentText: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(12) },
  splitHint: { color: "#fbbf24", fontFamily: "JetBrains Mono", fontSize: fs(11), fontWeight: "600" },
  metricsList: { gap: 10, borderTopWidth: 1, borderTopColor: "rgba(68,71,72,0.20)", paddingTop: 14 },
  metricRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metricLabel: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(12) },
  metricValue: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(13), fontWeight: "600" },
  metricTarget: { color: "#fbbf24", fontFamily: "JetBrains Mono", fontSize: fs(13), fontWeight: "700" },
  metricGreen: { color: "#34d399", fontFamily: "JetBrains Mono", fontSize: fs(13), fontWeight: "600" },
  progressContainer: { gap: 6, marginTop: 4 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between" },
  progressPctText: { color: "#fbbf24", fontFamily: "JetBrains Mono", fontSize: fs(12), fontWeight: "700" },
  progressBarBg: { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  progressBarFill: { height: "100%", borderRadius: 4 },
  saveBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#fbbf24",
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#131313", fontFamily: "Hanken Grotesk", fontSize: fs(15), fontWeight: "700" },
});
