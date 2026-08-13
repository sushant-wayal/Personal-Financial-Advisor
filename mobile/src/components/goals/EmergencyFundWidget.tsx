import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import type { EmergencyFundData } from "../../types/goal";
import { formatCurrencyAmount, getCurrencySymbol } from "../../providers/CurrencyProvider";

type EmergencyFundWidgetProps = {
  ef?: EmergencyFundData | null;
  currencyCode?: string;
};

export function EmergencyFundWidget({ ef, currencyCode }: EmergencyFundWidgetProps) {
  if (!ef) return null;

  const symbol = getCurrencySymbol(currencyCode);
  const progressClamped = Math.min(100, Math.max(0, ef.progressPct || 0));
  const isComplete = ef.isComplete || progressClamped >= 100;

  return (
    <View style={[styles.card, isComplete ? styles.cardComplete : styles.cardIncomplete]}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={[styles.iconContainer, isComplete ? styles.iconComplete : styles.iconIncomplete]}>
            <MaterialIcons name={isComplete ? "shield" : "warning"} size={22} color={isComplete ? "#80e3ab" : "#ffb4ab"} />
          </View>
          <View style={styles.headerTextGroup}>
            <Text style={styles.headerSub}>FIRST PRIORITY</Text>
            <Text style={styles.headerTitle}>Emergency Fund</Text>
            <Text style={styles.headerDetail}>{ef.targetMonths} months of expenses covered</Text>
          </View>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressPercent}>{progressClamped.toFixed(1)}% <Text style={styles.progressLabel}>funded</Text></Text>
          {!isComplete && ef.estimatedCompletionDate ? (
            <Text style={styles.etaText}>
              Est. {new Date(ef.estimatedCompletionDate).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
            </Text>
          ) : null}
        </View>
        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${progressClamped}%` },
              isComplete ? styles.fillComplete : styles.fillIncomplete,
            ]}
          />
        </View>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Target</Text>
          <Text style={styles.statValue}>{symbol}{formatCurrencyAmount(ef.targetAmount || 0, currencyCode)}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Saved</Text>
          <Text style={[styles.statValue, isComplete ? styles.textComplete : null]}>
            {symbol}{formatCurrencyAmount(ef.savedAmount || 0, currencyCode)}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Shortfall</Text>
          <Text style={[styles.statValue, ef.shortfall > 0 ? styles.textIncomplete : styles.textComplete]}>
            {ef.shortfall <= 0 ? "None" : `${symbol}${formatCurrencyAmount(ef.shortfall || 0, currencyCode)}`}
          </Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Avg Spend/M</Text>
          <Text style={styles.statValue}>{symbol}{formatCurrencyAmount(ef.avgMonthlyExpenses || 0, currencyCode)}</Text>
        </View>
      </View>

      {!isComplete ? (
        <View style={styles.warningBanner}>
          <MaterialIcons name="info-outline" size={16} color="#ffb4ab" />
          <Text style={styles.warningText}>
            Goal allocations are paused until the Emergency Fund is fully funded.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  cardComplete: {
    backgroundColor: "rgba(20, 40, 30, 0.5)",
    borderColor: "rgba(128, 227, 171, 0.3)",
  },
  cardIncomplete: {
    backgroundColor: "rgba(45, 25, 20, 0.5)",
    borderColor: "rgba(255, 180, 171, 0.3)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  iconComplete: {
    backgroundColor: "rgba(128, 227, 171, 0.15)",
  },
  iconIncomplete: {
    backgroundColor: "rgba(255, 180, 171, 0.15)",
  },
  headerTextGroup: {
    gap: 2,
  },
  headerSub: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: "#8e9192",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
  },
  headerDetail: {
    fontSize: 12,
    color: "#c4c7c8",
  },
  progressContainer: {
    gap: 6,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  progressPercent: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: "400",
    color: "#8e9192",
  },
  etaText: {
    fontSize: 12,
    color: "#ffb4ab",
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  fillComplete: {
    backgroundColor: "#80e3ab",
  },
  fillIncomplete: {
    backgroundColor: "#ffb4ab",
  },
  statsGrid: {
    flexDirection: "row",
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    padding: 10,
    borderRadius: 10,
    gap: 4,
  },
  statLabel: {
    fontSize: 10,
    color: "#8e9192",
    fontWeight: "600",
  },
  statValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
  textComplete: {
    color: "#80e3ab",
  },
  textIncomplete: {
    color: "#ffb4ab",
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 180, 171, 0.1)",
    padding: 10,
    borderRadius: 8,
  },
  warningText: {
    fontSize: 12,
    color: "#ffb4ab",
    flex: 1,
  },
});
