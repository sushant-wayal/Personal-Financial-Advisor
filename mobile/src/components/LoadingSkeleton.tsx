/* eslint-disable react-hooks/refs */
import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, Text, type StyleProp, type ViewStyle, type DimensionValue } from "react-native";

type SkeletonProps = {
    width?: DimensionValue;
    height?: number;
    radius?: number;
    style?: StyleProp<ViewStyle>;
};

function usePulse() {
    const opacity = useRef(new Animated.Value(0.35)).current;

    useEffect(() => {
        const animation = Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 0.82,
                    duration: 850,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0.35,
                    duration: 850,
                    useNativeDriver: true,
                }),
            ])
        );

        animation.start();
        return () => animation.stop();
    }, [opacity]);

    return opacity;
}

export function Skeleton({ width = "100%", height = 16, radius = 12, style }: SkeletonProps) {
    const opacity = usePulse();

    return <Animated.View style={[styles.base, { width, height, borderRadius: radius, opacity }, style]} />;
}

export function DashboardSkeleton() {
    return (
        <View style={styles.screen}>
            <View style={styles.topRow}>
                <Skeleton width={128} height={18} />
                <Skeleton width={42} height={42} radius={21} />
            </View>

            <View style={styles.heroCard}>
                <Text style={styles.skeletonSectionEyebrow}>BALANCE</Text>
                <Skeleton width="82%" height={14} />
                <View style={styles.chartBlock}>
                    <Skeleton width="100%" height={110} radius={22} />
                </View>
            </View>

            <View style={styles.metricRow}>
                <Skeleton width="31%" height={86} radius={22} />
                <Skeleton width="31%" height={86} radius={22} />
                <Skeleton width="31%" height={86} radius={22} />
            </View>

            <BudgetWidgetSkeleton />

            <View style={styles.sectionCard}>
                <Text style={styles.skeletonSectionTitle}>Advisor Summary</Text>
                <Skeleton width="88%" height={14} />
                <Skeleton width="100%" height={16} radius={8} />
                <Skeleton width="84%" height={16} radius={8} />
                <Skeleton width="68%" height={16} radius={8} />
            </View>

            <View style={styles.listCard}>
                <Text style={styles.skeletonSectionTitle}>Category Analysis</Text>
                <View style={styles.listRow}>
                    <Skeleton width={56} height={56} radius={18} />
                    <View style={styles.listCopy}>
                        <Skeleton width="62%" height={16} />
                        <Skeleton width="44%" height={12} />
                    </View>
                </View>
                <View style={styles.listRow}>
                    <Skeleton width={56} height={56} radius={18} />
                    <View style={styles.listCopy}>
                        <Skeleton width="70%" height={16} />
                        <Skeleton width="48%" height={12} />
                    </View>
                </View>
            </View>
        </View>
    );
}

export function TransactionsSkeleton() {
    return (
        <View style={styles.screen}>
            <View style={styles.listStack}>
                {Array.from({ length: 5 }).map((_, index) => (
                    <View key={index} style={styles.transactionCard}>
                        <View style={styles.listRow}>
                            <Skeleton width={48} height={48} radius={16} />
                            <View style={styles.listCopy}>
                                <Skeleton width="54%" height={16} />
                                <Skeleton width="38%" height={12} />
                            </View>
                        </View>
                        <Skeleton width="100%" height={12} radius={6} />
                    </View>
                ))}
            </View>
        </View>
    );
}

export function SettingsSkeleton() {
    return (
        <View style={styles.screen}>
            <View style={styles.topRow}>
                <Skeleton width={118} height={20} />
                <Skeleton width={42} height={42} radius={21} />
            </View>

            <View style={styles.sectionCard}>
                <Skeleton width="34%" height={18} />
                <Skeleton width="64%" height={14} />
                <Skeleton width="100%" height={48} radius={16} />
                <View style={styles.twoColumn}>
                    <Skeleton width="48%" height={48} radius={16} />
                    <Skeleton width="48%" height={48} radius={16} />
                </View>
                <View style={styles.twoColumn}>
                    <Skeleton width="48%" height={48} radius={16} />
                    <Skeleton width="48%" height={48} radius={16} />
                </View>
                <Skeleton width="100%" height={48} radius={16} />
                <Skeleton width="100%" height={88} radius={20} />
            </View>

            <View style={styles.sectionCard}>
                <Skeleton width="28%" height={18} />
                <Skeleton width="72%" height={14} />
                <Skeleton width="100%" height={52} radius={18} />
                <Skeleton width="100%" height={52} radius={18} />
            </View>
        </View>
    );
}

