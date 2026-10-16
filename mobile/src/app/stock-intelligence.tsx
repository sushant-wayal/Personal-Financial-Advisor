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
import { useAlert } from "../providers/AlertProvider";

import { InvestmentsSkeleton } from "../components/LoadingSkeleton";
import Markdown from "react-native-markdown-display";

function formatBindingConstraint(raw: string | null | undefined): string {
  if (!raw) return "Optimal Sizing";
  switch (raw) {
    case "cash_capacity_limit":
      return "Sized by available liquid cash";
    case "exposure_cap_limit":
      return "Capped by portfolio exposure limit";
    case "zero_deployable_cash":
      return "Zero unallocated cash";
    case "phase_blocked_crisis":
      return "Paused for financial stabilization";
    case "regime_blocked_bearish":
      return "Paused: Bearish market regime";
    case "regime_blocked_high_volatility":
      return "Paused: High market volatility";
    default:
      return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

async function safeFetchJson(url: string, options?: RequestInit) {
  const res = await fetch(url, options);
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("Unable to load data. Please check your network and try again.");
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Unable to complete request. Please try again.");
  }
  return data;
}

export default function StockIntelligenceScreen() {
  useCurrency();
  const router = useRouter();
  const { showSuccess, showError } = useAlert();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"recs" | "paper" | "risk" | "backtest">("recs");

  const [recData, setRecData] = useState<any>(null);
  const [capitalData, setCapitalData] = useState<any>(null);
  const [paperData, setPaperData] = useState<any>(null);
  const [backtestResult, setBacktestResult] = useState<any>(null);

  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [dataRec, dataCap, dataPaper] = await Promise.all([
        safeFetchJson(apiUrl("/api/stock-intelligence/recommendations")),
        safeFetchJson(apiUrl("/api/stock-intelligence/capital")),
        safeFetchJson(apiUrl("/api/stock-intelligence/paper")),
      ]);

      if (dataRec.ok) setRecData(dataRec.run);
      if (dataCap.ok) setCapitalData(dataCap);
      if (dataPaper.ok) setPaperData(dataPaper.portfolio);
    } catch (e: any) {
      console.warn("Stock intelligence fetch notice:", e.message || String(e));
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

  const handleRunAnalysis = async () => {
    setActionLoading(true);
    try {
      await safeFetchJson(apiUrl("/api/stock-intelligence/run"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRerun: true }),
      });
      showSuccess("Analysis Complete", "Daily quantitative swing recommendations updated!");
      loadData();
    } catch (e: any) {
      showError("Analysis Error", e.message || String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePaperBuy = async (buy: any) => {
    setActionLoading(true);
    try {
      await safeFetchJson(apiUrl("/api/stock-intelligence/paper"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "BUY",
          symbol: buy.symbol,
          exchange: buy.exchange,
          strategy: buy.strategy,
          quantity: buy.quantity,
          entryPrice: buy.entryPrice,
          stopLoss: buy.stopLoss,
          targetPrice: buy.targetPrice,
        }),
      });
      showSuccess("Simulated Buy Order", `Executed paper purchase for ${buy.quantity} shares of ${buy.symbol}`);
      loadData();
    } catch (e: any) {
      showError("Simulation Error", e.message || String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handlePaperSell = async (tradeId: string, exitPrice: number) => {
    setActionLoading(true);
    try {
      await safeFetchJson(apiUrl("/api/stock-intelligence/paper"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SELL",
          tradeId,
          exitPrice,
          exitReason: "MANUAL_CLOSE",
        }),
      });
      showSuccess("Position Closed", "Paper position exited successfully.");
      loadData();
    } catch (e: any) {
      showError("Error", e.message || String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunBacktest = async (strategyName: string) => {
    setActionLoading(true);
    try {
      const data = await safeFetchJson(apiUrl("/api/stock-intelligence/backtest"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategyName }),
      });
      setBacktestResult(data.result);
      showSuccess("Backtest Finished", `Evaluated historical performance for ${strategyName}`);
    } catch (e: any) {
      showError("Backtest Error", e.message || String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const buys = (recData?.recommendations?.filter((r: any) => r.type === "BUY") ?? []);
  const holds = (recData?.recommendations?.filter((r: any) => r.type === "HOLD") ?? []);
  const sells = (recData?.recommendations?.filter((r: any) => r.type === "SELL") ?? []);

  const regime = recData?.marketRegime || capitalData?.marketRegime || "NEUTRAL";
  const capital = capitalData?.capitalAllocation;
  const risk = capitalData?.riskSnapshot;

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
          <Text style={styles.backButtonText}>INVEST</Text>
        </Pressable>

        <Pressable
          onPress={handleRunAnalysis}
          disabled={actionLoading}
          style={({ pressed }) => [styles.actionPill, pressed ? { opacity: 0.7 } : null]}
        >
          <MaterialIcons name="refresh" size={16} color="#06b6d4" />
          <Text style={styles.actionPillText}>{actionLoading ? "Scanning..." : "Scan"}</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Block */}
        <View style={styles.headerBlock}>
          <View style={styles.badgeRow}>
            <View style={styles.regimeBadge}>
              <Text style={styles.regimeBadgeText}>Regime: {regime}</Text>
            </View>
            <View style={styles.nseBadge}>
              <Text style={styles.nseBadgeText}>NSE Delivery</Text>
            </View>
          </View>
          <Text style={styles.screenTitle}>Stock Intelligence</Text>
          <Text style={styles.screenSub}>
            Quantitative swing trading (2–15 day horizon) with ₹0 data cost & 5% drawdown safety limits.
          </Text>
        </View>

        {/* Hero KPI Summary Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.heroCol}>
              <Text style={styles.heroLabel}>SAFE TRADING BUDGET</Text>
              <Text style={styles.heroValue}>
                {capital ? formatCurrencyAmount(capital.eligibleNewPurchaseBudget ?? 0, "INR") : "Calculating..."}
              </Text>
              <Text style={styles.heroSubText}>
                {formatBindingConstraint(capital?.bindingConstraint)}
              </Text>
              {capital?.status && capital.status !== "ACTIVE" && (
                <Text style={{ fontSize: 10, color: "#f59e0b", fontWeight: "700", marginTop: 2 }}>
                  {capital.status}
                </Text>
              )}
            </View>
            <View style={styles.heroCol}>
              <Text style={styles.heroLabel}>DRAWDOWN RISK</Text>
              <Text style={[styles.heroValue, { color: (risk?.drawdownPct ?? 0) >= 4.0 ? "#f43f5e" : "#22d3ee" }]}>
                {(risk?.drawdownPct ?? 0).toFixed(1)}% <Text style={{ fontSize: 12, color: "#888888" }}>/ 5.0%</Text>
              </Text>
              <Text style={styles.heroSubText}>Status: {risk?.drawdownStatus ?? "NORMAL"}</Text>
            </View>
          </View>
        </View>

        {/* Segmented Control Tabs */}
        <View style={styles.tabContainer}>
          <Pressable
            onPress={() => setActiveTab("recs")}
            style={[styles.tabButton, activeTab === "recs" && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, activeTab === "recs" && styles.tabButtonTextActive]}>
              Signals ({buys.length + holds.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("paper")}
            style={[styles.tabButton, activeTab === "paper" && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, activeTab === "paper" && styles.tabButtonTextActive]}>
              Sandbox ({paperData?.positions?.length ?? 0})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("risk")}
            style={[styles.tabButton, activeTab === "risk" && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, activeTab === "risk" && styles.tabButtonTextActive]}>
              Safeguards
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("backtest")}
            style={[styles.tabButton, activeTab === "backtest" && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, activeTab === "backtest" && styles.tabButtonTextActive]}>
              Backtest
            </Text>
          </Pressable>
        </View>

        {/* ─── TAB 1: RECOMMENDATIONS ─── */}
        {activeTab === "recs" && (
          <View style={styles.section}>
            {/* AI Briefing */}
            {recData?.aiExplanation && (
              <View style={styles.aiBriefingCard}>
                <View style={styles.aiBriefingHeader}>
                  <MaterialIcons name="auto-awesome" size={16} color="#06b6d4" />
                  <Text style={styles.aiBriefingTitle}>AI Advisor Briefing</Text>
                </View>
                <Markdown style={aiMarkdownStyles}>{recData.aiExplanation}</Markdown>
              </View>
            )}

            {/* Buy Recommendations */}
            <Text style={styles.sectionTitle}>Buy Setups ({buys.length})</Text>
            {buys.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialIcons name="verified-user" size={32} color="#10b981" />
                <Text style={styles.emptyTitle}>Capital Preservation Active</Text>
                <Text style={styles.emptySub}>
                  No low-conviction setups forced today. Capital is safely preserved in accordance with your risk policy.
                </Text>
              </View>
            ) : (
              buys.map((buy: any) => (
                <View key={buy.symbol} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={styles.stockSymbol}>{buy.symbol}</Text>
                        <View style={styles.buyBadge}>
                          <Text style={styles.buyBadgeText}>BUY {buy.quantity} shares</Text>
                        </View>
                      </View>
                      <Text style={styles.stockSub}>Strategy: {buy.strategy} · ~{buy.expectedHoldingDays}d</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.stockPrice}>₹{buy.entryPrice.toFixed(2)}</Text>
                      <Text style={styles.stockCapEst}>{formatCurrencyAmount(buy.estimatedCapital, "INR")}</Text>
                    </View>
                  </View>

                  {/* Limits Row */}
                  <View style={styles.limitsGrid}>
                    <View style={styles.limitCol}>
                      <Text style={styles.limitLabel}>Entry Limit</Text>
                      <Text style={styles.limitVal}>≤ ₹{buy.maxChasePrice.toFixed(1)}</Text>
                    </View>
                    <View style={styles.limitCol}>
                      <Text style={[styles.limitLabel, { color: "#f43f5e" }]}>Stop Loss</Text>
                      <Text style={[styles.limitVal, { color: "#f43f5e" }]}>₹{buy.stopLoss.toFixed(1)}</Text>
                    </View>
                    <View style={styles.limitCol}>
                      <Text style={[styles.limitLabel, { color: "#10b981" }]}>Target</Text>
                      <Text style={[styles.limitVal, { color: "#10b981" }]}>₹{buy.targetPrice.toFixed(1)}</Text>
                    </View>
                  </View>

                  {/* Simulate Button */}
                  <Pressable
                    onPress={() => handlePaperBuy(buy)}
                    disabled={actionLoading}
                    style={({ pressed }) => [styles.simulateBtn, pressed ? { opacity: 0.7 } : null]}
                  >
                    <MaterialIcons name="play-arrow" size={16} color="#06b6d4" />
                    <Text style={styles.simulateBtnText}>Simulate in Paper Sandbox</Text>
                  </Pressable>
                </View>
              ))
            )}

            {/* Hold Positions */}
            {holds.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Hold Positions ({holds.length})</Text>
                {holds.map((hold: any) => (
                  <View key={hold.symbol} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.stockSymbol}>{hold.symbol}</Text>
                      <View style={styles.holdBadge}>
                        <Text style={styles.holdBadgeText}>HOLD</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                      <Text style={styles.detailText}>Qty: {hold.quantity} shares</Text>
                      <Text style={[styles.detailText, { color: hold.unrealizedPnl >= 0 ? "#10b981" : "#f43f5e", fontWeight: "bold" }]}>
                        {hold.unrealizedPnl >= 0 ? "+" : ""}{formatCurrencyAmount(hold.unrealizedPnl, "INR")} ({hold.unrealizedPnlPct}%)
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            )}

            {/* Sell Triggers */}
            {sells.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Sell Triggers ({sells.length})</Text>
                {sells.map((sell: any) => (
                  <View key={sell.symbol} style={[styles.card, { borderColor: "rgba(244,63,94,0.3)" }]}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.stockSymbol}>{sell.symbol}</Text>
                      <View style={[styles.holdBadge, { backgroundColor: "rgba(244,63,94,0.15)" }]}>
                        <Text style={[styles.holdBadgeText, { color: "#f43f5e" }]}>SELL ({sell.urgency})</Text>
                      </View>
                    </View>
                    <Text style={[styles.detailText, { color: "#fca5a5", marginTop: 4 }]}>{sell.reason}</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {/* ─── TAB 2: PAPER TRADING SANDBOX ─── */}
        {activeTab === "paper" && (
          <View style={styles.section}>
            <View style={styles.heroCard}>
              <View style={styles.heroRow}>
                <View style={styles.heroCol}>
                  <Text style={styles.heroLabel}>VIRTUAL EQUITY</Text>
                  <Text style={styles.heroValue}>{formatCurrencyAmount(paperData?.totalEquity ?? 100000, "INR")}</Text>
                </View>
                <View style={styles.heroCol}>
                  <Text style={styles.heroLabel}>WIN RATE</Text>
                  <Text style={[styles.heroValue, { color: "#10b981" }]}>{paperData?.winRate ?? 0}%</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Open Positions ({paperData?.positions?.length ?? 0})</Text>
            {paperData?.positions?.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No Open Paper Positions</Text>
                <Text style={styles.emptySub}>Tap &quot;Simulate in Paper Sandbox&quot; on any buy signal to test the strategy.</Text>
              </View>
            ) : (
              paperData?.positions?.map((pos: any) => (
                <View key={pos.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.stockSymbol}>{pos.symbol}</Text>
                    <Text style={[styles.detailText, { color: pos.pnl >= 0 ? "#10b981" : "#f43f5e", fontWeight: "bold" }]}>
                      {pos.pnl >= 0 ? "+" : ""}{formatCurrencyAmount(pos.pnl, "INR")} ({pos.pnlPct}%)
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginVertical: 6 }}>
                    <Text style={styles.detailText}>Entry: ₹{pos.entryPrice}</Text>
                    <Text style={[styles.detailText, { color: "#f43f5e" }]}>Stop: ₹{pos.stopLoss}</Text>
                    <Text style={[styles.detailText, { color: "#10b981" }]}>Target: ₹{pos.targetPrice}</Text>
                  </View>
                  <Pressable
                    onPress={() => handlePaperSell(pos.id, pos.entryPrice * (1 + (pos.pnlPct / 100)))}
                    style={({ pressed }) => [styles.closeBtn, pressed ? { opacity: 0.7 } : null]}
                  >
                    <Text style={styles.closeBtnText}>Close Position</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        )}

        {/* ─── TAB 3: SAFEGUARDS & CAPITAL ─── */}
        {activeTab === "risk" && (
          <View style={styles.section}>
            {/* Header / Status Banner */}
            <View style={styles.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.cardSectionTitle}>Capital Safeguards & Sizing Engine</Text>
                  <Text style={{ fontSize: 11, color: "#888888", marginTop: 2 }}>
                    Automated liquidity protection, liability insulation & exposure governor.
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <View style={{ backgroundColor: "rgba(34,211,238,0.12)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: "#22d3ee" }}>
                      {capital?.financialPhase ?? "WEALTH_BUILDING"}
                    </Text>
                  </View>
                  {capital?.status && (
                    <View style={{
                      backgroundColor: capital.status === "ACTIVE" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                    }}>
                      <Text style={{ fontSize: 10, fontWeight: "700", color: capital.status === "ACTIVE" ? "#34d399" : "#fbbf24" }}>
                        {capital.status}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {capital?.statusReason && capital.status !== "ACTIVE" && (
                <View style={{
                  backgroundColor: "rgba(245,158,11,0.08)",
                  padding: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: "rgba(245,158,11,0.25)",
                  marginTop: 6,
                }}>
                  <Text style={{ fontSize: 11, color: "#fbbf24", lineHeight: 16 }}>
                    {capital.statusReason}
                  </Text>
                </View>
              )}
            </View>

            {/* Liquidity Waterfall Cards */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={[styles.card, { flex: 1, padding: 10 }]}>
                <Text style={{ fontSize: 9, fontWeight: "700", color: "#888888", textTransform: "uppercase" }}>Bank Cash</Text>
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#ffffff", marginTop: 4 }}>
                  {formatCurrencyAmount(capital?.verifiedLiquidCash ?? 0, "INR")}
                </Text>
                <Text style={{ fontSize: 9, color: "#888888", marginTop: 2 }}>Verified Liquid</Text>
              </View>

              <View style={[styles.card, { flex: 1, padding: 10 }]}>
                <Text style={{ fontSize: 9, fontWeight: "700", color: "#f43f5e", textTransform: "uppercase" }}>Protected</Text>
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#f43f5e", marginTop: 4 }}>
                  −{formatCurrencyAmount(Math.max(0, (capital?.verifiedLiquidCash ?? 0) - (capital?.potentiallyDeployableCash ?? 0)), "INR")}
                </Text>
                <Text style={{ fontSize: 9, color: "#888888", marginTop: 2 }}>Deductions</Text>
              </View>

              <View style={[styles.card, { flex: 1, padding: 10, borderColor: "rgba(34,211,238,0.3)" }]}>
                <Text style={{ fontSize: 9, fontWeight: "700", color: "#22d3ee", textTransform: "uppercase" }}>Net Deployable</Text>
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#22d3ee", marginTop: 4 }}>
                  {formatCurrencyAmount(capital?.potentiallyDeployableCash ?? 0, "INR")}
                </Text>
                <Text style={{ fontSize: 9, color: "#22d3ee", marginTop: 2 }}>Unallocated</Text>
              </View>
            </View>

            {/* Protected Deductions Breakdown */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Protected Allocations Breakdown</Text>

              {/* Emergency Fund */}
              {capital?.efTargetAmount != null && (
                <View style={{
                  backgroundColor: "#161618",
                  padding: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.06)",
                }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: "#ffffff" }}>Emergency Reserve</Text>
                      <View style={{ backgroundColor: "rgba(16,185,129,0.12)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 9, fontWeight: "700", color: "#34d399" }}>Drip Funding</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#f43f5e" }}>
                      −{formatCurrencyAmount(capital.efAllocatedCash ?? 0, "INR")}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                    <Text style={{ fontSize: 10, color: "#888888" }}>
                      Target: {formatCurrencyAmount(capital.efTargetAmount, "INR")}
                    </Text>
                    {capital.efShortfall > 0 && (
                      <Text style={{ fontSize: 10, color: "#fbbf24" }}>
                        Shortfall: {formatCurrencyAmount(capital.efShortfall, "INR")} (Monthly Drip)
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {/* Other Deductions */}
              {capital?.deductions && capital.deductions.length > 0 ? (
                capital.deductions.map((d: any, idx: number) => (
                  <View
                    key={idx}
                    style={{
                      backgroundColor: "#161618",
                      padding: 10,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.06)",
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontSize: 12, fontWeight: "600", color: "#ffffff" }}>{d.label}</Text>
                      {d.basis ? (
                        <Text style={{ fontSize: 10, color: "#888888", marginTop: 2 }}>{d.basis}</Text>
                      ) : null}
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#f43f5e" }}>
                      −{formatCurrencyAmount(d.amount, "INR")}
                    </Text>
                  </View>
                ))
              ) : null}
            </View>

            {/* Portfolio Exposure & Limits */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Portfolio Exposure Limits</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                <View style={{ flex: 1, backgroundColor: "#161618", padding: 10, borderRadius: 8 }}>
                  <Text style={{ fontSize: 9, color: "#888888", textTransform: "uppercase" }}>Phase Limit</Text>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#ffffff", marginTop: 2 }}>
                    {capital?.phaseMaxPct ?? 100}%
                  </Text>
                </View>
                <View style={{ flex: 1, backgroundColor: "#161618", padding: 10, borderRadius: 8 }}>
                  <Text style={{ fontSize: 9, color: "#888888", textTransform: "uppercase" }}>Market Regime</Text>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#22d3ee", marginTop: 2 }}>
                    {capital?.regime ?? regime ?? "NORMAL"}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1, backgroundColor: "#161618", padding: 10, borderRadius: 8 }}>
                  <Text style={{ fontSize: 9, color: "#888888", textTransform: "uppercase" }}>Existing Holdings</Text>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#ffffff", marginTop: 2 }}>
                    {formatCurrencyAmount(capital?.deployedCapital ?? 0, "INR")}
                  </Text>
                </View>
                <View style={{ flex: 1, backgroundColor: "#161618", padding: 10, borderRadius: 8 }}>
                  <Text style={{ fontSize: 9, color: "#888888", textTransform: "uppercase" }}>Max Permitted Cap</Text>
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#34d399", marginTop: 2 }}>
                    {formatCurrencyAmount(capital?.maxPermittedExposure ?? 0, "INR")}
                  </Text>
                </View>
              </View>
            </View>

            {/* Final Budget Hero Card */}
            <View style={{
              backgroundColor: "rgba(16,185,129,0.08)",
              borderRadius: 14,
              padding: 16,
              borderWidth: 1,
              borderColor: "rgba(16,185,129,0.3)",
            }}>
              <Text style={{ fontSize: 10, fontWeight: "800", color: "#34d399", textTransform: "uppercase", letterSpacing: 0.8 }}>
                PERMITTED DAILY TRADING BUDGET
              </Text>
              <Text style={{ fontSize: 24, fontWeight: "900", color: "#10b981", marginTop: 4 }}>
                {formatCurrencyAmount(capital?.eligibleNewPurchaseBudget ?? 0, "INR")}
              </Text>
              <View style={{
                alignSelf: "flex-start",
                backgroundColor: "rgba(16,185,129,0.15)",
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 6,
                marginTop: 6,
              }}>
                <Text style={{ fontSize: 11, fontWeight: "700", color: "#34d399" }}>
                  Governed by: {formatBindingConstraint(capital?.bindingConstraint)}
                </Text>
              </View>
              <Text style={{ fontSize: 10, color: "#888888", marginTop: 8, lineHeight: 14 }}>
                Sized as the minimum of available liquid cash and remaining portfolio exposure, guarded by real-time drawdown throttles.
              </Text>
            </View>

            {/* Drawdown Circuit Breakers */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>5% Drawdown Control Mechanism</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
                <View style={{
                  flex: 1,
                  backgroundColor: "#161618",
                  padding: 10,
                  borderRadius: 8,
                  borderLeftWidth: 3,
                  borderLeftColor: "#10b981",
                }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#34d399" }}>&lt; 3.0% Normal</Text>
                  <Text style={{ fontSize: 10, color: "#888888", marginTop: 2 }}>
                    Standard swing trading & sizing active.
                  </Text>
                </View>
                <View style={{
                  flex: 1,
                  backgroundColor: "#161618",
                  padding: 10,
                  borderRadius: 8,
                  borderLeftWidth: 3,
                  borderLeftColor: "#fbbf24",
                }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#fbbf24" }}>3.0% – 4.0% Warning</Text>
                  <Text style={{ fontSize: 10, color: "#888888", marginTop: 2 }}>
                    Tighter sizing limits to preserve gains.
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{
                  flex: 1,
                  backgroundColor: "#161618",
                  padding: 10,
                  borderRadius: 8,
                  borderLeftWidth: 3,
                  borderLeftColor: "#f97316",
                }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#f97316" }}>4.0% – 4.5% Restricted</Text>
                  <Text style={{ fontSize: 10, color: "#888888", marginTop: 2 }}>
                    New purchases reduced by 50%.
                  </Text>
                </View>
                <View style={{
                  flex: 1,
                  backgroundColor: "#161618",
                  padding: 10,
                  borderRadius: 8,
                  borderLeftWidth: 3,
                  borderLeftColor: "#f43f5e",
                }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#f43f5e" }}>≥ 4.5% Halt</Text>
                  <Text style={{ fontSize: 10, color: "#888888", marginTop: 2 }}>
                    Trading locked until recovery.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ─── TAB 4: BACKTEST ─── */}
        {activeTab === "backtest" && (
          <View style={styles.section}>
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Simulate Strategy on History</Text>
              <Text style={styles.detailText}>Walk-forward, next-day execution, realistic Indian delivery costs & slippage.</Text>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <Pressable
                  onPress={() => handleRunBacktest("TREND_PULLBACK")}
                  style={styles.strategyBtn}
                >
                  <Text style={styles.strategyBtnText}>Trend Pullback</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleRunBacktest("MOMENTUM")}
                  style={styles.strategyBtn}
                >
                  <Text style={styles.strategyBtnText}>Momentum</Text>
                </Pressable>
              </View>
            </View>

            {backtestResult && (
              <View style={styles.card}>
                <Text style={styles.cardSectionTitle}>Results: {backtestResult.strategyName}</Text>
                <View style={styles.heroRow}>
                  <View style={styles.heroCol}>
                    <Text style={styles.heroLabel}>RETURN</Text>
                    <Text style={[styles.heroValue, { color: backtestResult.cumulativeReturn >= 0 ? "#10b981" : "#f43f5e" }]}>
                      {backtestResult.cumulativeReturn >= 0 ? "+" : ""}{backtestResult.cumulativeReturn}%
                    </Text>
                  </View>
                  <View style={styles.heroCol}>
                    <Text style={styles.heroLabel}>MAX DRAWDOWN</Text>
                    <Text style={[styles.heroValue, { color: "#f43f5e" }]}>{backtestResult.maxDrawdown}%</Text>
                  </View>
                  <View style={styles.heroCol}>
                    <Text style={styles.heroLabel}>WIN RATE</Text>
                    <Text style={styles.heroValue}>{backtestResult.winRate}%</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#131313" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  backButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  backButtonText: { fontSize: 13, fontWeight: "700", color: "#ffffff", letterSpacing: 0.5 },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(6,182,212,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(6,182,212,0.25)",
  },
  actionPillText: { fontSize: 12, fontWeight: "600", color: "#06b6d4" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 180 },
  headerBlock: { marginBottom: 16 },
  badgeRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  regimeBadge: {
    backgroundColor: "rgba(16,185,129,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.25)",
  },
  regimeBadgeText: { fontSize: 11, fontWeight: "700", color: "#34d399", textTransform: "uppercase" },
  nseBadge: {
    backgroundColor: "rgba(6,182,212,0.12)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(6,182,212,0.25)",
  },
  nseBadgeText: { fontSize: 11, fontWeight: "700", color: "#22d3ee" },
  screenTitle: { fontSize: 24, fontWeight: "800", color: "#ffffff", letterSpacing: -0.5 },
  screenSub: { fontSize: 12, color: "#888888", marginTop: 4, lineHeight: 18 },
  heroCard: {
    backgroundColor: "#1c1c1e",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 16,
  },
  heroRow: { flexDirection: "row", justifyContent: "space-between" },
  heroCol: { flex: 1 },
  heroLabel: { fontSize: 10, fontWeight: "700", color: "#888888", letterSpacing: 0.8 },
  heroValue: { fontSize: 20, fontWeight: "800", color: "#ffffff", marginTop: 4 },
  heroSubText: { fontSize: 11, color: "#34d399", marginTop: 2 },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#1c1c1e",
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  tabButtonActive: { backgroundColor: "rgba(6,182,212,0.15)" },
  tabButtonText: { fontSize: 11, fontWeight: "600", color: "#888888" },
  tabButtonTextActive: { color: "#22d3ee", fontWeight: "700" },
  section: { gap: 12 },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#ffffff", marginBottom: 4 },
  aiBriefingCard: {
    backgroundColor: "rgba(6,182,212,0.06)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(6,182,212,0.2)",
    marginBottom: 8,
  },
  aiBriefingHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  aiBriefingTitle: { fontSize: 12, fontWeight: "700", color: "#22d3ee" },
  aiBriefingBody: { fontSize: 11, color: "#cccccc", lineHeight: 16 },
  card: {
    backgroundColor: "#1c1c1e",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 8,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  stockSymbol: { fontSize: 16, fontWeight: "800", color: "#ffffff" },
  stockSub: { fontSize: 11, color: "#888888", marginTop: 2 },
  stockPrice: { fontSize: 16, fontWeight: "800", color: "#ffffff" },
  stockCapEst: { fontSize: 11, color: "#888888" },
  buyBadge: {
    backgroundColor: "rgba(16,185,129,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  buyBadgeText: { fontSize: 10, fontWeight: "700", color: "#34d399" },
  holdBadge: {
    backgroundColor: "rgba(245,158,11,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  holdBadgeText: { fontSize: 10, fontWeight: "700", color: "#fbbf24" },
  limitsGrid: {
    flexDirection: "row",
    backgroundColor: "#161618",
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
  },
  limitCol: { flex: 1, alignItems: "center" },
  limitLabel: { fontSize: 9, color: "#888888", textTransform: "uppercase" },
  limitVal: { fontSize: 12, fontWeight: "700", color: "#ffffff", marginTop: 2 },
  simulateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "rgba(6,182,212,0.1)",
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  simulateBtnText: { fontSize: 12, fontWeight: "600", color: "#06b6d4" },
  closeBtn: {
    backgroundColor: "rgba(244,63,94,0.15)",
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 4,
  },
  closeBtnText: { fontSize: 11, fontWeight: "700", color: "#f43f5e" },
  emptyCard: {
    backgroundColor: "#1c1c1e",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  emptyTitle: { fontSize: 14, fontWeight: "700", color: "#ffffff", marginTop: 8 },
  emptySub: { fontSize: 11, color: "#888888", textAlign: "center", marginTop: 4, lineHeight: 16 },
  detailText: { fontSize: 12, color: "#888888" },
  detailValue: { fontSize: 12, fontWeight: "600", color: "#ffffff" },
  cardSectionTitle: { fontSize: 13, fontWeight: "700", color: "#ffffff", marginBottom: 6 },
  waterfallRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  bulletText: { fontSize: 11, color: "#aaaaaa", lineHeight: 18 },
  strategyBtn: {
    flex: 1,
    backgroundColor: "rgba(6,182,212,0.15)",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  strategyBtnText: { fontSize: 12, fontWeight: "700", color: "#06b6d4" },
});

const aiMarkdownStyles = {
  body: {
    color: "#d1d5db",
    fontSize: 12,
    lineHeight: 18,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 8,
    color: "#d1d5db",
    fontSize: 12,
    lineHeight: 18,
  },
  strong: {
    fontWeight: "700" as const,
    color: "#ffffff",
  },
  em: {
    fontStyle: "italic" as const,
    color: "#a5f3fc",
  },
  bullet_list: {
    marginTop: 0,
    marginBottom: 6,
  },
  ordered_list: {
    marginTop: 0,
    marginBottom: 6,
  },
  list_item: {
    color: "#d1d5db",
    fontSize: 12,
    lineHeight: 18,
    marginVertical: 2,
  },
  bullet_list_icon: {
    color: "#22d3ee",
    fontSize: 10,
    lineHeight: 18,
  },
  heading1: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: "#ffffff",
    marginBottom: 4,
  },
  heading2: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: "#ffffff",
    marginBottom: 4,
  },
  heading3: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: "#22d3ee",
    marginBottom: 2,
  },
  code_inline: {
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#22d3ee",
    borderRadius: 4,
    fontSize: 11,
    paddingHorizontal: 4,
  },
};
