import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { EmergencyFundData } from "../../types/goal";
import { formatCurrencyAmount, useCurrency } from "../../providers/CurrencyProvider";
import { Skeleton } from "../LoadingSkeleton";

export interface EmergencyFundWidgetProps {
  ef?: EmergencyFundData | null;
  currencyCode?: string;
}

export function EmergencyFundWidget({ ef, currencyCode }: EmergencyFundWidgetProps) {
  const { currencyCode: activeCurrency } = useCurrency();
  const effectiveCurrency = currencyCode ?? activeCurrency;

  const formatCurrency = (value?: number | null) => {
    return formatCurrencyAmount(Number(value ?? 0), effectiveCurrency);
  };

  if (!ef) {
    return (
      <View style={[styles.goalCard, { borderColor: "rgba(68,71,72,0.35)", backgroundColor: "#0e0e0e" }]}>
        <View style={styles.goalCardHeader}>
          <Text style={styles.efCleanTitle}>🛡️  Emergency Fund</Text>
          <Text style={styles.efCleanSubtitle}>Priority</Text>
        </View>
        <View style={styles.efAmountBlock}>
          <Skeleton width="60%" height={28} radius={6} />
          <Skeleton width="15%" height={16} radius={4} />
        </View>
        <Skeleton width="100%" height={6} radius={3} style={{ marginTop: 12, marginBottom: 12 }} />
        <View style={styles.efFooterRow}>
          <Text style={styles.efFooterText}>Loading details...</Text>
        </View>
      </View>
    );
  }

  const progressClamped = Math.min(100, Math.max(0, ef.progressPct || 0));
  const isComplete = ef.isComplete || progressClamped >= 100;
  const etaStr = ef.estimatedCompletionDate
    ? new Date(ef.estimatedCompletionDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "N/A";

  return (
    <View
      style={[
        styles.goalCard,
        isComplete
          ? { borderColor: "rgba(16, 185, 129, 0.4)", backgroundColor: "rgba(6, 78, 59, 0.2)" }
          : { borderColor: "rgba(249, 115, 22, 0.4)", backgroundColor: "rgba(67, 20, 7, 0.2)" },
      ]}
    >
      <View style={styles.goalCardHeader}>
        <View>
          <Text style={styles.efCleanTitle}>{isComplete ? "✅" : "🛡️"}  Emergency Fund</Text>
          {!isComplete && (
            <View
              style={[
                styles.efWarningBadge,
                ef.goalsRatio && ef.goalsRatio > 0
                  ? { backgroundColor: "rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.4)" }
                  : null,
              ]}
            >
              <Text
                style={[
                  styles.efWarningBadgeText,
                  ef.goalsRatio && ef.goalsRatio > 0 ? { color: "#6ee7b7" } : null,
                ]}
              >
                {ef.goalsRatio && ef.goalsRatio > 0
                  ? `⚡ DUAL-TRACK (${Math.round((ef.efRatio ?? 0.7) * 100)}% EF / ${Math.round((ef.goalsRatio ?? 0.3) * 100)}% GOALS)`
                  : "🔒 STRICT MODE: 100% EF DRIP"}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.efCleanSubtitle, isComplete ? { color: "#6ee7b7" } : { color: "#fdba74" }]}>
          {isComplete ? "Fully Funded" : `Tier ${ef.tier ?? 2}`}
        </Text>
      </View>

      <View style={styles.efAmountBlock}>
        <Text>
          <Text style={[styles.efAmountText, isComplete ? { color: "#6ee7b7" } : { color: "#ffffff" }]}>
            {formatCurrency(ef.savedAmount)}
          </Text>
          <Text style={styles.efAmountTextSub}> / {formatCurrency(ef.targetAmount)}</Text>
        </Text>
        <Text style={[styles.efAmountTextSub, isComplete ? { color: "#6ee7b7" } : { color: "#fdba74" }]}>
          {progressClamped.toFixed(0)}%
        </Text>
      </View>

      <View style={styles.efProgressBg}>
        <View
          style={[
            styles.efProgressFill,
            isComplete ? { backgroundColor: "#34d399" } : { backgroundColor: "#f97316" },
            { width: `${progressClamped}%` },
          ]}
        />
      </View>

      <View style={styles.efFooterRow}>
        <View style={styles.efFooterLeft}>
          {isComplete ? (
            <Text style={styles.efFooterText}>
              Target of {ef.targetMonths} mo expenses achieved
            </Text>
          ) : (
            <>
              <Text style={styles.efFooterText}>
                EF Drip: {formatCurrency(ef.efMonthlyDrip ?? ef.monthlyCapacity)}/mo
              </Text>
              <Text style={[styles.efFooterText, { marginTop: 2 }]}>
                Goals Pool: {formatCurrency(ef.availableGoalCapacity ?? 0)}/mo
              </Text>
            </>
          )}
        </View>
        <View style={styles.efFooterRight}>
          <Text style={[styles.efFooterEtaText, isComplete && { color: "#34d399" }]}>
            ETA: {isComplete ? "Achieved 🎉" : etaStr}
          </Text>
        </View>
      </View>
    </View>
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
  goalCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
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
  efAmountBlock: {
    marginTop: -4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  efAmountText: {
    color: "#ffffff",
    fontFamily: "JetBrains Mono",
    fontSize: 28,
    fontWeight: "700",
  },
  efAmountTextSub: {
    color: "#8e9192",
    fontFamily: "JetBrains Mono",
    fontSize: 16,
    fontWeight: "600",
  },
  efProgressBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(0,0,0,0.4)",
    overflow: "hidden",
    marginTop: 4,
    marginBottom: 4,
  },
  efProgressFill: {
    height: "100%",
    borderRadius: 3,
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
  efWarningBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(249, 115, 22, 0.15)",
    marginTop: 6,
  },
  efWarningBadgeText: {
    color: "#fdba74",
    fontFamily: "JetBrains Mono",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
