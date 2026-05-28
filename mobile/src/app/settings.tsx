import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { SettingsSkeleton, Skeleton } from "../components/LoadingSkeleton";
import { DEFAULT_CURRENCY_CODE, useCurrency } from "../providers/CurrencyProvider";
import { useUserProfile } from "../providers/UserProfileProvider";
import { clearClientCache, fetchCachedValue } from "../lib/clientCache";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "https://personal-financial-advisor-os.vercel.app";

type Profile = {
  ownerName?: string | null;
  currency?: string | null;
  balance?: number | null;
  emergencyFund?: number | null;
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
  emergencyFund: 0,
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
      ...profile,
      balance: Number(profile.balance ?? 0),
      emergencyFund: Number(profile.emergencyFund ?? 0),
      monthlyIncome: Number(profile.monthlyIncome ?? 0),
      monthlyExpenses: Number(profile.monthlyExpenses ?? 0),
    }),
  });
  const payload = await res.json();
  if (!res.ok || payload.ok === false) throw new Error(payload.error || "Failed to save profile");
  return payload.profile ?? profile;
}

async function fetchSenders(force = false): Promise<string[]> {
  return fetchCachedValue(
    "gmail:senders",
    async () => {
      const res = await fetch(apiUrl("/api/gmail/senders"));
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "Failed to load Gmail senders");
      return payload.senders ?? [];
    },
    { force },
  );
}

async function saveSendersApi(senders: string[]): Promise<string[]> {
  const res = await fetch(apiUrl("/api/gmail/senders"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ senders }),
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.error || "Failed to save Gmail senders");
  return payload.senders ?? senders;
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