export function GoalsSkeleton() {
    return (
        <View style={styles.screen}>
            <View style={styles.topRow}>
                <Skeleton width={120} height={20} />
                <Skeleton width={44} height={44} radius={22} />
            </View>

            <View style={styles.metricRow}>
                <Skeleton width="31%" height={76} radius={22} />
                <Skeleton width="31%" height={76} radius={22} />
                <Skeleton width="31%" height={76} radius={22} />
            </View>

            <View style={styles.sectionCard}>
                <Skeleton width="42%" height={18} />
                <Skeleton width="100%" height={142} radius={24} />
            </View>

            <View style={styles.listStack}>
                {Array.from({ length: 3 }).map((_, index) => (
                    <View key={index} style={styles.transactionCard}>
                        <Skeleton width="56%" height={16} />
                        <Skeleton width="78%" height={12} />
                        <Skeleton width="100%" height={12} radius={6} />
                    </View>
                ))}
            </View>
        </View>
    );
}

export function InsightsSkeleton() {
    return (
        <View style={styles.screen}>
            <View style={styles.topRow}>
                <Skeleton width={116} height={20} />
                <Skeleton width={92} height={40} radius={20} />
            </View>

            <View style={styles.sectionCard}>
                <Skeleton width="34%" height={18} />
                <Skeleton width="100%" height={110} radius={24} />
            </View>

            <View style={styles.listStack}>
                {Array.from({ length: 4 }).map((_, index) => (
                    <View key={index} style={styles.transactionCard}>
                        <Skeleton width="48%" height={16} />
                        <Skeleton width="88%" height={12} />
                        <Skeleton width="72%" height={12} />
                    </View>
                ))}
            </View>
        </View>
    );
}

