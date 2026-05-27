import React from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { beginHorizontalScroll, endHorizontalScroll, updateHorizontalScroll } from "../../lib/horizontalScrollPriority";
import type {
    AdvisorArtifact,
    AdvisorComparisonTable,
    AdvisorDecisionSummary,
    AdvisorDirective,
    AdvisorDualMetric,
    AdvisorGoalCard,
    AdvisorGoalTimeline,
    AdvisorHealthCard,
    AdvisorMetricsGrid,
    AdvisorPriorityCard,
    AdvisorRecommendation,
    AdvisorRiskList,
    AdvisorWarning,
} from "../../types/advisor";

function toneStyles(tone?: string) {
    switch (tone) {
        case "critical":
            return styles.criticalTone;
        case "warning":
            return styles.warningTone;
        case "success":
        case "positive":
            return styles.successTone;
        case "negative":
            return styles.negativeTone;
        case "info":
            return styles.infoTone;
        default:
            return styles.neutralTone;
    }
}

function statusColor(status?: string) {
    switch (status) {
        case "critical":
            return "#ff5d67";
        case "warning":
            return "#f6c25f";
        case "healthy":
        case "success":
            return "#7dffa2";
        default:
            return "#c4c7c8";
    }
}

function priorityTone(priority?: string) {
    switch (priority) {
        case "critical":
            return styles.criticalTone;
        case "high":
            return styles.warningTone;
        case "medium":
            return styles.infoTone;
        case "low":
        default:
            return styles.neutralTone;
    }
}

function icon(name: React.ComponentProps<typeof MaterialIcons>["name"], color: string) {
    return <MaterialIcons name={name} size={16} color={color} />;
}

function ArtifactShell({ iconNode, title, subtitle, children }: { iconNode?: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <View style={styles.shell}>
            <View style={styles.shellHeader}>
                {iconNode ? <View style={styles.shellIconWrap}>{iconNode}</View> : null}
                <View style={styles.shellHeadingCopy}>
                    <Text style={styles.shellTitle}>{title}</Text>
                    {subtitle ? <Text style={styles.shellSubtitle}>{subtitle}</Text> : null}
                </View>
            </View>
            <View style={styles.shellBody}>{children}</View>
        </View>
    );
}

function MetricBlock({ label, value, tone, note }: { label: string; value: string; tone?: string; note?: string }) {
    return (
        <View style={[styles.metricBlock, toneStyles(tone)]}>
            <Text style={styles.metricLabel}>{label}</Text>
            <Text style={styles.metricValue}>{value}</Text>
            {note ? <Text style={styles.metricNote}>{note}</Text> : null}
        </View>
    );
}

export function HealthCard({ title, status, summary, metrics, note }: AdvisorHealthCard) {
    return (
        <ArtifactShell iconNode={icon("speed", statusColor(status))} title={title} subtitle={summary}>
            <View style={styles.stackGap}>
                <View style={[styles.statusPill, { borderColor: `${statusColor(status)}40`, backgroundColor: `${statusColor(status)}12` }]}>
                    <Text style={[styles.statusPillText, { color: statusColor(status) }]}>{status}</Text>
                </View>
                {metrics?.length ? (
                    <View style={styles.metricGrid}>
                        {metrics.map((metric) => (
                            <MetricBlock key={`${metric.label}-${metric.value}`} {...metric} />
                        ))}
                    </View>
                ) : null}
                {note ? <Text style={styles.bodyText}>{note}</Text> : null}
            </View>
        </ArtifactShell>
    );
}

export function DualMetricCard({ left, right }: AdvisorDualMetric) {
    return (
        <ArtifactShell iconNode={icon("compare-arrows", "#c4c7c8")} title="Key comparison">
            <View style={styles.metricGrid}>
                <MetricBlock {...left} />
                <MetricBlock {...right} />
            </View>
        </ArtifactShell>
    );
}

export function MetricsGrid({ title, metrics }: AdvisorMetricsGrid) {
    return (
        <ArtifactShell iconNode={icon("list", "#c4c7c8")} title={title || "Metrics"}>
            <View style={styles.metricGrid}>
                {metrics.map((metric) => (
                    <MetricBlock key={`${metric.label}-${metric.value}`} {...metric} />
                ))}
            </View>
        </ArtifactShell>
    );
}

