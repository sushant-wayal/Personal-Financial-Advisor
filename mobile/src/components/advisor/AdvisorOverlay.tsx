/* eslint-disable react-hooks/refs, react-hooks/set-state-in-effect */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    Easing,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
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
import { ConfirmModal } from "../ConfirmModal";
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

const POLL_INTERVAL_MS = 450;

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
        queryMemories: "AI Memory",
        queryInsights: "Financial Insights",
        queryBudgets: "Category Budgets",
        addBudget: "Create Budget",
        updateBudget: "Update Budget",
        deleteBudget: "Delete Budget",
        addTransaction: "Add Transaction",
        updateTransaction: "Update Transaction",
        deleteTransaction: "Delete Transaction",
        addGoal: "Add Goal",
        updateGoal: "Update Goal",
        deleteGoal: "Delete Goal",
        updateFinancialProfile: "Update Profile",
        addSubscription: "Add Subscription",
        updateSubscription: "Update Subscription",
        deleteSubscription: "Delete Subscription",
        addCategorizationRule: "Add Rule",
        deleteCategorizationRule: "Delete Rule",
        getDatabaseSchema: "Database Schema",
        writeDatabaseRecord: "Database Record",
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
                                <Text style={liveStyles.rowCount}>{tc.rowCount} {tc.rowCount === 1 ? "row" : "rows"}</Text>
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
    const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const serverStatusReceivedRef = useRef(false);

    useEffect(() => {
        if (!active || !requestId) {
            const timeout = setTimeout(() => {
                setStatus(null);
            }, 300);
            if (timerRef.current) clearInterval(timerRef.current);
            if (progressTimerRef.current) clearInterval(progressTimerRef.current);
            serverStatusReceivedRef.current = false;
            return () => clearTimeout(timeout);
        }

        serverStatusReceivedRef.current = false;

        // Instant optimistic status so UI immediately renders the rich panel from t=0
        const initialStatus: NonNullable<LiveStatus> = {
            phase: "thinking",
            message: "Connecting & loading financial profile…",
            iteration: 0,
            toolCalls: [],
            updatedAt: Date.now(),
        };
        setStatus(initialStatus);

        let cancelled = false;
        let progressStep = 0;
        const progressSteps = [
            "Connecting & loading financial profile…",
            "Analyzing recent transactions & categories…",
            "Checking budget limits & active goals…",
            "Evaluating cashflow & financial profile…",
            "Synthesizing personalized advice…",
        ];

        // Fallback progress updater in case server is doing heavy DB queries before first status write
        progressTimerRef.current = setInterval(() => {
            if (cancelled || serverStatusReceivedRef.current) return;
            progressStep = Math.min(progressStep + 1, progressSteps.length - 1);
            setStatus((prev) => {
                if (serverStatusReceivedRef.current && prev) return prev;
                return {
                    phase: progressStep >= 4 ? "processing" : "thinking",
                    message: progressSteps[progressStep],
                    iteration: 0,
                    toolCalls: [],
                    updatedAt: Date.now(),
                };
            });
        }, 1600);

        async function poll() {
            if (cancelled) return;
            try {
                const res = await fetch(
                    apiUrl(`/api/ai/advisor/status?requestId=${encodeURIComponent(requestId!)}`),
                    {
                        headers: {
                            "Cache-Control": "no-cache",
                            "Pragma": "no-cache",
                        },
                    }
                );
                if (!res.ok || cancelled) return;
                const data = await res.json();
                if (data && data.type === "status") {
                    serverStatusReceivedRef.current = true;
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
            if (progressTimerRef.current) clearInterval(progressTimerRef.current);
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

    const [conversationId, setConversationId] = useState<string>(() => `chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    const [q, setQ] = useState("");
    const [threads, setThreads] = useState<ChatTurn[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [inputHeight, setInputHeight] = useState(56);
    const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

    // Past conversations history state
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historySearch, setHistorySearch] = useState("");
    const [debouncedHistorySearch, setDebouncedHistorySearch] = useState("");
    const [historyItems, setHistoryItems] = useState<any[]>([]);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyHasMore, setHistoryHasMore] = useState(false);
    const [historyTotal, setHistoryTotal] = useState(0);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedHistorySearch(historySearch.trim());
        }, 350);
        return () => clearTimeout(timer);
    }, [historySearch]);

    const fetchHistory = useCallback(async (q: string, targetPage: number, append = false) => {
        try {
            if (append) setHistoryLoadingMore(true);
            else setHistoryLoading(true);

            const params = new URLSearchParams();
            if (q) params.set("q", q);
            params.set("page", String(targetPage));
            params.set("limit", "10");

            const res = await fetch(apiUrl(`/api/ai/conversations?${params.toString()}`));
            const data = await res.json();
            if (data?.ok) {
                if (append) {
                    setHistoryItems((prev) => [...prev, ...data.conversations]);
                } else {
                    setHistoryItems(data.conversations);
                }
                setHistoryPage(data.pagination.page);
                setHistoryHasMore(data.pagination.hasMore);
                setHistoryTotal(data.pagination.total);
            }
        } catch (e) {
            console.error("[AdvisorOverlay] Error fetching conversation history:", e);
        } finally {
            setHistoryLoading(false);
            setHistoryLoadingMore(false);
        }
    }, []);

    useEffect(() => {
        if (historyOpen) {
            void fetchHistory(debouncedHistorySearch, 1, false);
        }
    }, [historyOpen, debouncedHistorySearch, fetchHistory]);

    const handleSelectHistoryConversation = useCallback((item: any) => {
        let restoredTurns: ChatTurn[] = [];
        try {
            const parsed = JSON.parse(item.value);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].question) {
                restoredTurns = parsed.map((t: any) => ({
                    question: String(t.question || ""),
                    response: {
                        narrative: String(t.response?.narrative || t.response || ""),
                        artifacts: Array.isArray(t.response?.artifacts) ? t.response.artifacts : [],
                    },
                    runAt: t.runAt || undefined,
                }));
            }
        } catch {
            // fallback
        }
        if (restoredTurns.length === 0) {
            restoredTurns = [
                {
                    question: item.name || "Past Conversation",
                    response: { narrative: item.value, artifacts: [] },
                },
            ];
        }

        setThreads(restoredTurns);
        setConversationId(item.key.replace(/^chat:/, ""));
        setQ("");
        setHistoryOpen(false);
    }, []);

    const deleteHistoryItem = useCallback(async (id: string) => {
        try {
            await fetch(apiUrl(`/api/ai/memory?id=${encodeURIComponent(id)}`), { method: "DELETE" });
            setHistoryItems((prev) => prev.filter((it) => it.id !== id));
            setHistoryTotal((prev) => Math.max(0, prev - 1));
        } catch (e) {
            console.error("[AdvisorOverlay] Error deleting conversation:", e);
        } finally {
            setConfirmDeleteId(null);
        }
    }, []);

    const contentWidth = useMemo(() => Math.min(width, 980), [width]);

    // Start polling whenever there's an activeRequestId and we're loading
    const liveStatus = useAdvisorStatusPoller(activeRequestId, loading);

    useEffect(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
    }, [threads, loading, liveStatus]);

    useEffect(() => {
        const sub = Keyboard.addListener(
            Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
            () => {
                scrollRef.current?.scrollToEnd({ animated: true });
            }
        );
        return () => sub.remove();
    }, []);

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
        setInputHeight(56);
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

            // Fire-and-forget memory write with LLM-evaluated metadata and turn history
            if (reply.narrative.trim()) {
                const nextThreads = [
                    ...threads,
                    {
                        question: user,
                        response: reply,
                        runAt: new Date().toISOString(),
                    },
                ];
                fetch(apiUrl("/api/ai/memory"), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        conversationId,
                        question: user,
                        response: reply,
                        value: JSON.stringify(nextThreads),
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
    }, [q, threads, conversationId]);

    // ── Dynamic AI suggestions (cached for 12 h) ──────────────────────────────
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(true);

    useEffect(() => {
        if (!isAdvisorOpen) return;

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
    }, [isAdvisorOpen]);

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
                keyboardVerticalOffset={Platform.OS === "ios" ? insets.bottom : 0}
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
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                        <Pressable
                            style={({ pressed }) => [
                                (styles as any).newChatButton,
                                pressed ? { opacity: 0.7 } : null
                            ]}
                            onPress={() => setHistoryOpen(true)}
                            accessibilityRole="button"
                            accessibilityLabel="Past conversations"
                        >
                            <MaterialIcons name="history" size={16} color="#a78bfa" />
                            <Text style={(styles as any).newChatText}>History</Text>
                        </Pressable>
                        <Pressable
                            style={({ pressed }) => [
                                (styles as any).newChatButton,
                                pressed ? { opacity: 0.7 } : null
                            ]}
                            onPress={() => {
                                setThreads([]);
                                setQ("");
                                setInputHeight(56);
                                setConversationId(`chat_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
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
                                        {!!entry.response.narrative && (
                                            <Markdown style={markdownStyles}>{entry.response.narrative}</Markdown>
                                        )}
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

                    {/* Live status panel (shown while loading, data from status poll) */}
                    {loading ? (
                        <LiveStatusPanel
                            status={
                                liveStatus ?? {
                                    phase: "thinking",
                                    message: "Connecting & loading financial profile…",
                                    iteration: 0,
                                    toolCalls: [],
                                }
                            }
                        />
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
                                setInputHeight((prev) => (prev !== nextHeight ? nextHeight : prev));
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

            {/* Past Conversations History Modal */}
            <Modal
                visible={historyOpen}
                animationType="slide"
                transparent
                onRequestClose={() => setHistoryOpen(false)}
            >
                <View style={styles.historyOverlay}>
                    <SafeAreaView style={styles.historyModalContent} edges={["top", "bottom"]}>
                        {/* Header */}
                        <View style={styles.historyHeader}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <MaterialIcons name="history" size={20} color="#a78bfa" />
                                <Text style={styles.historyTitle}>Past Conversations</Text>
                                {historyTotal > 0 && (
                                    <View style={styles.historyCountBadge}>
                                        <Text style={styles.historyCountText}>{historyTotal}</Text>
                                    </View>
                                )}
                            </View>
                            <Pressable
                                onPress={() => setHistoryOpen(false)}
                                style={({ pressed }) => [styles.historyCloseBtn, pressed ? { opacity: 0.7 } : null]}
                                accessibilityRole="button"
                                accessibilityLabel="Close history"
                            >
                                <MaterialIcons name="close" size={22} color="#e5e2e1" />
                            </Pressable>
                        </View>

                        {/* Search Input with Debouncing */}
                        <View style={styles.historySearchRow}>
                            <MaterialIcons name="search" size={18} color="#8e9192" />
                            <TextInput
                                value={historySearch}
                                onChangeText={setHistorySearch}
                                placeholder="Search all conversations…"
                                placeholderTextColor="#5f6368"
                                style={styles.historySearchInput}
                            />
                            {historySearch ? (
                                <Pressable onPress={() => setHistorySearch("")}>
                                    <MaterialIcons name="close" size={16} color="#8e9192" />
                                </Pressable>
                            ) : historyLoading ? (
                                <ActivityIndicator size="small" color="#a78bfa" />
                            ) : null}
                        </View>

                        {/* Lazy Loaded List */}
                        {historyLoading && historyItems.length === 0 ? (
                            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
                                <ActivityIndicator size="large" color="#a78bfa" />
                                <Text style={{ color: "#8e9192", fontFamily: "Inter", fontSize: 13 }}>
                                    Loading conversations…
                                </Text>
                            </View>
                        ) : (
                            <FlatList
                                data={historyItems}
                                keyExtractor={(item) => item.id}
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingBottom: 24, gap: 10 }}
                                onEndReached={() => {
                                    if (historyHasMore && !historyLoadingMore && !historyLoading) {
                                        void fetchHistory(debouncedHistorySearch, historyPage + 1, true);
                                    }
                                }}
                                onEndReachedThreshold={0.3}
                                ListEmptyComponent={
                                    <View style={{ paddingVertical: 48, alignItems: "center" }}>
                                        <Text style={{ color: "#5f6368", fontFamily: "Inter", fontSize: 13 }}>
                                            {debouncedHistorySearch
                                                ? `No conversations matching "${debouncedHistorySearch}"`
                                                : "No saved conversations found."}
                                        </Text>
                                    </View>
                                }
                                renderItem={({ item }) => {
                                    const displayName = item.name || "AI Conversation";
                                    const dateStr = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString(undefined, {
                                        month: "short",
                                        day: "numeric",
                                    }) : "";
                                    const isActive = item.key === `chat:${conversationId}` || item.key === conversationId;

                                    return (
                                        <Pressable
                                            onPress={() => handleSelectHistoryConversation(item)}
                                            style={({ pressed }) => [
                                                styles.historyCard,
                                                isActive ? styles.historyCardActive : null,
                                                pressed ? { opacity: 0.8 } : null,
                                            ]}
                                        >
                                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                                                    <MaterialIcons name="chat" size={15} color="#a78bfa" />
                                                    <Text style={styles.historyCardTitle} numberOfLines={1}>
                                                        {displayName}
                                                    </Text>
                                                </View>
                                                {dateStr ? (
                                                    <Text style={styles.historyDateText}>{dateStr}</Text>
                                                ) : null}
                                            </View>

                                            <Text style={styles.historyCardSnippet} numberOfLines={2}>
                                                {item.value ? (
                                                    item.value.startsWith("[{") ? "Saved conversation turns" : item.value
                                                ) : "No preview"}
                                            </Text>

                                            <View style={styles.historyCardFooter}>
                                                {item.expiresAt ? (
                                                    <View style={styles.historyExpiryBadge}>
                                                        <MaterialIcons name="schedule" size={11} color="#a1a1aa" />
                                                        <Text style={styles.historyExpiryText}>
                                                            {item.expiryLabel || "Expires"}
                                                        </Text>
                                                    </View>
                                                ) : (
                                                    <Text style={styles.historyExpiryText}>Permanent</Text>
                                                )}

                                                <Pressable
                                                    onPress={() => setConfirmDeleteId(item.id)}
                                                    hitSlop={8}
                                                    style={{ padding: 4 }}
                                                >
                                                    <MaterialIcons name="delete-outline" size={16} color="#ef4444" />
                                                </Pressable>
                                            </View>
                                        </Pressable>
                                    );
                                }}
                                ListFooterComponent={
                                    historyLoadingMore ? (
                                        <View style={{ paddingVertical: 12, alignItems: "center" }}>
                                            <ActivityIndicator size="small" color="#a78bfa" />
                                        </View>
                                    ) : null
                                }
                            />
                        )}
                    </SafeAreaView>
                </View>
            </Modal>

            <ConfirmModal
                visible={!!confirmDeleteId}
                title="Delete Conversation"
                description="Are you sure you want to delete this conversation from history?"
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={() => {
                    if (confirmDeleteId) void deleteHistoryItem(confirmDeleteId);
                }}
                onCancel={() => setConfirmDeleteId(null)}
            />
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
    // Past Conversations History Modal Styles
    historyOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.85)",
        justifyContent: "flex-end",
    },
    historyModalContent: {
        height: "85%",
        backgroundColor: "#171819",
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        borderColor: "#444748",
        padding: 16,
    },
    historyHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(68,71,72,0.3)",
    },
    historyTitle: {
        color: "#ffffff",
        fontFamily: "Hanken Grotesk",
        fontSize: 18,
        fontWeight: "700",
    },
    historyCountBadge: {
        backgroundColor: "rgba(167,139,250,0.15)",
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 8,
    },
    historyCountText: {
        color: "#a78bfa",
        fontFamily: "JetBrains Mono",
        fontSize: 11,
        fontWeight: "600",
    },
    historyCloseBtn: {
        padding: 4,
    },
    historySearchRow: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#0e0e0e",
        borderWidth: 1,
        borderColor: "rgba(68,71,72,0.4)",
        borderRadius: 12,
        paddingHorizontal: 12,
        height: 42,
        marginVertical: 12,
        gap: 8,
    },
    historySearchInput: {
        flex: 1,
        color: "#ffffff",
        fontFamily: "Inter",
        fontSize: 13,
    },
    historyCard: {
        backgroundColor: "#131313",
        borderWidth: 1,
        borderColor: "rgba(68,71,72,0.3)",
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        gap: 6,
    },
    historyCardActive: {
        borderColor: "rgba(167,139,250,0.6)",
        backgroundColor: "rgba(167,139,250,0.08)",
    },
    historyCardTitle: {
        color: "#ffffff",
        fontFamily: "Hanken Grotesk",
        fontSize: 14,
        fontWeight: "600",
        flex: 1,
    },
    historyCardSnippet: {
        color: "#8e9192",
        fontFamily: "Inter",
        fontSize: 12,
        lineHeight: 16,
    },
    historyCardFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 4,
    },
    historyExpiryBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: "rgba(255,255,255,0.06)",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    historyExpiryText: {
        color: "#a1a1aa",
        fontFamily: "Inter",
        fontSize: 10,
        fontWeight: "500",
    },
    historyDateText: {
        color: "#71717a",
        fontFamily: "Inter",
        fontSize: 10,
    },
});