export function SubscriptionsSkeleton() {
    return (
        <View style={styles.screen}>
            <View style={styles.topRow}>
                <Skeleton width={140} height={20} />
                <Skeleton width={92} height={40} radius={20} />
            </View>

            <View style={styles.metricRow}>
                <Skeleton width="48%" height={78} radius={22} />
                <Skeleton width="48%" height={78} radius={22} />
            </View>

            <View style={styles.listStack}>
                {Array.from({ length: 4 }).map((_, index) => (
                    <View key={index} style={styles.sectionCard}>
                        <View style={styles.listRow}>
                            <View style={styles.listCopy}>
                                <Skeleton width="52%" height={16} />
                                <Skeleton width="38%" height={12} />
                            </View>
                            <Skeleton width={52} height={20} radius={10} />
                        </View>
                        <Skeleton width="84%" height={12} />
                        <View style={styles.buttonRow}>
                            <Skeleton width={92} height={40} radius={18} />
                            <Skeleton width={92} height={40} radius={18} />
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}

export function BudgetWidgetSkeleton() {
    return (
        <View style={styles.budgetWidgetSkeleton}>
            <View style={styles.budgetWidgetSkeletonHeader}>
                <Text style={styles.skeletonSectionTitle}>Budgets</Text>
                <Skeleton width={72} height={24} radius={12} />
            </View>
            <Skeleton width={130} height={12} radius={6} />
            <View style={{ gap: 10, marginTop: 4 }}>
                <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Skeleton width={72} height={14} radius={4} />
                        <Skeleton width={96} height={14} radius={4} />
                    </View>
                    <Skeleton width="100%" height={4} radius={2} />
                </View>
                <View style={{ gap: 6 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Skeleton width={84} height={14} radius={4} />
                        <Skeleton width={90} height={14} radius={4} />
                    </View>
                    <Skeleton width="100%" height={4} radius={2} />
                </View>
            </View>
        </View>
    );
}

export function BudgetsSkeleton() {
    return (
        <View style={styles.screen}>
            <View style={styles.topRow}>
                <Skeleton width={160} height={20} />
                <Skeleton width={70} height={32} radius={16} />
            </View>

            <View style={styles.listStack}>
                {Array.from({ length: 4 }).map((_, index) => (
                    <View key={index} style={styles.sectionCard}>
                        <View style={styles.listRow}>
                            <Skeleton width="45%" height={20} />
                            <Skeleton width="25%" height={16} />
                        </View>
                        <View style={styles.listRow}>
                            <Skeleton width="30%" height={26} />
                            <Skeleton width="25%" height={26} />
                        </View>
                        <Skeleton width="100%" height={8} radius={4} style={{ marginVertical: 12 }} />
                        <Skeleton width="35%" height={14} />
                    </View>
                ))}
            </View>
        </View>
    );
}

export function AdvisorSkeleton() {
    return (
        <View style={styles.screen}>
            <View style={styles.topRow}>
                <Skeleton width={108} height={20} />
                <Skeleton width={42} height={42} radius={21} />
            </View>

            <View style={styles.listStack}>
                <View style={styles.sectionCard}>
                    <Skeleton width="42%" height={14} />
                    <Skeleton width="86%" height={14} />
                    <Skeleton width="72%" height={14} />
                </View>
                <View style={[styles.sectionCard, styles.chatBubbleRight]}>
                    <Skeleton width="64%" height={14} />
                    <Skeleton width="48%" height={14} />
                </View>
                <View style={styles.sectionCard}>
                    <Skeleton width="88%" height={14} />
                    <Skeleton width="76%" height={14} />
                    <Skeleton width="40%" height={14} />
                </View>
            </View>

            <View style={styles.inputDock}>
                <View style={styles.inputShell}>
                    <Skeleton width="72%" height={20} radius={10} />
                    <Skeleton width={44} height={44} radius={22} />
                </View>
            </View>
        </View>
    );
}

export function SimulationSkeleton() {
    return (
        <View style={styles.screen}>
            <View style={styles.topRow}>
                <Skeleton width={138} height={20} />
                <Skeleton width={44} height={44} radius={22} />
            </View>

            <View style={styles.metricRow}>
                <View style={[styles.sectionCard, styles.formPanel]}>
                    <Skeleton width="48%" height={18} />
                    <Skeleton width="100%" height={48} radius={16} />
                    <Skeleton width="100%" height={48} radius={16} />
                    <Skeleton width="100%" height={48} radius={16} />
                    <Skeleton width="100%" height={48} radius={18} />
                </View>
                <View style={[styles.sectionCard, styles.resultPanel]}>
                    <Skeleton width="46%" height={18} />
                    <Skeleton width="68%" height={14} />
                    <Skeleton width="100%" height={104} radius={24} />
                    <Skeleton width="88%" height={14} />
                    <Skeleton width="72%" height={14} />
                </View>
            </View>
        </View>
    );
}

export function AppBootstrapSkeleton() {
    return (
        <View style={styles.bootstrapScreen}>
            <View style={styles.bootstrapTopRow}>
                <Skeleton width={132} height={18} />
                <Skeleton width={42} height={42} radius={21} />
            </View>

            <View style={styles.heroCard}>
                <Skeleton width="62%" height={18} />
                <Skeleton width="84%" height={14} />
            </View>

            <View style={styles.metricRow}>
                <Skeleton width="31%" height={80} radius={20} />
                <Skeleton width="31%" height={80} radius={20} />
                <Skeleton width="31%" height={80} radius={20} />
            </View>

            <View style={styles.navBar}>
                <Skeleton width={46} height={46} radius={23} />
                <Skeleton width={46} height={46} radius={23} />
                <Skeleton width={46} height={46} radius={23} />
                <Skeleton width={46} height={46} radius={23} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    base: {
        backgroundColor: "#202425",
    },
    budgetWidgetSkeleton: {
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.08)",
        backgroundColor: "#1c1b1b",
        borderRadius: 12,
        padding: 16,
        gap: 10,
    },
    budgetWidgetSkeletonHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    screen: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 28,
        gap: 16,
    },
    bootstrapScreen: {
        flex: 1,
        backgroundColor: "#131313",
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 24,
        gap: 18,
    },
    topRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
    },
    bootstrapTopRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
    },
    heroCard: {
        backgroundColor: "#171819",
        borderWidth: 1,
        borderColor: "#26282a",
        borderRadius: 28,
        padding: 18,
        gap: 12,
    },
    chartBlock: {
        marginTop: 8,
    },
    metricRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        gap: 12,
    },
    chipRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },
    sectionCard: {
        backgroundColor: "#171819",
        borderWidth: 1,
        borderColor: "#26282a",
        borderRadius: 24,
        padding: 18,
        gap: 12,
    },
    listCard: {
        backgroundColor: "#171819",
        borderWidth: 1,
        borderColor: "#26282a",
        borderRadius: 24,
        padding: 18,
        gap: 16,
    },
    listStack: {
        gap: 14,
    },
    transactionCard: {
        backgroundColor: "#171819",
        borderWidth: 1,
        borderColor: "#26282a",
        borderRadius: 22,
        padding: 16,
        gap: 12,
    },
    listRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    listCopy: {
        flex: 1,
        gap: 8,
    },
    twoColumn: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
    },
    buttonRow: {
        flexDirection: "row",
        gap: 12,
    },
    chatBubbleRight: {
        alignSelf: "flex-end",
        width: "88%",
    },
    inputDock: {
        marginTop: "auto",
        gap: 12,
    },
    inputShell: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: "#171819",
        borderWidth: 1,
        borderColor: "#26282a",
        borderRadius: 24,
        padding: 14,
    },
    formPanel: {
        flex: 1,
    },
    resultPanel: {
        flex: 1,
    },
    navBar: {
        marginTop: "auto",
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
        backgroundColor: "#171819",
        borderWidth: 1,
        borderColor: "#26282a",
        borderRadius: 28,
        padding: 14,
    },
    skeletonSectionTitle: {
        color: "#ffffff",
        fontSize: 20,
        lineHeight: 26,
        fontWeight: "700",
        letterSpacing: -0.4,
    },
    skeletonSectionEyebrow: {
        color: "#c4c7c8",
        fontSize: 11,
        letterSpacing: 3,
        fontWeight: "700",
    },
});

