import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

type SkeletonProps = {
    width?: number | string;
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
                <Skeleton width="56%" height={22} />
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

            <View style={styles.sectionCard}>
                <Skeleton width="40%" height={18} />
                <Skeleton width="88%" height={14} />
                <Skeleton width="100%" height={16} radius={8} />
                <Skeleton width="84%" height={16} radius={8} />
                <Skeleton width="68%" height={16} radius={8} />
            </View>

            <View style={styles.listCard}>
                <Skeleton width="36%" height={18} />
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
            <View style={styles.topRow}>
                <Skeleton width={140} height={20} />
                <Skeleton width={92} height={40} radius={20} />
            </View>

            <View style={styles.chipRow}>
                <Skeleton width={112} height={40} radius={20} />
                <Skeleton width={96} height={40} radius={20} />
                <Skeleton width={88} height={40} radius={20} />
            </View>

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
});
