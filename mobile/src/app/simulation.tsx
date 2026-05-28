import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Skeleton } from "../components/LoadingSkeleton";
import { API_BASE_URL } from "../lib/apiBaseUrl";
import { formatCurrencyAmount, getCurrencySymbol, useCurrency } from "../providers/CurrencyProvider";

type ScenarioKey = "capacity-delta" | "spending-reduction" | "large-expense";

type WhatIfImpact = {
    goalId: string;
    goalTitle: string;
    oldETA?: { months: number | null; eta: string | null } | null;
    newETA?: { months: number | null; eta: string | null } | null;
    daysDelta: number;
    summary: string;
    allocationDelta?: number;
    allocationReason?: string;
};

type WhatIfScenario = {
    description: string;
    newMonthlyCapacity: number;
    impacts: WhatIfImpact[];
    allocationTradeoffs?: string[];
};

function apiUrl(path: string) {
    return `${API_BASE_URL}${path}`;
}

function formatCurrency(value: number) {
    return formatCurrencyAmount(value);
}

function formatAmountInput(value: string) {
    const digits = value.replace(/\D/g, "");
    if (!digits) return "";
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(digits));
}

function parseAmountInput(value: string) {
    const digits = value.replace(/\D/g, "");
    return digits ? Number(digits) : NaN;
}

function scenarioRequestBody(scenario: ScenarioKey, amount: number) {
    if (scenario === "capacity-delta") {
        return { scenario, amount };
    }
    if (scenario === "spending-reduction") {
        return { scenario, categoryName: "discretionary", amount };
    }
    return { scenario, expenseName: "purchase", amount };
}

async function fetchWhatIfScenario(scenario: ScenarioKey, amount: number) {
    const response = await fetch(apiUrl("/api/goals/what-if"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scenarioRequestBody(scenario, amount)),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.error) {
        throw new Error(payload?.error || "Failed to run simulation");
    }
    return payload.scenario as WhatIfScenario;
}

function scenarioLabel(scenario: ScenarioKey) {
    if (scenario === "capacity-delta") return "SAVINGS INCREASE";
    if (scenario === "spending-reduction") return "REDUCE SPENDING";
    return "LARGE PURCHASE";
}

function scenarioIcon(scenario: ScenarioKey) {
    if (scenario === "capacity-delta") return "trending-up";
    if (scenario === "spending-reduction") return "arrow-downward";
    return "shopping-bag";
}

function summaryParts(summary: string) {
    return summary.split(" | ").map((part) => part.trim()).filter(Boolean);
}

