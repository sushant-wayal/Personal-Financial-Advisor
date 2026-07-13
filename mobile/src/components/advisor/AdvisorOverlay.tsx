/* eslint-disable react-hooks/exhaustive-deps, react-hooks/rules-of-hooks, react-hooks/refs, react-hooks/set-state-in-effect */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    Easing,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
    BackHandler,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Markdown from "react-native-markdown-display";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAdvisorContext } from "../../providers/AdvisorProvider";
import ArtifactRenderer from "./ArtifactRenderer";
import { API_BASE_URL } from "../../lib/apiBaseUrl";
import type { AdvisorResponse } from "../../types/advisor";

// ─── Suggestion cache constants ───────────────────────────────────────────────
const SUGGESTIONS_CACHE_KEY = "advisor_suggestions_v1";
const SUGGESTIONS_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatTurn = { question: string; response: AdvisorResponse | null; runAt?: string };

type StatusPhase = "thinking" | "querying" | "processing" | "done";

type ToolCallState = { name: string; rowCount?: number; done: boolean };

type LiveStatus = {
    phase: StatusPhase;
    message: string;
    iteration: number;
    toolCalls: ToolCallState[];
    updatedAt?: number;
} | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 1500;

function apiUrl(path: string) {
    return `${API_BASE_URL}${path}`;
}

function formatTimestamp(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
}

function toolLabel(name: string): string {
    const map: Record<string, string> = {
        queryTransactions: "Transaction Records",
        aggregateTransactions: "Spending Aggregation",
        queryGoals: "Financial Goals",
        querySubscriptions: "Subscriptions",
        queryCategories: "Categories",
        getFinancialProfile: "Financial Profile",
        queryMemories: "Memory",
        queryInsights: "Insights",
    };
    return map[name] ?? name;
}

// ─── Orbiting Loader ─────────────────────────────────────────────────────────────

function OrbitingLoader({ color }: { color: string }) {
    const anim1 = useRef(new Animated.Value(0)).current;
    const anim2 = useRef(new Animated.Value(0)).current;
    const anim3 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const a1 = Animated.loop(Animated.timing(anim1, { toValue: 1, duration: 1500, easing: Easing.linear, useNativeDriver: true }));
        const a2 = Animated.loop(Animated.timing(anim2, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }));
        const a3 = Animated.loop(Animated.timing(anim3, { toValue: 1, duration: 2500, easing: Easing.linear, useNativeDriver: true }));
        
        a1.start();
        a2.start();
        a3.start();

        return () => {
            a1.stop();
            a2.stop();
            a3.stop();
        };
    }, [anim1, anim2, anim3]);

    const spin1 = anim1.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
    const spin2 = anim2.interpolate({ inputRange: [0, 1], outputRange: ["120deg", "480deg"] });
    const spin3 = anim3.interpolate({ inputRange: [0, 1], outputRange: ["240deg", "600deg"] });

    return (
        <View style={{ width: 16, height: 16, alignItems: "center", justifyContent: "center" }}>
            <Animated.View style={[StyleSheet.absoluteFill, { alignItems: "center", transform: [{ rotate: spin1 }] }]}>
                <View style={{ width: 3.5, height: 3.5, borderRadius: 2, backgroundColor: color, shadowColor: color, shadowOpacity: 0.8, shadowRadius: 3, shadowOffset: { width: 0, height: 0 }, elevation: 2, transform: [{ translateY: 0 }] }} />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, { alignItems: "center", transform: [{ rotate: spin2 }] }]}>
                <View style={{ width: 2.5, height: 2.5, borderRadius: 1.5, backgroundColor: color, opacity: 0.7, transform: [{ translateY: 2 }] }} />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, { alignItems: "center", transform: [{ rotate: spin3 }] }]}>
                <View style={{ width: 1.5, height: 1.5, borderRadius: 1, backgroundColor: color, opacity: 0.5, transform: [{ translateY: 4 }] }} />
            </Animated.View>
        </View>
    );
}