export function RiskList({ title, items }: AdvisorRiskList) {
    return (
        <ArtifactShell iconNode={icon("security", "#f6c25f")} title={title}>
            <View style={styles.stackGap}>
                {items.map((item) => (
                    <View key={item.title} style={[styles.itemCard, toneStyles(item.severity || "warning")]}>
                        <View style={styles.rowGapSmall}>
                            <View style={styles.badgeDot}>
                                <Text style={styles.badgeDotText}>!</Text>
                            </View>
                            <View style={styles.flex1}>
                                <Text style={styles.itemTitle}>{item.title}</Text>
                                <Text style={styles.itemText}>{item.description}</Text>
                            </View>
                        </View>
                    </View>
                ))}
            </View>
        </ArtifactShell>
    );
}

export function WarningCard({ title, content, severity }: AdvisorWarning) {
    return (
        <ArtifactShell iconNode={icon("warning-amber", severity === "critical" ? "#ff5d67" : "#f6c25f")} title={title}>
            <View style={[styles.contentPanel, toneStyles(severity || "warning")]}>
                <Text style={styles.bodyText}>{content}</Text>
            </View>
        </ArtifactShell>
    );
}

export function DirectiveCard({ title, content, priority }: AdvisorDirective) {
    return (
        <ArtifactShell iconNode={icon("arrow-forward", "#5ec8ff")} title={title}>
            <View style={styles.stackGap}>
                {priority ? (
                    <View style={[styles.statusPill, priorityTone(priority)]}>
                        <Text style={styles.statusPillText}>{priority} priority</Text>
                    </View>
                ) : null}
                <View style={[styles.contentPanel, styles.bluePanel]}>
                    <Text style={styles.bodyText}>{content}</Text>
                </View>
            </View>
        </ArtifactShell>
    );
}

export function RecommendationCard({ title, content, reasoning, nextStep, tone }: AdvisorRecommendation) {
    return (
        <ArtifactShell iconNode={icon("auto-awesome", tone === "success" || tone === "positive" ? "#7dffa2" : "#5ec8ff")} title={title}>
            <View style={styles.stackGap}>
                <View style={styles.contentPanel}>
                    <Text style={styles.bodyText}>{content}</Text>
                </View>
                {reasoning ? <Text style={styles.subtleText}>{reasoning}</Text> : null}
                {nextStep ? <Text style={styles.subtleText}><Text style={styles.subtleStrong}>Next step:</Text> {nextStep}</Text> : null}
            </View>
        </ArtifactShell>
    );
}

export function GoalCard({ title, status, progressPct, progressLabel, currentLabel, targetLabel, note }: AdvisorGoalCard) {
    const progress = Math.max(0, Math.min(100, progressPct ?? 0));

    return (
        <ArtifactShell iconNode={icon("track-changes", statusColor(status || "neutral"))} title={title}>
            <View style={styles.stackGap}>
                <View style={styles.rowBetween}>
                    <Text style={[styles.statusLabel, { color: statusColor(status || "neutral") }]}>{status || "neutral"}</Text>
                    {progressLabel ? <Text style={styles.subtleText}>{progressLabel}</Text> : null}
                </View>
                <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: status === "critical" ? "#ff5d67" : status === "warning" ? "#f6c25f" : "#7dffa2" }]} />
                </View>
                <View style={styles.metricGrid}>
                    {currentLabel ? <MetricBlock label="Current" value={currentLabel} /> : null}
                    {targetLabel ? <MetricBlock label="Target" value={targetLabel} /> : null}
                </View>
                {note ? <Text style={styles.subtleText}>{note}</Text> : null}
            </View>
        </ArtifactShell>
    );
}

