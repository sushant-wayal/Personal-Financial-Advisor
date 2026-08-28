import React, { useState, useMemo, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, LayoutAnimation, Platform, UIManager } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { fetchNetWorth, NetWorthData } from "../../lib/networthApi";
import { NETWORTH_CONFIG } from "../../lib/networthConfig";
import { getClientCache, setClientCache } from "../../lib/clientCache";
import { NetWorthSkeleton } from "../../components/LoadingSkeleton";
import { beginHorizontalScroll, endHorizontalScroll, updateHorizontalScroll } from "../../lib/horizontalScrollPriority";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

type FilterTab = "ALL" | "INVESTMENTS" | "DEPOSITS" | "REAL_ASSETS" | "LIABILITIES";

interface GroupMeta {
  type: string;
  title: string;
  category: "asset" | "liability";
  icon: keyof typeof MaterialIcons.glyphMap;
  color: string;
  filter: FilterTab;
}

const GROUP_METAS: Record<string, GroupMeta> = {
  // Investments
  mutualFund: { type: "mutualFund", title: "Mutual Funds", category: "asset", icon: "pie-chart", color: "#818cf8", filter: "INVESTMENTS" },
  stock: { type: "stock", title: "Stocks & Equities", category: "asset", icon: "trending-up", color: "#38bdf8", filter: "INVESTMENTS" },
  
  // Deposits & Receivables
  pPFAccount: { type: "pPFAccount", title: "PPF Accounts", category: "asset", icon: "account-balance", color: "#a78bfa", filter: "DEPOSITS" },
  ePFAccount: { type: "ePFAccount", title: "EPF Accounts", category: "asset", icon: "work", color: "#f472b6", filter: "DEPOSITS" },
  fDAccount: { type: "fDAccount", title: "Fixed Deposits", category: "asset", icon: "savings", color: "#fbbf24", filter: "DEPOSITS" },
  rDAccount: { type: "rDAccount", title: "Recurring Deposits", category: "asset", icon: "autorenew", color: "#fb923c", filter: "DEPOSITS" },
  receivableAsset: { type: "receivableAsset", title: "Money Owed to You", category: "asset", icon: "handshake", color: "#2dd4bf", filter: "DEPOSITS" },

  // Real & Physical Assets
  jewelleryAsset: { type: "jewelleryAsset", title: "Gold & Jewellery", category: "asset", icon: "diamond", color: "#eab308", filter: "REAL_ASSETS" },
  vehicleAsset: { type: "vehicleAsset", title: "Vehicles", category: "asset", icon: "directions-car", color: "#60a5fa", filter: "REAL_ASSETS" },
  apartmentAsset: { type: "apartmentAsset", title: "Apartments", category: "asset", icon: "apartment", color: "#818cf8", filter: "REAL_ASSETS" },
  plotAsset: { type: "plotAsset", title: "Plots & Land", category: "asset", icon: "landscape", color: "#a3e635", filter: "REAL_ASSETS" },
  independentPropertyAsset: { type: "independentPropertyAsset", title: "Independent Properties", category: "asset", icon: "home", color: "#c084fc", filter: "REAL_ASSETS" },

  // Liabilities
  loanLiability: { type: "loanLiability", title: "Loans", category: "liability", icon: "request-quote", color: "#f87171", filter: "LIABILITIES" },
  creditCardLiability: { type: "creditCardLiability", title: "Credit Cards", category: "liability", icon: "credit-card", color: "#fb7185", filter: "LIABILITIES" },
  bnplLiability: { type: "bnplLiability", title: "Buy Now Pay Later", category: "liability", icon: "shopping-cart", color: "#fb923c", filter: "LIABILITIES" },
  borrowedLiability: { type: "borrowedLiability", title: "Borrowed Money", category: "liability", icon: "person", color: "#ef4444", filter: "LIABILITIES" },
};