export function NetWorthSkeleton() {
    return (
        <View style={styles.screen}>
            {/* Header placeholder */}
            <View style={[styles.topRow, { marginBottom: 16 }]}>
                <Skeleton width={32} height={32} radius={16} />
                <Skeleton width={110} height={22} radius={8} />
                <View style={{ width: 32 }} />
            </View>

            {/* Summary Card placeholder */}
            <View style={styles.sectionCard}>
                <Skeleton width="30%" height={12} radius={6} />
                <Skeleton width="50%" height={32} radius={8} style={{ marginTop: 10 }} />
                
                <View style={{ flexDirection: "row", marginTop: 24, gap: 16 }}>
                    <View style={{ flex: 1 }}>
                        <Skeleton width="40%" height={12} radius={6} />
                        <Skeleton width="80%" height={18} radius={6} style={{ marginTop: 8 }} />
                    </View>
                    <View style={{ width: 1, backgroundColor: "rgba(255,255,255,0.1)" }} />
                    <View style={{ flex: 1 }}>
                        <Skeleton width="50%" height={12} radius={6} />
                        <Skeleton width="80%" height={18} radius={6} style={{ marginTop: 8 }} />
                    </View>
                </View>
            </View>

            {/* Assets Header placeholder */}
            <View style={[styles.topRow, { marginTop: 16, marginBottom: 12 }]}>
                <Skeleton width="25%" height={18} radius={6} />
                <Skeleton width={32} height={32} radius={16} />
            </View>

            {/* Asset Cards placeholder */}
            {[1, 2].map((i) => (
                <View key={`asset-${i}`} style={[styles.sectionCard, { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 18, marginBottom: 16 }]}>
                    <Skeleton width={44} height={44} radius={12} />
                    <View style={{ flex: 1, gap: 8 }}>
                        <Skeleton width="60%" height={14} radius={6} />
                        <Skeleton width="35%" height={12} radius={6} />
                    </View>
                    <Skeleton width="25%" height={16} radius={6} />
                </View>
            ))}
        </View>
    );
}