// ─── Live Status Panel ────────────────────────────────────────────────────────

function LiveStatusPanel({ status }: { status: NonNullable<LiveStatus> }) {
    const isDone = status.phase === "done";
    const dotColor =
        status.phase === "querying"
            ? "#a78bfa"
            : status.phase === "processing"
                ? "#f59e0b"
                : status.phase === "done"
                    ? "#34d399"
                    : "#60a5fa";

    return (
        <View style={liveStyles.panel}>
            {/* Header */}
            <View style={liveStyles.headerRow}>
                {isDone ? (
                    <MaterialIcons name="check-circle" size={15} color="#34d399" />
                ) : (
                    <OrbitingLoader color={dotColor} />
                )}
                <Text style={[liveStyles.phaseText, isDone && liveStyles.doneText]}>
                    {status.message}
                </Text>
                {status.iteration > 0 && !isDone && (
                    <View style={liveStyles.iterBadge}>
                        <Text style={liveStyles.iterText}>step {status.iteration}</Text>
                    </View>
                )}
            </View>

            {/* Tool call rows */}
            {status.toolCalls.length > 0 && (
                <View style={liveStyles.toolList}>
                    {status.toolCalls.map((tc, i) => (
                        <View key={`${tc.name}-${i}`} style={liveStyles.toolRow}>
                            <MaterialIcons
                                name={tc.done ? "check" : "storage"}
                                size={12}
                                color={tc.done ? "#34d399" : "#a78bfa"}
                            />
                            <Text style={liveStyles.toolName}>{toolLabel(tc.name)}</Text>
                            {tc.done && tc.rowCount !== undefined && (
                                <Text style={liveStyles.rowCount}>{tc.rowCount} rows</Text>
                            )}
                            {!tc.done && <OrbitingLoader color="#a78bfa" />}
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

// ─── Status Poller Hook ───────────────────────────────────────────────────────

function useAdvisorStatusPoller(requestId: string | null, active: boolean) {
    const [status, setStatus] = useState<LiveStatus>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!active || !requestId) {
            setStatus(null);
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        let cancelled = false;

        async function poll() {
            if (cancelled) return;
            try {
                const res = await fetch(
                    apiUrl(`/api/ai/advisor/status?requestId=${encodeURIComponent(requestId!)}`)
                );
                if (!res.ok || cancelled) return;
                const data = await res.json();
                if (data && data.type === "status") {
                    setStatus(data as LiveStatus);
                }
            } catch {
                // swallow — polling errors are non-fatal
            }
        }

        // Poll immediately then on interval
        void poll();
        timerRef.current = setInterval(() => void poll(), POLL_INTERVAL_MS);

        return () => {
            cancelled = true;
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [requestId, active]);

    return status;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AdvisorOverlay() {
    const { isAdvisorOpen, closeAdvisor } = useAdvisorContext();
    const insets = useSafeAreaInsets();
    const { width, height: screenHeight } = useWindowDimensions();
    const scrollRef = useRef<ScrollView>(null);
    const inFlightRef = useRef(false);

    const [q, setQ] = useState("");
    const [threads, setThreads] = useState<ChatTurn[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [inputHeight, setInputHeight] = useState(56);
    const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

    const contentWidth = useMemo(() => Math.min(width, 980), [width]);

    // Start polling whenever there's an activeRequestId and we're loading
    const liveStatus = useAdvisorStatusPoller(activeRequestId, loading);

    useEffect(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
    }, [threads, loading, liveStatus]);

    const send = useCallback(async (overrideText?: string) => {
        const user = overrideText?.trim() || q.trim();
        if (!user || inFlightRef.current) return;

        inFlightRef.current = true;
        // Generate requestId client-side so polling starts before the POST resolves
        const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        setError(null);
        setActiveRequestId(requestId);
        setThreads((prev) => [...prev, { question: user, response: null }]);
        setQ("");
        setLoading(true);

        try {
            const history = threads.slice(-8).map((turn) => ({
                question: turn.question,
                response: turn.response?.narrative || "",
            }));

            const res = await fetch(apiUrl("/api/ai/advisor"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: user, history, requestId }),
            });

            const contentType = res.headers.get("content-type") || "";
            let reply: AdvisorResponse;

            if (contentType.includes("application/json")) {
                const data = await res.json();
                reply = {
                    narrative:
                        typeof data?.narrative === "string"
                            ? data.narrative
                            : typeof data?.error === "string"
                                ? data.error
                                : JSON.stringify(data),
                    artifacts: Array.isArray(data?.artifacts) ? data.artifacts : [],
                };
            } else {
                const raw = await res.text();
                reply = { narrative: raw.trim() || "No response", artifacts: [] };
            }

            setThreads((prev) => {
                if (!prev.length) return prev;
                const next = [...prev];
                next[next.length - 1] = {
                    ...next[next.length - 1],
                    response: reply,
                    runAt: new Date().toISOString(),
                };
                return next;
            });

            // Fire-and-forget memory write
            if (reply.narrative.trim()) {
                fetch(apiUrl("/api/ai/memory"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        key: `chat:${Date.now()}`,
                        value: reply.narrative.trim(),
                        tags: ["chat", "advisor"],
                    }),
                }).catch(() => { });
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg);
            setThreads((prev) => {
                if (!prev.length) return prev;
                const next = [...prev];
                next[next.length - 1] = {
                    ...next[next.length - 1],
                    response: { narrative: `Error: ${msg}`, artifacts: [] },
                };
                return next;
            });
        } finally {
            setLoading(false);
            setActiveRequestId(null);
            inFlightRef.current = false;
        }
    }, [q, threads]);

    // ── Dynamic AI suggestions (cached for 12 h) ──────────────────────────────
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function loadSuggestions() {
            // 1. Try reading from cache first
            try {
                const cached = await AsyncStorage.getItem(SUGGESTIONS_CACHE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached) as { ts: number; suggestions: string[] };
                    const ageMs = Date.now() - parsed.ts;
                    if (ageMs < SUGGESTIONS_TTL_MS && Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0) {
                        // Cache is fresh — use it, no API call needed
                        if (!cancelled) {
                            setSuggestions(parsed.suggestions);
                            setSuggestionsLoading(false);
                        }
                        return;
                    }
                }
            } catch {
                // Cache read failed — proceed to fetch
            }

            // 2. Cache miss or stale — fetch from backend
            try {
                const res = await fetch(apiUrl("/api/ai/advisor/suggestions"));
                const data = await res.json();
                if (!cancelled && Array.isArray(data?.suggestions) && data.suggestions.length > 0) {
                    setSuggestions(data.suggestions);
                    // Persist to cache with current timestamp
                    AsyncStorage.setItem(
                        SUGGESTIONS_CACHE_KEY,
                        JSON.stringify({ ts: Date.now(), suggestions: data.suggestions })
                    ).catch(() => { /* non-fatal */ });
                }
            } catch {
                // Fetch failed — leave suggestions empty, skeleton hides
            } finally {
                if (!cancelled) setSuggestionsLoading(false);
            }
        }

        void loadSuggestions();
        return () => { cancelled = true; };
    }, []);

    // ── Morphing Animation ────────────────────────────────────────────────────
    const [animValue] = useState(() => new Animated.Value(0));
    const [isRendered, setIsRendered] = useState(isAdvisorOpen);

    useEffect(() => {
        if (isAdvisorOpen) setIsRendered(true);
        Animated.timing(animValue, {
            toValue: isAdvisorOpen ? 1 : 0,
            duration: 350, // Slightly faster for snappier feel
            useNativeDriver: false, // We are animating layout properties
        }).start(() => {
            if (!isAdvisorOpen) setIsRendered(false);
        });
    }, [isAdvisorOpen, animValue]);

    // Hardware Back Button
    useEffect(() => {
        if (!isAdvisorOpen) return;
        const sub = BackHandler.addEventListener("hardwareBackPress", () => {
            closeAdvisor();
            return true;
        });
        return () => sub.remove();
    }, [isAdvisorOpen, closeAdvisor]);

    // Initial FAB position
    const fabBottom = Math.max(insets.bottom + 92, 102);
    const fabRight = 16;
    const fabSize = 55;
    const fabRadius = 31;

    const overlayBottom = animValue.interpolate({ inputRange: [0, 1], outputRange: [fabBottom, 0] });
    const overlayRight = animValue.interpolate({ inputRange: [0, 1], outputRange: [fabRight, 0] });
    const overlayWidth = animValue.interpolate({ inputRange: [0, 1], outputRange: [fabSize, width] });
    const overlayHeight = animValue.interpolate({ inputRange: [0, 1], outputRange: [fabSize, screenHeight] });
    const overlayRadius = animValue.interpolate({ inputRange: [0, 1], outputRange: [fabRadius, 0] });
    const overlayBorderColor = animValue.interpolate({ inputRange: [0, 1], outputRange: ["rgba(167,139,250,0.22)", "rgba(19,19,19,1)"] });
    const overlayBorderWidth = animValue.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
    
    const contentOpacity = animValue.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] });
    const contentTranslateY = animValue.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
    const iconOpacity = animValue.interpolate({ inputRange: [0, 0.3, 1], outputRange: [1, 0, 0] });

    if (!isRendered) {
        return null;
    }

    return (
        <Animated.View
            pointerEvents={isAdvisorOpen ? "auto" : "none"}
            style={[
                styles.overlayWrapper,
                {
                    bottom: overlayBottom,
                    right: overlayRight,
                    width: overlayWidth,
                    height: overlayHeight,
                    borderRadius: overlayRadius,
                    borderColor: overlayBorderColor,
                    borderWidth: overlayBorderWidth,
                },
            ]}
        >
            {/* The shrinking FAB icon */}
            <Animated.View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", opacity: iconOpacity }]} pointerEvents="none">
                <MaterialIcons name="auto-awesome" size={25} color="#a78bfa" />
            </Animated.View>

            <Animated.View style={{ flex: 1, opacity: contentOpacity, transform: [{ translateY: contentTranslateY }] }} pointerEvents={isAdvisorOpen ? "auto" : "none"}>
                <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
                    <StatusBar barStyle="light-content" backgroundColor="#131313" />
            <KeyboardAvoidingView
                style={styles.screen}
                behavior="padding"
            >
                {/* Top bar */}
                <View style={styles.topBar}>
                    <Pressable
                        style={({ pressed }) => [styles.topBarButton, pressed ? (styles as any).pressed : null]}
                        onPress={() => closeAdvisor()}
                        accessibilityRole="button"
                        accessibilityLabel="Close advisor"
                    >
                        <MaterialIcons name="support-agent" size={22} color="#e5e2e1" />
                        <Text style={styles.topBarTitle}>AI ADVISOR</Text>
                    </Pressable>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
                        <Pressable
                            style={({ pressed }) => [
                                (styles as any).newChatButton,
                                pressed ? { opacity: 0.7 } : null
                            ]}
                            onPress={() => {
                                setThreads([]);
                                setQ("");
                            }}
                            accessibilityRole="button"
                            accessibilityLabel="New chat"
                        >
                            <MaterialIcons name="refresh" size={16} color="#a78bfa" />
                            <Text style={(styles as any).newChatText}>Reset</Text>
                        </Pressable>
                        <Pressable
                            style={({ pressed }) => [styles.closeButton, pressed ? { opacity: 0.7 } : null]}
                            onPress={() => closeAdvisor()}
                            accessibilityRole="button"
                            accessibilityLabel="Close advisor"
                        >
                            <MaterialIcons name="close" size={24} color="#e5e2e1" />
                        </Pressable>
                    </View>
                </View>

                <ScrollView
                    ref={scrollRef}
                    style={styles.scroll}
                    contentContainerStyle={[styles.scrollContent, { width: contentWidth }]}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Empty state */}
                    {!threads.length ? (
                        <View style={styles.emptyWrap}>
                            <View style={styles.emptyCard}>
                                <View style={styles.emptyTitleRow}>
                                    <Text style={styles.emptyTitle}>Analysis Ready</Text>
                                    {suggestionsLoading && (
                                        <View style={styles.aiLiveBadge}>
                                            <OrbitingLoader color="#a78bfa" />
                                            <Text style={styles.aiLiveText}>AI</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.emptyBody}>
                                    {suggestionsLoading
                                        ? "Personalizing suggestions based on your finances…"
                                        : suggestions.length > 0
                                            ? "Here's what might be worth exploring today:"
                                            : "Ask about a purchase, a goal deadline, cash runway, or what should move first."}
                                </Text>
                                <View style={styles.quickPromptWrap}>
                                    {suggestionsLoading ? (
                                        // Skeleton placeholders
                                        [0, 1, 2].map((i) => (
                                            <View key={i} style={[styles.quickPrompt, styles.quickPromptSkeleton]}>
                                                <View style={[styles.skeletonLine, { width: i === 0 ? "80%" : i === 1 ? "65%" : "72%" }]} />
                                            </View>
                                        ))
                                    ) : (
                                        suggestions.map((prompt) => (
                                            <Pressable
                                                key={prompt}
                                                style={({ pressed }) => [
                                                    styles.quickPrompt,
                                                    pressed ? styles.pressed : null,
                                                ]}
                                                onPress={() => setQ(prompt)}
                                            >
                                                <MaterialIcons name="auto-awesome" size={13} color="#a78bfa" style={{ marginRight: 6 }} />
                                                <Text style={styles.quickPromptText}>{prompt}</Text>
                                            </Pressable>
                                        ))
                                    )}
                                </View>
                            </View>
                        </View>
                    ) : null}

                    {/* Chat turns */}
                    {threads.map((entry, index) => (
                        <View key={`${entry.question}-${index}`} style={styles.turn}>
                            <View style={styles.userRow}>
                                <View style={styles.userBubble}>
                                    <Markdown style={userMarkdownStyles}>{entry.question}</Markdown>
                                </View>
                            </View>

                            {entry.response ? (
                                <View style={styles.aiWrap}>
                                    <View style={styles.aiCard}>
                                        <Text style={styles.aiTitle}>Analysis Complete</Text>
                                        <Markdown style={markdownStyles}>{entry.response.narrative}</Markdown>
                                        {entry.response.artifacts.length ? (
                                            <ArtifactRenderer 
                                                artifacts={entry.response.artifacts} 
                                                onSubmitForm={(msg) => void send(msg)}
                                                onAction={(msg) => void send(msg)}
                                            />
                                        ) : null}
                                        {entry.runAt ? (
                                            <Text style={styles.lastRun}>
                                                Last run: {formatTimestamp(entry.runAt)}
                                            </Text>
                                        ) : null}
                                    </View>
                                </View>
                            ) : null}
                        </View>
                    ))}

                    {/* Live status panel (shown while loading, data from Redis poll) */}
                    {loading && liveStatus ? (
                        <LiveStatusPanel status={liveStatus} />
                    ) : loading ? (
                        <View style={styles.loadingRow}>
                            <OrbitingLoader color="#60a5fa" />
                            <Text style={styles.loadingText}>Advisor is working…</Text>
                        </View>
                    ) : null}
                </ScrollView>

                {/* Input dock */}
                <View style={styles.inputDock}>
                    <View style={styles.inputShell}>
                        <TextInput
                            value={q}
                            onChangeText={setQ}
                            placeholder="Ask the financial advisor..."
                            placeholderTextColor="#8e9192"
                            multiline
                            blurOnSubmit={false}
                            textAlignVertical="top"
                            onContentSizeChange={(event) => {
                                const nextHeight = Math.min(
                                    Math.max(56, Math.ceil(event.nativeEvent.contentSize.height)),
                                    200
                                );
                                setInputHeight(nextHeight);
                            }}
                            onSubmitEditing={() => void send()}
                            style={[styles.input, { height: inputHeight }]}
                        />
                        <Pressable
                            style={({ pressed }) => [
                                styles.sendButton,
                                pressed ? styles.sendPressed : null,
                                loading ? styles.sendDisabled : null,
                            ]}
                            onPress={() => void send()}
                            disabled={loading}
                            accessibilityRole="button"
                            accessibilityLabel="Send message"
                        >
                            {loading ? (
                                <OrbitingLoader color="#131313" />
                            ) : (
                                <MaterialIcons name="arrow-upward" size={22} color="#131313" />
                            )}
                        </Pressable>
                    </View>
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                </View>
            </KeyboardAvoidingView>
                </SafeAreaView>
            </Animated.View>
        </Animated.View>
    );
}

