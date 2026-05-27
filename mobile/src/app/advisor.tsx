import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import Markdown from "react-native-markdown-display";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import ArtifactRenderer from "../components/advisor/ArtifactRenderer";
import { Skeleton } from "../components/LoadingSkeleton";
import type { AdvisorResponse } from "../types/advisor";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "https://personal-financial-advisor-os.vercel.app";

type ChatTurn = { question: string; response: AdvisorResponse | null; runAt?: string };

function apiUrl(path: string) {
    return `${API_BASE_URL}${path}`;
}

function fallbackAdvisorResponse(raw: string): AdvisorResponse {
    return { narrative: raw.trim() || "No response", artifacts: [] };
}

function formatTimestamp(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

export default function AdvisorScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const liveRef = useRef<ScrollView>(null);
    const inFlightRef = useRef(false);

    const [q, setQ] = useState("");
    const [threads, setThreads] = useState<ChatTurn[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [inputHeight, setInputHeight] = useState(56);

    const contentWidth = useMemo(() => Math.min(width, 980), [width]);

    useEffect(() => {
        if (liveRef.current) {
            liveRef.current.scrollToEnd({ animated: true });
        }
    }, [threads, loading]);

    const send = useCallback(async () => {
        if (!q.trim()) return;
        if (inFlightRef.current) return;

        inFlightRef.current = true;
        const user = q.trim();
        setError(null);
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
                body: JSON.stringify({ question: user, history }),
            });

            const contentType = res.headers.get("content-type") || "";
            let reply: AdvisorResponse;

            if (contentType.includes("application/json")) {
                const data = await res.json();
                reply = {
                    narrative: typeof data?.narrative === "string"
                        ? data.narrative
                        : typeof data?.text === "string"
                            ? data.text
                            : typeof data?.error === "string"
                                ? data.error
                                : JSON.stringify(data),
                    artifacts: Array.isArray(data?.artifacts) ? data.artifacts : [],
                };
            } else {
                const raw = await res.text();
                reply = fallbackAdvisorResponse(raw);
            }

            setThreads((prev) => {
                if (!prev.length) return prev;
                const next = [...prev];
                next[next.length - 1] = { ...next[next.length - 1], response: reply, runAt: new Date().toISOString() };
                return next;
            });

            if (reply.narrative.trim()) {
                try {
                    await fetch(apiUrl("/api/ai/memory"), {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ key: `chat:${Date.now()}`, value: reply.narrative.trim(), tags: ["chat", "advisor"] }),
                    });
                } catch {
                    // ignore memory write failures
                }
            }
        } catch (e: unknown) {
            setThreads((prev) => {
                if (!prev.length) return prev;
                const next = [...prev];
                next[next.length - 1] = {
                    ...next[next.length - 1],
                    response: { narrative: `Error: ${e instanceof Error ? e.message : String(e)}`, artifacts: [] },
                };
                return next;
            });
        } finally {
            setLoading(false);
            inFlightRef.current = false;
        }
    }, [q, threads]);

    const quickPrompts = useMemo(() => [
        "Can I afford a purchase right now?",
        "What should my priority be this month?",
        "How far am I from my target date?",
    ], []);

    return (
        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
            <StatusBar barStyle="light-content" backgroundColor="#131313" />
            <View style={styles.screen}>
                <View style={styles.topBar}>
                    <Pressable style={({ pressed }) => [styles.topBarButton, pressed ? styles.pressed : null]} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close advisor">
                        <MaterialIcons name="support-agent" size={22} color="#e5e2e1" />
                        <Text style={styles.topBarTitle}>AI ADVISOR</Text>
                    </Pressable>
                    <Pressable style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : null]} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close advisor">
                        <MaterialIcons name="close" size={24} color="#e5e2e1" />
                    </Pressable>
                </View>

                <ScrollView
                    ref={liveRef}
                    style={styles.scroll}
                    contentContainerStyle={[styles.scrollContent, { width: contentWidth }]}
                    showsVerticalScrollIndicator={false}
                >
                    {!threads.length ? (
                        <View style={styles.emptyWrap}>
                            <View style={styles.emptyCard}>
                                <Text style={styles.emptyTitle}>Analysis Ready</Text>
                                <Text style={styles.emptyBody}>Ask about a purchase, a goal deadline, cash runway, or what should move first.</Text>
                                <View style={styles.quickPromptWrap}>
                                    {quickPrompts.map((prompt) => (
                                        <Pressable key={prompt} style={({ pressed }) => [styles.quickPrompt, pressed ? styles.pressed : null]} onPress={() => setQ(prompt)}>
                                            <Text style={styles.quickPromptText}>{prompt}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>
                        </View>
                    ) : null}

                    {threads.map((entry, index) => (
                        <View key={`${entry.question}-${index}`} style={styles.turn}>
                            <View style={styles.userRow}>
                                <View style={styles.userBubble}>
                                    <Text style={styles.userText}>{entry.question}</Text>
                                </View>
                            </View>

                            {entry.response ? (
                                <View style={styles.aiWrap}>
                                    <View style={styles.aiCard}>
                                        <Text style={styles.aiTitle}>Analysis Complete</Text>
                                        <Markdown style={markdownStyles}>{entry.response.narrative}</Markdown>

                                        {entry.response.artifacts.length ? <ArtifactRenderer artifacts={entry.response.artifacts} /> : null}

                                        {entry.runAt ? <Text style={styles.lastRun}>Last run: {formatTimestamp(entry.runAt)}</Text> : null}
                                    </View>
                                </View>
                            ) : null}
                        </View>
                    ))}

                    {loading ? (
                        <View style={styles.loadingRow}>
                            <Skeleton width={180} height={14} radius={7} />
                        </View>
                    ) : null}
                </ScrollView>

                <View style={[styles.inputDock, { paddingBottom: insets.bottom - 30 }]}>
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
                                const nextHeight = Math.min(Math.max(56, Math.ceil(event.nativeEvent.contentSize.height)), 200);
                                setInputHeight(nextHeight);
                            }}
                            onSubmitEditing={() => void send()}
                            style={[styles.input, { height: inputHeight }]}
                        />
                        <Pressable style={({ pressed }) => [styles.sendButton, pressed ? styles.sendPressed : null, loading ? styles.sendDisabled : null]} onPress={() => void send()} disabled={loading} accessibilityRole="button" accessibilityLabel="Send message">
                            {loading ? <Skeleton width={22} height={22} radius={11} /> : <MaterialIcons name="arrow-upward" size={22} color="#131313" />}
                        </Pressable>
                    </View>
                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                </View>
            </View>
        </SafeAreaView>
    );
}

