import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";
import { formatCurrencyAmount, useCurrency } from "../../providers/CurrencyProvider";
import { apiGet } from "../../lib/apiClient";

export interface InvestmentBucket {
  final?: number;
  pct?: number;
}

export interface InvestmentSuggestionData {
  status?: string;
  phase?: string;
  phaseLabel?: string;
  totalInvestable?: number;
  streak?: number;
  smoothedSurplus?: number;
  investableRate?: number;
  cycleDays?: number;
  buckets?: {
    equity?: InvestmentBucket;
    debt?: InvestmentBucket;
    gold?: InvestmentBucket;
  };
}

export interface InvestmentWidgetProps {
  suggestion?: InvestmentSuggestionData | null;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

export function InvestmentWidget({ suggestion: initialSuggestion }: InvestmentWidgetProps) {
  const router = useRouter();
  const { currencyCode } = useCurrency();
  const [fetchedData, setFetchedData] = useState<{ suggestion?: InvestmentSuggestionData } | null>(null);
  const [loading, setLoading] = useState(!initialSuggestion);

  const formatCurrency = (value?: number | null) => {
    return formatCurrencyAmount(Number(value ?? 0), currencyCode);
  };

  useEffect(() => {
    if (initialSuggestion) {
      return;
    }
    let active = true;
    apiGet<{ ok?: boolean; suggestion?: InvestmentSuggestionData }>("/api/investments")
      .then((d) => {
        if (active && d?.ok) setFetchedData(d);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialSuggestion]);

  const suggestion = initialSuggestion || fetchedData?.suggestion;
  if (loading || !suggestion) return null;

  const isInvested = suggestion.status === "INVESTED";
  const isCrisis = suggestion.phase === "CRISIS";
  const total = suggestion.totalInvestable ?? 0;
  const buckets = suggestion.buckets;

  const phaseColor = isCrisis
    ? "#ffb4ab"
    : isInvested
      ? "#6ee7b7"
      : suggestion.phase === "WEALTH_BUILDING"
        ? "#05e777"
        : suggestion.phase === "EF_BUILDING"
          ? "#ffd54f"
          : "#b0c6ff";

  const cardBorder = isInvested
    ? "rgba(16, 185, 129, 0.35)"
    : isCrisis
      ? "rgba(255, 180, 171, 0.35)"
      : "rgba(129, 140, 248, 0.35)";

  return (
    <Pressable
      onPress={() => router.push("/investments")}
      style={({ pressed }) => [
        styles.goalCard,
        { borderColor: cardBorder, backgroundColor: "#0e0e0e" },
        pressed ? styles.cardPressed : null,
      ]}
    >
      <View style={[styles.goalCardHeader, { alignItems: "center" }]}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: isInvested ? "rgba(16,185,129,0.15)" : "rgba(129,140,248,0.15)" },
            ]}
          >
            <MaterialIcons
              name={isInvested ? "check-circle" : "trending-up"}
              size={20}
              color={isInvested ? "#34d399" : "#818cf8"}
            />
          </View>
          <View style={styles.headerTextCol}>
            <Text style={styles.efCleanTitle} numberOfLines={1}>
              {isInvested ? "Invested" : "Monthly Investment"}
            </Text>
            <Text style={[styles.efCleanSubtitle, { color: phaseColor }]} numberOfLines={1}>
              {suggestion.phaseLabel}
            </Text>
          </View>
        </View>
        {(suggestion.streak ?? 0) > 1 && (
          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>🔥 {suggestion.streak}</Text>
          </View>
        )}
      </View>

      {!isCrisis && (
        <View style={styles.amountRow}>
          <View>
            <Text style={styles.eyebrow}>
              {isInvested ? "Total Invested" : "Recommended Allocation"}
            </Text>
            <Text style={[styles.efAmountText, isInvested ? { color: "#6ee7b7" } : { color: "#ffffff" }]}>
              {formatCurrency(total)}
            </Text>
          </View>
          <View style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>{isInvested ? "VIEW HISTORY" : "CONFIGURE"}</Text>
            <MaterialIcons name="chevron-right" size={16} color="#ffffff" />
          </View>
        </View>
      )}

      {total > 0 && buckets && (
        <View style={styles.bucketsSection}>
          <View style={styles.efProgressBg}>
            <View style={styles.bucketBars}>
              {(buckets.equity?.final ?? 0) > 0 && (
                <View style={{ flex: buckets.equity?.final, backgroundColor: "#818cf8" }} />
              )}
              {(buckets.debt?.final ?? 0) > 0 && (
                <View style={{ flex: buckets.debt?.final, backgroundColor: "#34d399" }} />
              )}
              {(buckets.gold?.final ?? 0) > 0 && (
                <View style={{ flex: buckets.gold?.final, backgroundColor: "#fbbf24" }} />
              )}
            </View>
          </View>
          <View style={styles.legendRow}>
            <LegendDot color="#818cf8" label={`Eq ${buckets.equity?.pct ?? 0}%`} />
            <LegendDot color="#34d399" label={`Debt ${buckets.debt?.pct ?? 0}%`} />
            <LegendDot color="#fbbf24" label={`Gold ${buckets.gold?.pct ?? 0}%`} />
          </View>
        </View>
      )}

      <View style={styles.efFooterRow}>
        <View style={styles.efFooterLeft}>
          {isInvested ? (
            <>
              <Text style={styles.efFooterText}>Status: Completed & Recorded</Text>
              <Text style={[styles.efFooterText, { marginTop: 2 }]}>
                Surplus: {formatCurrency(suggestion.smoothedSurplus ?? 0)}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.efFooterText}>
                Surplus: {formatCurrency(suggestion.smoothedSurplus ?? 0)}
              </Text>
              <Text style={[styles.efFooterText, { marginTop: 2 }]}>
                Investable Rate: {suggestion.investableRate ?? 0}% of surplus
              </Text>
            </>
          )}
        </View>
        <View style={styles.efFooterRight}>
          <Text style={[styles.efFooterEtaText, { color: isInvested ? "#34d399" : "#818cf8" }]}>
            {suggestion.cycleDays ?? 33}-Day Cycle
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  goalCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
    overflow: "hidden",
    position: "relative",
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  goalCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
    paddingRight: 6,
  },
  iconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  efCleanTitle: {
    color: "#ffffff",
    fontFamily: "Hanken Grotesk",
    fontSize: 18,
    fontWeight: "600",
  },
  efCleanSubtitle: {
    color: "#8e9192",
    fontFamily: "JetBrains Mono",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  streakBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderColor: "rgba(245, 158, 11, 0.4)",
    borderWidth: 1,
    marginTop: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    flexShrink: 0,
    alignSelf: "center",
  },
  streakText: {
    color: "#fbbf24",
    fontFamily: "JetBrains Mono",
    fontSize: 10,
    fontWeight: "700",
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginVertical: 4,
  },
  eyebrow: {
    color: "#8e9192",
    fontFamily: "JetBrains Mono",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  efAmountText: {
    color: "#ffffff",
    fontFamily: "JetBrains Mono",
    fontSize: 28,
    fontWeight: "700",
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  viewAllText: {
    color: "#ffffff",
    fontFamily: "JetBrains Mono",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  bucketsSection: {
    gap: 8,
    marginTop: 4,
  },
  efProgressBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(0,0,0,0.4)",
    overflow: "hidden",
    marginTop: 4,
    marginBottom: 4,
  },
  bucketBars: {
    flexDirection: "row",
    height: "100%",
    width: "100%",
    overflow: "hidden",
    borderRadius: 999,
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: "#c4c7c8",
    fontFamily: "JetBrains Mono",
    fontSize: 11,
  },
  efFooterRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  efFooterLeft: {
    flex: 1,
    paddingRight: 8,
  },
  efFooterRight: {
    flexShrink: 0,
    alignItems: "flex-end",
  },
  efFooterText: {
    color: "#8e9192",
    fontFamily: "Inter",
    fontSize: 13,
    lineHeight: 18,
  },
  efFooterEtaText: {
    color: "#fbbf24",
    fontFamily: "JetBrains Mono",
    fontSize: 12,
    fontWeight: "700",
  },
});

