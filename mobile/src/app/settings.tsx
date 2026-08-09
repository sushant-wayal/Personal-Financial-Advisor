import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
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
import { ConfirmModal } from "../components/ConfirmModal";
import { SettingsSkeleton } from "../components/LoadingSkeleton";
import { DEFAULT_CURRENCY_CODE, useCurrency } from "../providers/CurrencyProvider";
import { useUserProfile } from "../providers/UserProfileProvider";
import { API_BASE_URL } from "../lib/apiBaseUrl";
import { clearClientCache, fetchCachedValue } from "../lib/clientCache";

type Profile = {
  ownerName?: string | null;
  currency?: string | null;
  balance?: number | null;
  monthlyIncome?: number | null;
  monthlyExpenses?: number | null;
};

type Memory = {
  id: string;
  key: string;
  value: string;
  tags?: string | null;
  updatedAt?: string;
};

const blankProfile: Profile = {
  ownerName: "",
  currency: DEFAULT_CURRENCY_CODE,
  balance: 0,
  monthlyIncome: 0,
  monthlyExpenses: 0,
};

function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

async function fetchProfile(force = false): Promise<Profile> {
  return fetchCachedValue(
    "settings:profile",
    async () => {
      const res = await fetch(apiUrl("/api/profile"));
      const payload = await res.json();
      if (!res.ok || payload.ok === false) throw new Error(payload.error || "Failed to load profile");
      return payload.profile ?? blankProfile;
    },
    { force },
  );
}

async function saveProfileApi(profile: Profile): Promise<Profile> {
  const res = await fetch(apiUrl("/api/profile"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ownerName: profile.ownerName,
      currency: profile.currency,
      balance: Number(profile.balance ?? 0),
    }),
  });
  const payload = await res.json();
  if (!res.ok || payload.ok === false) throw new Error(payload.error || "Failed to save profile");
  return payload.profile ?? profile;
}

async function fetchMemories(force = false): Promise<Memory[]> {
  return fetchCachedValue(
    "ai:memory",
    async () => {
      const res = await fetch(apiUrl("/api/ai/memory"));
      const payload = await res.json();
      if (!res.ok || payload.ok === false) throw new Error(payload.error || "Failed to load AI memory");
      return payload.memories ?? [];
    },
    { force },
  );
}

async function createMemory(key: string, value: string): Promise<Memory> {
  const res = await fetch(apiUrl("/api/ai/memory"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, value, tags: ["mobile"] }),
  });
  const payload = await res.json();
  if (!res.ok || payload.ok === false) throw new Error(payload.error || "Failed to save memory");
  return payload.memory;
}

async function deleteMemory(id: string) {
  const res = await fetch(apiUrl(`/api/ai/memory?id=${encodeURIComponent(id)}`), { method: "DELETE" });
  const payload = await res.json();
  if (!res.ok || payload.ok === false) throw new Error(payload.error || "Failed to delete memory");
}

