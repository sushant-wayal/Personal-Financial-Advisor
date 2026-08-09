import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL } from "../lib/apiBaseUrl";
import { formatCurrencyAmount, useCurrency } from "../providers/CurrencyProvider";

import { InvestmentHistoryCardSkeleton, InvestmentHistorySkeleton } from "../components/LoadingSkeleton";

function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

const fs = (size: number) => Math.round(size * 0.9 * 10) / 10;

const INITIAL_PAGE_SIZE = 5;
const PAGE_INCREMENT = 5;

export default function InvestmentHistoryScreen() {
  useCurrency();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [streak, setStreak] = useState<number>(0);
  const [displayLimit, setDisplayLimit] = useState(INITIAL_PAGE_SIZE);

  const loadData = useCallback(async () => {
    try {
      const [resHistory, resSuggest] = await Promise.all([
        fetch(apiUrl("/api/investments/history")),
        fetch(apiUrl("/api/investments")),
      ]);

      const dataHistory = await resHistory.json();
      const dataSuggest = await resSuggest.json();

      if (dataHistory.ok) {
        setHistoryData(dataHistory.history ?? []);
      }
      if (dataSuggest.ok && dataSuggest.suggestion) {
        setStreak(dataSuggest.suggestion.streak ?? 0);
      }
    } catch (e: any) {
      console.error("Failed to load investment history", e);
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
    setDisplayLimit(INITIAL_PAGE_SIZE);
    loadData();
  };

  const totalLifetimeInvested = historyData.reduce((sum, item) => sum + Number(item.totalInvested || 0), 0);
  const visibleHistory = historyData.slice(0, displayLimit);
  const hasMore = historyData.length > displayLimit;

  const handleScroll = useCallback(
    (event: any) => {
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 200;

      if (isNearBottom && hasMore && !loadingMore) {
        setLoadingMore(true);
        setTimeout(() => {
          setDisplayLimit((prev) => prev + PAGE_INCREMENT);
          setLoadingMore(false);
        }, 500);
      }
    },
    [hasMore, loadingMore],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar barStyle="light-content" backgroundColor="#131313" />
        <InvestmentHistorySkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#131313" />

      {/* Top Navigation Bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={24} color="#ffffff" />
          <Text style={styles.backButtonText}>INVESTMENTS</Text>
        </Pressable>
        {streak > 0 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakBadgeText}>🔥 {streak} STREAK</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={handleScroll}
      >
        {/* Header Block */}
        <View style={styles.headerBlock}>
          <Text style={styles.eyebrow}>Past Cycles & Records</Text>
          <Text style={styles.screenTitle}>Investment History</Text>
          <Text style={styles.screenSub}>
            Complete record of your monthly percentage-of-surplus investment allocations.
          </Text>
        </View>

        {/* Lifetime Summary Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Lifetime Invested</Text>
            <Text style={styles.statValue}>{formatCurrencyAmount(totalLifetimeInvested, "INR")}</Text>
            <Text style={styles.statNote}>Across all completed cycles</Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Completed Cycles</Text>
            <Text style={styles.statValue}>{historyData.length}</Text>
            <Text style={styles.statNote}>{streak > 0 ? `🔥 ${streak} cycle streak active` : "Track monthly growth"}</Text>
          </View>
        </View>

        {/* Timeline List Section */}
        <View style={styles.panelCard}>
          <View style={styles.cardHeadingRow}>
            <View style={styles.cardHeadingCopy}>
              <Text style={styles.sectionTitle}>History Timeline</Text>
              <Text style={styles.sectionSubtext}>Showing {visibleHistory.length} of {historyData.length} recorded cycles</Text>
            </View>
          </View>

          {historyData.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconAvatar}>
                <MaterialIcons name="history" size={28} color="#8e9192" />
              </View>
              <Text style={styles.emptyTitle}>No Recorded History Yet</Text>
              <Text style={styles.emptyText}>
                When you click &apos;Mark as Invested&apos; on your monthly strategy screen, your completed allocations will be logged here.
              </Text>
            </View>
          ) : (
            <View style={styles.historyTimeline}>
              {visibleHistory.map((item, index) => {
                const date = new Date(item.investedAt);
                const dateFormatted = Number.isNaN(date.getTime())
                  ? "Recorded Cycle"
                  : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                const phaseColor = item.phase === "WEALTH_BUILDING" ? "#05e777" : item.phase === "EF_BUILDING" ? "#ffd54f" : "#b0c6ff";

                return (
                  <View key={item.id || index} style={styles.historyCard}>
                    {/* Header Row */}
                    <View style={styles.historyCardHeader}>
                      <View style={styles.historyDateWrap}>
                        <MaterialIcons name="event" size={16} color="#818cf8" />
                        <Text style={styles.historyDateText}>{dateFormatted}</Text>
                      </View>
                      {item.phase && (
                        <View style={[styles.phasePill, { borderColor: `${phaseColor}40`, backgroundColor: `${phaseColor}15` }]}>
                          <Text style={[styles.phasePillText, { color: phaseColor }]}>{item.phase.replace(/_/g, " ")}</Text>
                        </View>
                      )}
                    </View>

                    {/* Total Invested */}
                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>Total Invested</Text>
                      <Text style={styles.totalVal}>{formatCurrencyAmount(item.totalInvested, "INR")}</Text>
                    </View>

                    {/* Sub-allocations */}
                    <View style={styles.bucketGrid}>
                      <View style={[styles.bucketChip, { borderColor: "rgba(129,140,248,0.3)" }]}>
                        <Text style={[styles.bucketChipLabel, { color: "#818cf8" }]}>Equity</Text>
                        <Text style={styles.bucketChipVal}>{formatCurrencyAmount(item.equity, "INR")}</Text>
                      </View>
                      <View style={[styles.bucketChip, { borderColor: "rgba(52,211,153,0.3)" }]}>
                        <Text style={[styles.bucketChipLabel, { color: "#34d399" }]}>Debt</Text>
                        <Text style={styles.bucketChipVal}>{formatCurrencyAmount(item.debt, "INR")}</Text>
                      </View>
                      <View style={[styles.bucketChip, { borderColor: "rgba(251,191,36,0.3)" }]}>
                        <Text style={[styles.bucketChipLabel, { color: "#fbbf24" }]}>Gold</Text>
                        <Text style={styles.bucketChipVal}>{formatCurrencyAmount(item.gold, "INR")}</Text>
                      </View>
                      <View style={[styles.bucketChip, { borderColor: "rgba(196,199,200,0.3)" }]}>
                        <Text style={[styles.bucketChipLabel, { color: "#c4c7c8" }]}>Cash</Text>
                        <Text style={styles.bucketChipVal}>{formatCurrencyAmount(item.cash, "INR")}</Text>
                      </View>
                    </View>

                    {/* Audit Metadata if available */}
                    {(item.rawSurplus != null || item.notes) && (
                      <View style={styles.metaRow}>
                        {item.rawSurplus != null && (
                          <Text style={styles.metaText}>
                            Surplus: {formatCurrencyAmount(item.rawSurplus, "INR")}
                          </Text>
                        )}
                        {item.notes ? (
                          <View style={styles.noteBox}>
                            <MaterialIcons name="notes" size={14} color="#818cf8" style={{ marginTop: 2 }} />
                            <Text style={styles.noteText}>{item.notes}</Text>
                          </View>
                        ) : null}
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Dynamic Skeleton Loading on Scroll */}
              {loadingMore && <InvestmentHistoryCardSkeleton />}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#131313" },
  loadingCenter: { flex: 1, justifyContent: "center", alignItems: "center", gap: 14 },
  loadingText: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(14) },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 160, gap: 24 },
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
  statsGrid: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, minHeight: 120, borderRadius: 16, borderWidth: 1, borderColor: "rgba(68,71,72,0.35)", backgroundColor: "#0e0e0e", padding: 18, gap: 6 },
  statLabel: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(10), letterSpacing: 1.2, textTransform: "uppercase", fontWeight: "700" },
  statValue: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(24), lineHeight: 30, fontWeight: "700" },
  statNote: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(12) },
  panelCard: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(68,71,72,0.35)", backgroundColor: "#0e0e0e", padding: 22, gap: 20 },
  cardHeadingRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  cardHeadingCopy: { flex: 1 },
  sectionTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(20), lineHeight: 28, fontWeight: "600" },
  sectionSubtext: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(13), lineHeight: 19, marginTop: 2 },
  emptyState: { paddingVertical: 36, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyIconAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  emptyTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(18), fontWeight: "700" },
  emptyText: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(13), textAlign: "center", paddingHorizontal: 20, lineHeight: 19 },
  historyTimeline: { gap: 16 },
  historyCard: { borderRadius: 12, borderWidth: 1, borderColor: "rgba(68,71,72,0.35)", backgroundColor: "#131313", padding: 16, gap: 12 },
  historyCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  historyDateWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  historyDateText: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(15), fontWeight: "600" },
  phasePill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  phasePillText: { fontFamily: "JetBrains Mono", fontSize: fs(9), fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderBottomWidth: 1, borderBottomColor: "rgba(68,71,72,0.20)", paddingBottom: 10 },
  totalLabel: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(11), textTransform: "uppercase" },
  totalVal: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(22), fontWeight: "700" },
  bucketGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bucketChip: { width: "48%", borderRadius: 8, borderWidth: 1, backgroundColor: "#1a1a1a", padding: 10, gap: 2 },
  bucketChipLabel: { fontFamily: "JetBrains Mono", fontSize: fs(10), textTransform: "uppercase" },
  bucketChipVal: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(14), fontWeight: "700" },
  metaRow: { borderTopWidth: 1, borderTopColor: "rgba(68,71,72,0.18)", paddingTop: 10, gap: 6 },
  metaText: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(12) },
  noteBox: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: "rgba(255,255,255,0.03)", padding: 8, borderRadius: 6, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  noteText: { flex: 1, color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(12), lineHeight: 17 },
  loadMoreButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(129,140,248,0.3)",
    backgroundColor: "rgba(129,140,248,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  loadMoreText: { color: "#818cf8", fontFamily: "Hanken Grotesk", fontSize: fs(14), fontWeight: "600" },
});
