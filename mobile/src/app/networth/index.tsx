import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useNetWorth } from "../../lib/networthApi";
import { NETWORTH_CONFIG } from "../../lib/networthConfig";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function NetWorthScreen() {
  const router = useRouter();
  const { data, isLoading, isError } = useNetWorth();

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7dffa2" />
        </View>
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

  const renderSection = (category: "asset" | "liability", records: Record<string, any[]>) => {
    const list = Object.entries(records).flatMap(([type, items]) =>
      items.map((item) => ({ ...item, _type: type }))
    );

    if (list.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No {category}s added yet.</Text>
        </View>
      );
    }

    return list.map((item, idx) => {
      const config = NETWORTH_CONFIG[item._type];
      const title = config ? config.label : item._type;
      
      // Try to find a reasonable subtitle from fields like bankName, provider, etc.
      const subtitle = item.bankName || item.provider || item.brand || item.name || item.lenderName || "Active";
      const value = category === "asset" 
        ? (item.currentWorth ?? item.currentBalance ?? item.principalAmount ?? item.purchasePrice ?? 0)
        : (item.currentOutstanding ?? item.outstandingBalance ?? item.outstandingAmount ?? 0);

      return (
        <Pressable 
          key={`${item._type}-${item.id || idx}`} 
          style={styles.card}
          onPress={() => {
            if (item._type !== "Bank Balance") {
              router.push({ pathname: "/networth/form", params: { type: item._type, id: item.id } } as any);
            }
          }}
        >
          <View style={styles.cardLeft}>
            <View style={styles.iconBox}>
               <MaterialIcons name={category === "asset" ? "account-balance" : "credit-card"} size={20} color="#fff" />
            </View>
            <View>
              <Text style={styles.cardTitle}>{title}</Text>
              <Text style={styles.cardSubtitle}>{subtitle}</Text>
            </View>
          </View>
          <Text style={[styles.cardValue, category === "asset" ? styles.assetText : styles.liabilityText]}>
            {formatCurrency(value)}
          </Text>
        </Pressable>
      );
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Net Worth</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryEyebrow}>TOTAL NET WORTH</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totals.netWorth)}</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Assets</Text>
              <Text style={styles.assetText}>{formatCurrency(totals.assets)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Liabilities</Text>
              <Text style={styles.liabilityText}>{formatCurrency(totals.liabilities)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Assets</Text>
        {renderSection("asset", assets)}

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Liabilities</Text>
        {renderSection("liability", liabilities)}

        <View style={{ height: 100 }} />
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => router.push("/networth/add" as any)}>
        <MaterialIcons name="add" size={28} color="#000" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { color: "#ffb4ab", fontSize: 16 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, color: "#fff", fontWeight: "600" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  summaryCard: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 24, marginBottom: 32, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  summaryEyebrow: { color: "rgba(255,255,255,0.5)", fontSize: 12, fontWeight: "600", letterSpacing: 1, marginBottom: 8 },
  summaryValue: { color: "#fff", fontSize: 36, fontWeight: "700", marginBottom: 24 },
  summaryRow: { flexDirection: "row", width: "100%", justifyContent: "space-between" },
  summaryCol: { flex: 1, alignItems: "center" },
  summaryLabel: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 4 },
  summaryDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.1)" },
  assetText: { color: "#7dffa2", fontSize: 16, fontWeight: "600" },
  liabilityText: { color: "#ffb4ab", fontSize: 16, fontWeight: "600" },
  sectionTitle: { color: "#fff", fontSize: 20, fontWeight: "600", marginBottom: 16 },
  emptyCard: { backgroundColor: "rgba(255,255,255,0.02)", padding: 20, borderRadius: 12, alignItems: "center" },
  emptyText: { color: "rgba(255,255,255,0.4)", fontSize: 14 },
  card: { backgroundColor: "rgba(255,255,255,0.05)", padding: 16, borderRadius: 12, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  cardTitle: { color: "#fff", fontSize: 16, fontWeight: "500", marginBottom: 2 },
  cardSubtitle: { color: "rgba(255,255,255,0.5)", fontSize: 13 },
  cardValue: { fontSize: 16, fontWeight: "600" },
  fab: { position: "absolute", bottom: 32, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: "#7dffa2", alignItems: "center", justifyContent: "center", shadowColor: "#7dffa2", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
});
