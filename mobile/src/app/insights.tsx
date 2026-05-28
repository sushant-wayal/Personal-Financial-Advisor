import React, { useCallback, useMemo, useRef, useState } from "react";
import {
    Animated,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Markdown from "react-native-markdown-display";
import { InsightsSkeleton } from "../components/LoadingSkeleton";
import { beginHorizontalScroll, endHorizontalScroll, updateHorizontalScroll } from "../lib/horizontalScrollPriority";
import { fetchCachedValue } from "../lib/clientCache";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "https://personal-financial-advisor-os.vercel.app";

type Insight = {
    id?: string;
    type?: string;
    message: string;
    score?: number | null;
    createdAt?: string;
};

type MetricTone = {
    color: string;
    icon: React.ComponentProps<typeof MaterialIcons>["name"];
    topGlow: string;
};

function apiUrl(path: string) {
    return `${API_BASE_URL}${path}`;
}

function fs(size: number) {
    return Math.round(size * 0.9 * 10) / 10;
}

function toneForInsight(type?: string): MetricTone {
    const map: Record<string, MetricTone> = {
        savings_rate: { color: "#7dffa2", icon: "savings", topGlow: "rgba(125,255,162,0.2)" },
        monthly_spend_trend: { color: "#7dffa2", icon: "trending-up", topGlow: "rgba(125,255,162,0.2)" },
        burn_rate: { color: "#ffb4ab", icon: "local-fire-department", topGlow: "rgba(255,180,171,0.2)" },
        runway: { color: "#ffb4ab", icon: "hourglass-empty", topGlow: "rgba(255,180,171,0.2)" },
        top_category: { color: "#ff5252", icon: "sports-esports", topGlow: "rgba(255,82,82,0.2)" },
        large_expense: { color: "#7dffa2", icon: "receipt-long", topGlow: "rgba(125,255,162,0.2)" },
        ai_summary: { color: "#7dffa2", icon: "auto-awesome", topGlow: "rgba(125,255,162,0.2)" },
    };

    return map[type || ""] ?? { color: "#c4c7c8", icon: "insights", topGlow: "rgba(196,199,200,0.2)" };
}

export default function InsightsScreen() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const metricsRef = useRef<ScrollView>(null);

    const [insights, setInsights] = useState<Insight[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [metricIndex, setMetricIndex] = useState(0);

    const cardWidth = Math.max(280, width - 48);
    const metricInsights = useMemo(() => insights.filter((item) => item.type !== "ai_summary"), [insights]);
    const aiSummary = useMemo(() => insights.find((item) => item.type === "ai_summary") ?? null, [insights]);

    const loadInsights = useCallback(async (force = false) => {
        setError(null);
        const data = await fetchCachedValue(
            "insights:generate",
            async () => {
                const res = await fetch(apiUrl("/api/insights/generate"), { cache: "no-store" });
                const payload = await res.json();
                if (!res.ok || payload.ok === false) {
                    throw new Error(payload.error || "Failed to load insights");
                }
                return Array.isArray(payload.insights) ? payload.insights : [];
            },
            { force },
        );
        setInsights(data);
    }, []);

    const runAnalysis = useCallback(async () => {
        setRefreshing(true);
        setError(null);
        try {
            const res = await fetch(apiUrl("/api/insights/generate"), { method: "POST" });
            const payload = await res.json().catch(() => null);
            if (!res.ok || payload?.ok === false) {
                throw new Error(payload?.error || "Failed to generate insights");
            }
            await loadInsights(true);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setRefreshing(false);
        }
    }, [loadInsights]);

    // Animated scrollX for the metrics carousel dots
    const metricsScrollX = useRef(new Animated.Value(0));

    React.useEffect(() => {
        let mounted = true;

        (async () => {
            try {
                const data = await fetchCachedValue(
                    "insights:generate",
                    async () => {
                        const res = await fetch(apiUrl("/api/insights/generate"), { cache: "no-store" });
                        const payload = await res.json();
                        if (!res.ok || payload.ok === false) {
                            throw new Error(payload.error || "Failed to load insights");
                        }
                        return Array.isArray(payload.insights) ? payload.insights : [];
                    },
                );
                if (!mounted) return;
                setInsights(data);
            } catch (e: unknown) {
                if (!mounted) return;
                setError(e instanceof Error ? e.message : String(e));
                setInsights([]);
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        })();

        return () => {
            mounted = false;
        };
    }, []);

    function onMetricsScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
        const x = event.nativeEvent.contentOffset.x;
        const next = Math.round(x / (cardWidth + 16));
        updateHorizontalScroll(event.nativeEvent.contentOffset.x, event.nativeEvent.layoutMeasurement.width, event.nativeEvent.contentSize.width);
        setMetricIndex(Math.max(0, Math.min(metricInsights.length - 1, next)));
    }

    function scrollToMetric(index: number) {
        if (!metricInsights.length) return;
        const clamped = Math.max(0, Math.min(metricInsights.length - 1, index));
        metricsRef.current?.scrollTo({ x: clamped * (cardWidth + 16), animated: true });
        setMetricIndex(clamped);
    }

    return (
        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
            <StatusBar barStyle="light-content" backgroundColor="#131313" />
            <View style={styles.container}>
                <View style={styles.topBar}>
                    <View style={styles.topBarLeft}>
                        <Pressable style={({ pressed }) => [styles.iconButton, pressed ? styles.iconPressed : null]} onPress={() => router.back()}>
                            <MaterialIcons name="arrow-back" size={24} color="#ffffff" />
                        </Pressable>
                        <Text style={styles.topBarTitle}>Insights</Text>
                    </View>
                </View>

                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void runAnalysis()} tintColor="#ffffff" />}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>Key Metrics</Text>
                        <View style={styles.metricNavRow}>
                            <Pressable style={({ pressed }) => [styles.metricNavButton, pressed ? styles.iconPressed : null]} onPress={() => scrollToMetric(metricIndex - 1)}>
                                <MaterialIcons name="chevron-left" size={18} color="#c4c7c8" />
                            </Pressable>
                            <Pressable style={({ pressed }) => [styles.metricNavButton, pressed ? styles.iconPressed : null]} onPress={() => scrollToMetric(metricIndex + 1)}>
                                <MaterialIcons name="chevron-right" size={18} color="#c4c7c8" />
                            </Pressable>
                        </View>
                    </View>

                    {loading ? (
                        <InsightsSkeleton />
                    ) : (
                        <>
                            <ScrollView
                                ref={metricsRef}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.metricsContent}
                                snapToInterval={cardWidth + 16}
                                decelerationRate="fast"
                                onTouchStart={beginHorizontalScroll}
                                onTouchEnd={endHorizontalScroll}
                                onTouchCancel={endHorizontalScroll}
                                onScrollBeginDrag={beginHorizontalScroll}
                                onScrollEndDrag={endHorizontalScroll}
                                onMomentumScrollEnd={endHorizontalScroll}
                                onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: metricsScrollX.current } } }], {
                                    useNativeDriver: false,
                                    listener: onMetricsScroll,
                                })}
                                scrollEventThrottle={16}
                            >
                                {metricInsights.map((insight, index) => {
                                    const tone = toneForInsight(insight.type);
                                    return (
                                        <View key={insight.id ?? `${insight.type ?? "metric"}-${index}`} style={[styles.metricCard, { width: cardWidth }]}>
                                            <View style={[styles.metricCardTopGlow, { backgroundColor: tone.topGlow }]} />
                                            <View style={styles.metricBodyRow}>
                                                <View style={styles.metricIconWrap}>
                                                    <MaterialIcons name={tone.icon} size={22} color={tone.color} />
                                                </View>
                                                <Text style={styles.metricMessage}>{insight.message}</Text>
                                            </View>
                                            <View style={styles.metricFooter}>
                                                <View style={styles.scorePill}>
                                                    <Text style={styles.scoreText}>Score:</Text>
                                                    <Text style={[styles.scoreValue, { color: tone.color }]}>{Math.round(insight.score ?? 0)}</Text>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })}

                                {!metricInsights.length ? (
                                    <View style={[styles.metricCard, styles.emptyMetricCard, { width: cardWidth }]}>
                                        <Text style={styles.emptyMetricText}>No key metrics yet. Pull to refresh to generate insights.</Text>
                                    </View>
                                ) : null}
                            </ScrollView>

                            <View style={styles.paginationRow}>
                                {(metricInsights.length ? metricInsights : [{ message: "", score: 0 }]).map((_, index) => {
                                    const inputRange = [
                                        (index - 1) * (cardWidth + 16),
                                        index * (cardWidth + 16),
                                        (index + 1) * (cardWidth + 16),
                                    ];

                                    return (
                                        <Animated.View
                                            key={`dot-${index}`}
                                            style={[
                                                styles.dot,
                                                {
                                                    width: metricsScrollX.current.interpolate({ inputRange, outputRange: [6, 18, 6], extrapolate: "clamp" }),
                                                    opacity: metricsScrollX.current.interpolate({ inputRange, outputRange: [0.28, 1, 0.28], extrapolate: "clamp" }),
                                                    backgroundColor: metricsScrollX.current.interpolate({ inputRange, outputRange: ["rgba(255,255,255,0.22)", "#7dffa2", "rgba(255,255,255,0.22)"], extrapolate: "clamp" }),
                                                },
                                            ]}
                                        />
                                    );
                                })}
                            </View>
                        </>
                    )}

                    <View style={styles.summaryCard}>
                        <View style={styles.summaryHeader}>
                            <View style={styles.summaryTitleWrap}>
                                <MaterialIcons name="auto-awesome" size={28} color="#7dffa2" />
                                <View>
                                    <Text style={styles.summaryTitle}>AI-GENERATED SUMMARY</Text>
                                    <Text style={styles.summarySubTitle}>Personalized analysis from your transactions</Text>
                                </View>
                            </View>
                            <Pressable style={({ pressed }) => [styles.refreshButton, pressed ? styles.iconPressed : null]} onPress={() => void runAnalysis()}>
                                <MaterialIcons name="refresh" size={18} color="#c4c7c8" />
                            </Pressable>
                        </View>

                        {error ? <Text style={styles.errorText}>{error}</Text> : null}

                        {!aiSummary ? (
                            <Text style={styles.noSummaryText}>No AI summary available yet. Tap Refresh to generate one.</Text>
                        ) : (
                            <View style={styles.mdContainer}>
                                <Markdown style={markdownStyles}>{aiSummary.message}</Markdown>
                            </View>
                        )}
                    </View>
                </ScrollView>

            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: "#131313" },
    container: { flex: 1, backgroundColor: "#131313" },
    topBar: {
        height: 64,
        borderBottomWidth: 1,
        borderBottomColor: "#444748",
        paddingHorizontal: 24,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#131313",
    },
    topBarLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    topBarTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(20), lineHeight: 28, fontWeight: "700" },
    iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    iconPressed: { backgroundColor: "rgba(255,255,255,0.05)", transform: [{ scale: 0.95 }] },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 136, gap: 24 },
    sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    sectionTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(18), lineHeight: 24, fontWeight: "600" },
    metricNavRow: { flexDirection: "row", gap: 8 },
    metricNavButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#444748",
        alignItems: "center",
        justifyContent: "center",
    },
    stateWrap: { minHeight: 120, alignItems: "center", justifyContent: "center" },
    metricsContent: { gap: 16, paddingBottom: 8 },
    metricCard: {
        backgroundColor: "#1A1A1A",
        borderWidth: 1,
        borderColor: "#333333",
        borderRadius: 12,
        padding: 20,
        minHeight: 190,
        justifyContent: "space-between",
        overflow: "hidden",
    },
    metricCardTopGlow: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
    },
    metricBodyRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    metricIconWrap: { width: 36, height: 36, borderRadius: 8, backgroundColor: "#201f1f", alignItems: "center", justifyContent: "center" },
    metricMessage: { flex: 1, color: "#e5e2e1", fontFamily: "Inter", fontSize: fs(14), lineHeight: 22 },
    metricFooter: { marginTop: 14, flexDirection: "row", justifyContent: "flex-start" },
    scorePill: {
        flexDirection: "row",
        gap: 6,
        alignItems: "center",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: "#444748",
        backgroundColor: "#201f1f",
    },
    scoreText: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(10), lineHeight: 14 },
    scoreValue: { fontFamily: "JetBrains Mono", fontSize: fs(10), lineHeight: 14, fontWeight: "700" },
    emptyMetricCard: { alignItems: "center", justifyContent: "center" },
    emptyMetricText: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(13), lineHeight: 20, textAlign: "center" },
    paginationRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 2 },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#8e9192" },
    dotActive: { width: 16, backgroundColor: "#7dffa2" },
    summaryCard: {
        backgroundColor: "#1c1b1b",
        borderWidth: 1,
        borderColor: "#444748",
        borderRadius: 16,
        overflow: "hidden",
    },
    summaryHeader: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#444748",
        backgroundColor: "rgba(14,14,14,0.5)",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
    },
    summaryTitleWrap: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
    summaryTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(16), lineHeight: 22, fontWeight: "700" },
    summarySubTitle: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(10), lineHeight: 14, letterSpacing: 0.9, textTransform: "uppercase" },
    refreshButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderWidth: 1,
        borderColor: "#444748",
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    refreshButtonText: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(10), lineHeight: 14, letterSpacing: 0.8, textTransform: "uppercase" },
    errorText: { color: "#ffb4ab", fontFamily: "Inter", fontSize: fs(12), lineHeight: 18, paddingHorizontal: 16, paddingTop: 12 },
    noSummaryText: { color: "#8e9192", fontFamily: "Inter", fontSize: fs(13), lineHeight: 20, paddingHorizontal: 16, paddingVertical: 16 },
    mdContainer: { paddingHorizontal: 16, paddingVertical: 16 },
});

