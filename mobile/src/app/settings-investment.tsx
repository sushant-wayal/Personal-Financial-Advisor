import React, { useCallback, useEffect, useState } from "react";
import {
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
import { useAlert } from "../providers/AlertProvider";
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
  consEquityPct?: number | null;
  consDebtPct?: number | null;
  consGoldPct?: number | null;
  equityNifty50Pct?: number | null;
  equityNiftyNext50Pct?: number | null;
  equityMidcapPct?: number | null;
};

function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

const fs = (size: number) => Math.round(size * 0.9 * 10) / 10;

function ConfigInput({
  label,
  sublabel,
  value,
  unit = "%",
  onChangeText,
  accentColor = "#818cf8",
}: {
  label: string;
  sublabel?: string;
  value: string;
  unit?: string;
  onChangeText?: (text: string) => void;
  accentColor?: string;
}) {
  return (
    <View style={styles.fieldBlock}>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {sublabel ? <Text style={styles.fieldSublabel}>{sublabel}</Text> : null}
      </View>
      <View style={styles.fieldInputWrap}>
        <TextInput
          style={styles.fieldInput}
          value={value}
          placeholder="0"
          placeholderTextColor="rgba(196,199,200,0.3)"
          onChangeText={onChangeText}
          keyboardType="numeric"
        />
        <View style={[styles.unitBadge, { backgroundColor: `${accentColor}20` }]}>
          <Text style={[styles.unitBadgeText, { color: accentColor }]}>{unit}</Text>
        </View>
      </View>
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
    setProfile((prev) => ({ ...prev, ...patch }));
  };

  const stdEquity = profile.stdEquityPct ?? 70;
  const stdDebt = profile.stdDebtPct ?? 20;
  const stdGold = profile.stdGoldPct ?? 10;
  const stdSum = stdEquity + stdDebt + stdGold;

  const consEquity = profile.consEquityPct ?? 30;
  const consDebt = profile.consDebtPct ?? 60;
  const consGold = profile.consGoldPct ?? 10;
  const consSum = consEquity + consDebt + consGold;

  const nifty50 = profile.equityNifty50Pct ?? 60;
  const niftyNext50 = profile.equityNiftyNext50Pct ?? 20;
  const midcap = profile.equityMidcapPct ?? 20;
  const eqSum = nifty50 + niftyNext50 + midcap;

  const { showSuccess, showError } = useAlert();

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          efBuildingInvestableRate: Math.max(0, Math.min(100, Number(profile.efBuildingInvestableRate ?? 20))),
          goalSprintInvestableRate: Math.max(0, Math.min(100, Number(profile.goalSprintInvestableRate ?? 40))),
          wealthBuildingInvestableRate: Math.max(0, Math.min(100, Number(profile.wealthBuildingInvestableRate ?? 100))),
          crisisInvestableRate: Math.max(0, Math.min(100, Number(profile.crisisInvestableRate ?? 0))),
          stdEquityPct: Math.max(0, Math.min(100, Number(profile.stdEquityPct ?? 70))),
          stdDebtPct: Math.max(0, Math.min(100, Number(profile.stdDebtPct ?? 20))),
          stdGoldPct: Math.max(0, Math.min(100, Number(profile.stdGoldPct ?? 10))),
          consEquityPct: Math.max(0, Math.min(100, Number(profile.consEquityPct ?? 30))),
          consDebtPct: Math.max(0, Math.min(100, Number(profile.consDebtPct ?? 60))),
          consGoldPct: Math.max(0, Math.min(100, Number(profile.consGoldPct ?? 10))),
          equityNifty50Pct: Math.max(0, Math.min(100, Number(profile.equityNifty50Pct ?? 60))),
          equityNiftyNext50Pct: Math.max(0, Math.min(100, Number(profile.equityNiftyNext50Pct ?? 20))),
          equityMidcapPct: Math.max(0, Math.min(100, Number(profile.equityMidcapPct ?? 20))),
        }),
      });

      const payload = await res.json();
      if (!res.ok || payload.ok === false) throw new Error(payload.error || "Failed to save investment settings");

      clearClientCache();
      showSuccess("Settings Saved", "Your investment strategy configuration has been updated!");
      loadData();
    } catch (e: any) {
      showError("Error", e.message || String(e));
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
          {/* Header Description Block */}
          <View style={styles.headerBlock}>
            <Text style={styles.eyebrow}>STRATEGY & ALLOCATIONS</Text>
            <Text style={styles.screenTitle}>Investment Settings</Text>
          </View>

          {/* SECTION 1: Pay Cycle & Phase Surplus Rates */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.iconBox, { backgroundColor: "rgba(129,140,248,0.15)" }]}>
                <MaterialIcons name="event-repeat" size={20} color="#818cf8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardKicker}>PAY CYCLE & PHASE DEPLOYMENT</Text>
                <Text style={styles.cardTitle}>Surplus Investment Rates</Text>
              </View>
            </View>

            <View style={styles.gridTwo}>
              <ConfigInput
                label="Salary Pay Cycle"
                value={String(profile.salaryCycleDays ?? 33)}
                unit="Days"
                onChangeText={(v) => updateProfile({ salaryCycleDays: Math.max(30, Math.min(33, Number(v || 33))) })}
                accentColor="#818cf8"
              />
              <ConfigInput
                label="Wealth Building"
                value={String(profile.wealthBuildingInvestableRate ?? 100)}
                unit="%"
                onChangeText={(v) => updateProfile({ wealthBuildingInvestableRate: Math.max(0, Math.min(100, Number(v || 0))) })}
                accentColor="#34d399"
              />
            </View>

            <View style={styles.gridTwo}>
              <ConfigInput
                label="Goal Sprint"
                value={String(profile.goalSprintInvestableRate ?? 40)}
                unit="%"
                onChangeText={(v) => updateProfile({ goalSprintInvestableRate: Math.max(0, Math.min(100, Number(v || 0))) })}
                accentColor="#fbbf24"
              />
              <ConfigInput
                label="EF Building"
                value={String(profile.efBuildingInvestableRate ?? 15)}
                unit="%"
                onChangeText={(v) => updateProfile({ efBuildingInvestableRate: Math.max(0, Math.min(100, Number(v || 0))) })}
                accentColor="#c4c7c8"
              />
            </View>

            <ConfigInput
              label="Crisis Phase"
              value={String(profile.crisisInvestableRate ?? 0)}
              unit="%"
              onChangeText={(v) => updateProfile({ crisisInvestableRate: Math.max(0, Math.min(100, Number(v || 0))) })}
              accentColor="#ffb4ab"
            />
          </View>

          {/* SECTION 2: Standard Asset Allocation (Wealth Building) */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.iconBox, { backgroundColor: "rgba(52,211,153,0.15)" }]}>
                <MaterialIcons name="pie-chart" size={20} color="#34d399" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardKicker, { color: "#34d399" }]}>WEALTH BUILDING PHASE</Text>
                <Text style={styles.cardTitle}>Standard Allocation</Text>
              </View>
              <View style={[styles.sumBadge, stdSum === 100 ? styles.sumOk : styles.sumWarn]}>
                <Text style={styles.sumBadgeText}>{stdSum}% Total</Text>
              </View>
            </View>

            {/* Live Visual Allocation Bar */}
            <View style={styles.barPreviewWrap}>
              <View style={styles.barTrack}>
                {stdEquity > 0 && <View style={{ flex: stdEquity, backgroundColor: "#818cf8" }} />}
                {stdDebt > 0 && <View style={{ flex: stdDebt, backgroundColor: "#34d399" }} />}
                {stdGold > 0 && <View style={{ flex: stdGold, backgroundColor: "#fbbf24" }} />}
              </View>
              <View style={styles.barLegendRow}>
                <Text style={{ color: "#818cf8", fontSize: fs(11), fontWeight: "600" }}>Equity {stdEquity}%</Text>
                <Text style={{ color: "#34d399", fontSize: fs(11), fontWeight: "600" }}>Debt {stdDebt}%</Text>
                <Text style={{ color: "#fbbf24", fontSize: fs(11), fontWeight: "600" }}>Gold {stdGold}%</Text>
              </View>
            </View>

            <View style={styles.gridThree}>
              <ConfigInput
                label="Equity"
                value={String(stdEquity)}
                unit="%"
                onChangeText={(v) => updateProfile({ stdEquityPct: Math.max(0, Math.min(100, Number(v || 0))) })}
                accentColor="#818cf8"
              />
              <ConfigInput
                label="Debt"
                value={String(stdDebt)}
                unit="%"
                onChangeText={(v) => updateProfile({ stdDebtPct: Math.max(0, Math.min(100, Number(v || 0))) })}
                accentColor="#34d399"
              />
              <ConfigInput
                label="Gold"
                value={String(stdGold)}
                unit="%"
                onChangeText={(v) => updateProfile({ stdGoldPct: Math.max(0, Math.min(100, Number(v || 0))) })}
                accentColor="#fbbf24"
              />
            </View>
          </View>

          {/* SECTION 3: Conservative Asset Allocation (EF Building) */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.iconBox, { backgroundColor: "rgba(251,191,36,0.15)" }]}>
                <MaterialIcons name="security" size={20} color="#fbbf24" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardKicker, { color: "#fbbf24" }]}>EMERGENCY FUND BUILDING</Text>
                <Text style={styles.cardTitle}>Conservative Allocation</Text>
              </View>
              <View style={[styles.sumBadge, consSum === 100 ? styles.sumOk : styles.sumWarn]}>
                <Text style={styles.sumBadgeText}>{consSum}% Total</Text>
              </View>
            </View>

            {/* Live Visual Allocation Bar */}
            <View style={styles.barPreviewWrap}>
              <View style={styles.barTrack}>
                {consEquity > 0 && <View style={{ flex: consEquity, backgroundColor: "#818cf8" }} />}
                {consDebt > 0 && <View style={{ flex: consDebt, backgroundColor: "#34d399" }} />}
                {consGold > 0 && <View style={{ flex: consGold, backgroundColor: "#fbbf24" }} />}
              </View>
              <View style={styles.barLegendRow}>
                <Text style={{ color: "#818cf8", fontSize: fs(11), fontWeight: "600" }}>Equity {consEquity}%</Text>
                <Text style={{ color: "#34d399", fontSize: fs(11), fontWeight: "600" }}>Debt {consDebt}%</Text>
                <Text style={{ color: "#fbbf24", fontSize: fs(11), fontWeight: "600" }}>Gold {consGold}%</Text>
              </View>
            </View>

            <View style={styles.gridThree}>
              <ConfigInput
                label="Cons Equity"
                value={String(consEquity)}
                unit="%"
                onChangeText={(v) => updateProfile({ consEquityPct: Math.max(0, Math.min(100, Number(v || 0))) })}
                accentColor="#818cf8"
              />
              <ConfigInput
                label="Cons Debt"
                value={String(consDebt)}
                unit="%"
                onChangeText={(v) => updateProfile({ consDebtPct: Math.max(0, Math.min(100, Number(v || 0))) })}
                accentColor="#34d399"
              />
              <ConfigInput
                label="Cons Gold"
                value={String(consGold)}
                unit="%"
                onChangeText={(v) => updateProfile({ consGoldPct: Math.max(0, Math.min(100, Number(v || 0))) })}
                accentColor="#fbbf24"
              />
            </View>
          </View>

          {/* SECTION 4: Equity Sub-Category Market Cap Ratio */}
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <View style={[styles.iconBox, { backgroundColor: "rgba(129,140,248,0.15)" }]}>
                <MaterialIcons name="show-chart" size={20} color="#818cf8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardKicker}>EQUITY MARKET CAP SPLIT</Text>
                <Text style={styles.cardTitle}>Equity Breakdown</Text>
              </View>
              <View style={[styles.sumBadge, eqSum === 100 ? styles.sumOk : styles.sumWarn]}>
                <Text style={styles.sumBadgeText}>{eqSum}% Total</Text>
              </View>
            </View>

            <View style={styles.gridThree}>
              <ConfigInput
                label="Nifty 50"
                value={String(nifty50)}
                unit="%"
                onChangeText={(v) => updateProfile({ equityNifty50Pct: Math.max(0, Math.min(100, Number(v || 0))) })}
                accentColor="#818cf8"
              />
              <ConfigInput
                label="Nifty Next 50"
                value={String(niftyNext50)}
                unit="%"
                onChangeText={(v) => updateProfile({ equityNiftyNext50Pct: Math.max(0, Math.min(100, Number(v || 0))) })}
                accentColor="#818cf8"
              />
              <ConfigInput
                label="Midcap"
                value={String(midcap)}
                unit="%"
                onChangeText={(v) => updateProfile({ equityMidcapPct: Math.max(0, Math.min(100, Number(v || 0))) })}
                accentColor="#818cf8"
              />
            </View>
          </View>

          {/* Action Save Button */}
          <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, saving && styles.saveBtnDisabled]}>
            <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save"}</Text>
          </Pressable>
        </KeyboardAwareScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#131313" },
  topBar: {
    height: 70,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(68,71,72,0.20)",
    backgroundColor: "rgba(19,19,19,0.96)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  backButtonText: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(11), letterSpacing: 1.4, fontWeight: "700" },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 120, gap: 20 },
  headerBlock: { gap: 4 },
  eyebrow: { color: "#818cf8", fontFamily: "JetBrains Mono", fontSize: fs(10), letterSpacing: 1.6, textTransform: "uppercase", fontWeight: "700" },
  screenTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(26), lineHeight: 32, fontWeight: "700" },
  screenSub: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(13), lineHeight: 18 },
  card: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(68,71,72,0.35)", backgroundColor: "#0e0e0e", padding: 18, gap: 14 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardKicker: { color: "#818cf8", fontFamily: "JetBrains Mono", fontSize: fs(10), letterSpacing: 1.2, fontWeight: "700" },
  cardTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(16), fontWeight: "700" },
  cardDescription: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(12), lineHeight: 17 },
  sumBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  sumOk: { backgroundColor: "rgba(52,211,153,0.15)", borderColor: "rgba(52,211,153,0.3)" },
  sumWarn: { backgroundColor: "rgba(251,191,36,0.15)", borderColor: "rgba(251,191,36,0.3)" },
  sumBadgeText: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(11), fontWeight: "700" },
  gridTwo: { flexDirection: "row", gap: 10 },
  gridThree: { flexDirection: "row", gap: 8 },
  fieldBlock: { flex: 1, gap: 4 },
  fieldHeader: { gap: 1 },
  fieldLabel: { color: "#ffffff", fontFamily: "Inter", fontSize: fs(12), fontWeight: "600" },
  fieldSublabel: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(10) },
  fieldInputWrap: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(68,71,72,0.40)",
    backgroundColor: "#171819",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    paddingRight: 6,
    overflow: "hidden",
  },
  fieldInput: {
    flex: 1,
    color: "#ffffff",
    fontFamily: "JetBrains Mono",
    fontSize: fs(14),
    fontWeight: "700",
    padding: 0,
  },
  unitBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unitBadgeText: {
    fontFamily: "JetBrains Mono",
    fontSize: fs(11),
    fontWeight: "700",
  },
  barPreviewWrap: { gap: 6, marginVertical: 2 },
  barTrack: { height: 10, borderRadius: 999, flexDirection: "row", overflow: "hidden", backgroundColor: "rgba(0,0,0,0.5)" },
  barLegendRow: { flexDirection: "row", justifyContent: "space-between" },
  equityPreviewWrap: { marginVertical: 2 },
  gridThreePreview: { flexDirection: "row", gap: 6 },
  eqPill: { flex: 1, padding: 8, borderRadius: 8, borderWidth: 1, alignItems: "center", gap: 2 },
  saveBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#818cf8",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(16), fontWeight: "700" },
});
