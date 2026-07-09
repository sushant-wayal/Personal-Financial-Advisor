import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { NETWORTH_CONFIG } from "../../lib/networthConfig";

export default function AddNetWorthScreen() {
  const router = useRouter();
  const { filter } = useLocalSearchParams<{ filter?: string }>();

  const configs = Object.values(NETWORTH_CONFIG);
  const assets = configs.filter((c) => c.category === "asset");
  const liabilities = configs.filter((c) => c.category === "liability");

  const renderItem = (config: any) => (
    <Pressable
      key={config.type}
      style={styles.item}
      onPress={() => router.push({ pathname: "/networth/form", params: { type: config.type } } as any)}
    >
      <View style={styles.iconBox}>
        <MaterialIcons name={config.icon || (config.category === "asset" ? "account-balance" : "credit-card")} size={20} color="#fff" />
      </View>
      <Text style={styles.itemLabel}>{config.label}</Text>
      <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="close" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>{filter === "asset" ? "Add Asset" : filter === "liability" ? "Add Liability" : "Add Account"}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {(!filter || filter === "asset") && (
          <View style={styles.listCard}>
            {assets.map(renderItem)}
          </View>
        )}

        {(!filter || filter === "liability") && (
          <View style={[styles.listCard, { marginTop: filter ? 0 : 24 }]}>
            {liabilities.map(renderItem)}
          </View>
        )}

        <View style={{ height: 160 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#131313" },
  header: { height: 96, paddingTop: 14, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: "rgba(68,71,72,0.20)", backgroundColor: "rgba(19,19,19,0.94)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backButton: { width: 40, height: 40, marginLeft: -8, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: 20, fontWeight: "700" },
  scroll: { flex: 1 },
  scrollContent: { padding: 24 },
  sectionTitle: { color: "#8e9192", fontFamily: "JetBrains Mono", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700", marginBottom: 12, marginLeft: 8 },
  listCard: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(68,71,72,0.35)", backgroundColor: "#0e0e0e", overflow: "hidden" },
  item: { flexDirection: "row", alignItems: "center", padding: 18, borderBottomWidth: 1, borderBottomColor: "rgba(68,71,72,0.20)" },
  iconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#2a2a2a", alignItems: "center", justifyContent: "center", marginRight: 12 },
  itemLabel: { flex: 1, color: "#ffffff", fontFamily: "Inter", fontSize: 16, fontWeight: "500" },
});