function getItemTitle(item: any, type: string): string {
  switch (type) {
    case "mutualFund":
      return item.schemeName || "Mutual Fund Scheme";
    case "stock":
      return `${item.symbol || "Stock"} (${item.exchange || "NSE"})`;
    case "pPFAccount":
      return "Public Provident Fund (PPF)";
    case "ePFAccount":
      return "Employee Provident Fund (EPF)";
    case "fDAccount":
      return `${item.bankName || "Bank"} Fixed Deposit`;
    case "rDAccount":
      return `${item.bankName || "Bank"} Recurring Deposit`;
    case "receivableAsset":
      return item.name || "Money Owed";
    case "jewelleryAsset":
      return `${item.metalType || "Gold"} (${item.purity ? `${item.purity}K` : "Pure"})`;
    case "vehicleAsset":
      return `${item.brand || ""} ${item.modelName || "Vehicle"}`.trim();
    case "apartmentAsset":
      return item.projectName || `${item.locality ? `${item.locality}, ` : ""}${item.city || "Apartment"}`.trim();
    case "plotAsset":
      return `${item.locality ? `${item.locality}, ` : ""}${item.city || "Plot / Land"}`.trim();
    case "independentPropertyAsset":
      return `${item.locality ? `${item.locality}, ` : ""}${item.city || "Property"}`.trim();
    case "loanLiability":
      return `${item.loanType || "Personal"} Loan`;
    case "creditCardLiability":
      return item.provider || "Credit Card";
    case "bnplLiability":
      return item.provider || "Pay Later";
    case "borrowedLiability":
      return item.lenderName || "Borrowed Money";
    default:
      return item.name || item.brand || item.provider || "Holding";
  }
}

function getItemSubtitle(item: any, type: string): string {
  switch (type) {
    case "mutualFund": {
      const units = Number(item.currentUnits || 0);
      const nav = Number(item.currentNav || 0);
      const parts = [];
      if (item.planType && item.option) parts.push(`${item.planType} • ${item.option}`);
      if (units > 0 && nav > 0) parts.push(`${units.toFixed(3)} units @ ₹${nav.toFixed(2)}`);
      return parts.join(" | ") || "Mutual Fund Holding";
    }
    case "stock": {
      const qty = Number(item.currentQuantity || 0);
      const price = Number(item.currentPrice || 0);
      return qty > 0 && price > 0 ? `${qty} shares @ ₹${price.toFixed(2)}` : "Equity Holding";
    }
    case "fDAccount": {
      const rate = item.annualInterestRate ? `${item.annualInterestRate}% p.a.` : "";
      const payout = item.payoutType === "CUMULATIVE" ? "Cumulative" : "Non-Cumulative";
      return [rate, payout].filter(Boolean).join(" • ") || "Fixed Deposit";
    }
    case "rDAccount": {
      const monthly = item.monthlyDepositAmount ? `₹${item.monthlyDepositAmount}/mo` : "";
      const rate = item.annualInterestRate ? `${item.annualInterestRate}%` : "";
      return [monthly, rate].filter(Boolean).join(" • ") || "Recurring Deposit";
    }
    case "pPFAccount":
      return item.currentInterestRate ? `${item.currentInterestRate}% interest rate` : "Government PPF";
    case "ePFAccount":
      return item.currentInterestRate ? `${item.currentInterestRate}% interest rate` : "EPF Corpus";
    case "receivableAsset": {
      const category = item.category ? item.category.replace(/_/g, " ") : "Receivable";
      const date = item.expectedReturnDate 
        ? `Due: ${new Date(item.expectedReturnDate).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}` 
        : null;
      const intRate = item.interestRate && item.interestRate > 0 ? `${item.interestRate}% interest` : null;
      return [category, date, intRate].filter(Boolean).join(" • ");
    }
    case "plotAsset": {
      const area = item.area ? `${item.area} ${item.areaUnit || "sqft"}` : "";
      const location = [item.state, item.country].filter(Boolean).join(", ");
      return [area, location].filter(Boolean).join(" • ") || "Land Property";
    }
    case "jewelleryAsset":
      return `${item.netWeight || 0} ${item.weightUnit || "g"}`;
    case "vehicleAsset":
      return `${item.manufacturingYear || ""} ${item.fuelType || ""}`.trim() || "Vehicle";
    case "apartmentAsset": {
      const bhk = item.bhk ? `${item.bhk}` : "";
      const area = item.builtUpArea ? `${item.builtUpArea} sqft` : "";
      return [bhk, area].filter(Boolean).join(" • ") || "Apartment";
    }
    case "independentPropertyAsset": {
      const builtUp = item.builtUpArea ? `${item.builtUpArea} sqft built-up` : "";
      const land = item.landArea ? `${item.landArea} ${item.landAreaUnit || "sqft"} land` : "";
      return [builtUp, land].filter(Boolean).join(" • ") || "Independent House";
    }
    case "loanLiability":
      return item.emiAmount ? `₹${item.emiAmount}/mo EMI • ${item.interestRate || 0}%` : "Loan Account";
    case "creditCardLiability":
      return `Due day: ${item.paymentDueDay || 1}th of month • ${item.annualInterestRate || 0}% APR`;
    case "bnplLiability":
      return `₹${item.monthlyInstallment || 0}/mo installment • Due ${item.paymentDueDay || 1}th`;
    case "borrowedLiability":
      return `${item.repaymentFrequency || "Monthly"} • ${item.interestRate || 0}% interest`;
    default:
      return "Active";
  }
}

