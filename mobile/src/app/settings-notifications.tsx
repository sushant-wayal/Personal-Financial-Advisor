import React, { useCallback, useEffect, useState } from "react";
import {
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
import { useAlert } from "../providers/AlertProvider";
import { SettingsSkeleton } from "../components/LoadingSkeleton";

function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

const fs = (size: number) => Math.round(size * 0.9 * 10) / 10;

export default function NotificationsSettingsScreen() {
  const router = useRouter();
  const { showSuccess, showError } = useAlert();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [expoPushToken, setExpoPushToken] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [hasPushToken, setHasPushToken] = useState(false);
  const [hasWebhookUrl, setHasWebhookUrl] = useState(false);
  const [maskedPushToken, setMaskedPushToken] = useState<string | null>(null);
  const [maskedWebhookUrl, setMaskedWebhookUrl] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/notifications/config"));
      const data = await res.json();
      if (res.ok && data.ok) {
        setHasPushToken(Boolean(data.hasPushToken));
        setHasWebhookUrl(Boolean(data.hasWebhookUrl));
        setMaskedPushToken(data.maskedPushToken || null);
        setMaskedWebhookUrl(data.maskedWebhookUrl || null);
      }
    } catch (e: any) {
      console.error("Failed to load notification config", e);
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(apiUrl("/api/notifications/register-token"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expoPushToken: expoPushToken || undefined,
          webhookUrl: webhookUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Save failed");

      showSuccess("Preferences Saved", "Notification delivery channels updated!");
      setExpoPushToken("");
      setWebhookUrl("");
      loadData();
    } catch (err: any) {
      showError("Save Error", err.message || "Failed to update notification settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    setTesting(true);
    try {
      const res = await fetch(apiUrl("/api/notifications/test"), {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Test dispatch failed");

      showSuccess("Test Dispatched", data.message || "Notification sent successfully!");
    } catch (err: any) {
      showError("Test Failed", err.message || "Failed to send test notification");
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <SettingsSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#131313" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={24} color="#ffffff" />
          </Pressable>
          <Text style={styles.headerTitle}>Proactive Notifications</Text>
        </View>
      </View>

      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22d3ee" />}
      >
        {/* Morning Intel Overview Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroIconAvatar}>
              <MaterialIcons name="auto-awesome" size={24} color="#22d3ee" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Morning Financial Intel</Text>
              <Text style={styles.heroSub}>
                Pre-computes actionable Swing Stocks, IPO Applications, and Monthly Mutual Fund allocations daily at ~9:15 AM - 9:45 AM IST.
              </Text>
            </View>
          </View>
          <View style={styles.statusPill}>
            <MaterialIcons name="check-circle" size={14} color="#10b981" />
            <Text style={styles.statusPillText}>Persistent In-App Dashboard Intel: Active</Text>
          </View>
        </View>

        {/* Delivery Channels */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mobile Push Delivery</Text>
          <Text style={styles.cardSub}>
            Delivered directly to your lock screen via Expo Push Notification service.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Expo Push Token {hasPushToken && <Text style={{ color: "#10b981" }}>(Currently Active: {maskedPushToken})</Text>}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"
              placeholderTextColor="#666666"
              value={expoPushToken}
              onChangeText={setExpoPushToken}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Webhook Delivery */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>External Webhook Delivery</Text>
          <Text style={styles.cardSub}>
            Forward notifications directly to Telegram, Discord, Slack, Pushover, or NTFY.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>
              Webhook URL {hasWebhookUrl && <Text style={{ color: "#10b981" }}>(Currently Active: {maskedWebhookUrl})</Text>}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="https://discord.com/api/webhooks/... or https://ntfy.sh/..."
              placeholderTextColor="#666666"
              value={webhookUrl}
              onChangeText={setWebhookUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={{ gap: 12 }}>
          <Pressable
            onPress={handleSave}
            disabled={saving || (!expoPushToken && !webhookUrl)}
            style={[styles.saveBtn, (saving || (!expoPushToken && !webhookUrl)) && styles.btnDisabled]}
          >
            <MaterialIcons name="save" size={18} color="#000000" />
            <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Notification Preferences"}</Text>
          </Pressable>

          <Pressable
            onPress={handleTestNotification}
            disabled={testing}
            style={[styles.testBtn, testing && styles.btnDisabled]}
          >
            <MaterialIcons name="send" size={18} color="#22d3ee" />
            <Text style={styles.testBtnText}>{testing ? "Sending..." : "Send Test Notification Now"}</Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#131313" },
  header: {
    height: 70,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(68,71,72,0.20)",
    backgroundColor: "rgba(19,19,19,0.94)",
    flexDirection: "row",
    alignItems: "center",
  },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { color: "#ffffff", fontSize: fs(18), fontWeight: "700" },
  scroll: { flex: 1 },
  content: { padding: 20, paddingBottom: 100, gap: 18 },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.25)",
    backgroundColor: "rgba(34,211,238,0.05)",
    padding: 18,
    gap: 12,
  },
  heroHeader: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  heroIconAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(34,211,238,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { color: "#ffffff", fontSize: fs(16), fontWeight: "700" },
  heroSub: { color: "#aaaaaa", fontSize: fs(12), lineHeight: 18, marginTop: 2 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16,185,129,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  statusPillText: { color: "#34d399", fontSize: fs(11), fontWeight: "600" },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(68,71,72,0.35)",
    backgroundColor: "#0e0e0e",
    padding: 18,
    gap: 12,
  },
  cardTitle: { color: "#ffffff", fontSize: fs(15), fontWeight: "700" },
  cardSub: { color: "#8e9192", fontSize: fs(12), lineHeight: 16 },
  inputGroup: { gap: 6, marginTop: 4 },
  inputLabel: { color: "#c4c7c8", fontSize: fs(11), fontWeight: "600" },
  input: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(68,71,72,0.40)",
    backgroundColor: "#171819",
    color: "#ffffff",
    fontSize: fs(13),
    paddingHorizontal: 14,
  },
  saveBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#22d3ee",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveBtnText: { color: "#000000", fontSize: fs(14), fontWeight: "700" },
  testBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.3)",
    backgroundColor: "rgba(34,211,238,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  testBtnText: { color: "#22d3ee", fontSize: fs(14), fontWeight: "700" },
  btnDisabled: { opacity: 0.5 },
});

