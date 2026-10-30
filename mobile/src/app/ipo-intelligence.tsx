import React, { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { API_BASE_URL } from "../lib/apiBaseUrl";
import { formatCurrencyAmount, useCurrency } from "../providers/CurrencyProvider";
import { useAlert } from "../providers/AlertProvider";
import Markdown from "react-native-markdown-display";
import { IpoIntelligenceSkeleton } from "../components/LoadingSkeleton";

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

export default function IpoIntelligenceScreen() {
  useCurrency();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showSuccess, showError } = useAlert();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<"open" | "upcoming" | "applications">("open");
  const [recData, setRecData] = useState<any>(null);
  const [userApplications, setUserApplications] = useState<any[]>([]);

  // Application Modal state
  const [selectedIpoForApp, setSelectedIpoForApp] = useState<any>(null);
  const [lotsToApply, setLotsToApply] = useState(1);
  const [upiIdInput, setUpiIdInput] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [dataRec, dataApp] = await Promise.all([
        safeFetchJson(apiUrl("/api/ipo-intelligence/recommendations")),
        safeFetchJson(apiUrl("/api/ipo-intelligence/apply")),
      ]);

      if (dataRec.ok) setRecData(dataRec.run);
      if (dataApp.ok) setUserApplications(dataApp.applications || []);
    } catch (e: any) {
      console.warn("IPO intelligence fetch notice:", e.message || String(e));
    } finally {
      setRefreshing(false);
      setLoading(false);
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

  const handleRefreshPipeline = async () => {
    setActionLoading(true);
    try {
      const res = await safeFetchJson(apiUrl("/api/ipo-intelligence/run"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRerun: true }),
      });
      if (res?.isSessionLocked) {
        showSuccess(
          "Session Locked",
          res.message || "Today's IPO recommendations are locked because an application was tracked.",
        );
      } else {
        showSuccess("Analysis Complete", "Today's IPO recommendations updated!");
      }
      loadData();
    } catch (e: any) {
      showError("Analysis Error", e.message || String(e));
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmApplication = async () => {
    if (!selectedIpoForApp) return;
    setActionLoading(true);
    try {
      await safeFetchJson(apiUrl("/api/ipo-intelligence/apply"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: selectedIpoForApp.symbol,
          lotsApplied: lotsToApply,
          upiIdUsed: upiIdInput,
        }),
      });
      showSuccess("Application Tracked", `Application for ${selectedIpoForApp.companyName} recorded!`);
      setSelectedIpoForApp(null);
      loadData();
    } catch (e: any) {
      showError("Error", e.message || String(e));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
        <StatusBar barStyle="light-content" backgroundColor="#131313" />
        <IpoIntelligenceSkeleton />
      </SafeAreaView>
    );
  }

  const bestPick = recData?.bestPick;
  const openIpos = recData?.openIpos || [];
  const upcomingIpos = recData?.upcomingIpos || [];
  const budget = recData?.personalBudget;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#131313" />

      {/* Header Bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={26} color="#ffffff" />
          <Text style={styles.backButtonText}>INVESTMENTS</Text>
        </Pressable>

        <Pressable
          onPress={handleRefreshPipeline}
          disabled={actionLoading || refreshing}
          style={({ pressed }) => [
            styles.actionButton,
            pressed ? { opacity: 0.7 } : null,
          ]}
        >
          <MaterialIcons
            name="refresh"
            size={18}
            color="#34d399"
            style={actionLoading ? styles.spinning : undefined}
          />
          <Text style={styles.actionButtonText}>Sync</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#34d399" />}
      >
        {/* Title & Badge */}
        <View style={styles.headerBlock}>
          <View style={styles.titleRow}>
            <MaterialIcons name="layers" size={26} color="#34d399" />
            <Text style={styles.mainTitle}>IPO Intelligence</Text>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>Primary Market</Text>
            </View>
          </View>
          <Text style={styles.subTitle}>
            Institutional Indian IPO discovery, real-time subscription demand, and personalized lot sizing.
          </Text>
        </View>

        {/* Quick Stats Chips */}
        {budget && (
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Text style={styles.statChipLabel}>Safe Budget</Text>
              <Text style={[styles.statChipValue, { color: budget.canAffordOneLot ? "#34d399" : "#fbbf24" }]}>
                {formatCurrencyAmount(budget.deployableBudget, "INR")}
              </Text>
            </View>

            <View style={styles.statChip}>
              <Text style={styles.statChipLabel}>Regime</Text>
              <Text style={[styles.statChipValue, { color: "#c084fc" }]}>{recData?.marketRegime || "Neutral"}</Text>
            </View>

            <View style={styles.statChip}>
              <Text style={styles.statChipLabel}>Open Today</Text>
              <Text style={[styles.statChipValue, { color: "#34d399" }]}>{openIpos.length} Issues</Text>
            </View>
          </View>
        )}

        {/* HERO CARD: BEST PICK TO APPLY TODAY */}
        {bestPick ? (
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroBadge}>
                <MaterialIcons name="star" size={14} color="#34d399" />
                <Text style={styles.heroBadgeText}>BEST PICK TO APPLY TODAY</Text>
              </View>

              <View style={styles.scorePill}>
                <Text style={styles.scorePillText}>Score: {bestPick.score.totalScore}/100</Text>
              </View>
            </View>

            <Text style={styles.heroCompanyName}>{bestPick.companyName}</Text>
            <Text style={styles.heroSymbolText}>
              {bestPick.symbol} • {bestPick.exchange} • {bestPick.issueType}
            </Text>

            {/* Listing Gain / GMP highlight */}
            <View style={styles.gmpBox}>
              <View>
                <Text style={styles.gmpBoxLabel}>Expected Listing Gain</Text>
                <Text style={styles.gmpBoxValue}>+{bestPick.gmpPercent.toFixed(1)}%</Text>
              </View>
              <View style={styles.gmpAmountBadge}>
                <Text style={styles.gmpAmountText}>GMP: ₹{bestPick.gmpAmount}/sh</Text>
                <Text style={styles.gmpTrendText}>{bestPick.gmpTrend} Trend</Text>
              </View>
            </View>

            {/* Sizing & Bidding Metrics */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Cut-Off Bid</Text>
                <Text style={styles.metricValue}>₹{bestPick.priceCap}</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Lot Size</Text>
                <Text style={styles.metricValue}>{bestPick.lotSize} sh</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>1 Lot Capital</Text>
                <Text style={[styles.metricValue, { color: "#34d399" }]}>
                  {formatCurrencyAmount(bestPick.minInvestment, "INR")}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Strategy</Text>
                <Text style={[styles.metricValue, { color: "#60a5fa" }]}>1 Lot / PAN</Text>
              </View>
            </View>

            {/* Live Demand Gauges */}
            <View style={styles.demandSection}>
              <View style={styles.demandHeader}>
                <Text style={styles.demandTitle}>Subscription Traction</Text>
                <Text style={styles.demandTotal}>Total: {bestPick.totalSub}x</Text>
              </View>

              <View style={styles.demandRow}>
                <View style={styles.demandItem}>
                  <Text style={styles.demandItemLabel}>QIB (Inst)</Text>
                  <Text style={styles.demandItemValue}>{bestPick.qibSub}x</Text>
                </View>
                <View style={styles.demandItem}>
                  <Text style={styles.demandItemLabel}>NII / HNI</Text>
                  <Text style={styles.demandItemValue}>{bestPick.niiSub}x</Text>
                </View>
                <View style={styles.demandItem}>
                  <Text style={styles.demandItemLabel}>Retail</Text>
                  <Text style={styles.demandItemValue}>{bestPick.retailSub}x</Text>
                </View>
              </View>
            </View>

            {/* Prospectus Highlights */}
            {bestPick.reasonsFor.length > 0 && (
              <View style={styles.thesisBox}>
                <Text style={styles.thesisTitle}>Why Apply?</Text>
                {bestPick.reasonsFor.map((r: string, idx: number) => (
                  <Text key={idx} style={styles.thesisPoint}>
                    • {r}
                  </Text>
                ))}
              </View>
            )}

            {/* Log Application Button */}
            <Pressable
              onPress={() => setSelectedIpoForApp(bestPick)}
              style={({ pressed }) => [
                styles.applyBtn,
                pressed ? { opacity: 0.8 } : null,
              ]}
            >
              <MaterialIcons name="check-circle" size={18} color="#ffffff" />
              <Text style={styles.applyBtnText}>Log Application in Tracker</Text>
            </Pressable>
          </View>
        ) : openIpos.length > 0 ? (
          <View style={styles.avoidBox}>
            <MaterialIcons name="warning" size={24} color="#f59e0b" />
            <View style={{ flex: 1 }}>
              <Text style={styles.avoidTitle}>AVOID ALL OPEN IPOS TODAY</Text>
              <Text style={styles.avoidText}>
                None of the open issues satisfy North&apos;s 60-point quality and risk hurdle.
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.avoidBox, { borderColor: "rgba(255,255,255,0.1)", backgroundColor: "#1e1e1e" }]}>
            <MaterialIcons name="info-outline" size={24} color="#9ca3af" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.avoidTitle, { color: "#e5e7eb" }]}>NO OPEN IPOS TODAY</Text>
              <Text style={styles.avoidText}>
                There are currently no active public issues accepting bids in the primary market. Check upcoming issues below.
              </Text>
            </View>
          </View>
        )}

        {/* AI Briefing Accordion */}
        {recData?.aiSynthesis && (
          <View style={styles.aiBriefCard}>
            <View style={styles.aiBriefHeader}>
              <MaterialIcons name="auto-awesome" size={16} color="#34d399" />
              <Text style={styles.aiBriefTitle}>AI Prospectus Commentary</Text>
            </View>
            <Markdown
              style={{
                body: { color: "#9ca3af", fontSize: 12, lineHeight: 18 },
                strong: { color: "#f3f4f6" },
                heading3: { color: "#34d399", fontSize: 13, fontWeight: "bold", marginVertical: 4 },
              }}
            >
              {recData.aiSynthesis}
            </Markdown>
          </View>
        )}

        {/* Tab Controls */}
        <View style={styles.tabContainer}>
          <Pressable
            onPress={() => setActiveTab("open")}
            style={[styles.tabButton, activeTab === "open" ? styles.tabButtonActive : null]}
          >
            <Text style={[styles.tabText, activeTab === "open" ? styles.tabTextActive : null]}>
              Open ({openIpos.length})
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("upcoming")}
            style={[styles.tabButton, activeTab === "upcoming" ? styles.tabButtonActive : null]}
          >
            <Text style={[styles.tabText, activeTab === "upcoming" ? styles.tabTextActive : null]}>
              Upcoming ({upcomingIpos.length})
            </Text>
          </Pressable>


          <Pressable
            onPress={() => setActiveTab("applications")}
            style={[styles.tabButton, activeTab === "applications" ? styles.tabButtonActive : null]}
          >
            <Text style={[styles.tabText, activeTab === "applications" ? styles.tabTextActive : null]}>
              My Bids ({userApplications.length})
            </Text>
          </Pressable>
        </View>

        {/* TAB 1: OPEN IPOS */}
        {activeTab === "open" && (
          <View style={styles.cardsList}>
            {openIpos.length === 0 ? (
              <View style={styles.emptyAppsBox}>
                <MaterialIcons name="event-busy" size={36} color="#6b7280" />
                <Text style={styles.emptyAppsTitle}>No Open Issues Active</Text>
                <Text style={styles.emptyAppsText}>
                  There are no public issues currently open for bidding. Check the Upcoming tab for scheduled listings.
                </Text>
              </View>
            ) : (
              openIpos.map((ipo: any) => (
                <View key={ipo.symbol} style={styles.listItemCard}>
                  <View style={styles.listItemTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.listItemName}>{ipo.companyName}</Text>
                      <Text style={styles.listItemSymbol}>
                        {ipo.symbol} • {ipo.issueType}
                      </Text>
                    </View>
                    <View style={styles.listScoreBadge}>
                      <Text style={styles.listScoreText}>{ipo.score.totalScore} pts</Text>
                    </View>
                  </View>

                  <View style={styles.listMetricsRow}>
                    <View>
                      <Text style={styles.listMetricLabel}>Est. GMP Gain</Text>
                      <Text style={[styles.listMetricValue, { color: "#34d399" }]}>
                        {ipo.gmpAmount > 0 ? `+${ipo.expectedListingGain.toFixed(1)}%` : "0% (Par)"}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.listMetricLabel}>Demand</Text>
                      <Text style={[styles.listMetricValue, { color: "#38bdf8" }]}>
                        {ipo.totalSub > 0 ? `${ipo.totalSub}x Sub` : "0x"}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.listMetricLabel}>Cut-Off Price</Text>
                      <Text style={styles.listMetricValue}>₹{ipo.priceCap}</Text>
                    </View>
                    <View>
                      <Text style={styles.listMetricLabel}>1 Lot Capital</Text>
                      <Text style={styles.listMetricValue}>{formatCurrencyAmount(ipo.minInvestment, "INR")}</Text>
                    </View>
                  </View>

                  <View style={styles.listActionRow}>
                    <Text style={styles.listDatesText}>Closes: {ipo.closeDate}</Text>
                    <Pressable
                      onPress={() => setSelectedIpoForApp(ipo)}
                      style={styles.listApplyBtn}
                    >
                      <Text style={styles.listApplyBtnText}>Track Bid</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* TAB 2: UPCOMING IPOS */}
        {activeTab === "upcoming" && (
          <View style={styles.cardsList}>
            {upcomingIpos.length === 0 ? (
              <View style={styles.emptyAppsBox}>
                <MaterialIcons name="event-busy" size={36} color="#6b7280" />
                <Text style={styles.emptyAppsTitle}>No Upcoming Issues</Text>
                <Text style={styles.emptyAppsText}>
                  No future IPO issues are currently registered in the pipeline.
                </Text>
              </View>
            ) : (
              upcomingIpos.map((ipo: any) => (
                <View key={ipo.symbol} style={styles.listItemCard}>
                  <Text style={styles.listItemName}>{ipo.companyName}</Text>
                  <Text style={styles.listItemSymbol}>
                    {ipo.symbol} • {ipo.issueType}
                  </Text>

                  <View style={[styles.listMetricsRow, { marginTop: 8 }]}>
                    <View>
                      <Text style={styles.listMetricLabel}>Opening Date</Text>
                      <Text style={styles.listMetricValue}>
                        {typeof ipo.openDate === "string" ? ipo.openDate : ipo.openDate.slice(0, 10)}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.listMetricLabel}>Price Band</Text>
                      <Text style={styles.listMetricValue}>
                        ₹{ipo.priceFloor} - ₹{ipo.priceCap}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.listMetricLabel}>Issue Size</Text>
                      <Text style={styles.listMetricValue}>₹{ipo.issueSizeCr} Cr</Text>
                    </View>
                  </View>

                  {ipo.summaryThesis && (
                    <Text style={styles.upcomingThesisText} numberOfLines={2}>
                      {ipo.summaryThesis}
                    </Text>
                  )}
                </View>
              ))
            )}
          </View>
        )}


        {/* TAB 4: MY APPLICATIONS */}
        {activeTab === "applications" && (
          <View style={styles.cardsList}>
            {userApplications.length === 0 ? (
              <View style={styles.emptyAppsBox}>
                <MaterialIcons name="inbox" size={36} color="#6b7280" />
                <Text style={styles.emptyAppsTitle}>No Applications Logged</Text>
                <Text style={styles.emptyAppsText}>
                  Use &quot;Log Application&quot; to track your ASBA UPI mandates, allotment status, and realized listing profit.
                </Text>
              </View>
            ) : (
              userApplications.map((app: any) => (
                <View key={app.id} style={styles.listItemCard}>
                  <View style={styles.listItemTop}>
                    <Text style={styles.listItemName}>{app.ipo?.companyName || app.symbol}</Text>
                    <View style={styles.appStatusPill}>
                      <Text style={styles.appStatusText}>{app.status}</Text>
                    </View>
                  </View>

                  <View style={styles.listMetricsRow}>
                    <View>
                      <Text style={styles.listMetricLabel}>Lots Applied</Text>
                      <Text style={styles.listMetricValue}>{app.lotsApplied} Lot</Text>
                    </View>
                    <View>
                      <Text style={styles.listMetricLabel}>Bid Price</Text>
                      <Text style={styles.listMetricValue}>₹{app.bidPrice}</Text>
                    </View>
                    <View>
                      <Text style={styles.listMetricLabel}>Blocked Capital</Text>
                      <Text style={[styles.listMetricValue, { color: "#34d399" }]}>
                        {formatCurrencyAmount(app.totalAmountBlocked, "INR")}
                      </Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* APPLICATION MODAL */}
      <Modal visible={selectedIpoForApp != null} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedIpoForApp(null)} />
          <View style={[styles.modalContent, { paddingBottom: Math.max(28, insets.bottom + 16) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Track IPO Application</Text>
              <Pressable onPress={() => setSelectedIpoForApp(null)}>
                <MaterialIcons name="close" size={22} color="#9ca3af" />
              </Pressable>
            </View>

            {selectedIpoForApp && (
              <View style={styles.modalBody}>
                <Text style={styles.modalCompany}>{selectedIpoForApp.companyName}</Text>
                <Text style={styles.modalSubCompany}>
                  {selectedIpoForApp.symbol} • Cut-Off ₹{selectedIpoForApp.priceCap}
                </Text>

                <View style={styles.modalFieldGroup}>
                  <Text style={styles.modalFieldLabel}>Lots to Apply (1 Lot Recommended):</Text>
                  <View style={styles.lotCounterRow}>
                    <Pressable
                      onPress={() => setLotsToApply(Math.max(1, lotsToApply - 1))}
                      style={styles.lotCounterBtn}
                    >
                      <Text style={styles.lotCounterBtnText}>-</Text>
                    </Pressable>
                    <Text style={styles.lotCounterValue}>{lotsToApply}</Text>
                    <Pressable
                      onPress={() => setLotsToApply(lotsToApply + 1)}
                      style={styles.lotCounterBtn}
                    >
                      <Text style={styles.lotCounterBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.modalFieldGroup}>
                  <Text style={styles.modalFieldLabel}>UPI ID for Mandate (Optional):</Text>
                  <TextInput
                    value={upiIdInput}
                    onChangeText={setUpiIdInput}
                    placeholder="e.g. user@okhdfcbank"
                    placeholderTextColor="#6b7280"
                    style={styles.textInput}
                  />
                </View>

                <View style={styles.modalTotalBox}>
                  <Text style={styles.modalTotalLabel}>Total Capital Blocked:</Text>
                  <Text style={styles.modalTotalValue}>
                    {formatCurrencyAmount(
                      selectedIpoForApp.priceCap * selectedIpoForApp.lotSize * lotsToApply,
                      "INR",
                    )}
                  </Text>
                </View>

                <View style={styles.modalActionRow}>
                  <Pressable
                    onPress={() => setSelectedIpoForApp(null)}
                    style={styles.modalCancelBtn}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleConfirmApplication}
                    disabled={actionLoading}
                    style={styles.modalConfirmBtn}
                  >
                    <Text style={styles.modalConfirmText}>
                      {actionLoading ? "Saving..." : "Save Mandate"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#131313",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16,185,129,0.15)",
    borderColor: "rgba(16,185,129,0.3)",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  actionButtonText: {
    color: "#34d399",
    fontSize: 12,
    fontWeight: "600",
  },
  spinning: {
    transform: [{ rotate: "45deg" }],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 180,
    gap: 16,
  },
  headerBlock: {
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mainTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
  },
  badgePill: {
    backgroundColor: "rgba(16,185,129,0.15)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgePillText: {
    color: "#34d399",
    fontSize: 10,
    fontWeight: "700",
  },
  subTitle: {
    color: "#9ca3af",
    fontSize: 12,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statChip: {
    flex: 1,
    backgroundColor: "#1c1c1f",
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 10,
    borderRadius: 10,
  },
  statChipLabel: {
    color: "#9ca3af",
    fontSize: 10,
    textTransform: "uppercase",
  },
  statChipValue: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  heroCard: {
    backgroundColor: "#161b17",
    borderWidth: 2,
    borderColor: "rgba(16,185,129,0.4)",
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16,185,129,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  heroBadgeText: {
    color: "#34d399",
    fontSize: 10,
    fontWeight: "800",
  },
  scorePill: {
    backgroundColor: "#27272a",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  scorePillText: {
    color: "#34d399",
    fontSize: 11,
    fontWeight: "700",
  },
  heroCompanyName: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
  },
  heroSymbolText: {
    color: "#9ca3af",
    fontSize: 12,
  },
  gmpBox: {
    backgroundColor: "rgba(16,185,129,0.12)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.25)",
    padding: 12,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gmpBoxLabel: {
    color: "#9ca3af",
    fontSize: 11,
    textTransform: "uppercase",
  },
  gmpBoxValue: {
    color: "#34d399",
    fontSize: 24,
    fontWeight: "900",
  },
  gmpAmountBadge: {
    alignItems: "flex-end",
  },
  gmpAmountText: {
    color: "#34d399",
    fontSize: 13,
    fontWeight: "700",
  },
  gmpTrendText: {
    color: "#9ca3af",
    fontSize: 10,
  },
  metricsGrid: {
    flexDirection: "row",
    backgroundColor: "#1f2024",
    padding: 10,
    borderRadius: 10,
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
  },
  metricLabel: {
    color: "#9ca3af",
    fontSize: 10,
  },
  metricValue: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  demandSection: {
    backgroundColor: "#1f2024",
    padding: 10,
    borderRadius: 10,
    gap: 8,
  },
  demandHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  demandTitle: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  demandTotal: {
    color: "#34d399",
    fontSize: 11,
    fontWeight: "700",
  },
  demandRow: {
    flexDirection: "row",
    gap: 8,
  },
  demandItem: {
    flex: 1,
    backgroundColor: "#16171a",
    padding: 6,
    borderRadius: 6,
    alignItems: "center",
  },
  demandItemLabel: {
    color: "#9ca3af",
    fontSize: 9,
  },
  demandItemValue: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  thesisBox: {
    backgroundColor: "rgba(16,185,129,0.08)",
    padding: 10,
    borderRadius: 8,
    gap: 4,
  },
  thesisTitle: {
    color: "#34d399",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  thesisPoint: {
    color: "#d1d5db",
    fontSize: 11,
    lineHeight: 16,
  },
  applyBtn: {
    backgroundColor: "#059669",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 4,
  },
  applyBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  avoidBox: {
    backgroundColor: "rgba(245,158,11,0.1)",
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)",
    padding: 14,
    borderRadius: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  avoidTitle: {
    color: "#fbbf24",
    fontSize: 14,
    fontWeight: "800",
  },
  avoidText: {
    color: "#9ca3af",
    fontSize: 11,
    marginTop: 2,
  },
  aiBriefCard: {
    backgroundColor: "#1a1a1e",
    borderWidth: 1,
    borderColor: "#27272a",
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  aiBriefHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  aiBriefTitle: {
    color: "#34d399",
    fontSize: 12,
    fontWeight: "700",
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#16171a",
    padding: 4,
    borderRadius: 10,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: "#27272a",
  },
  tabText: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#34d399",
    fontWeight: "700",
  },
  cardsList: {
    gap: 10,
  },
  listItemCard: {
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "#27272a",
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  listItemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  listItemName: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  listItemSymbol: {
    color: "#9ca3af",
    fontSize: 11,
    marginTop: 1,
  },
  listScoreBadge: {
    backgroundColor: "#27272a",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  listScoreText: {
    color: "#34d399",
    fontSize: 10,
    fontWeight: "700",
  },
  listMetricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#1f2024",
    padding: 8,
    borderRadius: 8,
  },
  listMetricLabel: {
    color: "#9ca3af",
    fontSize: 10,
  },
  listMetricValue: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 1,
  },
  listActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
  },
  listDatesText: {
    color: "#9ca3af",
    fontSize: 10,
  },
  listApplyBtn: {
    backgroundColor: "rgba(16,185,129,0.15)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  listApplyBtnText: {
    color: "#34d399",
    fontSize: 11,
    fontWeight: "600",
  },
  upcomingThesisText: {
    color: "#9ca3af",
    fontSize: 11,
    lineHeight: 16,
  },
  emptyAppsBox: {
    alignItems: "center",
    padding: 30,
    gap: 6,
  },
  emptyAppsTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  emptyAppsText: {
    color: "#9ca3af",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
  appStatusPill: {
    backgroundColor: "rgba(16,185,129,0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  appStatusText: {
    color: "#34d399",
    fontSize: 10,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#18181b",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  modalBody: {
    gap: 12,
  },
  modalCompany: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  modalSubCompany: {
    color: "#9ca3af",
    fontSize: 12,
  },
  modalFieldGroup: {
    gap: 6,
  },
  modalFieldLabel: {
    color: "#9ca3af",
    fontSize: 11,
  },
  lotCounterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  lotCounterBtn: {
    backgroundColor: "#27272a",
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  lotCounterBtnText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
  },
  lotCounterValue: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  textInput: {
    backgroundColor: "#27272a",
    color: "#ffffff",
    padding: 10,
    borderRadius: 8,
    fontSize: 12,
  },
  modalTotalBox: {
    backgroundColor: "rgba(16,185,129,0.1)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.25)",
    padding: 10,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalTotalLabel: {
    color: "#9ca3af",
    fontSize: 12,
  },
  modalTotalValue: {
    color: "#34d399",
    fontSize: 14,
    fontWeight: "800",
  },
  modalActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: "#27272a",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalCancelText: {
    color: "#9ca3af",
    fontSize: 12,
    fontWeight: "600",
  },
  modalConfirmBtn: {
    flex: 1,
    backgroundColor: "#059669",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  modalConfirmText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
});