// ─── Live Status Styles ───────────────────────────────────────────────────────

const liveStyles = StyleSheet.create({
    panel: {
        marginBottom: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#2d2d2d",
        backgroundColor: "#1a1a1a",
        padding: 14,
        gap: 10,
    },
    headerRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    phaseText: {
        flex: 1,
        color: "#c4c7c8",
        fontSize: 13,
        lineHeight: 18,
        fontFamily: "Inter",
    },
    doneText: {
        color: "#34d399",
    },
    iterBadge: {
        borderRadius: 6,
        backgroundColor: "#252525",
        paddingHorizontal: 7,
        paddingVertical: 3,
    },
    iterText: {
        color: "#8e9192",
        fontSize: 10,
        fontFamily: "JetBrains Mono",
        letterSpacing: 0.5,
    },
    toolList: {
        gap: 7,
        marginTop: 2,
        paddingLeft: 4,
        borderLeftWidth: 1,
        borderLeftColor: "#2d2d2d",
        marginLeft: 3,
        paddingTop: 2,
    },
    toolRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
    },
    toolName: {
        flex: 1,
        color: "#8e9192",
        fontSize: 12,
        lineHeight: 16,
        fontFamily: "Inter",
    },
    rowCount: {
        color: "#34d399",
        fontSize: 11,
        fontFamily: "JetBrains Mono",
        letterSpacing: 0.3,
    },
});

