import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL } from "../lib/apiBaseUrl";
import { SettingsSkeleton } from "../components/LoadingSkeleton";
import { clearClientCache } from "../lib/clientCache";

function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

const fs = (size: number) => Math.round(size * 0.9 * 10) / 10;

function normalizeSender(value: string) {
  return value.trim().toLowerCase();
}

export default function SendersSettingsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [senders, setSenders] = useState<string[]>([]);
  const [newSender, setNewSender] = useState("");

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/gmail/senders"));
      const data = await res.json();
      if (res.ok && data.senders) {
        setSenders(data.senders);
      }
    } catch (e: any) {
      console.error("Failed to load senders", e);
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

  const addSender = () => {
    const s = normalizeSender(newSender);
    if (!s) return;
    if (senders.includes(s)) {
      Alert.alert("Already Added", "This email address is already in your allowed list.");
      return;
    }
    setSenders((current) => [...current, s]);
    setNewSender("");
  };

  const removeSender = (target: string) => {
    setSenders((current) => current.filter((item) => item !== target));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/gmail/senders"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ senders }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save senders");

      clearClientCache();
      Alert.alert("Senders Saved", "Allowed bank senders list updated successfully.");
      loadData();
    } catch (e: any) {
      Alert.alert("Error", e.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const [syncing, setSyncing] = useState(false);

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(apiUrl("/api/gmail/sync"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");

      clearClientCache();
      const count = data.processed?.length ?? data.messageIds?.length ?? 0;
      Alert.alert("Sync Complete", `Successfully synced Gmail inbox. Processed ${count} recent messages.`);
    } catch (e: any) {
      Alert.alert("Sync Failed", e.message || String(e));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#131313" />

      {/* Top Bar Navigation */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={24} color="#ffffff" />
          <Text style={styles.backButtonText}>PROFILE</Text>
        </Pressable>
      </View>

      {loading ? (
        <SettingsSkeleton />
      ) : (
        <KeyboardAwareScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
          extraScrollHeight={24}
        >
          <View style={styles.headerBlock}>
            <Text style={styles.eyebrow}>Bank & Depository Alert Integration</Text>
            <Text style={styles.screenTitle}>Gmail Senders</Text>
            <Text style={styles.screenSub}>
              Authorized email addresses for auto-parsing bank notifications, mutual funds, and depository transaction alerts.
            </Text>
          </View>

          {/* Quick Manual Sync Action Card */}
          <View style={styles.syncCard}>
            <View style={styles.syncLeft}>
              <MaterialIcons name="sync" size={24} color="#818cf8" />
              <View style={styles.syncCopy}>
                <Text style={styles.syncTitle}>On-Demand Gmail Sync</Text>
                <Text style={styles.syncSub}>Scan recent bank & mutual fund emails immediately.</Text>
              </View>
            </View>
            <Pressable onPress={handleManualSync} disabled={syncing} style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}>
              <Text style={styles.syncBtnText}>{syncing ? "Syncing..." : "Sync Now"}</Text>
            </Pressable>
          </View>

          <View style={styles.panelCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionKicker}>Allowed Bank Email Addresses</Text>
              <Text style={styles.sectionSubtext}>
                Central depositories (CDSL, NSDL, CAMS, KFintech) are auto-approved by default. Add custom bank emails below.
              </Text>
            </View>

            <View style={styles.senderChips}>
              {senders.map((sender) => (
                <View key={sender} style={styles.senderChip}>
                  <Text style={styles.senderChipText} numberOfLines={1}>{sender}</Text>
                  <Pressable onPress={() => removeSender(sender)}>
                    <MaterialIcons name="close" size={16} color="#8e9192" />
                  </Pressable>
                </View>
              ))}
              {!senders.length ? <Text style={styles.mutedText}>No custom bank senders added yet.</Text> : null}
            </View>

            <View style={styles.addSenderRow}>
              <TextInput
                value={newSender}
                onChangeText={setNewSender}
                placeholder="alerts@yourbank.com"
                placeholderTextColor="#5f6368"
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.senderInput}
              />
              <Pressable onPress={addSender} style={styles.addBtn}>
                <MaterialIcons name="add" size={20} color="#ffffff" />
                <Text style={styles.addBtnText}>Add</Text>
              </Pressable>
            </View>
          </View>

          {/* Save Action Button */}
          <Pressable onPress={handleSave} disabled={saving} style={[styles.saveBtn, saving && styles.saveBtnDisabled]}>
            <Text style={styles.saveBtnText}>{saving ? "Saving Senders..." : "Save Gmail Senders"}</Text>
          </Pressable>
        </KeyboardAwareScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#131313" },
  topBar: {
    height: 80,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(68,71,72,0.20)",
    backgroundColor: "rgba(19,19,19,0.94)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  backButtonText: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(11), letterSpacing: 1.4, fontWeight: "700" },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 160, gap: 24 },
  headerBlock: { gap: 6 },
  eyebrow: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(10), letterSpacing: 1.6, textTransform: "uppercase", fontWeight: "700" },
  screenTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(30), lineHeight: 38, fontWeight: "700" },
  screenSub: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(13), lineHeight: 19 },
  panelCard: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(68,71,72,0.35)", backgroundColor: "#0e0e0e", padding: 22, gap: 16 },
  cardHeader: { gap: 4 },
  sectionKicker: { color: "#818cf8", fontFamily: "JetBrains Mono", fontSize: fs(11), letterSpacing: 1.6, textTransform: "uppercase", fontWeight: "700" },
  sectionSubtext: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(12) },
  senderChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  senderChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(68,71,72,0.40)",
    backgroundColor: "#171819",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  senderChipText: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(12) },
  mutedText: { color: "#5f6368", fontFamily: "Inter", fontSize: fs(13) },
  addSenderRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  senderInput: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(68,71,72,0.40)",
    backgroundColor: "#171819",
    color: "#ffffff",
    fontFamily: "Inter",
    fontSize: fs(14),
    paddingHorizontal: 14,
  },
  addBtn: {
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#818cf8",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addBtnText: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(14), fontWeight: "700" },
  saveBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: "#818cf8",
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(15), fontWeight: "700" },
  syncCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0e0e0e",
    borderWidth: 1,
    borderColor: "rgba(129,140,248,0.3)",
    borderRadius: 16,
    padding: 18,
    gap: 12,
  },
  syncLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  syncCopy: {
    flex: 1,
    gap: 2,
  },
  syncTitle: {
    color: "#ffffff",
    fontFamily: "Hanken Grotesk",
    fontSize: fs(15),
    fontWeight: "700",
  },
  syncSub: {
    color: "#8e9192",
    fontFamily: "Inter",
    fontSize: fs(12),
  },
  syncBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#818cf8",
    alignItems: "center",
    justifyContent: "center",
  },
  syncBtnDisabled: { opacity: 0.5 },
  syncBtnText: {
    color: "#ffffff",
    fontFamily: "Hanken Grotesk",
    fontSize: fs(13),
    fontWeight: "700",
  },
});