const markdownStyles = {
    body: {
        color: "#e5e2e1",
        fontFamily: "Inter",
        fontSize: fs(14),
        lineHeight: 22,
    },
    paragraph: {
        marginTop: 0,
        marginBottom: 10,
        color: "#e5e2e1",
        fontFamily: "Inter",
        fontSize: fs(14),
        lineHeight: 22,
    },
    heading1: {
        color: "#ffffff",
        fontFamily: "Hanken Grotesk",
        fontSize: fs(18),
        lineHeight: 24,
        fontWeight: "700",
        marginTop: 2,
        marginBottom: 8,
    },
    heading2: {
        color: "#ffffff",
        fontFamily: "Hanken Grotesk",
        fontSize: fs(16),
        lineHeight: 22,
        fontWeight: "700",
        marginTop: 2,
        marginBottom: 8,
    },
    heading3: {
        color: "#ffffff",
        fontFamily: "Hanken Grotesk",
        fontSize: fs(14),
        lineHeight: 20,
        fontWeight: "600",
        marginTop: 2,
        marginBottom: 8,
    },
    strong: {
        color: "#7dffa2",
        fontWeight: "700",
    },
    em: {
        color: "#b0c6ff",
        fontStyle: "italic",
    },
    bullet_list: {
        marginTop: 0,
        marginBottom: 10,
    },
    ordered_list: {
        marginTop: 0,
        marginBottom: 10,
    },
    list_item: {
        color: "#e5e2e1",
        fontFamily: "Inter",
        fontSize: fs(14),
        lineHeight: 22,
    },
    bullet_list_icon: {
        color: "#7dffa2",
        fontFamily: "JetBrains Mono",
        fontSize: fs(12),
        lineHeight: 20,
    },
    ordered_list_icon: {
        color: "#7dffa2",
        fontFamily: "JetBrains Mono",
        fontSize: fs(12),
        lineHeight: 20,
    },
    bullet_list_content: {
        color: "#e5e2e1",
        fontFamily: "Inter",
        fontSize: fs(14),
        lineHeight: 22,
    },
    ordered_list_content: {
        color: "#e5e2e1",
        fontFamily: "Inter",
        fontSize: fs(14),
        lineHeight: 22,
    },
    hr: {
        backgroundColor: "#444748",
        marginVertical: 10,
    },
} as const;