function prettyMemoryValue(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function fs(size: number) {
  return Math.round(size * 0.9 * 10) / 10;
}

function SettingInput({
  label,
  value,
  placeholder,
  onChangeText,
  keyboardType = "default",
  editable = true,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChangeText?: (text: string) => void;
  keyboardType?: "default" | "numeric";
  editable?: boolean;
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={[styles.input, !editable && styles.inputDisabled]}
        value={value}
        placeholder={placeholder}
        placeholderTextColor="#5f6368"
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        editable={editable}
      />
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { setCurrencyCode } = useCurrency();
  const { setOwnerName } = useUserProfile();
  const [profile, setProfile] = useState<Profile>(blankProfile);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [confirmDeleteMemoryVisible, setConfirmDeleteMemoryVisible] = useState(false);
  const [newMemoryKey, setNewMemoryKey] = useState("");
  const [newMemoryValue, setNewMemoryValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (force = false) => {
    try {
      setError(null);
      const [nextProfile, nextMemories] = await Promise.all([
        fetchProfile(force),
        fetchMemories(force),
      ]);
      setProfile(nextProfile);
      setMemories(nextMemories);
      if (nextProfile.currency) setCurrencyCode(nextProfile.currency);
      setOwnerName(nextProfile.ownerName ?? "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setCurrencyCode, setOwnerName]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 0);

    return () => clearTimeout(timer);
  }, [loadData]);

  const refresh = async () => {
    setRefreshing(true);
    await loadData(true);
  };

  const updateProfile = (patch: Partial<Profile>) => {
    setProfile((current) => ({ ...current, ...patch }));
  };

  async function handleSaveProfile() {
    setSaving(true);
    setMessage("");
    setError(null);
    try {
      const updated = await saveProfileApi(profile);
      setProfile(updated);
      if (updated.currency) setCurrencyCode(updated.currency);
      setOwnerName(updated.ownerName ?? "");
      clearClientCache();
      setMessage("Profile saved successfully");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function addMemory() {
    if (!newMemoryKey.trim() || !newMemoryValue.trim()) {
      setError("Memory key and value are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const memory = await createMemory(newMemoryKey.trim(), newMemoryValue.trim());
      setMemories((current) => [memory, ...current]);
      setNewMemoryKey("");
      setNewMemoryValue("");
      clearClientCache();
      setMessage("Memory saved successfully");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function removeSelectedMemory() {
    if (!selectedMemory) return;
    setSaving(true);
    try {
      await deleteMemory(selectedMemory.id);
      setMemories((current) => current.filter((memory) => memory.id !== selectedMemory.id));
      setSelectedMemory(null);
      setConfirmDeleteMemoryVisible(false);
      clearClientCache();
      setMessage("Memory entry deleted");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#131313" />

      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <MaterialIcons name="person" size={24} color="#818cf8" />
          <Text style={styles.headerTitle}>Profile & Account</Text>
        </View>
      </View>

      {loading ? (
        <SettingsSkeleton />
      ) : (
        <KeyboardAwareScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor="#ffffff" />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
          extraScrollHeight={24}
        >
          {/* Header Identity Hero */}
          <View style={styles.heroBlock}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarInitials}>
                {(profile.ownerName || "U").slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.ownerNameText}>{profile.ownerName || "User Profile"}</Text>
              <Text style={styles.currencySubtext}>Primary Currency: {profile.currency || "INR"}</Text>
            </View>
          </View>

          {message ? <Text style={styles.successMessage}>{message}</Text> : null}
          {error ? <Text style={styles.errorMessage}>{error}</Text> : null}

          {/* Financial Profile Card */}
          <View style={styles.panelCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionKicker}>Identity & Balances</Text>
              <Text style={styles.sectionSubtext}>Basic values used across all financial analyses</Text>
            </View>

            <SettingInput
              label="Owner Name"
              value={profile.ownerName ?? ""}
              placeholder="Your name"
              onChangeText={(ownerName) => updateProfile({ ownerName })}
            />

            <View style={styles.twoColumn}>
              <SettingInput
                label="Currency"
                value={profile.currency ?? "INR"}
                placeholder="INR"
                onChangeText={(currency) => updateProfile({ currency: currency.toUpperCase() })}
              />
              <SettingInput
                label="Balance"
                value={String(Math.round((profile.balance ?? 0) * 100) / 100)}
                keyboardType="numeric"
                onChangeText={(balance) => updateProfile({ balance: Number(balance || 0) })}
              />
            </View>

            <View style={styles.twoColumn}>
              <SettingInput label="Monthly Income" value={String(profile.monthlyIncome ?? 0)} editable={false} />
              <SettingInput label="Monthly Expense" value={String(profile.monthlyExpenses ?? 0)} editable={false} />
            </View>

            <Pressable onPress={() => void handleSaveProfile()} disabled={saving} style={[styles.saveBtn, saving && styles.saveBtnDisabled]}>
              <Text style={styles.saveBtnText}>{saving ? "Saving Profile..." : "Save Financial Profile"}</Text>
            </Pressable>
          </View>

          {/* Sub-Screens Navigation Menu Card */}
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>Configuration & Preferences</Text>

            <Pressable
              onPress={() => router.push("/settings-ef")}
              style={({ pressed }) => [styles.menuRow, pressed && styles.cardPressed]}
            >
              <View style={[styles.menuIconAvatar, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
                <MaterialIcons name="shield" size={22} color="#fbbf24" />
              </View>
              <View style={styles.menuCopy}>
                <Text style={styles.menuRowTitle}>Emergency Reserve Settings</Text>
                <Text style={styles.menuRowSub}>Coverage target months, allocation strategy & status</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#8e9192" />
            </Pressable>

            <Pressable
              onPress={() => router.push("/settings-investment")}
              style={({ pressed }) => [styles.menuRow, pressed && styles.cardPressed]}
            >
              <View style={[styles.menuIconAvatar, { backgroundColor: "rgba(129, 140, 248, 0.15)" }]}>
                <MaterialIcons name="trending-up" size={22} color="#818cf8" />
              </View>
              <View style={styles.menuCopy}>
                <Text style={styles.menuRowTitle}>Investment Strategy Settings</Text>
                <Text style={styles.menuRowSub}>Pay cycle length, phase rates & asset sub-allocations</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#8e9192" />
            </Pressable>

            <Pressable
              onPress={() => router.push("/settings-senders")}
              style={({ pressed }) => [styles.menuRow, pressed && styles.cardPressed]}
            >
              <View style={[styles.menuIconAvatar, { backgroundColor: "rgba(192, 132, 252, 0.15)" }]}>
                <MaterialIcons name="mark-email-unread" size={22} color="#c084fc" />
              </View>
              <View style={styles.menuCopy}>
                <Text style={styles.menuRowTitle}>Bank Alert Integrations</Text>
                <Text style={styles.menuRowSub}>Gmail senders & automated alert parsing</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#8e9192" />
            </Pressable>

            <Pressable
              onPress={() => router.push("/settings-export")}
              style={({ pressed }) => [styles.menuRow, pressed && styles.cardPressed, { borderBottomWidth: 0 }]}
            >
              <View style={[styles.menuIconAvatar, { backgroundColor: "rgba(52, 211, 153, 0.15)" }]}>
                <MaterialIcons name="description" size={22} color="#34d399" />
              </View>
              <View style={styles.menuCopy}>
                <Text style={styles.menuRowTitle}>External LLM Export</Text>
                <Text style={styles.menuRowSub}>Export Markdown context for ChatGPT / Claude</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color="#8e9192" />
            </Pressable>
          </View>

          {/* AI Memory Section */}
          <View style={styles.panelCard}>
            <View style={styles.cardHeader}>
              <Text style={[styles.sectionKicker, { color: "#c084fc" }]}>AI Memory & Preferences</Text>
              <Text style={styles.sectionSubtext}>Custom rules and memory stored for the AI financial advisor</Text>
            </View>

            <View style={styles.memoryAddStack}>
              <TextInput
                value={newMemoryKey}
                onChangeText={setNewMemoryKey}
                placeholder="Memory key (e.g. risk_tolerance)"
                placeholderTextColor="#5f6368"
                style={styles.input}
              />
              <TextInput
                value={newMemoryValue}
                onChangeText={setNewMemoryValue}
                placeholder="Value (e.g. Moderate long-term growth)"
                placeholderTextColor="#5f6368"
                style={styles.input}
              />
              <Pressable style={styles.addMemoryBtn} onPress={() => void addMemory()} disabled={saving}>
                <MaterialIcons name="add-circle-outline" size={18} color="#ffffff" />
                <Text style={styles.addMemoryBtnText}>Save Memory Entry</Text>
              </Pressable>
            </View>

            <View style={styles.memoryList}>
              {memories.map((memory) => (
                <Pressable key={memory.id} style={styles.memoryItem} onPress={() => setSelectedMemory(memory)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.memoryKeyText} numberOfLines={1}>{memory.key}</Text>
                    <Text style={styles.memoryValText} numberOfLines={1}>{memory.value}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#8e9192" />
                </Pressable>
              ))}
              {!memories.length ? <Text style={styles.mutedText}>No custom AI memories stored yet.</Text> : null}
            </View>
          </View>
        </KeyboardAwareScrollView>
      )}

      {/* Memory Detail Modal */}
      <Modal visible={!!selectedMemory} transparent animationType="fade" onRequestClose={() => setSelectedMemory(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{selectedMemory?.key}</Text>
            <Text style={styles.modalBody}>{selectedMemory ? prettyMemoryValue(selectedMemory.value) : ""}</Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalDeleteBtn} onPress={() => setConfirmDeleteMemoryVisible(true)}>
                <Text style={styles.modalDeleteText}>Delete Memory</Text>
              </Pressable>
              <Pressable style={styles.modalCloseBtn} onPress={() => setSelectedMemory(null)}>
                <Text style={styles.modalCloseText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={confirmDeleteMemoryVisible}
        title="Delete Memory Entry"
        description={`Are you sure you want to delete "${selectedMemory?.key || "this entry"}"?`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => void removeSelectedMemory()}
        onCancel={() => setConfirmDeleteMemoryVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#131313" },
  header: {
    height: 80,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(68,71,72,0.20)",
    backgroundColor: "rgba(19,19,19,0.94)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(20), fontWeight: "700" },
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 160, gap: 24 },
  heroBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(68,71,72,0.35)",
    backgroundColor: "#0e0e0e",
    padding: 20,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(129,140,248,0.18)",
    borderWidth: 1,
    borderColor: "#818cf8",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { color: "#818cf8", fontFamily: "Hanken Grotesk", fontSize: fs(20), fontWeight: "700" },
  heroCopy: { flex: 1, gap: 2 },
  ownerNameText: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(22), fontWeight: "700" },
  currencySubtext: { color: "#8e9192", fontFamily: "JetBrains Mono", fontSize: fs(12) },
  successMessage: { color: "#34d399", fontFamily: "Inter", fontSize: fs(13), fontWeight: "600" },
  errorMessage: { color: "#ef4444", fontFamily: "Inter", fontSize: fs(13), fontWeight: "600" },
  panelCard: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(68,71,72,0.35)", backgroundColor: "#0e0e0e", padding: 22, gap: 16 },
  cardHeader: { gap: 4 },
  sectionKicker: { color: "#818cf8", fontFamily: "JetBrains Mono", fontSize: fs(11), letterSpacing: 1.6, textTransform: "uppercase", fontWeight: "700" },
  sectionSubtext: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(12) },
  inputGroup: { gap: 6 },
  inputLabel: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(11), fontWeight: "600" },
  input: {
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
  inputDisabled: { opacity: 0.5 },
  twoColumn: { flexDirection: "row", gap: 12 },
  saveBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: "#818cf8",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(14), fontWeight: "700" },
  menuCard: { borderRadius: 16, borderWidth: 1, borderColor: "rgba(68,71,72,0.35)", backgroundColor: "#0e0e0e", padding: 22, gap: 16 },
  menuTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(18), fontWeight: "700" },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(68,71,72,0.20)",
  },
  cardPressed: { opacity: 0.7 },
  menuIconAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  menuCopy: { flex: 1, gap: 2 },
  menuRowTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(15), fontWeight: "600" },
  menuRowSub: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(12) },
  memoryAddStack: { gap: 10 },
  addMemoryBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(192,132,252,0.18)",
    borderWidth: 1,
    borderColor: "rgba(192,132,252,0.4)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addMemoryBtnText: { color: "#c084fc", fontFamily: "Hanken Grotesk", fontSize: fs(14), fontWeight: "600" },
  memoryList: { gap: 10, marginTop: 4 },
  memoryItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(68,71,72,0.35)",
    backgroundColor: "#131313",
  },
  memoryKeyText: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(13), fontWeight: "600" },
  memoryValText: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(12), marginTop: 2 },
  mutedText: { color: "#5f6368", fontFamily: "Inter", fontSize: fs(13) },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalContent: { width: "100%", borderRadius: 16, backgroundColor: "#171819", borderWidth: 1, borderColor: "rgba(68,71,72,0.4)", padding: 22, gap: 14 },
  modalTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(18), fontWeight: "700" },
  modalBody: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(13), lineHeight: 18 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 },
  modalDeleteBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: "rgba(239,68,68,0.15)" },
  modalDeleteText: { color: "#ef4444", fontFamily: "Inter", fontSize: fs(13), fontWeight: "600" },
  modalCloseBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: "#26282a" },
  modalCloseText: { color: "#ffffff", fontFamily: "Inter", fontSize: fs(13), fontWeight: "600" },
});
