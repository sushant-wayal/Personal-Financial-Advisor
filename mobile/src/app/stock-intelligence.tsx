import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
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
import { useAlert } from "../providers/AlertProvider";

import { InvestmentsSkeleton } from "../components/LoadingSkeleton";
import Markdown from "react-native-markdown-display";

/**
 * Feature flag for experimental Paper Trading Sandbox and Historical Backtesting tabs.
 * Kept disabled from frontend pending architectural and accuracy re-evaluation.
 * Backend services and endpoints remain active.
 */
const SHOW_EXPERIMENTAL_TABS = false;

function calculateStockCharges(tradeValue: number) {
  if (!tradeValue || tradeValue <= 0) {
    return {
      brokerage: 0,
      stt: 0,
      stampDuty: 0,
      exchangeCharges: 0,
      sebiCharges: 0,
      gst: 0,
      totalCharges: 0,
    };
  }

  const brokerage = Math.max(5, Math.min(20, tradeValue * 0.001));
  const stt = tradeValue * 0.001;
  const stampDuty = tradeValue * 0.00015;
  const exchangeCharges = tradeValue * 0.0000297;
  const sebiCharges = tradeValue * 0.000001;
  const gst = 0.18 * (brokerage + exchangeCharges + sebiCharges);
  const total = brokerage + stt + stampDuty + exchangeCharges + sebiCharges + gst;

  return {
    brokerage: Math.round(brokerage * 100) / 100,
    stt: Math.round(stt * 100) / 100,
    stampDuty: Math.round(stampDuty * 100) / 100,
    exchangeCharges: Math.round(exchangeCharges * 100) / 100,
    sebiCharges: Math.round(sebiCharges * 100) / 100,
    gst: Math.round(gst * 100) / 100,
    totalCharges: Math.round(total * 100) / 100,
  };
}

function calculateStockBrokerage(tradeValue: number): number {
  return calculateStockCharges(tradeValue).totalCharges;
}

