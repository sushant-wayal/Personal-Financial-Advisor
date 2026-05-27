"use client";

import React from "react";
import { AlertTriangle, ArrowRight, ChevronRight, CheckCircle2, Clock3, Gauge, Info, ListChecks, Minus, ShieldAlert, Sparkles, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
} from "@/types/advisor";

function toneStyles(tone?: string) {
    switch (tone) {
        case "critical":
            return "border-rose-500/30 bg-rose-500/10 text-rose-200";
        case "warning":
            return "border-amber-500/30 bg-amber-500/10 text-amber-100";
        case "success":
        case "positive":
            return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
        case "negative":
            return "border-rose-500/30 bg-rose-500/10 text-rose-100";
        case "info":
            return "border-sky-500/30 bg-sky-500/10 text-sky-100";
        default:
            return "border-border/70 bg-muted/40 text-foreground";
    }
}

function statusStyles(status?: string) {
    switch (status) {
        case "critical":
            return "text-rose-400";
        case "warning":
            return "text-amber-400";
        case "healthy":
        case "success":
            return "text-emerald-400";
        default:
            return "text-slate-300";
    }
}

function priorityStyles(priority?: string) {
    switch (priority) {
        case "critical":
            return "text-rose-400 bg-rose-500/10 border-rose-500/20";
        case "high":
            return "text-amber-400 bg-amber-500/10 border-amber-500/20";
        case "medium":
            return "text-sky-400 bg-sky-500/10 border-sky-500/20";
        case "low":
            return "text-slate-300 bg-slate-500/10 border-slate-500/20";
        default:
            return "text-slate-300 bg-slate-500/10 border-slate-500/20";
    }
}

function ArtifactShell({
    icon,
    title,
    subtitle,
    className,
    children,
}: {
    icon?: React.ReactNode;
    title: string;
    subtitle?: string;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <Card className={cn("border-border/60 bg-card/95 shadow-[0_18px_45px_rgba(6,9,20,0.18)]", className)}>
            <CardHeader className="border-b border-border/50 pb-4">
                <div className="flex items-start gap-3">
                    {icon ? (
                        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-muted/60 text-foreground">
                            {icon}
                        </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                        <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.28em] text-muted-foreground">{title}</CardTitle>
                        {subtitle ? <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div> : null}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-4">{children}</CardContent>
        </Card>
    );
}

function MetricBlock({ label, value, tone, note }: { label: string; value: string; tone?: string; note?: string }) {
    return (
        <div className={cn("rounded-xl border p-3", toneStyles(tone))}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{label}</div>
            <div className="mt-2 text-base font-semibold text-foreground">{value}</div>
            {note ? <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{note}</div> : null}
        </div>
    );
}

export function HealthCard({ title, status, summary, metrics, note }: AdvisorHealthCard) {
    return (
        <ArtifactShell title={title} subtitle={summary} icon={<Gauge className={cn("size-4", statusStyles(status))} />}>
            <div className="space-y-4">
                <div className={cn("inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]", statusStyles(status))}>
                    {status}
                </div>
                {metrics && metrics.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                        {metrics.map((metric) => (
                            <MetricBlock key={`${metric.label}-${metric.value}`} {...metric} />
                        ))}
                    </div>
                ) : null}
                {note ? <div className="text-sm leading-relaxed text-muted-foreground">{note}</div> : null}
            </div>
        </ArtifactShell>
    );
}

export function DualMetricCard({ left, right }: AdvisorDualMetric) {
    return (
        <ArtifactShell title="Key comparison" icon={<ChevronRight className="size-4 text-slate-300" />}>
            <div className="grid gap-3 sm:grid-cols-2">
                <MetricBlock {...left} />
                <MetricBlock {...right} />
            </div>
        </ArtifactShell>
    );
}