export function InvestmentsSkeleton() {
    return (
        <View style={styles.screen}>
            {/* Header Block */}
            <View style={{ gap: 8, marginBottom: 16 }}>
                <Skeleton width={160} height={12} radius={6} />
                <Skeleton width={220} height={28} radius={8} />
                <Skeleton width="88%" height={14} radius={6} />
            </View>

            {/* Hero Card Skeleton */}
            <View style={[styles.sectionCard, { gap: 16, marginBottom: 20 }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Skeleton width={140} height={18} radius={6} />
                    <Skeleton width={90} height={22} radius={11} />
                </View>
                <View style={{ gap: 6, marginVertical: 8 }}>
                    <Skeleton width={120} height={12} radius={6} />
                    <Skeleton width={180} height={32} radius={8} />
                </View>
                <Skeleton width="100%" height={8} radius={4} />
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Skeleton width={60} height={12} radius={4} />
                    <Skeleton width={60} height={12} radius={4} />
                    <Skeleton width={60} height={12} radius={4} />
                    <Skeleton width={60} height={12} radius={4} />
                </View>
            </View>

            {/* Sub-allocation Cards Skeleton */}
            <View style={[styles.sectionCard, { gap: 14 }]}>
                <Skeleton width={180} height={20} radius={6} />
                <Skeleton width="75%" height={14} radius={6} />
                {[1, 2, 3, 4].map((i) => (
                    <View key={`bucket-skel-${i}`} style={{ borderRadius: 12, borderWidth: 1, borderColor: "rgba(68,71,72,0.35)", padding: 14, gap: 10, backgroundColor: "#131313" }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Skeleton width={110} height={16} radius={6} />
                            <Skeleton width={36} height={14} radius={6} />
                        </View>
                        <Skeleton width="100%" height={48} radius={8} />
                    </View>
                ))}
            </View>
        </View>
    );
}

export function InvestmentHistorySkeleton() {
    return (
        <View style={styles.screen}>
            {/* Header Block */}
            <View style={{ gap: 8, marginBottom: 16 }}>
                <Skeleton width={140} height={12} radius={6} />
                <Skeleton width={200} height={28} radius={8} />
                <Skeleton width="85%" height={14} radius={6} />
            </View>

            {/* Stats Grid Skeleton */}
            <View style={{ flexDirection: "row", gap: 12, marginBottom: 20 }}>
                <View style={[styles.sectionCard, { flex: 1, gap: 8 }]}>
                    <Skeleton width="60%" height={10} radius={4} />
                    <Skeleton width="80%" height={24} radius={6} />
                    <Skeleton width="70%" height={12} radius={4} />
                </View>
                <View style={[styles.sectionCard, { flex: 1, gap: 8 }]}>
                    <Skeleton width="60%" height={10} radius={4} />
                    <Skeleton width="50%" height={24} radius={6} />
                    <Skeleton width="70%" height={12} radius={4} />
                </View>
            </View>

            {/* History Timeline Items */}
            <View style={[styles.sectionCard, { gap: 16 }]}>
                <Skeleton width={150} height={20} radius={6} />
                {[1, 2, 3].map((i) => (
                    <InvestmentHistoryCardSkeleton key={`hist-skel-${i}`} />
                ))}
            </View>
        </View>
    );
}

export function InvestmentHistoryCardSkeleton() {
    return (
        <View style={{ borderRadius: 12, borderWidth: 1, borderColor: "rgba(68,71,72,0.35)", padding: 16, gap: 12, backgroundColor: "#131313", marginTop: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Skeleton width={100} height={16} radius={6} />
                <Skeleton width={80} height={18} radius={9} />
            </View>
            <Skeleton width={140} height={26} radius={6} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Skeleton width="47%" height={38} radius={8} />
                <Skeleton width="47%" height={38} radius={8} />
                <Skeleton width="47%" height={38} radius={8} />
                <Skeleton width="47%" height={38} radius={8} />
            </View>
        </View>
    );
}
