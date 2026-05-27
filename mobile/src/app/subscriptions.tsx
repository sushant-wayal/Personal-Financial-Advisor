import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Skeleton, SubscriptionsSkeleton } from "../components/LoadingSkeleton";
import { formatCurrencyAmount, useCurrency } from "../providers/CurrencyProvider";
import { clearClientCache, fetchCachedValue } from "../lib/clientCache";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "https://personal-financial-advisor-os.vercel.app";

type Subscription = {
    id: string;
    merchant: string;
    amount: number;
    interval: string;
    nextCharge?: string | null;
    active: boolean;
};

function apiUrl(path: string) {
    return `${API_BASE_URL}${path}`;
}

function formatCurrency(value: number) {
    return formatCurrencyAmount(value);
}

function formatDate(value?: string | null) {
    if (!value) return "--";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-US", { month: "numeric", day: "numeric", year: "numeric" }).format(date);
}

function fs(size: number) {
    return Math.round(size * 0.9 * 10) / 10;
}

async function fetchSubscriptions(force = false) {
    return fetchCachedValue(
        "subscriptions",
        async () => {
            const res = await fetch(apiUrl("/api/subscriptions"));
            const payload = await res.json();
            if (!res.ok || payload.ok === false) throw new Error(payload.error || "Failed to load subscriptions");
            return (payload.subscriptions ?? []) as Subscription[];
        },
        { force },
    );
}

async function detectSubscriptions() {
    const res = await fetch(apiUrl("/api/subscriptions/detect"), { method: "POST" });
    const payload = await res.json();
    if (!res.ok || payload.ok === false) throw new Error(payload.error || "Failed to detect subscriptions");
    return payload.detected;
}

async function updateSubscription(id: string, data: Partial<Pick<Subscription, "merchant" | "amount" | "interval" | "nextCharge" | "active">>) {
    const res = await fetch(apiUrl("/api/subscriptions"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, data }),
    });
    const payload = await res.json();
    if (!res.ok || payload.ok === false) throw new Error(payload.error || "Failed to update subscription");
    return payload.subscription as Subscription;
}

async function deleteSubscription(id: string) {
    const res = await fetch(apiUrl("/api/subscriptions"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
    });
    const payload = await res.json();
    if (!res.ok || payload.ok === false) throw new Error(payload.error || "Failed to delete subscription");
}