export function MetricsGrid({ title, metrics }: AdvisorMetricsGrid) {
    return (
        <ArtifactShell title={title || "Metrics"} icon={<ListChecks className="size-4 text-slate-300" />}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {metrics.map((metric) => (
                    <MetricBlock key={`${metric.label}-${metric.value}`} {...metric} />
                ))}
            </div>
        </ArtifactShell>
    );
}

export function RiskList({ title, items }: AdvisorRiskList) {
    return (
        <ArtifactShell title={title} icon={<ShieldAlert className="size-4 text-amber-300" />}>
            <div className="space-y-3">
                {items.map((item) => (
                    <div key={item.title} className={cn("rounded-xl border p-3", toneStyles(item.severity || "warning"))}>
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-current/20 bg-black/10 text-[10px] font-bold uppercase tracking-[0.2em]">
                                !
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                                <div className="text-sm font-semibold text-foreground">{item.title}</div>
                                <div className="text-sm leading-relaxed text-muted-foreground">{item.description}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </ArtifactShell>
    );
}

export function WarningCard({ title, content, severity }: AdvisorWarning) {
    return (
        <ArtifactShell title={title} icon={<AlertTriangle className={cn("size-4", severity === "critical" ? "text-rose-400" : "text-amber-400")} />}>
            <div className={cn("rounded-xl border p-4", toneStyles(severity || "warning"))}>
                <div className="text-sm leading-relaxed text-foreground">{content}</div>
            </div>
        </ArtifactShell>
    );
}

export function DirectiveCard({ title, content, priority }: AdvisorDirective) {
    return (
        <ArtifactShell title={title} icon={<ArrowRight className="size-4 text-sky-400" />}>
            <div className="space-y-3">
                {priority ? (
                    <div className={cn("inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]", priorityStyles(priority))}>
                        {priority} priority
                    </div>
                ) : null}
                <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4 text-sm leading-relaxed text-foreground">{content}</div>
            </div>
        </ArtifactShell>
    );
}

export function RecommendationCard({ title, content, reasoning, nextStep, tone }: AdvisorRecommendation) {
    return (
        <ArtifactShell title={title} icon={<Sparkles className={cn("size-4", tone === "success" || tone === "positive" ? "text-emerald-400" : "text-sky-400")} />}>
            <div className="space-y-3">
                <div className="rounded-xl border border-border/70 bg-muted/40 p-4 text-sm leading-relaxed text-foreground">
                    {content}
                </div>
                {reasoning ? <div className="text-sm leading-relaxed text-muted-foreground">{reasoning}</div> : null}
                {nextStep ? <div className="text-sm leading-relaxed text-muted-foreground"><span className="font-semibold text-foreground">Next step:</span> {nextStep}</div> : null}
            </div>
        </ArtifactShell>
    );
}

export function GoalCard({ title, status, progressPct, progressLabel, currentLabel, targetLabel, note }: AdvisorGoalCard) {
    const progress = Math.max(0, Math.min(100, progressPct ?? 0));

    return (
        <ArtifactShell title={title} icon={<Target className={cn("size-4", statusStyles(status || "neutral"))} />}>
            <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div className={cn("text-sm font-semibold", statusStyles(status || "neutral"))}>{status || "neutral"}</div>
                    {progressLabel ? <div className="text-sm text-muted-foreground">{progressLabel}</div> : null}
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                        className={cn(
                            "h-full rounded-full",
                            status === "critical" ? "bg-rose-400" : status === "warning" ? "bg-amber-400" : "bg-emerald-400"
                        )}
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                    {currentLabel ? <MetricBlock label="Current" value={currentLabel} /> : null}
                    {targetLabel ? <MetricBlock label="Target" value={targetLabel} /> : null}
                </div>
                {note ? <div className="text-sm leading-relaxed text-muted-foreground">{note}</div> : null}
            </div>
        </ArtifactShell>
    );
}

export function GoalTimeline({ title, items }: AdvisorGoalTimeline) {
    return (
        <ArtifactShell title={title} icon={<Clock3 className="size-4 text-slate-300" />}>
            <div className="space-y-3">
                {items.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="flex gap-3">
                        <div className="flex flex-col items-center">
                            <div className={cn("mt-1 h-3 w-3 rounded-full border-2 border-background", item.status === "critical" ? "bg-rose-400" : item.status === "warning" ? "bg-amber-400" : item.status === "success" ? "bg-emerald-400" : "bg-sky-400")} />
                            {index < items.length - 1 ? <div className="mt-2 h-full w-px flex-1 bg-border/60" /> : null}
                        </div>
                        <div className="min-w-0 flex-1 pb-2">
                            <div className="text-sm font-semibold text-foreground">{item.label}</div>
                            {item.date ? <div className="mt-0.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.date}</div> : null}
                            {item.note ? <div className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.note}</div> : null}
                        </div>
                    </div>
                ))}
            </div>
        </ArtifactShell>
    );
}

export function ComparisonTable({ title, columns, rows }: AdvisorComparisonTable) {
    return (
        <ArtifactShell title={title} icon={<Info className="size-4 text-sky-300" />}>
            <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2">
                    <thead>
                        <tr>
                            <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Item</th>
                            {columns.map((column) => (
                                <th key={column} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.label} className="rounded-xl border border-border/70 bg-muted/30">
                                <td className="rounded-l-xl px-3 py-3 text-sm font-semibold text-foreground">{row.label}</td>
                                {row.values.map((value, index) => (
                                    <td key={`${row.label}-${index}`} className={cn("px-3 py-3 text-sm text-muted-foreground", index === row.values.length - 1 ? "rounded-r-xl" : "")}>{value}</td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </ArtifactShell>
    );
}

export function PriorityCard({ title, priority, summary, reasons }: AdvisorPriorityCard) {
    return (
        <ArtifactShell title={title} icon={<AlertTriangle className={cn("size-4", priority === "critical" ? "text-rose-400" : priority === "high" ? "text-amber-400" : "text-slate-300")} />}>
            <div className="space-y-3">
                <div className={cn("inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]", priorityStyles(priority))}>
                    {priority}
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/40 p-4 text-sm leading-relaxed text-foreground">{summary}</div>
                {reasons && reasons.length > 0 ? (
                    <div className="space-y-2">
                        {reasons.map((reason) => (
                            <div key={reason} className="flex items-start gap-2 text-sm text-muted-foreground">
                                <CheckCircle2 className="mt-0.5 size-4 flex-none text-emerald-400" />
                                <span>{reason}</span>
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
        </ArtifactShell>
    );
}

export function DecisionSummaryCard({ title, decision, recommendation, tradeoffs, nextStep }: AdvisorDecisionSummary) {
    return (
        <ArtifactShell title={title} icon={<Target className="size-4 text-slate-300" />}>
            <div className="space-y-4">
                <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Decision</div>
                    <div className="mt-2 text-sm leading-relaxed text-foreground">{decision}</div>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/40 p-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Recommendation</div>
                    <div className="mt-2 text-sm leading-relaxed text-foreground">{recommendation}</div>
                </div>
                {tradeoffs && tradeoffs.length > 0 ? (
                    <div className="space-y-2">
                        {tradeoffs.map((tradeoff) => (
                            <div key={tradeoff} className="flex items-start gap-2 text-sm text-muted-foreground">
                                <Minus className="mt-1 size-4 flex-none text-slate-500" />
                                <span>{tradeoff}</span>
                            </div>
                        ))}
                    </div>
                ) : null}
                {nextStep ? <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-4 text-sm leading-relaxed text-foreground">{nextStep}</div> : null}
            </div>
        </ArtifactShell>
    );
}

export default function ArtifactRenderer({ artifacts }: { artifacts: AdvisorArtifact[] }) {
    return (
        <div className="space-y-3">
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
        </div>
    );
}