export function GoalTimeline({ title, items }: AdvisorGoalTimeline) {
    return (
        <ArtifactShell iconNode={icon("schedule", "#c4c7c8")} title={title}>
            <View style={styles.stackGap}>
                {items.map((item, index) => (
                    <View key={`${item.label}-${index}`} style={styles.timelineRow}>
                        <View style={styles.timelineRailWrap}>
                            <View style={[styles.timelineDot, { backgroundColor: item.status === "critical" ? "#ff5d67" : item.status === "warning" ? "#f6c25f" : item.status === "success" ? "#7dffa2" : "#5ec8ff" }]} />
                            {index < items.length - 1 ? <View style={styles.timelineRail} /> : null}
                        </View>
                        <View style={styles.flex1}>
                            <Text style={styles.itemTitle}>{item.label}</Text>
                            {item.date ? <Text style={styles.timelineDate}>{item.date}</Text> : null}
                            {item.note ? <Text style={styles.itemText}>{item.note}</Text> : null}
                        </View>
                    </View>
                ))}
            </View>
        </ArtifactShell>
    );
}

export function ComparisonTable({ title, columns, rows }: AdvisorComparisonTable) {
    return (
        <ArtifactShell iconNode={icon("info-outline", "#5ec8ff")} title={title}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                onTouchStart={beginHorizontalScroll}
                onTouchEnd={endHorizontalScroll}
                onTouchCancel={endHorizontalScroll}
                onScrollBeginDrag={beginHorizontalScroll}
                onScrollEndDrag={endHorizontalScroll}
                onMomentumScrollEnd={endHorizontalScroll}
                onScroll={(event) => updateHorizontalScroll(event.nativeEvent.contentOffset.x, event.nativeEvent.layoutMeasurement.width, event.nativeEvent.contentSize.width)}
                scrollEventThrottle={16}
            >
                <View style={styles.table}>
                    <View style={styles.tableHeaderRow}>
                        <Text style={[styles.tableHeaderCell, styles.tableLabelCell]}>Item</Text>
                        {columns.map((column) => (
                            <Text key={column} style={styles.tableHeaderCell}>{column}</Text>
                        ))}
                    </View>
                    {rows.map((row) => (
                        <View key={row.label} style={styles.tableRow}>
                            <Text style={[styles.tableCell, styles.tableLabelCell]}>{row.label}</Text>
                            {row.values.map((value, index) => (
                                <Text key={`${row.label}-${index}`} style={styles.tableCell}>{value}</Text>
                            ))}
                        </View>
                    ))}
                </View>
            </ScrollView>
        </ArtifactShell>
    );
}