function getItemValue(item: any, category: "asset" | "liability"): number {
  if (category === "asset") {
    return Number(item.currentWorth ?? (item.currentUnits && item.currentNav ? item.currentUnits * item.currentNav : (item.currentBalance ?? item.principalAmount ?? item.purchasePrice ?? 0)));
  }
  return Number(item.currentOutstanding ?? item.outstandingBalance ?? item.outstandingAmount ?? 0);
}

export default function NetWorthScreen() {
  const router = useRouter();
  
  const initialCache = useMemo(() => getClientCache<NetWorthData>("app:networth-data") ?? null, []);
  const [data, setData] = useState<NetWorthData | null>(initialCache);
  const [isLoading, setIsLoading] = useState(!initialCache);
  const [isError, setIsError] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");
  // All accordions collapsed by default
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!getClientCache("app:networth-data")) {
        setIsLoading(true);
      }
      
      fetchNetWorth()
        .then(res => {
          if (active) {
            setData(res);
            setIsError(false);
            setClientCache("app:networth-data", res);
          }
        })
        .catch(() => {
          if (active && !getClientCache("app:networth-data")) setIsError(true);
        })
        .finally(() => {
          if (active) setIsLoading(false);
        });
      return () => { active = false; };
    }, [])
  );

  const toggleGroup = (groupKey: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <NetWorthSkeleton />
      </SafeAreaView>
    );
  }

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Failed to load Net Worth data.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { assets, liabilities, totals } = data;

  // Extract Bank Balance as a clean minimal pill
  const bankBalanceItem = assets["Bank Balance"]?.[0];
  const bankBalanceValue = Number(bankBalanceItem?.currentWorth ?? 0);

  // Build structured groups for other constructs
  const allGroups = [
    ...Object.entries(assets)
      .filter(([type]) => type !== "Bank Balance")
      .map(([type, items]) => ({
        type,
        category: "asset" as const,
        meta: GROUP_METAS[type] || {
          type,
          title: NETWORTH_CONFIG[type]?.label || type,
          category: "asset",
          icon: "account-balance" as const,
          color: "#34d399",
          filter: "INVESTMENTS" as FilterTab
        },
        items: (items || []) as any[],
        total: (items || []).reduce((sum, item) => sum + getItemValue(item, "asset"), 0)
      })),
    ...Object.entries(liabilities).map(([type, items]) => ({
      type,
      category: "liability" as const,
      meta: GROUP_METAS[type] || {
        type,
        title: NETWORTH_CONFIG[type]?.label || type,
        category: "liability",
        icon: "credit-card" as const,
        color: "#f87171",
        filter: "LIABILITIES" as FilterTab
      },
      items: (items || []) as any[],
      total: (items || []).reduce((sum, item) => sum + getItemValue(item, "liability"), 0)
    }))
  ].filter(group => group.items.length > 0);

  // Filter groups according to selected tab
  const filteredGroups = allGroups.filter(g => {
    if (activeFilter === "ALL") return true;
    if (activeFilter === "LIABILITIES") return g.category === "liability";
    return g.meta.filter === activeFilter;
  });

  const showLiquidCash = activeFilter === "ALL" || activeFilter === "DEPOSITS";

  const assetPercentage = totals.assets + totals.liabilities > 0 
    ? Math.round((totals.assets / (totals.assets + totals.liabilities)) * 100) 
    : 100;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Net Worth Portfolio</Text>
        <Pressable 
          onPress={() => router.push({ pathname: "/networth/add", params: {} } as any)} 
          style={styles.headerAddBtn}
        >
          <MaterialIcons name="add" size={22} color="#fff" />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Total Net Worth Hero Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>TOTAL NET WORTH</Text>
          <Text style={styles.heroValue}>{formatCurrency(totals.netWorth)}</Text>
          
          {/* Visual Allocation Bar */}
          <View style={styles.allocationBarContainer}>
            <View style={[styles.allocationBarAsset, { width: `${assetPercentage}%` }]} />
            <View style={[styles.allocationBarLiability, { width: `${100 - assetPercentage}%` }]} />
          </View>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatCol}>
              <View style={styles.statLabelRow}>
                <View style={[styles.dotIndicator, { backgroundColor: "#7dffa2" }]} />
                <Text style={styles.heroStatLabel}>Total Assets</Text>
              </View>
              <Text style={styles.heroAssetValue}>{formatCurrency(totals.assets)}</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStatCol}>
              <View style={styles.statLabelRow}>
                <View style={[styles.dotIndicator, { backgroundColor: "#ffb4ab" }]} />
                <Text style={styles.heroStatLabel}>Total Liabilities</Text>
              </View>
              <Text style={styles.heroLiabilityValue}>{formatCurrency(totals.liabilities)}</Text>
            </View>
          </View>
        </View>

        {/* Minimal Clean Liquid Cash Card */}
        {showLiquidCash && (
          <View style={styles.liquidCashCard}>
            <View style={styles.liquidCashLeft}>
              <View style={styles.liquidCashDot} />
              <Text style={styles.liquidCashTitle}>Liquid Cash</Text>
            </View>
            <Text style={styles.liquidCashValue}>{formatCurrency(bankBalanceValue)}</Text>
          </View>
        )}

        {/* Inline Horizontal Filter ScrollView with gesture protection */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
          nestedScrollEnabled={true}
          onTouchStart={beginHorizontalScroll}
          onTouchEnd={endHorizontalScroll}
          onTouchCancel={endHorizontalScroll}
          onScrollBeginDrag={beginHorizontalScroll}
          onScrollEndDrag={endHorizontalScroll}
          onMomentumScrollEnd={endHorizontalScroll}
          onScroll={({ nativeEvent: { contentOffset, layoutMeasurement, contentSize } }) => {
            updateHorizontalScroll(contentOffset.x, layoutMeasurement.width, contentSize.width);
          }}
          scrollEventThrottle={16}
        >
          {(["ALL", "INVESTMENTS", "DEPOSITS", "REAL_ASSETS", "LIABILITIES"] as FilterTab[]).map(tab => {
            const isActive = activeFilter === tab;
            const labels: Record<FilterTab, string> = {
              ALL: "All",
              INVESTMENTS: "Investments",
              DEPOSITS: "Deposits & Owed",
              REAL_ASSETS: "Real Assets",
              LIABILITIES: "Liabilities"
            };
            return (
              <Pressable 
                key={tab} 
                onPress={() => setActiveFilter(tab)}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
              >
                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                  {labels[tab]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Grouped Asset & Liability Accordions (Collapsed by default) */}
        <View style={styles.groupsContainer}>
          {filteredGroups.length === 0 && !showLiquidCash ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="account-balance-wallet" size={48} color="#333" />
              <Text style={styles.emptyTitle}>No holdings found in this category</Text>
              <Text style={styles.emptySub}>Tap &quot;+&quot; in the header to add your first asset or liability.</Text>
            </View>
          ) : (
            filteredGroups.map(group => {
              const isExpanded = Boolean(expandedGroups[group.type]);
              const countLabel = group.items.length === 1 
                ? "1 holding" 
                : `${group.items.length} holdings`;

              return (
                <View key={group.type} style={styles.groupCard}>
                  {/* Group Header Accordion */}
                  <Pressable 
                    onPress={() => toggleGroup(group.type)} 
                    style={styles.groupHeader}
                  >
                    <View style={styles.groupHeaderLeft}>
                      <View style={[styles.groupIconBox, { backgroundColor: `${group.meta.color}20` }]}>
                        <MaterialIcons name={group.meta.icon} size={20} color={group.meta.color} />
                      </View>
                      <View style={styles.groupHeaderCopy}>
                        <View style={styles.groupTitleRow}>
                          <Text style={styles.groupTitle}>{group.meta.title}</Text>
                          <View style={styles.countBadge}>
                            <Text style={styles.countBadgeText}>{countLabel}</Text>
                          </View>
                        </View>
                        <Text style={[styles.groupTotalValue, group.category === "asset" ? styles.assetColor : styles.liabilityColor]}>
                          {formatCurrency(group.total)}
                        </Text>
                      </View>
                    </View>
                    <MaterialIcons 
                      name={isExpanded ? "keyboard-arrow-up" : "keyboard-arrow-down"} 
                      size={24} 
                      color="#8e9192" 
                    />
                  </Pressable>

                  {/* Group Holdings List (Shown only when expanded) */}
                  {isExpanded && (
                    <View style={styles.groupItemsList}>
                      {group.items.map((item, idx) => {
                        const title = getItemTitle(item, group.type);
                        const subtitle = getItemSubtitle(item, group.type);
                        const value = getItemValue(item, group.category);

                        return (
                          <Pressable
                            key={`${group.type}-${item.id || idx}`}
                            style={[
                              styles.itemRow,
                              idx < group.items.length - 1 && styles.itemRowBorder
                            ]}
                            onPress={() => {
                              router.push({ pathname: "/networth/form", params: { type: group.type, id: item.id } } as any);
                            }}
                          >
                            <View style={styles.itemCopy}>
                              <Text style={styles.itemTitle} numberOfLines={1} ellipsizeMode="tail">
                                {title}
                              </Text>
                              <Text style={styles.itemSubtitle} numberOfLines={1} ellipsizeMode="tail">
                                {subtitle}
                              </Text>
                            </View>
                            <View style={styles.itemValueWrapper}>
                              <Text style={[styles.itemValue, group.category === "asset" ? styles.assetColor : styles.liabilityColor]}>
                                {formatCurrency(value)}
                              </Text>
                              <MaterialIcons name="chevron-right" size={18} color="#555" />
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0e0e0e" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { color: "#ffb4ab", fontSize: 16 },
  header: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    paddingHorizontal: 20, 
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
    backgroundColor: "#0e0e0e"
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, color: "#fff", fontWeight: "700", fontFamily: "Hanken Grotesk" },
  headerAddBtn: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: "#818cf8", 
    alignItems: "center", 
    justifyContent: "center" 
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  heroCard: { 
    backgroundColor: "#161618", 
    borderRadius: 20, 
    padding: 22, 
    marginBottom: 16, 
    borderWidth: 1, 
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4
  },
  heroEyebrow: { color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: "700", letterSpacing: 1.4, marginBottom: 6 },
  heroValue: { color: "#ffffff", fontSize: 34, fontWeight: "800", marginBottom: 18, letterSpacing: -0.5 },
  allocationBarContainer: {
    flexDirection: "row",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 18,
    backgroundColor: "rgba(255,255,255,0.1)"
  },
  allocationBarAsset: { backgroundColor: "#7dffa2" },
  allocationBarLiability: { backgroundColor: "#ffb4ab" },
  heroStatsRow: { flexDirection: "row", width: "100%", justifyContent: "space-between" },
  heroStatCol: { flex: 1 },
  statLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  dotIndicator: { width: 6, height: 6, borderRadius: 3 },
  heroStatLabel: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "500" },
  heroAssetValue: { color: "#7dffa2", fontSize: 18, fontWeight: "700" },
  heroLiabilityValue: { color: "#ffb4ab", fontSize: 18, fontWeight: "700" },
  heroDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.08)", marginHorizontal: 16 },

  liquidCashCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#161618",
    borderWidth: 1,
    borderColor: "rgba(52, 211, 153, 0.2)",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16
  },
  liquidCashLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  liquidCashDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#34d399"
  },
  liquidCashTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600"
  },
  liquidCashValue: {
    color: "#7dffa2",
    fontSize: 16,
    fontWeight: "700"
  },
  
  filterScroll: { 
    marginBottom: 16 
  },
  filterContainer: { 
    flexDirection: "row",
    alignItems: "center",
    gap: 8, 
    paddingRight: 16 
  },
  filterPill: { 
    paddingHorizontal: 15, 
    paddingVertical: 8, 
    borderRadius: 20, 
    backgroundColor: "rgba(255,255,255,0.05)", 
    borderWidth: 1, 
    borderColor: "rgba(255,255,255,0.08)" 
  },
  filterPillActive: { 
    backgroundColor: "rgba(129,140,248,0.2)", 
    borderColor: "#818cf8" 
  },
  filterPillText: { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "600" },
  filterPillTextActive: { color: "#818cf8", fontWeight: "700" },

  groupsContainer: { gap: 12 },
  groupCard: { 
    backgroundColor: "#161618", 
    borderRadius: 16, 
    borderWidth: 1, 
    borderColor: "rgba(255,255,255,0.07)",
    overflow: "hidden"
  },
  groupHeader: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    padding: 16 
  },
  groupHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  groupIconBox: { 
    width: 42, 
    height: 42, 
    borderRadius: 12, 
    alignItems: "center", 
    justifyContent: "center" 
  },
  groupHeaderCopy: { flex: 1, gap: 2 },
  groupTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  groupTitle: { color: "#ffffff", fontSize: 16, fontWeight: "700" },
  countBadge: { 
    backgroundColor: "rgba(255,255,255,0.08)", 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    borderRadius: 10 
  },
  countBadgeText: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "600" },
  groupTotalValue: { fontSize: 15, fontWeight: "700", marginTop: 2 },
  
  groupItemsList: { 
    borderTopWidth: 1, 
    borderTopColor: "rgba(255,255,255,0.05)", 
    backgroundColor: "rgba(0,0,0,0.2)", 
    paddingHorizontal: 16 
  },
  itemRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between", 
    paddingVertical: 14 
  },
  itemRowBorder: { 
    borderBottomWidth: 1, 
    borderBottomColor: "rgba(255,255,255,0.04)" 
  },
  itemCopy: { flex: 1, marginRight: 12, gap: 3 },
  itemTitle: { color: "#ffffff", fontSize: 14, fontWeight: "600" },
  itemSubtitle: { color: "rgba(255,255,255,0.45)", fontSize: 12 },
  itemValueWrapper: { flexDirection: "row", alignItems: "center", gap: 4 },
  itemValue: { fontSize: 15, fontWeight: "700" },

  assetColor: { color: "#7dffa2" },
  liabilityColor: { color: "#ffb4ab" },

  emptyContainer: { 
    alignItems: "center", 
    justifyContent: "center", 
    paddingVertical: 48, 
    gap: 12 
  },
  emptyTitle: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  emptySub: { color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center", maxWidth: 280 }
});