export default function SimulationScreen() {
    useCurrency();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isWide = width >= 960;
    const currencySymbol = getCurrencySymbol();

    const [selectedScenario, setSelectedScenario] = useState<ScenarioKey>("capacity-delta");
    const [amountInput, setAmountInput] = useState("1,000");
    const [scenarioResult, setScenarioResult] = useState<WhatIfScenario | null>(null);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const runSimulation = useCallback(async (scenario = selectedScenario, rawAmount = amountInput) => {
        const amount = parseAmountInput(rawAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            setError("Enter a valid amount.");
            setLoading(false);
            return;
        }

        setSubmitting(true);
        setError(null);
        try {
            const result = await fetchWhatIfScenario(scenario, amount);
            setScenarioResult(result);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : String(e));
        } finally {
            setSubmitting(false);
            setLoading(false);
        }
    }, [amountInput, selectedScenario]);

    const resultImpacts = useMemo(() => scenarioResult?.impacts ?? [], [scenarioResult]);

    return (
        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
            <StatusBar barStyle="light-content" backgroundColor="#131313" />
            <View style={styles.screen}>
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Pressable style={styles.iconButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
                            <MaterialIcons name="arrow-back" size={24} color="#e5e2e1" />
                        </Pressable>
                        <Text style={styles.headerTitle}>Simulation</Text>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <View style={styles.intro}>
                        <Text style={styles.pageTitle}>What-If Simulation</Text>
                    </View>

                    <View style={[styles.grid, isWide ? styles.gridWide : null]}>
                        <View style={[styles.leftColumn, isWide ? styles.leftColumnWide : null]}>
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Scenario</Text>
                                <View style={styles.scenarioList}>
                                    {(["capacity-delta", "spending-reduction", "large-expense"] as ScenarioKey[]).map((scenario) => {
                                        const active = selectedScenario === scenario;
                                        return (
                                            <Pressable
                                                key={scenario}
                                                style={({ pressed }) => [
                                                    styles.scenarioButton,
                                                    active ? styles.scenarioButtonActive : styles.scenarioButtonInactive,
                                                    pressed ? styles.pressed : null,
                                                ]}
                                                onPress={() => setSelectedScenario(scenario)}
                                            >
                                                <Text style={[styles.scenarioText, active ? styles.scenarioTextActive : styles.scenarioTextInactive]}>{scenarioLabel(scenario)}</Text>
                                                <MaterialIcons
                                                    name={scenarioIcon(scenario) as React.ComponentProps<typeof MaterialIcons>["name"]}
                                                    size={18}
                                                    color={active ? "#7dffa2" : "#8e9192"}
                                                />
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>

                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Parameters</Text>
                                <View style={styles.fieldGroup}>
                                    <Text style={styles.fieldLabel}>Enter amount (Monthly)</Text>
                                    <View style={styles.amountFieldWrap}>
                                        <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
                                        <TextInput
                                            value={amountInput}
                                            onChangeText={(value) => setAmountInput(formatAmountInput(value))}
                                            keyboardType="numeric"
                                            placeholder="0"
                                            placeholderTextColor="#8e9192"
                                            style={styles.amountField}
                                        />
                                    </View>
                                </View>
                                <Pressable
                                    style={({ pressed }) => [styles.runButton, pressed ? styles.runButtonPressed : null, submitting ? styles.runButtonDisabled : null]}
                                    onPress={() => void runSimulation()}
                                    disabled={submitting}
                                >
                                    {submitting ? <Skeleton width={104} height={16} radius={8} /> : <Text style={styles.runButtonText}>RUN SIMULATION</Text>}
                                </Pressable>
                            </View>
                        </View>

                        <View style={[styles.rightColumn, isWide ? styles.rightColumnWide : null]}>
                            <View style={[styles.card, styles.resultCard]}>
                                <View style={styles.resultHeader}>
                                    <Text style={styles.cardTitle}>Simulation Impact</Text>
                                    <Text style={styles.resultSubtext}>Live API data from your active goals</Text>
                                </View>

                                <View style={styles.resultBody}>
                                    {loading && !scenarioResult ? (
                                        <View style={styles.loadingState}>
                                            <Skeleton width={180} height={14} radius={7} />
                                            <Skeleton width={132} height={12} radius={6} />
                                        </View>
                                    ) : !scenarioResult ? (
                                        <Text style={styles.emptyState}>Set your inputs and press RUN SIMULATION to see the impact.</Text>
                                    ) : null}

                                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                                    {scenarioResult ? (
                                        <>
                                            <Text style={styles.resultDescription}>{scenarioResult.description}</Text>
                                            <View style={styles.metricCard}>
                                                <Text style={styles.metricLabel}>New monthly capacity</Text>
                                                <Text style={styles.metricValue}>{formatCurrency(scenarioResult.newMonthlyCapacity)}</Text>
                                            </View>

                                            <View style={styles.impactsBlock}>
                                                <Text style={styles.impactsTitle}>Impact on Active Goals</Text>
                                                <View style={styles.impactsList}>
                                                    {resultImpacts.map((impact) => {
                                                        const parts = summaryParts(impact.summary);
                                                        const fundingLine = parts[1] || "";
                                                        const fundingTone = fundingLine.toLowerCase().includes("decreases") ? styles.negativeText : styles.positiveText;
                                                        return (
                                                            <View key={impact.goalId} style={styles.impactRow}>
                                                                <View style={styles.goalIdentity}>
                                                                    <View style={styles.goalDot} />
                                                                    <Text style={styles.goalName}>{impact.goalTitle}</Text>
                                                                </View>
                                                                <View style={styles.impactMeta}>
                                                                    <Text style={styles.etaLabel}>{parts[0] || "No change in ETA"}</Text>
                                                                    <Text style={[styles.allocationLabel, fundingTone]}>
                                                                        {fundingLine}
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                        );
                                                    })}
                                                    {!resultImpacts.length ? <Text style={styles.emptyText}>No active goals were returned by the simulation.</Text> : null}
                                                </View>
                                            </View>
                                        </>
                                    ) : null}
                                </View>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}

const fs = (size: number) => Math.round(size * 0.9 * 10) / 10;

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
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
    headerTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(18), fontWeight: "700" },
    iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    content: { paddingHorizontal: 24, paddingVertical: 24, paddingBottom: 36, gap: 28 },
    intro: { gap: 8 },
    pageTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(24), lineHeight: 32, fontWeight: "700" },
    grid: { gap: 24 },
    gridWide: { flexDirection: "row", alignItems: "flex-start" },
    leftColumn: { gap: 24 },
    leftColumnWide: { flex: 0.42 },
    rightColumn: { gap: 24, paddingBottom: 100 },
    rightColumnWide: { flex: 0.58 },
    card: {
        backgroundColor: "rgba(32, 31, 31, 0.72)",
        borderWidth: 1,
        borderColor: "rgba(68, 71, 72, 0.32)",
        borderRadius: 16,
        padding: 24,
        gap: 18,
    },
    cardTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(18), lineHeight: 26, fontWeight: "600" },
    scenarioList: { gap: 12 },
    scenarioButton: {
        minHeight: 56,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
    },
    scenarioButtonActive: { backgroundColor: "#353534", borderColor: "#444748" },
    scenarioButtonInactive: { backgroundColor: "#131313", borderColor: "#444748" },
    scenarioText: { fontFamily: "Inter", fontSize: fs(15), lineHeight: 22 },
    scenarioTextActive: { color: "#7dffa2" },
    scenarioTextInactive: { color: "#c4c7c8" },
    fieldGroup: { gap: 10 },
    fieldLabel: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(14), lineHeight: 20 },
    amountFieldWrap: {
        minHeight: 60,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#444748",
        backgroundColor: "#1c1b1b",
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
    },
    currencyPrefix: { color: "#c4c7c8", fontFamily: "JetBrains Mono", fontSize: fs(15), marginRight: 6 },
    amountField: { flex: 1, color: "#ffffff", fontFamily: "JetBrains Mono", fontSize: fs(15), paddingVertical: 0 },
    runButton: {
        minHeight: 56,
        borderRadius: 12,
        backgroundColor: "#ffffff",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 2,
    },
    runButtonPressed: { opacity: 0.88 },
    runButtonDisabled: { opacity: 0.78 },
    runButtonText: { color: "#131313", fontFamily: "Inter", fontSize: fs(15), fontWeight: "700", letterSpacing: 0.2 },
    resultCard: { borderTopWidth: 2, borderTopColor: "#7dffa2", gap: 0 },
    resultHeader: { gap: 4, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: "#444748" },
    resultSubtext: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(12), lineHeight: 18 },
    resultBody: { gap: 20, paddingTop: 20 },
    loadingState: { flexDirection: "row", alignItems: "center", gap: 12 },
    loadingText: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(12) },
    errorText: { color: "#ffb4ab", fontFamily: "Inter", fontSize: fs(12), lineHeight: 18 },
    resultDescription: { color: "#e5e2e1", fontFamily: "Inter", fontSize: fs(15), lineHeight: 22 },
    metricCard: {
        backgroundColor: "#353534",
        borderWidth: 1,
        borderColor: "#444748",
        borderRadius: 12,
        padding: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
    },
    metricLabel: { color: "#e5e2e1", fontFamily: "Inter", fontSize: fs(14), lineHeight: 20 },
    metricValue: { color: "#7dffa2", fontFamily: "JetBrains Mono", fontSize: fs(20), lineHeight: 26, fontWeight: "500" },
    impactsBlock: { gap: 16 },
    impactsTitle: { color: "#ffffff", fontFamily: "Hanken Grotesk", fontSize: fs(16), lineHeight: 24, fontWeight: "600", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#444748" },
    impactsList: { gap: 12 },
    impactRow: {
        minHeight: 64,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "transparent",
        padding: 16,
        gap: 10,
        backgroundColor: "transparent",
    },
    goalIdentity: { flexDirection: "row", alignItems: "center", gap: 12 },
    goalDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#7dffa2" },
    goalName: { color: "#ffffff", fontFamily: "Inter", fontSize: fs(14), lineHeight: 20 },
    impactMeta: { gap: 4, paddingLeft: 20 },
    etaLabel: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(12), lineHeight: 18 },
    allocationLabel: { fontFamily: "JetBrains Mono", fontSize: fs(11), lineHeight: 16 },
    positiveText: { color: "#05e777" },
    negativeText: { color: "#ffb4ab" },
    neutralText: { color: "#c4c7c8" },
    emptyText: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(12), lineHeight: 18 },
    emptyState: { color: "#c4c7c8", fontFamily: "Inter", fontSize: fs(12), lineHeight: 18 },
    pressed: { opacity: 0.9 },
});