export function PriorityCard({ title, priority, summary, reasons }: AdvisorPriorityCard) {
    return (
        <ArtifactShell iconNode={icon("warning-amber", priority === "critical" ? "#ff5d67" : priority === "high" ? "#f6c25f" : "#c4c7c8")} title={title}>
            <View style={styles.stackGap}>
                <View style={[styles.statusPill, priorityTone(priority)]}>
                    <Text style={styles.statusPillText}>{priority}</Text>
                </View>
                <View style={styles.contentPanel}>
                    <Text style={styles.bodyText}>{summary}</Text>
                </View>
                {reasons?.length ? (
                    <View style={styles.stackGapSmall}>
                        {reasons.map((reason) => (
                            <View key={reason} style={styles.rowGapSmall}>
                                <MaterialIcons name="check-circle" size={15} color="#7dffa2" />
                                <Text style={styles.subtleText}>{reason}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}
            </View>
        </ArtifactShell>
    );
}

export function DecisionSummaryCard({ title, decision, recommendation, tradeoffs, nextStep }: AdvisorDecisionSummary) {
    return (
        <ArtifactShell iconNode={icon("track-changes", "#c4c7c8")} title={title}>
            <View style={styles.stackGap}>
                <View style={styles.contentPanel}>
                    <Text style={styles.smallEyebrow}>Decision</Text>
                    <Text style={styles.bodyText}>{decision}</Text>
                </View>
                <View style={styles.contentPanel}>
                    <Text style={styles.smallEyebrow}>Recommendation</Text>
                    <Text style={styles.bodyText}>{recommendation}</Text>
                </View>
                {tradeoffs?.length ? (
                    <View style={styles.stackGapSmall}>
                        {tradeoffs.map((tradeoff) => (
                            <View key={tradeoff} style={styles.rowGapSmall}>
                                <MaterialIcons name="remove" size={15} color="#8e9192" />
                                <Text style={styles.subtleText}>{tradeoff}</Text>
                            </View>
                        ))}
                    </View>
                ) : null}
                {nextStep ? <View style={[styles.contentPanel, styles.bluePanel]}><Text style={styles.bodyText}>{nextStep}</Text></View> : null}
            </View>
        </ArtifactShell>
    );
}

export default function ArtifactRenderer({ artifacts }: { artifacts: AdvisorArtifact[] }) {
    return (
        <View style={styles.rendererStack}>
            {artifacts.map((artifact, index) => {
                const key = `${artifact.type}-${index}`;

                switch (artifact.type) {
                    case "healthCard":
                        return <HealthCard key={key} {...artifact} />;
                    case "dualMetric":
                        return <DualMetricCard key={key} {...artifact} />;
                    case "metricsGrid":
                        return <MetricsGrid key={key} {...artifact} />;
                    case "riskList":
                        return <RiskList key={key} {...artifact} />;
                    case "warning":
                        return <WarningCard key={key} {...artifact} />;
                    case "directive":
                        return <DirectiveCard key={key} {...artifact} />;
                    case "recommendation":
                        return <RecommendationCard key={key} {...artifact} />;
                    case "goalCard":
                        return <GoalCard key={key} {...artifact} />;
                    case "goalTimeline":
                        return <GoalTimeline key={key} {...artifact} />;
                    case "comparisonTable":
                        return <ComparisonTable key={key} {...artifact} />;
                    case "priorityCard":
                        return <PriorityCard key={key} {...artifact} />;
                    case "decisionSummary":
                        return <DecisionSummaryCard key={key} {...artifact} />;
                    default:
                        return null;
                }
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    rendererStack: {
        gap: 12,
    },
    shell: {
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#444748",
        backgroundColor: "#201f1f",
        overflow: "hidden",
    },
    shellHeader: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: "#444748",
    },
    shellIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "#444748",
        backgroundColor: "#2a2a2a",
        alignItems: "center",
        justifyContent: "center",
    },
    shellHeadingCopy: {
        flex: 1,
        minWidth: 0,
    },
    shellTitle: {
        color: "#e5e2e1",
        fontSize: 12,
        fontFamily: "JetBrains Mono",
        fontWeight: "700",
        letterSpacing: 2,
        textTransform: "uppercase",
    },
    shellSubtitle: {
        marginTop: 4,
        color: "#8e9192",
        fontSize: 13,
        lineHeight: 18,
        fontFamily: "Inter",
    },
    shellBody: {
        padding: 16,
    },
    stackGap: {
        gap: 12,
    },
    stackGapSmall: {
        gap: 8,
    },
    rowGapSmall: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
    },
    rowBetween: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
    },
    flex1: {
        flex: 1,
        minWidth: 0,
    },
    bodyText: {
        color: "#e5e2e1",
        fontSize: 14,
        lineHeight: 20,
        fontFamily: "Inter",
    },
    subtleText: {
        color: "#c4c7c8",
        fontSize: 13,
        lineHeight: 19,
        fontFamily: "Inter",
    },
    subtleStrong: {
        color: "#e5e2e1",
        fontWeight: "700",
    },
    smallEyebrow: {
        color: "#8e9192",
        fontSize: 10,
        lineHeight: 14,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        fontFamily: "JetBrains Mono",
        fontWeight: "700",
    },
    statusPill: {
        alignSelf: "flex-start",
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    statusPillText: {
        color: "#e5e2e1",
        fontSize: 11,
        lineHeight: 15,
        textTransform: "uppercase",
        letterSpacing: 1,
        fontFamily: "JetBrains Mono",
        fontWeight: "700",
    },
    statusLabel: {
        fontSize: 14,
        lineHeight: 20,
        fontFamily: "Inter",
        fontWeight: "700",
        textTransform: "uppercase",
        letterSpacing: 1.1,
    },
    metricGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },
    metricBlock: {
        flexBasis: "48%",
        flexGrow: 1,
        minWidth: 130,
        borderRadius: 14,
        borderWidth: 1,
        padding: 12,
        backgroundColor: "#2a2a2a",
    },
    metricLabel: {
        color: "#8e9192",
        fontSize: 10,
        lineHeight: 14,
        letterSpacing: 1,
        textTransform: "uppercase",
        fontFamily: "JetBrains Mono",
        fontWeight: "700",
    },
    metricValue: {
        color: "#e5e2e1",
        fontSize: 16,
        lineHeight: 22,
        fontFamily: "Hanken Grotesk",
        fontWeight: "700",
        marginTop: 6,
    },
    metricNote: {
        marginTop: 4,
        color: "#c4c7c8",
        fontSize: 12,
        lineHeight: 17,
        fontFamily: "Inter",
    },
    criticalTone: {
        borderColor: "#ff5d6740",
        backgroundColor: "#ff5d6714",
    },
    warningTone: {
        borderColor: "#f6c25f40",
        backgroundColor: "#f6c25f14",
    },
    successTone: {
        borderColor: "#7dffa240",
        backgroundColor: "#7dffa214",
    },
    negativeTone: {
        borderColor: "#ff5d6740",
        backgroundColor: "#ff5d6714",
    },
    infoTone: {
        borderColor: "#5ec8ff40",
        backgroundColor: "#5ec8ff14",
    },
    neutralTone: {
        borderColor: "#444748",
        backgroundColor: "#2a2a2a",
    },
    itemCard: {
        borderRadius: 14,
        borderWidth: 1,
        padding: 12,
        backgroundColor: "#2a2a2a",
    },
    badgeDot: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: "#444748",
        backgroundColor: "rgba(0,0,0,0.12)",
        alignItems: "center",
        justifyContent: "center",
    },
    badgeDotText: {
        color: "#e5e2e1",
        fontSize: 11,
        fontWeight: "700",
        lineHeight: 14,
    },
    itemTitle: {
        color: "#e5e2e1",
        fontSize: 14,
        lineHeight: 20,
        fontFamily: "Inter",
        fontWeight: "700",
    },
    itemText: {
        marginTop: 4,
        color: "#c4c7c8",
        fontSize: 13,
        lineHeight: 19,
        fontFamily: "Inter",
    },
    contentPanel: {
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#444748",
        backgroundColor: "#1a1a1a",
        padding: 12,
    },
    bluePanel: {
        borderColor: "#5ec8ff40",
        backgroundColor: "#5ec8ff14",
    },
    progressTrack: {
        height: 8,
        borderRadius: 999,
        backgroundColor: "#2a2a2a",
        overflow: "hidden",
    },
    progressFill: {
        height: "100%",
        borderRadius: 999,
    },
    timelineRow: {
        flexDirection: "row",
        gap: 12,
    },
    timelineRailWrap: {
        width: 16,
        alignItems: "center",
    },
    timelineDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 6,
    },
    timelineRail: {
        width: 1,
        flex: 1,
        marginTop: 8,
        backgroundColor: "#444748",
    },
    timelineDate: {
        marginTop: 4,
        color: "#8e9192",
        fontSize: 10,
        lineHeight: 14,
        letterSpacing: 1,
        textTransform: "uppercase",
        fontFamily: "JetBrains Mono",
        fontWeight: "700",
    },
    table: {
        minWidth: 340,
    },
    tableHeaderRow: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#444748",
        paddingBottom: 8,
        marginBottom: 8,
    },
    tableRow: {
        flexDirection: "row",
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#444748",
        backgroundColor: "#2a2a2a",
        marginBottom: 8,
    },
    tableHeaderCell: {
        flex: 1,
        color: "#8e9192",
        fontSize: 10,
        lineHeight: 14,
        letterSpacing: 1,
        textTransform: "uppercase",
        fontFamily: "JetBrains Mono",
        fontWeight: "700",
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    tableLabelCell: {
        flex: 1.1,
        color: "#e5e2e1",
        fontWeight: "700",
    },
    tableCell: {
        flex: 1,
        color: "#c4c7c8",
        fontSize: 13,
        lineHeight: 18,
        fontFamily: "Inter",
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
});