const markdownStyles = {
    body: {
        color: "#c4c7c8",
        fontSize: 14,
        lineHeight: 20,
        fontFamily: "Inter",
    },
    strong: {
        color: "#e5e2e1",
    },
    paragraph: {
        marginTop: 0,
        marginBottom: 10,
    },
    bullet_list: {
        marginTop: 6,
        marginBottom: 8,
    },
    ordered_list: {
        marginTop: 6,
        marginBottom: 8,
    },
    list_item: {
        color: "#c4c7c8",
        marginBottom: 4,
    },
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#131313",
    },
    screen: {
        flex: 1,
        backgroundColor: "#131313",
    },
    topBar: {
        height: 64,
        paddingHorizontal: 24,
        borderBottomWidth: 1,
        borderBottomColor: "#444748",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    topBarButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    topBarTitle: {
        color: "#e5e2e1",
        fontSize: 12,
        lineHeight: 18,
        fontFamily: "JetBrains Mono",
        fontWeight: "700",
        letterSpacing: 2,
    },
    closeButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        alignSelf: "center",
        width: "100%",
        paddingHorizontal: 24,
        paddingTop: 28,
        paddingBottom: 220,
    },
    emptyWrap: {
        marginBottom: 24,
    },
    emptyCard: {
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#444748",
        backgroundColor: "#1c1b1b",
        padding: 18,
    },
    emptyTitle: {
        color: "#e5e2e1",
        fontSize: 24,
        lineHeight: 32,
        fontFamily: "Hanken Grotesk",
        fontWeight: "700",
        letterSpacing: -0.2,
    },
    emptyBody: {
        marginTop: 8,
        color: "#c4c7c8",
        fontSize: 14,
        lineHeight: 20,
        fontFamily: "Inter",
    },
    quickPromptWrap: {
        marginTop: 16,
        gap: 10,
    },
    quickPrompt: {
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#444748",
        backgroundColor: "#2a2a2a",
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    quickPromptText: {
        color: "#e5e2e1",
        fontSize: 13,
        lineHeight: 18,
        fontFamily: "Inter",
    },
    turn: {
        marginBottom: 24,
        gap: 16,
    },
    userRow: {
        alignItems: "flex-end",
    },
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
    userText: {
        color: "#e5e2e1",
        fontSize: 14,
        lineHeight: 20,
        fontFamily: "Inter",
    },
    aiWrap: {
        alignItems: "center",
    },
    aiCard: {
        width: "100%",
        backgroundColor: "#131313",
        paddingVertical: 16,
    },
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
    loadingRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 8,
    },
    loadingText: {
        color: "#c4c7c8",
        fontSize: 13,
        lineHeight: 18,
        fontFamily: "Inter",
    },
    inputDock: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "#1c1b1b",
        borderTopWidth: 1,
        borderTopColor: "#444748",
        paddingTop: 16,
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
    sendPressed: {
        opacity: 0.9,
    },
    sendDisabled: {
        opacity: 0.72,
    },
    errorText: {
        marginTop: 10,
        color: "#ffb4ab",
        fontSize: 12,
        lineHeight: 18,
        fontFamily: "Inter",
    },
    pressed: {
        opacity: 0.85,
    },
});