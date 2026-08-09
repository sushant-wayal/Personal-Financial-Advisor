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
  salaryCycleDays?: number | null;
  crisisInvestableRate?: number | null;
  efBuildingInvestableRate?: number | null;
  wealthBuildingInvestableRate?: number | null;
  goalSprintInvestableRate?: number | null;
  stdEquityPct?: number | null;
  stdDebtPct?: number | null;
  stdGoldPct?: number | null;
  stdCashPct?: number | null;
  consEquityPct?: number | null;
  consDebtPct?: number | null;
  consGoldPct?: number | null;
  consCashPct?: number | null;
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

function SettingInput({
  label,
  value,
  placeholder,
  onChangeText,
  keyboardType = "default",
  editable = true,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChangeText?: (text: string) => void;
  keyboardType?: "default" | "numeric";
  editable?: boolean;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, !editable && styles.inputDisabled]}
        value={value}
        placeholder={placeholder}
        placeholderTextColor="#5f6368"
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        editable={editable}
      />
    </View>
  );
}

export default function StrategySettingsScreen() {
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
      console.error("Failed to load strategy settings", e);
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
          salaryCycleDays: Math.max(30, Math.min(33, Number(profile.salaryCycleDays ?? 33))),
          efBuildingInvestableRate: Math.max(0, Math.min(100, Number(profile.efBuildingInvestableRate ?? 15))),
          goalSprintInvestableRate: Math.max(0, Math.min(100, Number(profile.goalSprintInvestableRate ?? 40))),
          wealthBuildingInvestableRate: Math.max(0, Math.min(100, Number(profile.wealthBuildingInvestableRate ?? 60))),
          crisisInvestableRate: Math.max(0, Math.min(100, Number(profile.crisisInvestableRate ?? 0))),
          stdEquityPct: Math.max(0, Math.min(100, Number(profile.stdEquityPct ?? 50))),
          stdDebtPct: Math.max(0, Math.min(100, Number(profile.stdDebtPct ?? 25))),
          stdGoldPct: Math.max(0, Math.min(100, Number(profile.stdGoldPct ?? 15))),
          stdCashPct: Math.max(0, Math.min(100, Number(profile.stdCashPct ?? 10))),
          consEquityPct: Math.max(0, Math.min(100, Number(profile.consEquityPct ?? 20))),
          consDebtPct: Math.max(0, Math.min(100, Number(profile.consDebtPct ?? 50))),
          consGoldPct: Math.max(0, Math.min(100, Number(profile.consGoldPct ?? 10))),
          consCashPct: Math.max(0, Math.min(100, Number(profile.consCashPct ?? 20))),
        }),
      });

      const payload = await res.json();
      if (!res.ok || payload.ok === false) throw new Error(payload.error || "Failed to save strategy");

      clearClientCache();
      Alert.alert("Settings Saved", "Emergency reserve and investment strategy configuration updated.");
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
            <Text style={styles.eyebrow}>Strategy & Allocations</Text>
            <Text style={styles.screenTitle}>Investment Settings</Text>
            <Text style={styles.screenSub}>
              Configure your emergency safety coverage, pay cycle length, and target asset sub-allocation splits.
            </Text>
          </View>

          {/* Emergency Reserve & Strategy Section */}
          <View style={styles.panelCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionKicker}>Emergency Reserve & Strategy</Text>
              <Text style={styles.sectionSubtext}>Safety coverage and capital allocation split.</Text>
            </View>

            <SettingInput
              label="Coverage (Months, Min 3)"
              value={String(profile.emergencyFundMonths ?? 6)}
              keyboardType="numeric"
              onChangeText={(v) => updateProfile({ emergencyFundMonths: Math.max(3, Number(v || 0)) })}
            />

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

          {/* Investment Strategy Configuration Section */}
          <View style={styles.panelCard}>
            <View style={styles.cardHeader}>
              <Text style={[styles.sectionKicker, { color: "#818cf8" }]}>Investment Strategy Parameters</Text>
              <Text style={styles.sectionSubtext}>Pay cycle timing and investable rates per financial phase.</Text>
            </View>

            <SettingInput
              label="Salary Pay Cycle (Days: 30..33)"
              value={String(profile.salaryCycleDays ?? 33)}
              keyboardType="numeric"
              onChangeText={(v) => updateProfile({ salaryCycleDays: Math.max(30, Math.min(33, Number(v || 33))) })}
            />

            <Text style={styles.smallLabel}>Phase Investable Rates (%)</Text>

            <View style={styles.twoColumn}>
              <SettingInput
                label="EF Building Rate %"
                value={String(profile.efBuildingInvestableRate ?? 15)}
                keyboardType="numeric"
                onChangeText={(v) => updateProfile({ efBuildingInvestableRate: Math.max(0, Math.min(100, Number(v || 0))) })}
              />
              <SettingInput
                label="Goal Sprint Rate %"
                value={String(profile.goalSprintInvestableRate ?? 40)}
                keyboardType="numeric"
                onChangeText={(v) => updateProfile({ goalSprintInvestableRate: Math.max(0, Math.min(100, Number(v || 0))) })}
              />
            </View>

            <View style={styles.twoColumn}>
              <SettingInput
                label="Wealth Building Rate %"
                value={String(profile.wealthBuildingInvestableRate ?? 60)}
                keyboardType="numeric"
                onChangeText={(v) => updateProfile({ wealthBuildingInvestableRate: Math.max(0, Math.min(100, Number(v || 0))) })}
              />
              <SettingInput
                label="Crisis Phase Rate %"
                value={String(profile.crisisInvestableRate ?? 0)}
                keyboardType="numeric"
                onChangeText={(v) => updateProfile({ crisisInvestableRate: Math.max(0, Math.min(100, Number(v || 0))) })}
              />
            </View>

            <Text style={[styles.smallLabel, { marginTop: 12 }]}>Standard Asset Sub-Allocations (%)</Text>

            <View style={styles.twoColumn}>
              <SettingInput
                label="Std Equity %"
                value={String(profile.stdEquityPct ?? 50)}
                keyboardType="numeric"
                onChangeText={(v) => updateProfile({ stdEquityPct: Math.max(0, Math.min(100, Number(v || 0))) })}
              />
              <SettingInput
                label="Std Debt %"
                value={String(profile.stdDebtPct ?? 25)}
                keyboardType="numeric"
                onChangeText={(v) => updateProfile({ stdDebtPct: Math.max(0, Math.min(100, Number(v || 0))) })}
              />
            </View>

            <View style={styles.twoColumn}>
              <SettingInput
                label="Std Gold %"
                value={String(profile.stdGoldPct ?? 15)}
                keyboardType="numeric"
                onChangeText={(v) => updateProfile({ stdGoldPct: Math.max(0, Math.min(100, Number(v || 0))) })}
              />
              <SettingInput
                label="Std Cash %"
                value={String(profile.stdCashPct ?? 10)}
                keyboardType="numeric"
                onChangeText={(v) => updateProfile({ stdCashPct: Math.max(0, Math.min(100, Number(v || 0))) })}
              />
            </View>

            <Text style={[styles.smallLabel, { marginTop: 12 }]}>Conservative EF-Building Sub-Allocations (%)</Text>

            <View style={styles.twoColumn}>
              <SettingInput
                label="Cons Equity %"
                value={String(profile.consEquityPct ?? 20)}
                keyboardType="numeric"
                onChangeText={(v) => updateProfile({ consEquityPct: Math.max(0, Math.min(100, Number(v || 0))) })}
              />
              <SettingInput
                label="Cons Debt %"
                value={String(profile.consDebtPct ?? 50)}
                keyboardType="numeric"
                onChangeText={(v) => updateProfile({ consDebtPct: Math.max(0, Math.min(100, Number(v || 0))) })}
              />
            </View>

            <View style={styles.twoColumn}>
              <SettingInput
                label="Cons Gold %"
                value={String(profile.consGoldPct ?? 10)}
                keyboardType="numeric"
                onChangeText={(v) => updateProfile({ consGoldPct: Math.max(0, Math.min(100, Number(v || 0))) })}
              />
              <SettingInput
                label="Cons Cash %"
                value={String(profile.consCashPct ?? 20)}
                keyboardType="numeric"
                onChangeText={(v) => updateProfile({ consCashPct: Math.max(0, Math.min(100, Number(v || 0))) })}
              />
            </View>
          </View>

          {/* Save Action Button */}
          <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, saving && styles.saveBtnDisabled]}>
            <Text style={styles.saveBtnText}>{saving ? "Saving Changes..." : "Save Strategy Configuration"}</Text>
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
  inputDisabled: { opacity: 0.5 },
  twoColumn: { flexDirection: "row", gap: 12 },
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
    backgroundColor: "#818cf8",
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(15), fontWeight: "700" },
});