function formatBindingConstraint(raw: string | null | undefined): string {
  if (!raw) return "Optimal Sizing";
  switch (raw) {
    case "cycle_stock_credit_limit":
      return "Sized from cycle stock trading balance";
    case "slot_tranche_allocated":
      return "Sized by available position slot capacity";
    case "market_regime_moderated":
      return "Moderated by market regime condition";
    case "drawdown_throttle_active":
      return "Scaled down by drawdown throttle";
    case "max_positions_reached":
      return "Max concurrent open positions (5/5) reached";
    case "cycle_budget_exhausted":
      return "Cycle stock trading credit exhausted";
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
    case "drawdown_halt_triggered":
      return "Paused: 5% drawdown circuit breaker";
    default:
      return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function formatPhaseName(raw: string | null | undefined): string {
  if (!raw) return "Wealth Building";
  switch (raw) {
    case "EF_BUILDING":
      return "Reserve Building";
    case "WEALTH_BUILDING":
      return "Wealth Building";
    case "GOAL_SPRINT":
      return "Goal Sprint";
    case "CRISIS":
      return "Crisis Mode";
    default:
      return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

function formatStatusName(raw: string | null | undefined): string {
  if (!raw) return "Active";
  switch (raw) {
    case "ACTIVE":
      return "Active";
    case "CYCLE_BUDGET_EXHAUSTED":
      return "Cycle Credit Used";
    case "EXPOSURE_CAP_REACHED":
      return "Exposure Capped";
    case "BLOCKED_BY_PHASE":
      return "Phase Protected";
    case "BLOCKED_BY_REGIME":
      return "Regime Paused";
    case "ZERO_SURPLUS":
      return "Zero Surplus";
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
  const { showSuccess, showError, showAlert } = useAlert();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"recs" | "paper" | "risk" | "backtest">("recs");

  const [recData, setRecData] = useState<any>(null);
  const [capitalData, setCapitalData] = useState<any>(null);
  const [paperData, setPaperData] = useState<any>(null);
  const [backtestResult, setBacktestResult] = useState<any>(null);

  const [actionLoading, setActionLoading] = useState(false);

  // Live stock investment dialog state
  const [investModalBuy, setInvestModalBuy] = useState<any | null>(null);
  const [executedPriceText, setExecutedPriceText] = useState<string>("");
  const [executedQtyText, setExecutedQtyText] = useState<string>("");
  const [brokerageText, setBrokerageText] = useState<string>("20");

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
      const res: any = await safeFetchJson(apiUrl("/api/stock-intelligence/run"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRerun: true }),
      });
      if (res?.isSessionLocked) {
        showSuccess("Session Locked", res.message || "Daily session is locked with executed trades.");
      } else {
        showSuccess("Analysis Complete", "Daily quantitative swing recommendations updated!");
      }
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

  const handleResetPaper = () => {
    showAlert({
      title: "Reset Virtual Equity",
      message: "Are you sure you want to reset your sandbox virtual equity to ₹1,00,000? All active simulated positions and trade history will be cleared.",
      type: "warning",
      buttons: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setActionLoading(true);
            try {
              await safeFetchJson(apiUrl("/api/stock-intelligence/paper"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "RESET", initialCash: 100000 }),
              });
              showSuccess("Sandbox Reset", "Virtual equity has been reset to ₹1,00,000.");
              loadData();
            } catch (e: any) {
              showError("Reset Error", e.message || String(e));
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    });
  };

  const handleSyncPaper = async () => {
    setActionLoading(true);
    try {
      await safeFetchJson(apiUrl("/api/stock-intelligence/paper"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SYNC" }),
      });
      showSuccess("Mark to Market", "Simulated positions updated against latest market prices.");
      loadData();
    } catch (e: any) {
      showError("Sync Error", e.message || String(e));
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

  const openInvestModal = (buy: any) => {
    setInvestModalBuy(buy);
    const initialPrice = buy.entryPrice || 0;
    const initialQty = buy.quantity || 1;
    setExecutedPriceText(initialPrice ? String(initialPrice) : "");
    setExecutedQtyText(initialQty ? String(initialQty) : "1");
    const autoBrokerage = calculateStockBrokerage(initialPrice * initialQty);
    setBrokerageText(String(autoBrokerage || ""));
  };

  const handleConfirmInvest = async () => {
    if (!investModalBuy) return;
    const price = parseFloat(executedPriceText);
    const qty = parseInt(executedQtyText, 10);
    const tradeValue = (price || 0) * (qty || 0);
    const autoBrokerage = calculateStockBrokerage(tradeValue);
    const brokerage = brokerageText !== "" ? (parseFloat(brokerageText) || 0) : autoBrokerage;

    if (!price || price <= 0 || !qty || qty <= 0) {
      showError("Invalid Input", "Please enter a valid executed price and quantity.");
      return;
    }

    const total = Math.round((tradeValue + brokerage) * 100) / 100;

    setActionLoading(true);
    try {
      const res = await safeFetchJson(apiUrl("/api/stock-intelligence/recommendations/invest"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: investModalBuy.id,
          symbol: investModalBuy.symbol,
          executedPrice: price,
          quantity: qty,
          brokerage,
        }),
      });
      setInvestModalBuy(null);
      showSuccess(
        "Investment Recorded",
        res.message || `Invested ₹${tradeValue.toLocaleString("en-IN")} in ${investModalBuy.symbol} (Charges: ₹${brokerage.toFixed(2)}, Budget: ₹${total.toLocaleString("en-IN")})`
      );
      loadData();
    } catch (e: any) {
      showError("Investment Error", e.message || String(e));
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
              <Text style={styles.heroLabel}>SAFE BUDGET</Text>
              <Text style={styles.heroValue}>
                {capital ? formatCurrencyAmount(capital.eligibleNewPurchaseBudget ?? 0, "INR") : "₹0"}
              </Text>
              <View style={{
                alignSelf: "flex-start",
                marginTop: 4,
                backgroundColor: (capital?.eligibleNewPurchaseBudget ?? 0) > 0 ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
              }}>
                <Text style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: (capital?.eligibleNewPurchaseBudget ?? 0) > 0 ? "#34d399" : "#fbbf24",
                }}>
                  {(capital?.eligibleNewPurchaseBudget ?? 0) > 0 ? "Ready" : formatStatusName(capital?.status)}
                </Text>
              </View>
            </View>

            <View style={styles.heroCol}>
              <Text style={styles.heroLabel}>CYCLE CREDIT</Text>
              <Text style={[styles.heroValue, { color: "#22d3ee" }]}>
                {capital ? formatCurrencyAmount(capital.remainingCycleStockBalance ?? 0, "INR") : "₹0"}
              </Text>
              <Text style={[styles.heroSubText, { color: "#888888" }]}>
                Pool: {capital ? formatCurrencyAmount(capital.cycleStockTradingPool ?? 0, "INR") : "₹0"}
              </Text>
            </View>

            <View style={styles.heroCol}>
              <Text style={styles.heroLabel}>DRAWDOWN</Text>
              <Text style={[styles.heroValue, { color: (risk?.drawdownPct ?? 0) >= 4.0 ? "#f43f5e" : "#22d3ee" }]}>
                {(risk?.drawdownPct ?? 0).toFixed(1)}% <Text style={{ fontSize: 11, color: "#888888" }}>/ 5%</Text>
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

          {SHOW_EXPERIMENTAL_TABS && (
            <Pressable
              onPress={() => setActiveTab("paper")}
              style={[styles.tabButton, activeTab === "paper" && styles.tabButtonActive]}
            >
              <Text style={[styles.tabButtonText, activeTab === "paper" && styles.tabButtonTextActive]}>
                Sandbox ({paperData?.positions?.length ?? 0})
              </Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => setActiveTab("risk")}
            style={[styles.tabButton, activeTab === "risk" && styles.tabButtonActive]}
          >
            <Text style={[styles.tabButtonText, activeTab === "risk" && styles.tabButtonTextActive]}>
              Safeguards
            </Text>
          </Pressable>

          {SHOW_EXPERIMENTAL_TABS && (
            <Pressable
              onPress={() => setActiveTab("backtest")}
              style={[styles.tabButton, activeTab === "backtest" && styles.tabButtonActive]}
            >
              <Text style={[styles.tabButtonText, activeTab === "backtest" && styles.tabButtonTextActive]}>
                Backtest
              </Text>
            </Pressable>
          )}
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
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Text style={styles.stockSymbol}>{buy.symbol}</Text>
                        <View style={styles.buyBadge}>
                          <Text style={styles.buyBadgeText}>BUY {buy.quantity} shares</Text>
                        </View>
                        {buy.status === "INVESTED" ? (
                          <View style={[styles.buyBadge, { backgroundColor: "rgba(16,185,129,0.2)", borderColor: "rgba(16,185,129,0.5)" }]}>
                            <Text style={[styles.buyBadgeText, { color: "#34d399", fontWeight: "700" }]}>✓ INVESTED</Text>
                          </View>
                        ) : null}
                        {buy.isAiDiscovered ? (
                          <View style={styles.aiScoutBadge}>
                            <MaterialIcons name="auto-awesome" size={11} color="#c084fc" />
                            <Text style={styles.aiScoutBadgeText}>AI Scouted</Text>
                          </View>
                        ) : null}
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

                  {/* AI Catalyst Thesis if AI Scouted */}
                  {buy.aiThesis ? (
                    <View style={styles.aiThesisBox}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 }}>
                        <MaterialIcons name="auto-awesome" size={12} color="#c084fc" />
                        <Text style={styles.aiThesisTitle}>AI Catalyst Thesis</Text>
                      </View>
                      <Text style={styles.aiThesisText}>{buy.aiThesis}</Text>
                    </View>
                  ) : null}

                  {/* Executed Live Position Banner if Invested */}
                  {buy.status === "INVESTED" ? (
                    <View style={styles.investedBox}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <MaterialIcons name="check-circle" size={14} color="#10b981" />
                          <Text style={{ fontSize: 12, fontWeight: "700", color: "#34d399" }}>Live Position Recorded</Text>
                        </View>
                        <Text style={{ fontSize: 12, fontWeight: "800", color: "#ffffff" }}>
                          Invested: ₹{(buy.investedAmount ?? ((buy.executedPrice || buy.entryPrice) * buy.quantity)).toFixed(2)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                        <Text style={{ fontSize: 11, color: "#888888" }}>
                          {buy.quantity} shares @ ₹{(buy.executedPrice || buy.entryPrice).toFixed(2)}
                        </Text>
                        <Text style={{ fontSize: 11, color: "#888888" }}>
                          Charges: ₹{(buy.brokerage ?? calculateStockBrokerage((buy.executedPrice || buy.entryPrice) * buy.quantity)).toFixed(2)} · Budget: ₹{((buy.investedAmount ?? ((buy.executedPrice || buy.entryPrice) * buy.quantity)) + (buy.brokerage ?? calculateStockBrokerage((buy.executedPrice || buy.entryPrice) * buy.quantity))).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {/* Actions Row */}
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                    {buy.status === "INVESTED" ? (
                      <Pressable
                        disabled
                        style={[
                          styles.investBtn,
                          { backgroundColor: "rgba(16,185,129,0.18)", borderColor: "rgba(16,185,129,0.4)" },
                        ]}
                      >
                        <MaterialIcons name="check-circle" size={16} color="#10b981" />
                        <Text style={styles.investBtnText}>Invested</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={() => openInvestModal(buy)}
                        disabled={actionLoading}
                        style={({ pressed }) => [
                          styles.investBtn,
                          pressed ? { opacity: 0.7 } : null,
                        ]}
                      >
                        <MaterialIcons name="check" size={16} color="#10b981" />
                        <Text style={styles.investBtnText}>Mark as Invested</Text>
                      </Pressable>
                    )}

                    {SHOW_EXPERIMENTAL_TABS && (
                      <Pressable
                        onPress={() => handlePaperBuy(buy)}
                        disabled={actionLoading}
                        style={({ pressed }) => [styles.simulateBtn, { flex: 1, marginTop: 0 }, pressed ? { opacity: 0.7 } : null]}
                      >
                        <MaterialIcons name="play-arrow" size={16} color="#06b6d4" />
                        <Text style={styles.simulateBtnText}>Simulate</Text>
                      </Pressable>
                    )}
                  </View>
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
        {SHOW_EXPERIMENTAL_TABS && activeTab === "paper" && (
          <View style={styles.section}>
            {/* Sandbox Controls Header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.sectionTitle}>Paper Trading Sandbox</Text>
                <Text style={{ fontSize: 11, color: "#888888", marginTop: 2 }}>
                  Simulated execution with ₹0 real money at risk.
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={handleSyncPaper}
                  disabled={actionLoading}
                  style={({ pressed }) => [styles.actionPill, pressed ? { opacity: 0.7 } : null]}
                >
                  <MaterialIcons name="refresh" size={14} color="#06b6d4" />
                  <Text style={styles.actionPillText}>Sync</Text>
                </Pressable>
                <Pressable
                  onPress={handleResetPaper}
                  disabled={actionLoading}
                  style={({ pressed }) => [styles.actionPillDanger, pressed ? { opacity: 0.7 } : null]}
                >
                  <MaterialIcons name="restart-alt" size={14} color="#f43f5e" />
                  <Text style={styles.actionPillDangerText}>Reset Equity</Text>
                </Pressable>
              </View>
            </View>

            {/* Virtual Equity & Sandbox KPI Hero Card */}
            <View style={styles.heroCard}>
              <View style={styles.heroRow}>
                <View style={styles.heroCol}>
                  <Text style={styles.heroLabel}>VIRTUAL EQUITY</Text>
                  <Text style={styles.heroValue}>{formatCurrencyAmount(paperData?.totalEquity ?? 100000, "INR")}</Text>
                  <Text style={[styles.heroSubText, { color: "#888888", marginTop: 2 }]}>
                    Cash: {formatCurrencyAmount(paperData?.virtualCash ?? 100000, "INR")}
                  </Text>
                </View>
                <View style={styles.heroCol}>
                  <Text style={styles.heroLabel}>WIN RATE</Text>
                  <Text style={[styles.heroValue, { color: "#10b981" }]}>{paperData?.winRate ?? 0}%</Text>
                  <Text style={[styles.heroSubText, { color: "#888888", marginTop: 2 }]}>
                    Closed: {paperData?.closedTradesCount ?? (paperData?.closedTrades?.length ?? 0)}
                  </Text>
                </View>
                <View style={styles.heroCol}>
                  <Text style={styles.heroLabel}>TOTAL P&L</Text>
                  <Text style={[styles.heroValue, { color: (paperData?.totalPnl ?? 0) >= 0 ? "#10b981" : "#f43f5e" }]}>
                    {(paperData?.totalPnl ?? 0) >= 0 ? "+" : ""}{formatCurrencyAmount(paperData?.totalPnl ?? 0, "INR")}
                  </Text>
                  <Text style={[styles.heroSubText, { color: "#888888", marginTop: 2 }]}>
                    {paperData?.totalPnlPct ?? 0}%
                  </Text>
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
              <View>
                <Text style={styles.cardSectionTitle}>Capital Safeguards & Sizing Engine</Text>
                <Text style={{ fontSize: 11, color: "#888888", marginTop: 2, lineHeight: 16 }}>
                  Automated liquidity protection, liability insulation & exposure governor.
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <View style={{
                  backgroundColor: "rgba(34,211,238,0.12)",
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: "rgba(34,211,238,0.25)",
                }}>
                  <Text style={{ fontSize: 10, fontWeight: "700", color: "#22d3ee" }}>
                    {formatPhaseName(capital?.financialPhase)}
                  </Text>
                </View>
                {capital?.status && (
                  <View style={{
                    backgroundColor: capital.status === "ACTIVE" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)",
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: capital.status === "ACTIVE" ? "rgba(16,185,129,0.25)" : "rgba(245,158,11,0.25)",
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: "700", color: capital.status === "ACTIVE" ? "#34d399" : "#fbbf24" }}>
                      {formatStatusName(capital.status)}
                    </Text>
                  </View>
                )}
              </View>

              {capital?.statusReason && capital.status !== "ACTIVE" && (
                <View style={{
                  backgroundColor: "rgba(245,158,11,0.08)",
                  padding: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: "rgba(245,158,11,0.25)",
                  marginTop: 8,
                }}>
                  <Text style={{ fontSize: 11, color: "#fbbf24", lineHeight: 16 }}>
                    {capital.statusReason}
                  </Text>
                </View>
              )}
            </View>

            {/* Cycle Stock Trading Allocation Card */}
            <View style={styles.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.cardSectionTitle}>Cycle Stock Trading Allocation</Text>
                  <Text style={{ fontSize: 11, color: "#888888", marginTop: 2 }}>
                    Monthly stock allocation governed by your financial phase.
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ fontSize: 9, color: "#888888", textTransform: "uppercase" }}>Liquid Bank Cash</Text>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#ffffff" }}>
                    {formatCurrencyAmount(capital?.verifiedLiquidCash ?? 0, "INR")}
                  </Text>
                </View>
              </View>

              <View style={{ gap: 8, marginTop: 10 }}>
                {/* Metric 1: Cycle Stock Pool */}
                <View style={[styles.pillarItem, { borderColor: "rgba(34,211,238,0.25)", backgroundColor: "rgba(34,211,238,0.05)" }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#22d3ee" }}>Cycle Stock Pool</Text>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: "#22d3ee" }}>
                      {formatCurrencyAmount(capital?.cycleStockTradingPool ?? 0, "INR")}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 10, color: "#888888", marginTop: 2 }}>
                    Allocated during monthly investment cycle
                  </Text>
                </View>

                {/* Metric 2: Utilized This Cycle */}
                <View style={[styles.pillarItem, { borderColor: "rgba(192,132,252,0.25)", backgroundColor: "rgba(192,132,252,0.05)" }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#c084fc" }}>Utilized / Invested</Text>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: "#ffffff" }}>
                      {formatCurrencyAmount(
                        Math.max(0, (capital?.cycleStockTradingPool ?? 0) - (capital?.remainingCycleStockBalance ?? 0)),
                        "INR"
                      )}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 10, color: "#888888", marginTop: 2 }}>
                    Committed in active stock trades
                  </Text>
                </View>

                {/* Metric 3: Remaining Cycle Balance */}
                <View style={[styles.pillarItem, { borderColor: "rgba(16,185,129,0.35)", backgroundColor: "rgba(16,185,129,0.08)" }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#34d399" }}>Available Cycle Credit</Text>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: "#34d399" }}>
                      {formatCurrencyAmount(capital?.remainingCycleStockBalance ?? 0, "INR")}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 10, color: "rgba(52,211,153,0.8)", marginTop: 2 }}>
                    Governs daily purchase recommendations
                  </Text>
                </View>
              </View>

              <View style={{
                backgroundColor: "#161618",
                padding: 10,
                borderRadius: 8,
                marginTop: 8,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.06)",
              }}>
                <Text style={{ fontSize: 10, color: "#888888", lineHeight: 14 }}>
                  <Text style={{ color: "#22d3ee", fontWeight: "700" }}>Strict Ring-Fencing: </Text>
                  Stock suggestions draw exclusively from your cycle stock credit. Emergency reserves, goals, and mutual funds are completely isolated.
                </Text>
              </View>
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
                Sized from your cycle stock credit pool and remaining exposure, guarded by real-time drawdown throttles.
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
        {SHOW_EXPERIMENTAL_TABS && activeTab === "backtest" && (
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

      {/* Interactive Stock Execution Confirmation Modal */}
      <Modal
        visible={!!investModalBuy}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!actionLoading) setInvestModalBuy(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <MaterialIcons name="check-circle" size={20} color="#10b981" />
              <Text style={styles.modalTitle}>Record Stock Fill: {investModalBuy?.symbol}</Text>
            </View>
            <Text style={styles.modalSub}>
              Enter actual broker fill price and quantity. Delivery charges (brokerage, STT, stamp duty, exchange, SEBI, GST) are computed and deducted from cycle stock budget.
            </Text>

            <View style={{ marginTop: 12, gap: 10 }}>
              <View>
                <Text style={styles.inputLabel}>Executed Price / Share (₹)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="decimal-pad"
                  value={executedPriceText}
                  onChangeText={setExecutedPriceText}
                  placeholder="343.00"
                  placeholderTextColor="#666666"
                />
              </View>

              <View>
                <Text style={styles.inputLabel}>Executed Quantity (Shares)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="number-pad"
                  value={executedQtyText}
                  onChangeText={setExecutedQtyText}
                  placeholder="2"
                  placeholderTextColor="#666666"
                />
              </View>

              <View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={styles.inputLabel}>Brokerage & Fee (₹)</Text>
                  <Pressable onPress={() => {
                    const p = parseFloat(executedPriceText) || 0;
                    const q = parseInt(executedQtyText, 10) || 0;
                    setBrokerageText(String(calculateStockBrokerage(p * q)));
                  }}>
                    <Text style={{ fontSize: 10, color: "#22d3ee", textDecorationLine: "underline" }}>
                      Auto-Calculate
                    </Text>
                  </Pressable>
                </View>
                <TextInput
                  style={styles.textInput}
                  keyboardType="decimal-pad"
                  value={brokerageText}
                  onChangeText={setBrokerageText}
                  placeholder="6.71"
                  placeholderTextColor="#666666"
                />
              </View>

              {/* Live Financial Breakdown Box */}
              {(() => {
                const p = parseFloat(executedPriceText) || 0;
                const q = parseInt(executedQtyText, 10) || 0;
                const trade = Math.round(p * q * 100) / 100;
                const itemized = calculateStockCharges(trade);
                const b = brokerageText !== "" ? (parseFloat(brokerageText) || 0) : itemized.totalCharges;
                const total = Math.round((trade + b) * 100) / 100;
                return (
                  <View style={styles.modalBreakdown}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 3 }}>
                      <Text style={{ fontSize: 12, color: "#aaaaaa" }}>Trade Value ({q} × ₹{p.toFixed(2)}):</Text>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: "#ffffff" }}>₹{trade.toFixed(2)}</Text>
                    </View>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                      <Text style={{ fontSize: 12, color: "#aaaaaa" }}>Total Regulatory & Broker Charges:</Text>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: "#ffffff" }}>+ ₹{b.toFixed(2)}</Text>
                    </View>
                    {/* Itemized charges mini-list */}
                    <View style={{ borderLeftWidth: 2, borderLeftColor: "rgba(255,255,255,0.15)", paddingLeft: 6, marginVertical: 3 }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 10, color: "#888888" }}>• Brokerage (max(5, min(0.001×Trade, 20))):</Text>
                        <Text style={{ fontSize: 10, color: "#bbbbbb" }}>₹{itemized.brokerage.toFixed(2)}</Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 10, color: "#888888" }}>• STT (0.001×Trade):</Text>
                        <Text style={{ fontSize: 10, color: "#bbbbbb" }}>₹{itemized.stt.toFixed(2)}</Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 10, color: "#888888" }}>• Stamp Duty (0.00015×Trade):</Text>
                        <Text style={{ fontSize: 10, color: "#bbbbbb" }}>₹{itemized.stampDuty.toFixed(2)}</Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 10, color: "#888888" }}>• Exchange & SEBI:</Text>
                        <Text style={{ fontSize: 10, color: "#bbbbbb" }}>₹{(itemized.exchangeCharges + itemized.sebiCharges).toFixed(2)}</Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 10, color: "#888888" }}>• GST (18% on fees):</Text>
                        <Text style={{ fontSize: 10, color: "#bbbbbb" }}>₹{itemized.gst.toFixed(2)}</Text>
                      </View>
                    </View>
                    <View style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", paddingTop: 5, flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
                      <Text style={{ fontSize: 13, fontWeight: "700", color: "#ffffff" }}>Cycle Stock Budget Used:</Text>
                      <Text style={{ fontSize: 13, fontWeight: "800", color: "#34d399" }}>₹{total.toFixed(2)}</Text>
                    </View>
                    <Text style={{ fontSize: 10, color: "#777777", marginTop: 4, lineHeight: 14 }}>
                      Deducted from cycle stock budget. Bank account balance is untouched.
                    </Text>
                  </View>
                );
              })()}
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable
                style={[styles.modalCancelBtn, actionLoading ? { opacity: 0.5 } : null]}
                disabled={actionLoading}
                onPress={() => setInvestModalBuy(null)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirmBtn, actionLoading ? { opacity: 0.6 } : null]}
                disabled={actionLoading}
                onPress={handleConfirmInvest}
              >
                <Text style={styles.modalConfirmBtnText}>
                  {actionLoading ? "Recording..." : "Confirm Investment"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  actionPillDanger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(244,63,94,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(244,63,94,0.25)",
  },
  actionPillDangerText: { fontSize: 12, fontWeight: "600", color: "#f43f5e" },
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
  aiScoutBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(168,85,247,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.3)",
  },
  aiScoutBadgeText: { fontSize: 10, fontWeight: "700", color: "#c084fc" },
  aiThesisBox: {
    backgroundColor: "rgba(168,85,247,0.08)",
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(168,85,247,0.2)",
  },
  aiThesisTitle: { fontSize: 10, fontWeight: "700", color: "#c084fc" },
  aiThesisText: { fontSize: 11, color: "#e9d5ff", lineHeight: 15 },
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
  investBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "rgba(16,185,129,0.12)",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.25)",
  },
  investBtnText: { fontSize: 12, fontWeight: "700", color: "#34d399" },
  pillarItem: {
    backgroundColor: "#161618",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    gap: 2,
  },
  investedBox: {
    backgroundColor: "rgba(16,185,129,0.08)",
    borderColor: "rgba(16,185,129,0.25)",
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#1c1c1f",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    padding: 18,
    width: "100%",
    maxWidth: 420,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#ffffff",
  },
  modalSub: {
    fontSize: 12,
    color: "#888888",
    marginTop: 2,
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#aaaaaa",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  textInput: {
    backgroundColor: "#121214",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 8,
    color: "#ffffff",
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalBreakdown: {
    backgroundColor: "#141416",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#cccccc",
  },
  modalConfirmBtn: {
    flex: 1.5,
    backgroundColor: "#059669",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  modalConfirmBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
  },
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
