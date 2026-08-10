import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL } from "../lib/apiBaseUrl";
import { formatCurrencyAmount, useCurrency } from "../providers/CurrencyProvider";

import { InvestmentsSkeleton } from "../components/LoadingSkeleton";

function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

const fs = (size: number) => Math.round(size * 0.9 * 10) / 10;

export default function InvestmentsScreen() {
  useCurrency();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [suggestionData, setSuggestionData] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);

  // Sub-allocation state
  const [equity, setEquity] = useState<number>(0);
  const [debt, setDebt] = useState<number>(0);
  const [gold, setGold] = useState<number>(0);

  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [resSuggest, resHistory] = await Promise.all([
        fetch(apiUrl("/api/investments")),
        fetch(apiUrl("/api/investments/history")),
      ]);

      const dataSuggest = await resSuggest.json();
      const dataHistory = await resHistory.json();

      if (dataSuggest.ok) {
        setSuggestionData(dataSuggest);
        const buckets = dataSuggest.suggestion?.buckets;
        if (buckets) {
          setEquity(buckets.equity?.final ?? 0);
          setDebt(buckets.debt?.final ?? 0);
          setGold(buckets.gold?.final ?? 0);
        }
      }

      if (dataHistory.ok) {
        setHistoryData(dataHistory.history ?? []);
      }
    } catch (e: any) {
      console.error("Failed to load investment data", e);
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

  const suggestion = suggestionData?.suggestion;
  const isInvested = suggestion?.status === "INVESTED";
  const isCrisis = suggestion?.phase === "CRISIS";

  const totalAllocated = equity + debt + gold;
  const maxAllowed = suggestion?.maxInvestable ?? 0;
  const isOverCap = totalAllocated > maxAllowed;

  // Dynamic Equity sub-allocation ratios from server suggestion
  const eqBreakdown = suggestion?.buckets?.equity?.breakdown;
  const n50Pct = eqBreakdown?.nifty50?.pctOfEquity ?? 60;
  const nn50Pct = eqBreakdown?.niftyNext50?.pctOfEquity ?? 20;
  const mcPct = eqBreakdown?.midcap?.pctOfEquity ?? 20;

  const nifty50 = Math.round(equity * (n50Pct / 100));
  const niftyNext50 = Math.round(equity * (nn50Pct / 100));
  const midcap = Math.max(0, equity - nifty50 - niftyNext50);

  const phaseColor = isCrisis ? "#ffb4ab" : isInvested ? "#6ee7b7" : suggestion?.phase === "WEALTH_BUILDING" ? "#05e777" : suggestion?.phase === "EF_BUILDING" ? "#ffd54f" : "#b0c6ff";

  // Handle Save
  const handleSave = async () => {
    if (isOverCap) {
      Alert.alert("Cap Exceeded", `Total allocation (${formatCurrencyAmount(totalAllocated, "INR")}) cannot exceed liquid balance (${formatCurrencyAmount(maxAllowed, "INR")}).`);
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(apiUrl("/api/investments"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equity, debt, gold }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      Alert.alert("Allocations Saved", "Your custom investment amounts have been saved!");
      loadData();
    } catch (e: any) {
      Alert.alert("Error", e.message || String(e));
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Mark as Invested
  const handleInvest = async () => {
    if (isOverCap) {
      Alert.alert("Cap Exceeded", "Please resolve allocation overflow before marking as invested.");
      return;
    }

    setActionLoading(true);
    try {
      await fetch(apiUrl("/api/investments"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equity, debt, gold }),
      });

      const res = await fetch(apiUrl("/api/investments/invest"), { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Record failed");
      Alert.alert("Investment Recorded!", "Marked as invested. Your streak has been updated! 🔥");
      loadData();
    } catch (e: any) {
      Alert.alert("Error", e.message || String(e));
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Reset
  const handleReset = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(apiUrl("/api/investments/reset"), { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reset failed");
      Alert.alert("Reset Complete", "Allocations restored to system suggested defaults.");
      loadData();
    } catch (e: any) {
      Alert.alert("Error", e.message || String(e));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar barStyle="light-content" backgroundColor="#131313" />
        <InvestmentsSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#131313" />

      {/* Top Bar Navigation */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={24} color="#ffffff" />
          <Text style={styles.backButtonText}>GOALS</Text>
        </Pressable>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Pressable
            onPress={() => router.push("/investment-history")}
            style={({ pressed }) => [styles.topHistoryPill, pressed ? styles.cardPressed : null]}
          >
            <MaterialIcons name="history" size={16} color="#818cf8" />
            <Text style={styles.topHistoryPillText}>History</Text>
          </Pressable>

          {suggestion?.streak > 1 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakBadgeText}>🔥 {suggestion.streak}</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Block */}
        <View style={styles.headerBlock}>
          <Text style={styles.eyebrow}>Percentage of Surplus Strategy</Text>
          <Text style={styles.screenTitle}>Monthly Investment</Text>
          <Text style={styles.screenSub}>
            Auto-computed based on your {suggestion?.cycleDays ?? 33}-day pay cycle income & spending surplus.
          </Text>
        </View>

        {/* Low Surplus Warning Banner */}
        {suggestion?.belowMinThreshold && !isInvested && (
          <View style={styles.warningBanner}>
            <MaterialIcons name="warning-amber" size={20} color="#ffd54f" />
            <Text style={styles.warningBannerText}>
              Low Surplus Warning: Smoothed surplus ({formatCurrencyAmount(suggestion?.smoothedSurplus ?? 0, "INR")}) is below ₹500 minimum threshold. Emergency reserves take priority.
            </Text>
          </View>
        )}

        {/* Hero Strategy Card */}
        <View style={[styles.heroCard, isInvested ? { borderColor: "rgba(16,185,129,0.35)" } : { borderColor: "rgba(68,71,72,0.35)" }]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleWrap}>
              <View style={styles.titleIconAvatar}>
                <MaterialIcons name={isInvested ? "check-circle" : "pie-chart"} size={18} color={isInvested ? "#34d399" : "#818cf8"} />
              </View>
              <Text style={styles.heroCardTitle} numberOfLines={1}>{isInvested ? "Investment Complete" : "Active Allocation"}</Text>
            </View>
            <View style={[styles.phasePill, { borderColor: `${phaseColor}40`, backgroundColor: `${phaseColor}15` }]}>
              <Text style={[styles.phasePillText, { color: phaseColor }]} numberOfLines={1}>{suggestion?.phaseLabel}</Text>
            </View>
          </View>

          <View style={{ marginVertical: 12 }}>
            <Text style={styles.eyebrow}>{isInvested ? "Total Invested Capital" : "Recommended Investment"}</Text>
            <Text style={[styles.heroAmountText, isInvested ? { color: "#6ee7b7" } : { color: "#ffffff" }]}>
              {formatCurrencyAmount(isInvested ? suggestion?.totalInvestable : totalAllocated, "INR")}
            </Text>
          </View>

          {/* Allocation Progress Visualizer */}
          {totalAllocated > 0 && (
            <View style={{ gap: 8 }}>
              <View style={styles.progressTrack}>
                <View style={{ flexDirection: "row", height: "100%", width: "100%", overflow: "hidden", borderRadius: 999 }}>
                  {equity > 0 && <View style={{ flex: equity, backgroundColor: "#818cf8" }} />}
                  {debt > 0 && <View style={{ flex: debt, backgroundColor: "#34d399" }} />}
                  {gold > 0 && <View style={{ flex: gold, backgroundColor: "#fbbf24" }} />}
                </View>
              </View>
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#818cf8" }]} />
                  <Text style={styles.legendLabel}>Equity {Math.round((equity / totalAllocated) * 100)}%</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#34d399" }]} />
                  <Text style={styles.legendLabel}>Debt {Math.round((debt / totalAllocated) * 100)}%</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: "#fbbf24" }]} />
                  <Text style={styles.legendLabel}>Gold {Math.round((gold / totalAllocated) * 100)}%</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Bucket Configuration Card */}
        {!isInvested ? (
          <View style={styles.panelCard}>
            <View style={styles.cardHeadingRow}>
              <View style={styles.cardHeadingCopy}>
                <Text style={styles.sectionTitle}>Asset Sub-Allocations</Text>
                <Text style={styles.sectionSubtext}>Adjust bucket amounts (Equity 70%, Debt 20%, Gold 10% default). Total is capped by liquid balance.</Text>
              </View>
            </View>

            <View style={styles.inputGrid}>
              {/* Equity */}
              <View style={styles.inputBox}>
                <View style={styles.inputLabelRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={[styles.bucketDot, { backgroundColor: "#818cf8" }]} />
                    <Text style={[styles.bucketTitle, { color: "#818cf8" }]}>Equity (Growth)</Text>
                  </View>
                  <Text style={styles.pctBadge}>{totalAllocated > 0 ? Math.round((equity / totalAllocated) * 100) : 0}%</Text>
                </View>
                <View style={styles.inputWrap}>
                  <Text style={styles.inputPrefix}>₹</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={String(equity)}
                    onChangeText={(val) => setEquity(Math.max(0, Number(val) || 0))}
                    style={styles.textInput}
                    placeholderTextColor="rgba(196,199,200,0.4)"
                  />
                </View>
                <Text style={styles.suggestedNote}>Suggested: {formatCurrencyAmount(suggestion?.buckets?.equity?.suggested ?? 0, "INR")}</Text>

                {/* Equity Category Distribution */}
                <View style={{ marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: "rgba(0,0,0,0.4)", borderWidth: 1, borderColor: "rgba(129,140,248,0.25)" }}>
                  <Text style={{ color: "#818cf8", fontFamily: "Inter", fontSize: fs(11), fontWeight: "700", textTransform: "uppercase", marginBottom: 6 }}>
                    Equity Sub-Category Breakdown
                  </Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 4 }}>
                    <View style={{ flex: 1, padding: 6, borderRadius: 6, backgroundColor: "rgba(129,140,248,0.1)", alignItems: "center" }}>
                      <Text style={{ color: "#c4c7c8", fontSize: fs(10) }}>Nifty 50 ({n50Pct}%)</Text>
                      <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: fs(11), marginTop: 2 }}>{formatCurrencyAmount(nifty50, "INR")}</Text>
                    </View>
                    <View style={{ flex: 1, padding: 6, borderRadius: 6, backgroundColor: "rgba(129,140,248,0.1)", alignItems: "center" }}>
                      <Text style={{ color: "#c4c7c8", fontSize: fs(10) }}>Nifty Next 50 ({nn50Pct}%)</Text>
                      <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: fs(11), marginTop: 2 }}>{formatCurrencyAmount(niftyNext50, "INR")}</Text>
                    </View>
                    <View style={{ flex: 1, padding: 6, borderRadius: 6, backgroundColor: "rgba(129,140,248,0.1)", alignItems: "center" }}>
                      <Text style={{ color: "#c4c7c8", fontSize: fs(10) }}>Midcap ({mcPct}%)</Text>
                      <Text style={{ color: "#ffffff", fontWeight: "700", fontSize: fs(11), marginTop: 2 }}>{formatCurrencyAmount(midcap, "INR")}</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Debt */}
              <View style={styles.inputBox}>
                <View style={styles.inputLabelRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={[styles.bucketDot, { backgroundColor: "#34d399" }]} />
                    <Text style={[styles.bucketTitle, { color: "#34d399" }]}>Debt (Stability)</Text>
                  </View>
                  <Text style={styles.pctBadge}>{totalAllocated > 0 ? Math.round((debt / totalAllocated) * 100) : 0}%</Text>
                </View>
                <View style={styles.inputWrap}>
                  <Text style={styles.inputPrefix}>₹</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={String(debt)}
                    onChangeText={(val) => setDebt(Math.max(0, Number(val) || 0))}
                    style={styles.textInput}
                    placeholderTextColor="rgba(196,199,200,0.4)"
                  />
                </View>
                <Text style={styles.suggestedNote}>Suggested: {formatCurrencyAmount(suggestion?.buckets?.debt?.suggested ?? 0, "INR")}</Text>
              </View>

              {/* Gold */}
              <View style={styles.inputBox}>
                <View style={styles.inputLabelRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={[styles.bucketDot, { backgroundColor: "#fbbf24" }]} />
                    <Text style={[styles.bucketTitle, { color: "#fbbf24" }]}>Gold (Hedge)</Text>
                  </View>
                  <Text style={styles.pctBadge}>{totalAllocated > 0 ? Math.round((gold / totalAllocated) * 100) : 0}%</Text>
                </View>
                <View style={styles.inputWrap}>
                  <Text style={styles.inputPrefix}>₹</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={String(gold)}
                    onChangeText={(val) => setGold(Math.max(0, Number(val) || 0))}
                    style={styles.textInput}
                    placeholderTextColor="rgba(196,199,200,0.4)"
                  />
                </View>
                <Text style={styles.suggestedNote}>Suggested: {formatCurrencyAmount(suggestion?.buckets?.gold?.suggested ?? 0, "INR")}</Text>
              </View>
            </View>

            {/* Liquid Balance Cap Summary */}
            <View style={styles.capSummaryRow}>
              <View>
                <Text style={styles.eyebrow}>Total Allocated</Text>
                <Text style={[styles.capAmountVal, isOverCap ? styles.dangerText : { color: "#34d399" }]}>
                  {formatCurrencyAmount(totalAllocated, "INR")}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.eyebrow}>Liquid Balance Cap</Text>
                <Text style={styles.capMaxVal}>{formatCurrencyAmount(maxAllowed, "INR")}</Text>
              </View>
            </View>

            {isOverCap && (
              <View style={styles.errorPill}>
                <MaterialIcons name="error-outline" size={16} color="#ffb4ab" />
                <Text style={styles.errorPillText}>Total allocation exceeds liquid balance limit. Please reduce amounts.</Text>
              </View>
            )}

            {/* Actions Bar */}
            <View style={styles.actionBlock}>
              <Pressable
                onPress={handleInvest}
                disabled={actionLoading || isOverCap || totalAllocated === 0}
                style={({ pressed }) => [
                  styles.mainInvestButton,
                  (actionLoading || isOverCap || totalAllocated === 0) && { opacity: 0.5 },
                  pressed ? styles.cardPressed : null,
                ]}
              >
                <MaterialIcons name="check-circle" size={20} color="#000000" />
                <Text style={styles.mainInvestButtonText}>Mark as Invested</Text>
              </Pressable>

              <View style={styles.secondaryActionRow}>
                <Pressable
                  onPress={handleSave}
                  disabled={actionLoading || isOverCap}
                  style={({ pressed }) => [
                    styles.saveButton,
                    (actionLoading || isOverCap) && { opacity: 0.5 },
                    pressed ? styles.cardPressed : null,
                  ]}
                >
                  <MaterialIcons name="save" size={18} color="#ffffff" />
                  <Text style={styles.saveButtonText}>Save Amounts</Text>
                </Pressable>

                <Pressable
                  onPress={handleReset}
                  disabled={actionLoading}
                  style={({ pressed }) => [
                    styles.resetButton,
                    actionLoading && { opacity: 0.5 },
                    pressed ? styles.cardPressed : null,
                  ]}
                >
                  <MaterialIcons name="refresh" size={18} color="#c4c7c8" />
                  <Text style={styles.resetButtonText}>Reset</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          /* Invested Active Status Card */
          <View style={[styles.panelCard, { borderColor: "rgba(16,185,129,0.35)", backgroundColor: "#0e0e0e" }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(16,185,129,0.15)", alignItems: "center", justifyContent: "center" }}>
                <MaterialIcons name="check-circle" size={26} color="#34d399" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(18), fontWeight: "700" }}>Investment Confirmed!</Text>
                <Text style={{ color: "#8e9192", fontFamily: "Inter", fontSize: fs(13), marginTop: 2 }}>
                  Next investment suggestion will compute in {suggestion?.nextSuggestionIn ?? suggestion?.cycleDays} days.
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>Equity: {formatCurrencyAmount(suggestion?.buckets?.equity?.final ?? 0, "INR")}</Text>
              </View>
              <View style={styles.chip}>
                <Text style={styles.chipText}>Debt: {formatCurrencyAmount(suggestion?.buckets?.debt?.final ?? 0, "INR")}</Text>
              </View>
              <View style={styles.chip}>
                <Text style={styles.chipText}>Gold: {formatCurrencyAmount(suggestion?.buckets?.gold?.final ?? 0, "INR")}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Computation Audit Panel */}
        <View style={styles.panelCard}>
          <View style={styles.cardHeadingRow}>
            <View style={styles.cardHeadingCopy}>
              <Text style={styles.sectionTitle}>Computation Audit</Text>
              <Text style={styles.sectionSubtext}>Transparent mathematical breakdown of allocation formulas</Text>
            </View>
          </View>

          <View style={styles.auditTable}>
            <View style={styles.auditRow}>
              <Text style={styles.auditLabel}>Pay Cycle Length</Text>
              <Text style={styles.auditVal}>{suggestion?.cycleDays ?? 33} days</Text>
            </View>
            <View style={styles.auditRow}>
              <Text style={styles.auditLabel}>Raw Cycle Surplus</Text>
              <Text style={styles.auditVal}>{formatCurrencyAmount(suggestion?.rawSurplus ?? 0, "INR")}</Text>
            </View>
            <View style={styles.auditRow}>
              <Text style={styles.auditLabel}>Smoothed Surplus (0.7/0.3)</Text>
              <Text style={[styles.auditVal, { color: "#818cf8" }]}>{formatCurrencyAmount(suggestion?.smoothedSurplus ?? 0, "INR")}</Text>
            </View>
            <View style={styles.auditRow}>
              <Text style={styles.auditLabel}>Phase Rate ({suggestion?.phase})</Text>
              <Text style={styles.auditVal}>{suggestion?.investableRate ?? 0}%</Text>
            </View>
            <View style={styles.auditRow}>
              <Text style={styles.auditLabel}>Base Investable Capital</Text>
              <Text style={styles.auditVal}>{formatCurrencyAmount(suggestion?.baseInvestable ?? 0, "INR")}</Text>
            </View>
            <View style={[styles.auditRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.auditLabel}>EF & Goal Spillover</Text>
              <Text style={[styles.auditVal, { color: "#34d399" }]}>{formatCurrencyAmount(suggestion?.spillover ?? 0, "INR")}</Text>
            </View>
          </View>
        </View>

        {/* Compact Navigation Button to Dedicated Investment History Screen */}
        <Pressable
          onPress={() => router.push("/investment-history")}
          style={({ pressed }) => [styles.historyLinkButton, pressed ? styles.cardPressed : null]}
        >
          <MaterialIcons name="history" size={18} color="#818cf8" />
          <Text style={styles.historyLinkText}>View Investment History ({historyData.length})</Text>
          <MaterialIcons name="chevron-right" size={18} color="#818cf8" />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#131313" },
  loadingCenter: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14 },
  loadingText: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(14) },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 132, gap: 24 },
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
  topHistoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(129, 140, 248, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(129, 140, 248, 0.4)",
  },
  topHistoryPillText: { color: "#818cf8", fontFamily: "JetBrains Mono", fontSize: fs(10), fontWeight: "700", letterSpacing: 0.5 },
  historyLinkButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(129,140,248,0.3)",
    backgroundColor: "rgba(129,140,248,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
  },
  historyLinkText: { color: "#818cf8", fontFamily: "Hanken Grotesk", fontSize: fs(14), fontWeight: "600" },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
  },
  streakBadgeText: { color: "#fbbf24", fontFamily: "JetBrains Mono", fontSize: fs(10), fontWeight: "700", letterSpacing: 0.5 },
  headerBlock: { gap: 6 },
  eyebrow: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(10), letterSpacing: 1.6, textTransform: "uppercase", fontWeight: "700" },
  screenTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(30), lineHeight: 38, fontWeight: "700" },
  screenSub: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(13), lineHeight: 19 },
  warningBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,213,79,0.30)",
    backgroundColor: "rgba(255,213,79,0.08)",
    padding: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  warningBannerText: { flex: 1, color: "#ffd54f", fontFamily: "Inter", fontSize: fs(13), lineHeight: 19 },
  heroCard: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(68,71,72,0.35)", backgroundColor: "#0e0e0e", padding: 20, gap: 10 },
  cardTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, minWidth: 120 },
  titleIconAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  heroCardTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(17), fontWeight: "600", flexShrink: 1 },
  cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" },
  phasePill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "center", flexShrink: 0 },
  phasePillText: { fontFamily: "JetBrains Mono", fontSize: fs(9), fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  heroAmountText: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(32), fontWeight: "700", marginTop: 4 },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: "rgba(0,0,0,0.5)", overflow: "hidden" },
  legendRow: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendLabel: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(11) },
  panelCard: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(68,71,72,0.35)", backgroundColor: "#0e0e0e", padding: 22, gap: 20 },
  cardHeadingRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  cardHeadingCopy: { flex: 1 },
  sectionTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(20), lineHeight: 28, fontWeight: "600" },
  sectionSubtext: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(13), lineHeight: 19, marginTop: 2 },
  inputGrid: { gap: 14 },
  inputBox: { borderRadius: 12, borderWidth: 1, borderColor: "rgba(68,71,72,0.35)", backgroundColor: "#131313", padding: 16, gap: 10 },
  inputLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bucketDot: { width: 8, height: 8, borderRadius: 4 },
  bucketTitle: { fontFamily: "Hanken Grotesk", fontSize: fs(15), fontWeight: "600" },
  pctBadge: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(11) },
  inputWrap: { minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "#1a1a1a", flexDirection: "row", alignItems: "center", paddingHorizontal: 14 },
  inputPrefix: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(16), marginRight: 8 },
  textInput: { flex: 1, color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(18), fontWeight: "700", paddingVertical: 8 },
  suggestedNote: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(12) },
  capSummaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "rgba(68,71,72,0.20)", paddingTop: 16 },
  capAmountVal: { fontFamily: "JetBrains Mono", fontSize: fs(22), fontWeight: "700", marginTop: 2 },
  capMaxVal: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(22), fontWeight: "700", marginTop: 2 },
  dangerText: { color: "#ffb4ab" },
  errorPill: { borderRadius: 8, borderWidth: 1, borderColor: "rgba(255,180,171,0.30)", backgroundColor: "rgba(255,180,171,0.08)", padding: 12, flexDirection: "row", gap: 8, alignItems: "center" },
  errorPillText: { flex: 1, color: "#ffb4ab", fontFamily: "Inter", fontSize: fs(12), lineHeight: 17 },
  actionBlock: { gap: 10, paddingTop: 4 },
  mainInvestButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#05e777",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  mainInvestButtonText: {
    color: "#000000",
    fontFamily: "Hanken Grotesk",
    fontSize: fs(15),
    fontWeight: "700",
  },
  secondaryActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  saveButton: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  saveButtonText: {
    color: "#ffffff",
    fontFamily: "Hanken Grotesk",
    fontSize: fs(14),
    fontWeight: "600",
  },
  resetButton: {
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  resetButtonText: {
    color: "#c4c7c8",
    fontFamily: "Hanken Grotesk",
    fontSize: fs(14),
    fontWeight: "600",
  },
  cardPressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
  chip: { borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)", paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { color: "#6ee7b7", fontFamily: "JetBrains Mono", fontSize: fs(12), fontWeight: "600" },
  auditTable: { borderRadius: 12, borderWidth: 1, borderColor: "rgba(68,71,72,0.35)", backgroundColor: "#131313", overflow: "hidden" },
  auditRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "rgba(68,71,72,0.20)" },
  auditLabel: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(13) },
  auditVal: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(13), fontWeight: "600" },
  emptyState: { paddingVertical: 32, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(13) },
  historyList: { gap: 12 },
  historyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(68,71,72,0.20)" },
  historyTotalVal: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(16), fontWeight: "700" },
  historyMeta: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(11), marginTop: 3 },
  historyDate: { color: "#8e9192", fontFamily: "JetBrains Mono", fontSize: fs(12) },
});