// ─── Markdown & Screen Styles ─────────────────────────────────────────────────

const markdownStyles = {
    body: { color: "#c4c7c8", fontSize: 14, lineHeight: 20, fontFamily: "Inter" },
    strong: { color: "#e5e2e1" },
    paragraph: { marginTop: 0, marginBottom: 10 },
    bullet_list: { marginTop: 6, marginBottom: 8 },
    ordered_list: { marginTop: 6, marginBottom: 8 },
    list_item: { color: "#c4c7c8", marginBottom: 4 },
};

const userMarkdownStyles = {
    ...markdownStyles,
    body: { color: "#e5e2e1", fontSize: 14, lineHeight: 20, fontFamily: "Inter" },
    paragraph: { marginTop: 0, marginBottom: 0 },
};

const styles = StyleSheet.create({
    overlayWrapper: {
        position: "absolute",
        overflow: "hidden",
        backgroundColor: "#131313",
        zIndex: 100, // Above everything
        elevation: 100,
    },
    safeArea: { flex: 1, backgroundColor: "#131313" },
    screen: { flex: 1, backgroundColor: "#131313" },
    topBar: {
        height: 64,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: "#444748",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    topBarButton: { flexDirection: "row", alignItems: "center", gap: 10 },
    topBarTitle: {
        color: "#e5e2e1",
        fontSize: 12,
        lineHeight: 18,
        fontFamily: "JetBrains Mono",
        fontWeight: "700",
        letterSpacing: 2,
    },
    closeButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
    newChatButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: "rgba(167, 139, 250, 0.15)",
        borderWidth: 1,
        borderColor: "rgba(167, 139, 250, 0.3)",
    },
    newChatText: {
        color: "#a78bfa",
        fontSize: 12,
        fontFamily: "Inter",
        fontWeight: "600",
    },
    scroll: { flex: 1 },
    scrollContent: {
        alignSelf: "center",
        width: "100%",
        paddingHorizontal: 24,
        paddingTop: 28,
        paddingBottom: 24,
    },
    emptyWrap: { marginBottom: 24 },
    emptyCard: {
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#444748",
        backgroundColor: "#1c1b1b",
        padding: 18,
    },
    emptyTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    emptyTitle: {
        color: "#e5e2e1",
        fontSize: 24,
        lineHeight: 32,
        fontFamily: "Hanken Grotesk",
        fontWeight: "700",
        letterSpacing: -0.2,
    },
    aiLiveBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#4c3d72",
        backgroundColor: "#1e1530",
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    aiLiveText: {
        color: "#a78bfa",
        fontSize: 10,
        fontFamily: "JetBrains Mono",
        fontWeight: "700",
        letterSpacing: 1,
    },
    emptyBody: { marginTop: 8, color: "#c4c7c8", fontSize: 14, lineHeight: 20, fontFamily: "Inter" },
    quickPromptWrap: { marginTop: 16, gap: 10 },
    quickPrompt: {
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#444748",
        backgroundColor: "#2a2a2a",
        paddingVertical: 12,
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
    },
    quickPromptSkeleton: {
        opacity: 0.5,
    },
    skeletonLine: {
        height: 13,
        borderRadius: 6,
        backgroundColor: "#3a3a3a",
    },
    quickPromptText: { color: "#e5e2e1", fontSize: 13, lineHeight: 18, fontFamily: "Inter", flex: 1 },
    turn: { marginBottom: 24, gap: 16 },
    userRow: { alignItems: "flex-end" },
    userBubble: {
        maxWidth: "86%",
        borderRadius: 16,
        borderTopRightRadius: 4,
        borderWidth: 1,
        borderColor: "#444748",
        backgroundColor: "#1c1b1b",
        paddingHorizontal: 16,
        paddingVertical: 14,
        shadowColor: "#000000",
        shadowOpacity: 0.24,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
    },
    userText: { color: "#e5e2e1", fontSize: 14, lineHeight: 20, fontFamily: "Inter" },
    aiWrap: { alignItems: "center" },
    aiCard: { width: "100%", backgroundColor: "#131313", paddingVertical: 16 },
    aiTitle: {
        color: "#e5e2e1",
        fontSize: 18,
        lineHeight: 24,
        fontFamily: "Hanken Grotesk",
        fontWeight: "700",
        marginBottom: 10,
    },
    lastRun: {
        marginTop: 12,
        color: "#8e9192",
        fontSize: 10,
        lineHeight: 14,
        letterSpacing: 1,
        textTransform: "uppercase",
        fontFamily: "JetBrains Mono",
        fontWeight: "700",
    },
    loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
    loadingText: { color: "#c4c7c8", fontSize: 13, lineHeight: 18, fontFamily: "Inter" },
    inputDock: {
        backgroundColor: "#1c1b1b",
        borderTopWidth: 1,
        borderTopColor: "#444748",
        paddingTop: 16,
        paddingBottom: 16,
        paddingHorizontal: 24,
    },
    inputShell: {
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#444748",
        backgroundColor: "#0e0e0e",
        padding: 4,
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 8,
        shadowColor: "#000000",
        shadowOpacity: 0.32,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },
    input: {
        flex: 1,
        color: "#e5e2e1",
        fontSize: 14,
        lineHeight: 20,
        fontFamily: "Inter",
        paddingHorizontal: 14,
        paddingTop: 14,
        paddingBottom: 14,
        minHeight: 56,
        maxHeight: 200,
    },
    sendButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ffffff",
        marginBottom: 4,
    },
    sendPressed: { opacity: 0.9 },
    sendDisabled: { opacity: 0.72 },
    errorText: { marginTop: 10, color: "#ffb4ab", fontSize: 12, lineHeight: 18, fontFamily: "Inter" },
    pressed: { opacity: 0.85 },
});
