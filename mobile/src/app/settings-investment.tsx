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
import { SettingsSkeleton } from "../components/LoadingSkeleton";
import { clearClientCache } from "../lib/clientCache";

type Profile = {
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
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChangeText?: (text: string) => void;
  keyboardType?: "default" | "numeric";
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        placeholder={placeholder}
        placeholderTextColor="#5f6368"
        onChangeText={onChangeText}
        keyboardType={keyboardType}
      />
    </View>
  );
}

export default function InvestmentSettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<Profile>({});

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/profile"));
      const data = await res.json();
      if (res.ok && data.profile) {
        setProfile(data.profile);
      }
    } catch (e: any) {
      console.error("Failed to load investment settings", e);
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
      if (!res.ok || payload.ok === false) throw new Error(payload.error || "Failed to save investment settings");

      clearClientCache();
      Alert.alert("Investment Settings Saved", "Pay cycle timing and phase sub-allocation parameters updated.");
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
            <Text style={styles.eyebrow}>Strategy Parameters</Text>
            <Text style={styles.screenTitle}>Investment Settings</Text>
            <Text style={styles.screenSub}>
              Customize salary pay cycle length, phase investable rates, and target asset sub-allocation splits.
            </Text>
          </View>

          {/* Investment Strategy Configuration Section */}
          <View style={styles.panelCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionKicker}>Pay Cycle & Phase Investable Rates</Text>
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
            <Text style={styles.saveBtnText}>{saving ? "Saving Changes..." : "Save Investment Settings"}</Text>
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
  sectionKicker: { color: "#818cf8", fontFamily: "JetBrains Mono", fontSize: fs(11), letterSpacing: 1.6, textTransform: "uppercase", fontWeight: "700" },
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
  twoColumn: { flexDirection: "row", gap: 12 },
  smallLabel: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(11), fontWeight: "700" },
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