function normalizeSender(value: string) {
  return value.trim().toLowerCase();
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

export default function SettingsScreen() {
  const { setCurrencyCode } = useCurrency();
  const { setOwnerName } = useUserProfile();
  const [profile, setProfile] = useState<Profile>(blankProfile);
  const [senders, setSenders] = useState<string[]>([]);
  const [newSender, setNewSender] = useState("");
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

  const senderText = useMemo(() => senders.join(", "), [senders]);

  const load = useCallback(async (force = false) => {
    setError(null);
    const [nextProfile, nextSenders, nextMemories] = await Promise.all([fetchProfile(force), fetchSenders(force), fetchMemories(force)]);
    setProfile({ ...blankProfile, ...nextProfile });
    setSenders(nextSenders);
    setMemories(nextMemories);
    setCurrencyCode(nextProfile.currency ?? DEFAULT_CURRENCY_CODE);
    setOwnerName(nextProfile.ownerName ?? "");
  }, [setCurrencyCode, setOwnerName]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await load();
        if (!mounted) return;
        setError(null);
      } catch (e: unknown) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [setCurrencyCode, setOwnerName]);

  async function refresh() {
    setRefreshing(true);
    try {
      await load(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }

  function updateProfile(patch: Partial<Profile>) {
    setProfile((current) => ({ ...current, ...patch }));
  }

  function addSender() {
    const next = normalizeSender(newSender);
    if (!next) return;
    setSenders((current) => Array.from(new Set([...current, next])));
    setNewSender("");
  }

  async function saveAll() {
    setSaving(true);
    setMessage("");
    setError(null);
    try {
      const [nextProfile, nextSenders] = await Promise.all([saveProfileApi(profile), saveSendersApi(senders)]);
      setProfile(nextProfile);
      setSenders(nextSenders);
      setCurrencyCode(nextProfile.currency ?? profile.currency ?? "INR");
      setOwnerName(nextProfile.ownerName ?? profile.ownerName ?? "");
      clearClientCache();
      setMessage("Settings saved");
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
      setMessage("Memory saved");
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
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <MaterialIcons name="settings" size={24} color="#c4c7c8" />
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
      </View>

      {loading ? (
        <SettingsSkeleton />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor="#ffffff" />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionKicker}>Financial Profile</Text>
              <Text style={styles.sectionSubtext}>Basic values used by analyses</Text>
            </View>

            <SettingInput label="Owner Name" value={profile.ownerName ?? ""} placeholder="Your name" onChangeText={(ownerName) => updateProfile({ ownerName })} />
            <View style={styles.twoColumn}>
              <SettingInput label="Currency" value={profile.currency ?? "INR"} placeholder="INR" onChangeText={(currency) => updateProfile({ currency: currency.toUpperCase() })} />
              <SettingInput label="Balance" value={String(profile.balance ?? 0)} keyboardType="numeric" onChangeText={(balance) => updateProfile({ balance: Number(balance || 0) })} />
            </View>
            <View style={styles.twoColumn}>
              <SettingInput label="Emergency Fund" value={String(profile.emergencyFund ?? 0)} keyboardType="numeric" onChangeText={(emergencyFund) => updateProfile({ emergencyFund: Number(emergencyFund || 0) })} />
              <SettingInput label="Monthly Income" value={String(profile.monthlyIncome ?? 0)} keyboardType="numeric" onChangeText={(monthlyIncome) => updateProfile({ monthlyIncome: Number(monthlyIncome || 0) })} />
            </View>
            <SettingInput label="Monthly Expenses" value={String(profile.monthlyExpenses ?? 0)} keyboardType="numeric" onChangeText={(monthlyExpenses) => updateProfile({ monthlyExpenses: Number(monthlyExpenses || 0) })} />

            <View style={styles.senderBlock}>
              <Text style={styles.inputLabel}>Gmail Senders</Text>
              <View style={styles.senderChips}>
                {senders.map((sender) => (
                  <View key={sender} style={styles.senderChip}>
                    <Text style={styles.senderChipText} numberOfLines={1}>{sender}</Text>
                    <Pressable onPress={() => setSenders((current) => current.filter((item) => item !== sender))}>
                      <MaterialIcons name="close" size={16} color="#8e9192" />
                    </Pressable>
                  </View>
                ))}
                {!senders.length ? <Text style={styles.mutedText}>No senders configured</Text> : null}
              </View>
              <View style={styles.addSenderRow}>
                <TextInput
                  value={newSender}
                  onChangeText={setNewSender}
                  placeholder="Add new sender email..."
                  placeholderTextColor="rgba(196,199,200,0.42)"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.senderInput}
                />
                <Pressable style={styles.smallDarkButton} onPress={addSender}>
                  <Text style={styles.smallDarkButtonText}>Add</Text>
                </Pressable>
              </View>
              <Text style={styles.senderMeta}>{senderText || "Enter one email per line in web, or add chips here."}</Text>
            </View>

            {(message || error) ? <Text style={[styles.feedbackText, error ? styles.errorText : null]}>{error || message}</Text> : null}
            <View style={styles.actionRow}>
              <Pressable style={styles.primaryButton} disabled={saving} onPress={() => void saveAll()}>
                {saving ? <Skeleton width={36} height={14} radius={7} /> : <Text style={styles.primaryButtonText}>Save</Text>}
              </Pressable>
              <Pressable style={styles.secondaryButton} onPress={() => void refresh()}>
                <Text style={styles.secondaryButtonText}>Reload</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.memorySection}>
            <View style={styles.memoryHeading}>
              <Text style={styles.memoryTitle}>AI Memory</Text>
              <Text style={styles.sectionSubtext}>Saved notes used for future responses</Text>
            </View>
            <View style={styles.memoryCard}>
              <View style={styles.memoryComposer}>
                <TextInput
                  value={newMemoryKey}
                  onChangeText={setNewMemoryKey}
                  placeholder="New key..."
                  placeholderTextColor="rgba(196,199,200,0.42)"
                  style={styles.memoryKeyInput}
                />
                <TextInput
                  value={newMemoryValue}
                  onChangeText={setNewMemoryValue}
                  placeholder="Value..."
                  placeholderTextColor="rgba(196,199,200,0.42)"
                  style={styles.memoryValueInput}
                />
                <Pressable style={styles.memorySaveButton} onPress={() => void addMemory()}>
                  <Text style={styles.memorySaveText}>Save</Text>
                </Pressable>
              </View>
              <View style={styles.memoryRows}>
                {memories.map((memory) => (
                  <Pressable key={memory.id} style={styles.memoryRow} onPress={() => setSelectedMemory(memory)}>
                    <Text style={styles.memoryKey} numberOfLines={1}>{memory.key}</Text>
                    <MaterialIcons name="chevron-right" size={22} color="#8e9192" />
                  </Pressable>
                ))}
                {!memories.length ? <Text style={styles.emptyMemory}>No memory entries yet</Text> : null}
              </View>
            </View>
          </View>
        </ScrollView>
      )}

      <Modal visible={!!selectedMemory} transparent animationType="slide" onRequestClose={() => setSelectedMemory(null)}>
        <SafeAreaView style={styles.modalBackdrop} edges={["bottom"]}>
          <View style={styles.memoryModal}>
            <View style={styles.memoryModalHeader}>
              <View style={styles.memoryModalTitleWrap}>
                <Text style={styles.modalKicker}>Memory Key</Text>
                <Text style={styles.memoryModalTitle} numberOfLines={1}>{selectedMemory?.key}</Text>
              </View>
              <Pressable style={styles.sheetIconButton} onPress={() => setSelectedMemory(null)}>
                <MaterialIcons name="close" size={24} color="#c4c7c8" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.memoryModalBody}>
              <Text style={styles.inputLabel}>Value Content</Text>
              <View style={styles.memoryValueBox}>
                <Text style={styles.memoryValueText}>{selectedMemory ? prettyMemoryValue(selectedMemory.value) : ""}</Text>
              </View>
            </ScrollView>
            <View style={styles.memoryModalFooter}>
              <Pressable style={styles.deleteMemoryButton} disabled={saving} onPress={() => setConfirmDeleteMemoryVisible(true)}>
                {saving ? <Skeleton width={112} height={14} radius={7} /> : <Text style={styles.deleteMemoryText}>Delete Memory Entry</Text>}
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal >

      <Modal visible={confirmDeleteMemoryVisible} transparent animationType="fade" onRequestClose={() => setConfirmDeleteMemoryVisible(false)}>
        <SafeAreaView style={styles.confirmOverlay} edges={["top", "bottom"]}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}>
              <MaterialIcons name="delete-outline" size={26} color="#ffb4ab" />
            </View>
            <Text style={styles.confirmTitle}>Delete memory entry?</Text>
            <Text style={styles.confirmBody}>
              This will permanently delete {selectedMemory?.key ?? "this entry"} from AI memory.
            </Text>
            {error ? <Text style={styles.confirmErrorText}>{error}</Text> : null}
            <View style={styles.confirmActions}>
              <Pressable
                disabled={saving}
                style={({ pressed }) => [styles.confirmCancel, pressed ? { opacity: 0.85 } : null]}
                onPress={() => setConfirmDeleteMemoryVisible(false)}
              >
                <Text style={styles.confirmCancelText}>Go Back</Text>
              </Pressable>
              <Pressable
                disabled={saving}
                style={({ pressed }) => [styles.confirmDelete, saving ? { opacity: 0.7 } : null, pressed ? { opacity: 0.85 } : null]}
                onPress={() => void removeSelectedMemory()}
              >
                {saving ? <Skeleton width={56} height={14} radius={7} /> : <Text style={styles.confirmDeleteText}>Delete</Text>}
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView >
  );
}

function SettingInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "email-address";
}) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="rgba(196,199,200,0.42)"
        keyboardType={keyboardType}
        style={styles.underlineInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A0A0A" },
  header: { height: 96, paddingTop: 14, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: "#333333", backgroundColor: "#0A0A0A", flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  headerTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(24), lineHeight: 32, fontWeight: "700" },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, borderWidth: 1, borderColor: "#333333", backgroundColor: "#1A1A1A", paddingHorizontal: 12, paddingVertical: 7 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#7dffa2" },
  liveText: { color: "#7dffa2", fontFamily: "JetBrains Mono", fontSize: fs(11), lineHeight: 16 },
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 132, gap: 42 },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  mutedText: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(13), lineHeight: 19 },
  profileCard: { borderRadius: 12, borderWidth: 1, borderColor: "#333333", backgroundColor: "#1A1A1A", padding: 24, gap: 24 },
  cardHeader: { marginBottom: 8 },
  sectionKicker: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(14), lineHeight: 20, letterSpacing: 1.7, textTransform: "uppercase", fontWeight: "700", marginBottom: 8 },
  sectionSubtext: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(14), lineHeight: 20 },
  twoColumn: { flexDirection: "row", gap: 18 },
  inputGroup: { flex: 1 },
  inputLabel: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(12), lineHeight: 18, letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 8 },
  underlineInput: { minHeight: 42, color: "#ffffff", borderBottomWidth: 1, borderBottomColor: "#333333", fontFamily: "Inter", fontSize: fs(16), lineHeight: 24, paddingVertical: 8 },
  senderBlock: { gap: 10 },
  senderChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  senderChip: { maxWidth: "100%", borderRadius: 999, borderWidth: 1, borderColor: "#333333", backgroundColor: "#0A0A0A", paddingLeft: 12, paddingRight: 8, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 8 },
  senderChipText: { color: "#ffffff", fontFamily: "Inter", fontSize: fs(14), lineHeight: 20, maxWidth: 235 },
  addSenderRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  senderInput: { flex: 1, minHeight: 42, color: "#ffffff", borderBottomWidth: 1, borderBottomColor: "#333333", fontFamily: "Inter", fontSize: fs(15), lineHeight: 22, paddingVertical: 8 },
  smallDarkButton: { height: 40, borderRadius: 6, borderWidth: 1, borderColor: "#333333", backgroundColor: "#262626", paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  smallDarkButtonText: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(12), letterSpacing: 1.4, textTransform: "uppercase", fontWeight: "700" },
  senderMeta: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(12), lineHeight: 18 },
  feedbackText: { color: "#7dffa2", fontFamily: "Inter", fontSize: fs(13), lineHeight: 19 },
  errorText: { color: "#ffb4ab" },
  actionRow: { flexDirection: "row", gap: 14, marginTop: 4 },
  primaryButton: { flex: 1, height: 56, borderRadius: 8, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  primaryButtonText: { color: "#131313", fontFamily: "JetBrains Mono", fontSize: fs(14), letterSpacing: 1.7, textTransform: "uppercase", fontWeight: "700" },
  secondaryButton: { flex: 1, height: 56, borderRadius: 8, borderWidth: 1, borderColor: "#333333", alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(14), letterSpacing: 1.7, textTransform: "uppercase", fontWeight: "700" },
  memorySection: { gap: 18 },
  memoryHeading: { gap: 3 },
  memoryTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(20), lineHeight: 28, fontWeight: "700" },
  memoryCard: { borderRadius: 12, borderWidth: 1, borderColor: "#333333", backgroundColor: "#1A1A1A", overflow: "hidden" },
  memoryComposer: { padding: 16, gap: 14, borderBottomWidth: 1, borderBottomColor: "#333333", backgroundColor: "#131313" },
  memoryKeyInput: { minHeight: 42, color: "#ffffff", borderBottomWidth: 1, borderBottomColor: "#333333", fontFamily: "JetBrains Mono", fontSize: fs(14), lineHeight: 20 },
  memoryValueInput: { minHeight: 42, color: "#ffffff", borderBottomWidth: 1, borderBottomColor: "#333333", fontFamily: "Inter", fontSize: fs(15), lineHeight: 22 },
  memorySaveButton: { height: 42, borderRadius: 6, borderWidth: 1, borderColor: "#333333", backgroundColor: "#262626", alignItems: "center", justifyContent: "center" },
  memorySaveText: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(12), letterSpacing: 1.4, textTransform: "uppercase", fontWeight: "700" },
  memoryRows: { backgroundColor: "#1A1A1A" },
  memoryRow: { minHeight: 66, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: "#262626", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  memoryKey: { flex: 1, color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(14), lineHeight: 20, fontWeight: "700" },
  emptyMemory: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(13), padding: 20 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.80)", justifyContent: "flex-end" },
  memoryModal: { maxHeight: "85%", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderColor: "#333333", backgroundColor: "#131313", overflow: "hidden" },
  memoryModalHeader: { padding: 24, borderBottomWidth: 1, borderBottomColor: "#333333", backgroundColor: "#1A1A1A", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  memoryModalTitleWrap: { flex: 1, minWidth: 0 },
  modalKicker: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(10), letterSpacing: 1.6, textTransform: "uppercase", marginBottom: 4 },
  memoryModalTitle: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(18), lineHeight: 26, fontWeight: "700" },
  sheetIconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#262626", borderWidth: 1, borderColor: "#333333", alignItems: "center", justifyContent: "center" },
  memoryModalBody: { padding: 24, gap: 12 },
  memoryValueBox: { borderRadius: 12, borderWidth: 1, borderColor: "#262626", backgroundColor: "#0A0A0A", padding: 18 },
  memoryValueText: { color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(13), lineHeight: 20 },
  memoryModalFooter: { padding: 24, borderTopWidth: 1, borderTopColor: "#333333", backgroundColor: "#1A1A1A" },
  deleteMemoryButton: { height: 54, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,82,82,0.35)", backgroundColor: "rgba(255,82,82,0.08)", alignItems: "center", justifyContent: "center" },
  deleteMemoryText: { color: "#ffb4ab", fontFamily: "JetBrains Mono", fontSize: fs(13), letterSpacing: 1.4, textTransform: "uppercase", fontWeight: "700" },
  confirmOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.74)", alignItems: "center", justifyContent: "center", padding: 24 },
  confirmCard: { width: "100%", borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "#131313", padding: 24, gap: 14 },
  confirmIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(255,180,171,0.08)", alignItems: "center", justifyContent: "center" },
  confirmTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(24), lineHeight: 32, fontWeight: "700" },
  confirmBody: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(16), lineHeight: 24 },
  confirmErrorText: { color: "#ffb4ab", fontFamily: "Inter", fontSize: fs(13), lineHeight: 19 },
  confirmActions: { flexDirection: "row", gap: 14, paddingTop: 8 },
  confirmCancel: { flex: 1, height: 52, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", alignItems: "center", justifyContent: "center" },
  confirmDelete: { flex: 1, height: 52, borderRadius: 999, backgroundColor: "#ffb4ab", alignItems: "center", justifyContent: "center" },
  confirmCancelText: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(14), fontWeight: "700", letterSpacing: 1.6, textTransform: "uppercase" },
  confirmDeleteText: { color: "#690005", fontFamily: "Hanken Grotesk", fontSize: fs(14), fontWeight: "700", letterSpacing: 1.6, textTransform: "uppercase" },
});
