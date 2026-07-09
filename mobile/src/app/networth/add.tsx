import React from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { NETWORTH_CONFIG } from "../../lib/networthConfig";

export default function AddNetWorthScreen() {
  const router = useRouter();

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
        <MaterialIcons name={config.category === "asset" ? "account-balance" : "credit-card"} size={20} color="#fff" />
      </View>
      <Text style={styles.itemLabel}>{config.label}</Text>
      <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="close" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.headerTitle}>Add Account</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Assets</Text>
        <View style={styles.listCard}>
          {assets.map(renderItem)}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Liabilities</Text>
        <View style={styles.listCard}>
          {liabilities.map(renderItem)}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 18, color: "#fff", fontWeight: "600" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  sectionTitle: { color: "rgba(255,255,255,0.6)", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, fontWeight: "600", marginBottom: 12, marginLeft: 8 },
  listCard: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, overflow: "hidden" },
  item: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  iconBox: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center", marginRight: 12 },
  itemLabel: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "500" },
});
