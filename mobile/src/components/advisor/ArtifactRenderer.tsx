import React, { useState } from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, View, TextInput, Pressable, Switch } from "react-native";
import Markdown from "react-native-markdown-display";
import { beginHorizontalScroll, endHorizontalScroll, updateHorizontalScroll } from "../../lib/horizontalScrollPriority";
import { formatIndianAmountInput, parseIndianAmountInput } from "../../providers/CurrencyProvider";
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
    AdvisorForm,
    AdvisorText,
    AdvisorActionConfirmation,
    AdvisorSuggestedAction,
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

function MetricBlock({ label, value, tone, note }: { label: string; value: string | number; tone?: string; note?: string }) {
    // Gemini sometimes returns numbers despite the schema saying string — stringify defensively
    const displayValue = value !== undefined && value !== null ? String(value) : "—";
    return (
        <View style={[styles.metricBlock, toneStyles(tone)]}>
            <Text style={styles.metricLabel}>{label || "—"}</Text>
            <Text style={styles.metricValue}>{displayValue}</Text>
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
    const safeMetrics = Array.isArray(metrics) ? metrics : [];
    return (
        <ArtifactShell iconNode={icon("list", "#c4c7c8")} title={title || "Metrics"}>
            <View style={styles.metricGrid}>
                {safeMetrics.map((metric, i) => (
                    <MetricBlock key={`${metric.label}-${i}`} {...metric} />
                ))}
            </View>
        </ArtifactShell>
    );
}

export function RiskList({ title, items }: AdvisorRiskList) {
    const safeItems = Array.isArray(items) ? items : [];
    return (
        <ArtifactShell iconNode={icon("security", "#f6c25f")} title={title}>
            <View style={styles.stackGap}>
                {safeItems.map((item, i) => (
                    <View key={`${item.title}-${i}`} style={[styles.itemCard, toneStyles(item.severity || "warning")]}>
                        <View style={styles.rowGapSmall}>
                            <View style={styles.badgeDot}>
                                <Text style={styles.badgeDotText}>!</Text>
                            </View>
                            <View style={styles.flex1}>
                                <Text style={styles.itemTitle}>{item.title || "—"}</Text>
                                <Text style={styles.itemText}>{item.description || "—"}</Text>
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
    const safeItems = Array.isArray(items) ? items : [];
    return (
        <ArtifactShell iconNode={icon("schedule", "#c4c7c8")} title={title}>
            <View style={styles.stackGap}>
                {safeItems.map((item, index) => (
                    <View key={`${item.label}-${index}`} style={styles.timelineRow}>
                        <View style={styles.timelineRailWrap}>
                            <View style={[styles.timelineDot, { backgroundColor: item.status === "critical" ? "#ff5d67" : item.status === "warning" ? "#f6c25f" : item.status === "success" ? "#7dffa2" : "#5ec8ff" }]} />
                            {index < safeItems.length - 1 ? <View style={styles.timelineRail} /> : null}
                        </View>
                        <View style={styles.flex1}>
                            <Text style={styles.itemTitle}>{item.label || "—"}</Text>
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
    // Normalise: guard against Gemini returning null/undefined for arrays
    const safeCols = Array.isArray(columns) ? columns : [];
    const safeRows = Array.isArray(rows) ? rows : [];

    // Use consistent column widths across the header and all rows so columns align with mathematical precision
    const itemColWidth = safeCols.length <= 2 ? 140 : 130;
    const dataColWidth = safeCols.length <= 2 ? 140 : 120;

    return (
        <ArtifactShell iconNode={icon("info-outline", "#5ec8ff")} title={title}>
            <View style={styles.stackGapSmall}>
                <ScrollView
                    horizontal
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator={true}
                    onTouchStart={beginHorizontalScroll}
                    onTouchEnd={endHorizontalScroll}
                    onTouchCancel={endHorizontalScroll}
                    onScrollBeginDrag={beginHorizontalScroll}
                    onScrollEndDrag={endHorizontalScroll}
                    onMomentumScrollEnd={endHorizontalScroll}
                    onScroll={(event) =>
                        updateHorizontalScroll(
                            event.nativeEvent.contentOffset.x,
                            event.nativeEvent.layoutMeasurement.width,
                            event.nativeEvent.contentSize.width
                        )
                    }
                    scrollEventThrottle={16}
                    contentContainerStyle={styles.tableScrollContent}
                >
                    <View style={styles.tableContainer}>
                        <View style={styles.tableHeaderRow}>
                            {/* "Item" is a fixed label column for row.label — data columns come from `columns` */}
                            <View style={[styles.tableCellWrap, { width: itemColWidth }]}>
                                <Text style={styles.tableHeaderCell} numberOfLines={2}>
                                    Item
                                </Text>
                            </View>
                            {safeCols.map((column, i) => (
                                <View key={`col-${i}`} style={[styles.tableCellWrap, { width: dataColWidth }]}>
                                    <Text style={styles.tableHeaderCell} numberOfLines={2}>
                                        {column}
                                    </Text>
                                </View>
                            ))}
                        </View>
                        {safeRows.map((row, rowIdx) => {
                            // Pad values with "—" if Gemini returned fewer than columns.length
                            const safeValues = Array.isArray(row.values) ? row.values : [];
                            const paddedValues = Array.from({ length: safeCols.length }, (_, i) =>
                                safeValues[i] !== undefined && safeValues[i] !== null && safeValues[i] !== ""
                                    ? String(safeValues[i])
                                    : "—"
                            );
                            const isLast = rowIdx === safeRows.length - 1;
                            return (
                                <View
                                    key={`row-${rowIdx}`}
                                    style={[
                                        styles.tableRow,
                                        rowIdx % 2 === 1 ? styles.tableRowAlt : null,
                                        isLast ? styles.tableRowLast : null,
                                    ]}
                                >
                                    <View style={[styles.tableCellWrap, { width: itemColWidth }]}>
                                        <Text style={[styles.tableCell, styles.tableLabelCell]}>
                                            {row.label || "—"}
                                        </Text>
                                    </View>
                                    {paddedValues.map((value, colIdx) => (
                                        <View
                                            key={`${rowIdx}-${colIdx}`}
                                            style={[styles.tableCellWrap, { width: dataColWidth }]}
                                        >
                                            <Text style={styles.tableCell}>{value}</Text>
                                        </View>
                                    ))}
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>
                {safeCols.length >= 3 ? (
                    <View style={styles.tableScrollHint}>
                        <MaterialIcons name="swap-horiz" size={14} color="#8e9192" />
                        <Text style={styles.tableScrollHintText}>Swipe horizontally to compare all columns</Text>
                    </View>
                ) : null}
            </View>
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

export function FormCard({ title, description, questions, submitLabel, onSubmitForm }: AdvisorForm & { onSubmitForm?: (msg: string) => void }) {
    const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = () => {
        if (!onSubmitForm || submitted) return;
        setSubmitted(true);
        
        const lines = [`I have filled out the form "${title}":`];
        questions.forEach(q => {
            const ans = answers[q.id];
            let ansStr = "(No answer)";
            if (q.type === 'boolean') {
                ansStr = ans ? "Yes" : "No";
            } else if (ans !== undefined && ans !== "") {
                ansStr = String(ans);
            }
            lines.push(`- **${q.label}**: ${ansStr}`);
        });
        
        onSubmitForm(lines.join("\n"));
    };

    return (
        <ArtifactShell iconNode={icon("list-alt", "#a78bfa")} title={title} subtitle={description}>
            <View style={styles.stackGap}>
                {questions.map(q => (
                    <View key={q.id} style={styles.formQuestionBlock}>
                        <Text style={styles.formQuestionLabel}>{q.label}</Text>
                        
                        {(q.type === 'text' || q.type === 'number') && (
                             <TextInput
                                style={styles.formInput}
                                placeholder={q.placeholder || 'Your answer...'}
                                placeholderTextColor="#8e9192"
                                value={q.type === 'number' ? formatIndianAmountInput(String(answers[q.id] || '')) : String(answers[q.id] || '')}
                                onChangeText={(text) => setAnswers(prev => ({...prev, [q.id]: q.type === 'number' ? parseIndianAmountInput(text) : text}))}
                                editable={!submitted}
                                keyboardType={q.type === 'number' ? 'numeric' : 'default'}
                             />
                        )}
                        
                        {q.type === 'boolean' && (
                             <View style={styles.formSwitchRow}>
                                <Text style={styles.formSwitchText}>{answers[q.id] ? "Yes" : "No"}</Text>
                                <Switch
                                    value={!!answers[q.id]}
                                    onValueChange={(val) => setAnswers(prev => ({...prev, [q.id]: val}))}
                                    disabled={submitted}
                                    trackColor={{ false: "#3a3a3a", true: "#a78bfa" }}
                                    thumbColor={"#e5e2e1"}
                                />
                             </View>
                        )}
                        
                        {q.type === 'select' && q.options && (
                             <View style={styles.formSelectGroup}>
                                 {q.options.map(opt => {
                                     const isSelected = answers[q.id] === opt;
                                     return (
                                         <Pressable
                                            key={opt}
                                            style={[styles.formSelectOption, isSelected && styles.formSelectOptionActive, submitted && !isSelected && { opacity: 0.5 }]}
                                            onPress={() => !submitted && setAnswers(prev => ({...prev, [q.id]: opt}))}
                                            disabled={submitted}
                                         >
                                             <Text style={[styles.formSelectOptionText, isSelected && styles.formSelectOptionTextActive]}>{opt}</Text>
                                         </Pressable>
                                     );
                                 })}
                             </View>
                        )}
                    </View>
                ))}
                
                {!submitted ? (
                    <Pressable style={({ pressed }) => [styles.formSubmitButton, pressed && { opacity: 0.8 }]} onPress={handleSubmit}>
                        <Text style={styles.formSubmitButtonText}>{submitLabel || 'Submit Answers'}</Text>
                    </Pressable>
                ) : (
                    <View style={styles.formSubmittedState}>
                        <MaterialIcons name="check-circle" size={18} color="#34d399" />
                        <Text style={styles.formSubmittedText}>Answers submitted</Text>
                    </View>
                )}
            </View>
        </ArtifactShell>
    );
}

const markdownStyles = {
    body: { color: "#c4c7c8", fontSize: 14, lineHeight: 20, fontFamily: "Inter" },
    strong: { color: "#e5e2e1" },
    paragraph: { marginTop: 0, marginBottom: 10 },
    bullet_list: { marginTop: 6, marginBottom: 8 },
    ordered_list: { marginTop: 6, marginBottom: 8 },
    list_item: { color: "#c4c7c8", marginBottom: 4 },
};

export function TextCard({ content }: AdvisorText) {
    return (
        <View style={styles.textArtifact}>
            <Markdown style={markdownStyles}>{content}</Markdown>
        </View>
    );
}

export function ActionConfirmationCard({ artifact, onAction }: { artifact: AdvisorActionConfirmation; onAction?: (text: string) => void }) {
    return (
        <ArtifactShell iconNode={icon("security", "#f6c25f")} title={artifact.title}>
            <View style={styles.stackGap}>
                <View style={styles.contentPanel}>
                    <Text style={styles.bodyText}>{artifact.message}</Text>
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                    <Pressable 
                        style={({ pressed }) => [styles.buttonPrimary, pressed && { opacity: 0.8 }]} 
                        onPress={() => onAction?.(artifact.actionCommand)}
                    >
                        <Text style={styles.buttonPrimaryText}>{artifact.actionLabel || "Confirm"}</Text>
                    </Pressable>
                    <Pressable 
                        style={({ pressed }) => [styles.buttonSecondary, pressed && { opacity: 0.8 }]} 
                        onPress={() => onAction?.("No, cancel the action.")}
                    >
                        <Text style={styles.buttonSecondaryText}>{artifact.cancelLabel || "Cancel"}</Text>
                    </Pressable>
                </View>
            </View>
        </ArtifactShell>
    );
}

export function SuggestedActionCard({ artifact, onAction }: { artifact: AdvisorSuggestedAction; onAction?: (text: string) => void }) {
    return (
        <ArtifactShell iconNode={icon("auto-awesome", "#5ec8ff")} title="Suggested Action">
            <View style={styles.stackGap}>
                <Text style={styles.bodyText}>{artifact.message}</Text>
                <Pressable 
                    style={({ pressed }) => [styles.buttonSuggested, pressed && { opacity: 0.8 }]} 
                    onPress={() => onAction?.(artifact.actionCommand)}
                >
                    <Text style={styles.buttonSuggestedText}>{artifact.label}</Text>
                    <MaterialIcons name="arrow-forward" size={16} color="#5ec8ff" />
                </Pressable>
            </View>
        </ArtifactShell>
    );
}

export default function ArtifactRenderer({ artifacts, onSubmitForm, onAction }: { artifacts: AdvisorArtifact[], onSubmitForm?: (msg: string) => void, onAction?: (msg: string) => void }) {
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
                    case "form":
                        return <FormCard key={key} {...artifact} onSubmitForm={onSubmitForm} />;
                    case "text":
                        return <TextCard key={key} {...artifact} />;
                    case "actionConfirmation":
                        return <ActionConfirmationCard key={key} artifact={artifact} onAction={onAction || onSubmitForm} />;
                    case "suggestedAction":
                        return <SuggestedActionCard key={key} artifact={artifact} onAction={onAction || onSubmitForm} />;
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
    textArtifact: {
        paddingHorizontal: 4,
        marginVertical: 4,
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
    tableScrollContent: {
        minWidth: "100%",
    },
    tableContainer: {
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#3a3a3a",
        backgroundColor: "#1c1b1b",
        overflow: "hidden",
    },
    tableHeaderRow: {
        flexDirection: "row",
        backgroundColor: "#262525",
        borderBottomWidth: 1,
        borderBottomColor: "#3a3a3a",
        paddingVertical: 10,
        paddingHorizontal: 2,
    },
    tableRow: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#2c2d2e",
        backgroundColor: "#1c1b1b",
        paddingVertical: 10,
        paddingHorizontal: 2,
    },
    tableRowAlt: {
        backgroundColor: "#222121",
    },
    tableRowLast: {
        borderBottomWidth: 0,
    },
    tableCellWrap: {
        paddingHorizontal: 10,
        justifyContent: "center",
    },
    tableHeaderCell: {
        color: "#8e9192",
        fontSize: 10,
        lineHeight: 14,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        fontFamily: "JetBrains Mono",
        fontWeight: "700",
    },
    tableLabelCell: {
        color: "#e5e2e1",
        fontWeight: "700",
    },
    tableCell: {
        color: "#c4c7c8",
        fontSize: 13,
        lineHeight: 18,
        fontFamily: "Inter",
    },
    tableScrollHint: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 4,
        marginTop: 2,
    },
    tableScrollHintText: {
        color: "#8e9192",
        fontSize: 11,
        fontFamily: "Inter",
    },
    formQuestionBlock: {
        marginBottom: 8,
    },
    formQuestionLabel: {
        color: "#e5e2e1",
        fontSize: 14,
        lineHeight: 20,
        fontFamily: "Inter",
        marginBottom: 8,
        fontWeight: "600",
    },
    formInput: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#444748",
        backgroundColor: "#131313",
        color: "#e5e2e1",
        fontSize: 14,
        lineHeight: 20,
        fontFamily: "Inter",
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    formSwitchRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
    },
    formSwitchText: {
        color: "#c4c7c8",
        fontSize: 14,
        fontFamily: "Inter",
        minWidth: 32,
    },
    formSelectGroup: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    formSelectOption: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "#444748",
        backgroundColor: "#1c1b1b",
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    formSelectOptionActive: {
        borderColor: "#a78bfa",
        backgroundColor: "#a78bfa22",
    },
    formSelectOptionText: {
        color: "#c4c7c8",
        fontSize: 13,
        fontFamily: "Inter",
    },
    formSelectOptionTextActive: {
        color: "#a78bfa",
        fontWeight: "700",
    },
    formSubmitButton: {
        borderRadius: 14,
        backgroundColor: "#e5e2e1",
        paddingVertical: 12,
        alignItems: "center",
        marginTop: 4,
    },
    formSubmitButtonText: {
        color: "#131313",
        fontSize: 14,
        fontFamily: "Hanken Grotesk",
        fontWeight: "700",
    },
    formSubmittedState: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "#34d39940",
        backgroundColor: "#34d39914",
        paddingVertical: 10,
        marginTop: 4,
    },
    formSubmittedText: {
        color: "#34d399",
        fontSize: 13,
        fontFamily: "Inter",
        fontWeight: "600",
    },
    buttonPrimary: {
        borderRadius: 12,
        backgroundColor: "#7dffa220",
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: "center",
        flex: 1,
    },
    buttonPrimaryText: {
        color: "#7dffa2",
        fontSize: 14,
        fontFamily: "Hanken Grotesk",
        fontWeight: "700",
    },
    buttonSecondary: {
        borderRadius: 12,
        backgroundColor: "#2a2a2a",
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: "center",
        flex: 1,
    },
    buttonSecondaryText: {
        color: "#8e9192",
        fontSize: 14,
        fontFamily: "Hanken Grotesk",
        fontWeight: "700",
    },
    buttonSuggested: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#5ec8ff40",
        backgroundColor: "#5ec8ff14",
        paddingVertical: 12,
        paddingHorizontal: 16,
        marginTop: 8,
    },
    buttonSuggestedText: {
        color: "#5ec8ff",
        fontSize: 14,
        fontFamily: "Hanken Grotesk",
        fontWeight: "700",
    },
});