export default function SubscriptionsScreen() {
    useCurrency();
    const router = useRouter();
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [detecting, setDetecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const load = useCallback(async (force = false) => {
        setError(null);
        const data = await fetchSubscriptions(force);
        setSubscriptions(data);
    }, []);

    useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                const data = await fetchSubscriptions();
                if (!mounted) return;
                setError(null);
                setSubscriptions(data);
            } catch (e: unknown) {
                if (mounted) setError(e instanceof Error ? e.message : String(e));
            } finally {
                if (mounted) setLoading(false);
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

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

    async function runDetect() {
        setDetecting(true);
        setError(null);
        try {
            await detectSubscriptions();
            clearClientCache();
            await load(true);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setDetecting(false);
        }
    }

    async function toggleActive(item: Subscription) {
        setTogglingId(item.id);
        setError(null);
        try {
            const updated = await updateSubscription(item.id, { active: !item.active });
            setSubscriptions((current) => current.map((subscription) => (subscription.id === updated.id ? updated : subscription)));
            clearClientCache();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setTogglingId(null);
        }
    }

    async function removeSubscription(item: Subscription) {
        setDeletingId(item.id);
        setError(null);
        try {
            await deleteSubscription(item.id);
            setSubscriptions((current) => current.filter((subscription) => subscription.id !== item.id));
            clearClientCache();
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setDeletingId(null);
        }
    }

    const activeCount = useMemo(() => subscriptions.filter((item) => item.active).length, [subscriptions]);

    return (
        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
            <StatusBar barStyle="light-content" backgroundColor="#131313" />
            <View style={styles.screen}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Pressable style={styles.iconButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
                            <MaterialIcons name="arrow-back" size={24} color="#ffffff" />
                        </Pressable>
                        <Text style={styles.headerTitle}>Subscriptions</Text>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor="#ffffff" />} showsVerticalScrollIndicator={false}>
                    <View style={styles.heroRow}>
                        <View>
                            <Text style={styles.pageTitle}>Subscriptions</Text>
                            <Text style={styles.pageSubtitle}>Recurring charges to keep in sight</Text>
                        </View>
                        <View style={styles.heroActions}>
                            <Pressable style={({ pressed }) => [styles.secondaryButton, pressed ? styles.pressed : null]} onPress={() => void refresh()}>
                                <Text style={styles.secondaryButtonText}>REFRESH</Text>
                            </Pressable>
                            <Pressable style={({ pressed }) => [styles.primaryButton, pressed ? styles.pressed : null]} onPress={() => void runDetect()} disabled={detecting}>
                                {detecting ? <Skeleton width={52} height={14} radius={7} /> : <Text style={styles.primaryButtonText}>Detect</Text>}
                            </Pressable>
                        </View>
                    </View>

                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryText}>{activeCount} active</Text>
                        <Text style={styles.summaryText}>{subscriptions.length} total</Text>
                    </View>

                    {loading ? (
                        <SubscriptionsSkeleton />
                    ) : error ? (
                        <View style={styles.centerState}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : (
                        <View style={styles.list}>
                            {subscriptions.map((item) => (
                                <View key={item.id} style={[styles.card, !item.active ? styles.cardPaused : null]}>
                                    <View style={styles.cardCopy}>
                                        <View style={styles.merchantRow}>
                                            <Text style={[styles.merchant, !item.active ? styles.merchantMuted : null]}>{item.merchant}</Text>
                                            {!item.active ? <Text style={styles.pausedPill}>Paused</Text> : null}
                                        </View>
                                        <View style={styles.amountRow}>
                                            <Text style={[styles.amount, !item.active ? styles.amountMuted : null]}>{formatCurrency(item.amount)}</Text>
                                            <View style={styles.dividerDot} />
                                            <Text style={styles.interval}>{item.interval}</Text>
                                        </View>
                                        <Text style={styles.nextCharge}>Next: {formatDate(item.nextCharge)}</Text>
                                    </View>
                                    <View style={styles.actionRow}>
                                        <Pressable style={({ pressed }) => [styles.toggleButton, item.active ? styles.disableButton : styles.enableButton, pressed ? styles.pressed : null]} onPress={() => void toggleActive(item)} disabled={togglingId === item.id}>
                                            {togglingId === item.id ? <Skeleton width={56} height={14} radius={7} /> : <Text style={[styles.toggleButtonText, item.active ? styles.disableButtonText : styles.enableButtonText]}>{item.active ? "DISABLE" : "ENABLE"}</Text>}
                                        </Pressable>
                                        <Pressable style={({ pressed }) => [styles.deleteButton, pressed ? styles.pressed : null]} onPress={() => void removeSubscription(item)} disabled={deletingId === item.id}>
                                            {deletingId === item.id ? <Skeleton width={56} height={14} radius={7} /> : <Text style={styles.deleteButtonText}>DELETE</Text>}
                                        </Pressable>
                                    </View>
                                </View>
                            ))}

                            {!subscriptions.length ? (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyTitle}>No subscriptions found</Text>
                                    <Text style={styles.emptyText}>Run detection to discover recurring charges.</Text>
                                </View>
                            ) : null}
                        </View>
                    )}

                </ScrollView>

            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#131313" },
    screen: { flex: 1, backgroundColor: "#131313" },
    header: {
        height: 64,
        borderBottomWidth: 1,
        borderBottomColor: "#444748",
        backgroundColor: "#131313",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 24,
    },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
    headerTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(18), lineHeight: 24, fontWeight: "700" },
    iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 136, gap: 24 },
    heroRow: { gap: 16 },
    eyebrow: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(11), lineHeight: 16, letterSpacing: 1.6, textTransform: "uppercase" },
    pageTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(24), lineHeight: 32, fontWeight: "700", marginTop: 4 },
    pageSubtitle: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(12), lineHeight: 18, marginTop: 4 },
    heroActions: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
    secondaryButton: {
        minHeight: 44,
        paddingHorizontal: 18,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#444748",
        alignItems: "center",
        justifyContent: "center",
    },
    secondaryButtonText: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(12), letterSpacing: 1.4, textTransform: "uppercase" },
    primaryButton: {
        minHeight: 44,
        paddingHorizontal: 18,
        borderRadius: 10,
        backgroundColor: "#ffffff",
        alignItems: "center",
        justifyContent: "center",
    },
    primaryButtonText: { color: "#1a1c1c", fontFamily: "JetBrains Mono", fontSize: fs(12), letterSpacing: 1.4, textTransform: "uppercase", fontWeight: "700" },
    pressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
    centerState: { minHeight: 120, alignItems: "center", justifyContent: "center" },
    errorText: { color: "#ffb4ab", fontFamily: "Inter", fontSize: fs(12), lineHeight: 18, textAlign: "center" },
    list: { gap: 16 },
    card: {
        backgroundColor: "#1c1b1b",
        borderWidth: 1,
        borderColor: "#444748",
        borderRadius: 12,
        padding: 20,
        gap: 16,
    },
    cardPaused: { backgroundColor: "#131313", opacity: 0.82 },
    cardCopy: { gap: 8 },
    merchantRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    merchant: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(18), lineHeight: 24, fontWeight: "600" },
    merchantMuted: { color: "#c4c7c8" },
    pausedPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: "#444748",
        backgroundColor: "#2a2a2a",
        color: "#8e9192",
        fontFamily: "JetBrains Mono",
        fontSize: fs(10),
        lineHeight: 14,
        textTransform: "uppercase",
    },
    amountRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    amount: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(14), lineHeight: 20 },
    amountMuted: { color: "#8e9192" },
    dividerDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#444748" },
    interval: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(14), lineHeight: 20 },
    nextCharge: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(12), lineHeight: 18, marginTop: 2 },
    actionRow: {
        width: "100%",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderTopWidth: 1,
        borderTopColor: "#444748",
        paddingTop: 16,
    },
    toggleButton: {
        flex: 1,
        minHeight: 34,
        paddingHorizontal: 14,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    enableButton: { borderColor: "#05e777", backgroundColor: "rgba(5,231,119,0.08)" },
    disableButton: { borderColor: "#ffb4ab", backgroundColor: "rgba(255,180,171,0.05)" },
    toggleButtonText: { fontFamily: "JetBrains Mono", fontSize: fs(11), letterSpacing: 1.1, textTransform: "uppercase", fontWeight: "700" },
    enableButtonText: { color: "#7dffa2" },
    disableButtonText: { color: "#ffb4ab" },
    deleteButton: { flex: 1, minHeight: 34, paddingHorizontal: 2, alignItems: "center", justifyContent: "center" },
    deleteButtonText: { color: "#ffb4ab", fontFamily: "JetBrains Mono", fontSize: fs(11), letterSpacing: 1.1, textTransform: "uppercase" },
    emptyState: {
        paddingVertical: 40,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#444748",
        backgroundColor: "#1c1b1b",
        alignItems: "center",
        gap: 6,
    },
    emptyTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(16), lineHeight: 24, fontWeight: "600" },
    emptyText: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(12), lineHeight: 18, textAlign: "center" },
    summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 6 },
    summaryText: { color: "#8e9192", fontFamily: "JetBrains Mono", fontSize: fs(11), letterSpacing: 1.1, textTransform: "uppercase" },
});