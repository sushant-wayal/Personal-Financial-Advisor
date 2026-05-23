"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input as BaseInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GanttChart } from "@/app/components/GanttChart";
import { buildGanttData, buildTimelineInsight, computeTimelineDeltas, formatTimelineInsight, normalizeGoalForTimeline } from "@/src/services/GoalTimelineService";

type AIRecommendation = {
    text: string;
    rationale?: string;
    priority?: string;
};

type WhatIfImpact = {
    goalId: string;
    goalTitle: string;
    daysDelta: number;
    summary: string;
};

type Goal = {
    id: string;
    title: string;
    targetAmount: number;
    currentAmount: number;
    monthlyTarget?: number | null;
    priority: number;
    currency?: string | null;
    targetDate?: string | null;
    notes?: string | null;
    monthsLeft?: number | null;
    recommendedMonthly?: number | null;
    recommendedMonthlyContribution?: number | null;
    recommendedMonthlyContributionLabel?: string | null;
    eta?: { months: number; eta: string } | null;
    milestones?: Array<{ label: string; thresholdPct: number; achieved: boolean; amount: number; amountLabel: string }>;
    nextMilestone?: { label: string; thresholdPct: number; achieved: boolean; amount: number; amountLabel: string } | null;
    requiredMonthly?: number | null;
    requiredMonthlyLabel?: string | null;
    health?: string | null;
    confidenceScore?: number | null;
    recommendations?: string[] | null;
};

type AllocationPlan = {
    strategy: "priority-first" | "proportional" | "utility";
    allocations: Array<{
        goalId: string;
        goalTitle?: string;
        requested: number;
        allocated: number;
        shortfall: number;
        sharePct: number;
        utilityScore: number;
        urgencyScore: number;
        priorityScore: number;
        reason: string;
    }>;
    remainingCapacity: number;
    deployedCapacity: number;
    totalRequested: number;
    utilizationPct: number;
    summary: string;
    tradeoffs: string[];
};

type AllocationScenario = {
    strategy: "priority-first" | "proportional" | "utility";
    description: string;
    baseCapacity: number;
    newMonthlyCapacity: number;
    impacts: Array<{
        goalId: string;
        goalTitle: string;
        oldAllocated: number;
        newAllocated: number;
        allocatedDelta: number;
        oldSharePct: number;
        newSharePct: number;
        summary: string;
        reason: string;
    }>;
    tradeoffs: string[];
};

type GoalOverview = {
    goals: Goal[];
    conflicts: Array<{ type: string; severity: string; message: string; affectedGoalIds: string[] }>;
    totalRecommendedMonthlyContribution: number;
    totalRecommendedMonthlyContributionLabel: string;
    monthlyCapacity: number;
    monthlyCapacityLabel: string;
    allocation?: AllocationPlan;
    allocationStrategies?: Record<string, AllocationPlan>;
    allocationScenarios?: AllocationScenario[];
};

type LabeledInputProps = React.ComponentProps<typeof BaseInput> & {
    label?: string;
};

function Input({ label, id, className, ...props }: LabeledInputProps) {
    const fallbackId = React.useId();
    if (!label) {
        return <BaseInput id={id} className={className} {...props} />;
    }

    const safeId = id || `goal-${fallbackId}`;
    return (
        <div className="space-y-2">
            <Label htmlFor={safeId}>{label}</Label>
            <BaseInput id={safeId} className={className} {...props} />
        </div>
    );
}

async function fetchGoals(): Promise<Goal[]> {
    const res = await fetch("/api/goals");
    if (!res.ok) throw new Error("Failed to load goals");
    const data = await res.json();
    return data.goals || [];
}

async function fetchGoalOverview(): Promise<GoalOverview> {
    const res = await fetch("/api/goals/recommend");
    if (!res.ok) throw new Error("Failed to load goal overview");
    const data = await res.json();
    return {
        goals: data.goals || [],
        conflicts: data.conflicts || [],
        totalRecommendedMonthlyContribution: data.totalRecommendedMonthlyContribution || 0,
        totalRecommendedMonthlyContributionLabel: data.totalRecommendedMonthlyContributionLabel || "₹0",
        monthlyCapacity: data.monthlyCapacity || 0,
        monthlyCapacityLabel: data.monthlyCapacityLabel || "₹0",
    };
}

function formatCurrency(amount: number, currency = "INR") {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount || 0);
}

async function fetchAIRecommendations(force = false) {
    const url = "/api/goals/ai" + (force ? "?force=true" : "");
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load AI recommendations");
    return res.json();
}

async function fetchAIStatus() {
    const res = await fetch("/api/goals/ai/status");
    if (!res.ok) throw new Error("Failed to load AI status");
    return res.json();
}

async function fetchWhatIf(scenario: string, params: Record<string, any>) {
    const res = await fetch("/api/goals/what-if", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, ...params }),
    });
    if (!res.ok) throw new Error("Failed to simulate scenario");
    return res.json();
}

export default function GoalsManager() {
    const queryClient = useQueryClient();
    const { data: goals = [], isLoading } = useQuery({ queryKey: ["goals"], queryFn: fetchGoals });
    const { data: goalOverview } = useQuery({ queryKey: ["goalOverview"], queryFn: fetchGoalOverview });
    const [aiRecommendations, setAiRecommendations] = useState<any | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiLastRun, setAiLastRun] = useState<string | null>(null);

    // On mount check last-run; auto-refresh only if older than 24h
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const status = await fetchAIStatus();
                if (!mounted) return;
                const last = status.lastRun ? new Date(status.lastRun) : null;
                setAiLastRun(last ? last.toISOString() : null);
                if (status.recommendations) {
                    setAiRecommendations(status.recommendations);
                }
                if (!last) return; // no prior run; do not auto-run unless user triggers
                const ageMs = Date.now() - last.getTime();
                if (ageMs > 24 * 60 * 60 * 1000) {
                    setAiLoading(true);
                    const data = await fetchAIRecommendations(true);
                    if (!mounted) return;
                    setAiRecommendations(data);
                    setAiLastRun(new Date().toISOString());
                    setAiLoading(false);
                }
            } catch (e) {
                // ignore status errors silently
            } finally {
                if (mounted) setAiLoading(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    const [form, setForm] = useState({
        title: "",
        targetAmount: "",
        targetDate: "",
        priority: "3",
        notes: "",
    });

    const [editing, setEditing] = useState<Record<string, Partial<Goal>>>({});
    const [whatIfScenario, setWhatIfScenario] = useState<"none" | "capacity" | "spending" | "expense">("none");
    const [whatIfAmount, setWhatIfAmount] = useState<string>("");
    const [createGoalOpen, setCreateGoalOpen] = useState(false);
    const { data: whatIfResult, isPending: whatIfPending, mutate: runWhatIf } = useMutation({
        mutationFn: async () => {
            if (whatIfScenario === "capacity") {
                return fetchWhatIf("capacity-delta", { amount: Number(whatIfAmount) });
            } else if (whatIfScenario === "spending") {
                return fetchWhatIf("spending-reduction", { categoryName: "discretionary", amount: Number(whatIfAmount) });
            } else if (whatIfScenario === "expense") {
                return fetchWhatIf("large-expense", { expenseName: "purchase", amount: Number(whatIfAmount) });
            }
            throw new Error("Unknown scenario");
        },
    });

    function buildPatch(patch: Partial<Goal>) {
        const cleaned: Record<string, unknown> = {};
        Object.entries(patch).forEach(([key, value]) => {
            if (value === undefined) return;
            if (typeof value === "string" && value.trim() === "") return;
            cleaned[key] = value;
        });
        return cleaned;
    }

    const createMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                title: form.title.trim(),
                targetAmount: Number(form.targetAmount),
                targetDate: form.targetDate || undefined,
                priority: form.priority ? Number(form.priority) : undefined,
                notes: form.notes || undefined,
            };
            const res = await fetch("/api/goals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Failed to create goal");
            return res.json();
        },
        onSuccess: () => {
            setForm({ title: "", targetAmount: "", targetDate: "", priority: "3", notes: "" });
            setCreateGoalOpen(false);
            queryClient.invalidateQueries({ queryKey: ["goals"] });
            queryClient.invalidateQueries({ queryKey: ["goalOverview"] });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, patch }: { id: string; patch: Partial<Goal> }) => {
            const res = await fetch(`/api/goals/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patch),
            });
            if (!res.ok) throw new Error("Failed to update goal");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["goals"] });
            queryClient.invalidateQueries({ queryKey: ["goalOverview"] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/goals/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Failed to delete goal");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["goals"] });
            queryClient.invalidateQueries({ queryKey: ["goalOverview"] });
        },
    });

    const totalGoals = goals.length;
    const totalCurrentAmount = useMemo(() => goals.reduce((sum, goal) => sum + (goal.currentAmount || 0), 0), [goals]);
    const totalTargetAmount = useMemo(() => goals.reduce((sum, goal) => sum + (goal.targetAmount || 0), 0), [goals]);
    const fundingGap = Math.max(0, totalTargetAmount - totalCurrentAmount);

    const dashboardMetrics = [
        {
            label: "Goals tracked",
            value: String(totalGoals),
            detail: totalGoals > 0 ? `${goals.filter((goal) => goal.currentAmount >= goal.targetAmount).length} fully funded` : "Start with a goal",
            accent: "from-cyan-400/30 to-cyan-500/5",
        },
        {
            label: "Current saved",
            value: formatCurrency(totalCurrentAmount),
            detail: `Gap remaining ${formatCurrency(fundingGap)}`,
            accent: "from-emerald-400/30 to-emerald-500/5",
        },
        {
            label: "Monthly capacity",
            value: goalOverview?.monthlyCapacityLabel ?? "₹0",
            detail: goalOverview ? `${goalOverview.conflicts.length} conflict${goalOverview.conflicts.length === 1 ? "" : "s"} flagged` : "Loading recommendation",
            accent: "from-amber-400/30 to-amber-500/5",
        },
        {
            label: "Required monthly",
            value: goalOverview?.totalRecommendedMonthlyContributionLabel ?? "₹0",
            detail: goalOverview ? "Planned commitments across goals" : "Loading recommendation",
            accent: "from-violet-400/30 to-violet-500/5",
        },
    ];

    return (
        <div className="space-y-8">
            <Card className="overflow-hidden border-white/10 bg-slate-950/55 shadow-2xl shadow-black/10 backdrop-blur">
                <div className="border-b border-white/5 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
                    <div className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300/80">Goals dashboard</div>
                    <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="max-w-3xl">
                            <div className="text-2xl font-semibold text-white md:text-3xl">Plan, fund, and compare every goal from one control center.</div>
                            <div className="mt-2 text-sm text-slate-400">The most important items sit first: capacity, conflicts, allocation, and timeline risk. Editing and goal creation stay available, but secondary.</div>
                        </div>
                        <div className="flex flex-col items-stretch gap-3 md:items-end">
                            <Button onClick={() => setCreateGoalOpen(true)} variant="secondary" className="w-full rounded-lg md:w-auto md:self-end">
                                Add goal
                            </Button>
                            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
                                <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Funding gap</div>
                                <div className="mt-1 text-lg font-semibold text-white">{formatCurrency(fundingGap)}</div>
                                <div className="text-xs text-slate-400">Across {totalGoals} tracked goals</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {dashboardMetrics.map((metric) => (
                            <div key={metric.label} className={`rounded-2xl border border-white/10 bg-gradient-to-br ${metric.accent} p-4`}>
                                <div className="text-xs uppercase tracking-[0.28em] text-slate-400">{metric.label}</div>
                                <div className="mt-3 text-2xl font-semibold text-white">{metric.value}</div>
                                <div className="mt-2 text-xs text-slate-400">{metric.detail}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </Card>

            {goalOverview && goalOverview.conflicts.length > 0 && (
                <Card className="overflow-hidden border-amber-700/30 bg-amber-950/10 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div>
                            <div className="text-sm font-semibold text-amber-300">Goal conflicts</div>
                            <div className="text-xs text-slate-400">Monthly capacity: {goalOverview.monthlyCapacityLabel} • Required commitments: {goalOverview.totalRecommendedMonthlyContributionLabel}</div>
                        </div>
                        <div className="text-xs uppercase tracking-[0.25em] text-amber-300/80">Needs attention</div>
                    </div>
                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        {goalOverview.conflicts.map((conflict) => (
                            <div key={`${conflict.type}-${conflict.message}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="font-medium capitalize text-slate-100">{conflict.type} conflict</span>
                                    <span className="text-xs uppercase tracking-wide text-amber-300">{conflict.severity}</span>
                                </div>
                                <div className="mt-1 text-xs text-slate-300">{conflict.message}</div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            <div className="grid gap-4 xl:grid-cols-12">
                <div className="space-y-6 xl:col-span-8">
                    {goalOverview?.goals && goalOverview.goals.length > 0 && (() => {
                        const timelineGoals = goalOverview.goals.map((g) => normalizeGoalForTimeline(g));
                        const ganttData = buildGanttData(timelineGoals);
                        const deltas = computeTimelineDeltas(timelineGoals.slice(0, 1), timelineGoals);
                        const timelineInsight = buildTimelineInsight(timelineGoals, deltas);
                        const insightLines = formatTimelineInsight(timelineInsight);

                        return (
                            <>
                                <Card className="overflow-hidden border-teal-700/30 bg-teal-950/10 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                        <div>
                                            <div className="text-sm font-semibold text-teal-300">Timeline Overview</div>
                                            <div className="text-xs text-slate-400">Goal completion timeline and recent movements</div>
                                        </div>
                                        <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Primary view</div>
                                    </div>
                                    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
                                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                            <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Insight summary</div>
                                            <div className="mt-3 space-y-2 text-xs leading-5 text-slate-300">
                                                {insightLines.map((line, i) => (
                                                    <div key={i}>{line}</div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                                            <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Recent changes</div>
                                            {timelineInsight.deltas.length > 0 ? (
                                                <div className="mt-3 space-y-2">
                                                    {timelineInsight.deltas.slice(0, 3).map((delta) => (
                                                        <div key={delta.goalId} className="flex items-center justify-between gap-2 text-xs text-slate-300">
                                                            <span className="font-medium text-slate-100">{delta.goalTitle}</span>
                                                            <span className={delta.direction === "accelerating" ? "text-emerald-400" : delta.direction === "delayed" ? "text-rose-400" : "text-slate-400"}>
                                                                {delta.daysDelta > 0 ? `+${delta.daysDelta}d` : `${delta.daysDelta}d`}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="mt-3 text-xs text-slate-400">No timeline deltas yet.</div>
                                            )}
                                        </div>
                                    </div>
                                </Card>

                                <Card className="overflow-hidden border-cyan-700/30 bg-cyan-950/10 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                        <div>
                                            <div className="text-sm font-semibold text-cyan-300">Gantt Timeline</div>
                                            <div className="text-xs text-slate-400">Visual timeline of all goals and their progress</div>
                                        </div>
                                        <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Planning depth</div>
                                    </div>
                                    <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-3">
                                        <GanttChart data={ganttData} height={Math.max(240, ganttData.segments.length * 42 + 100)} showLegend />
                                    </div>
                                </Card>

                                {goalOverview?.allocation && goalOverview.allocationStrategies && (
                                    <Card className="overflow-hidden border-emerald-700/30 bg-emerald-950/10 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
                                        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                            <div>
                                                <div className="text-sm font-semibold text-emerald-300">Allocation engine</div>
                                                <div className="text-xs text-slate-400">Optimized monthly funding across competing goals</div>
                                            </div>
                                            <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Decision layer</div>
                                        </div>
                                        <div className="mt-4 text-xs text-slate-400">{goalOverview.allocation.summary}</div>
                                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                                            {[
                                                ["priorityFirst", "Priority-first"],
                                                ["proportional", "Proportional"],
                                                ["utility", "Utility-based"],
                                            ].map(([key, label]) => {
                                                const plan = goalOverview.allocationStrategies?.[key];
                                                if (!plan) return null;
                                                return (
                                                    <div key={key} className="rounded-xl border border-white/10 bg-black/20 p-3">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="text-sm font-medium text-slate-100">{label}</span>
                                                            <span className="text-xs text-slate-400">{plan.utilizationPct}% used</span>
                                                        </div>
                                                        <div className="mt-2 text-xs text-slate-300">{formatCurrency(plan.deployedCapacity)} deployed</div>
                                                        <div className="mt-1 text-xs text-slate-400">{plan.tradeoffs[0]}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {goalOverview.allocationScenarios?.length ? (
                                            <div className="mt-4 grid gap-3 md:grid-cols-3">
                                                {goalOverview.allocationScenarios.map((scenario) => (
                                                    <div key={`${scenario.strategy}-${scenario.description}`} className="rounded-xl border border-white/10 bg-black/20 p-3">
                                                        <div className="text-sm font-medium text-slate-100">{scenario.description}</div>
                                                        <div className="mt-1 text-xs text-slate-400">New capacity: {formatCurrency(scenario.newMonthlyCapacity)}</div>
                                                        <div className="mt-2 space-y-1">
                                                            {scenario.impacts.slice(0, 2).map((impact) => (
                                                                <div key={impact.goalId} className="flex items-center justify-between gap-2 text-xs text-slate-300">
                                                                    <span>{impact.goalTitle}</span>
                                                                    <span className={impact.allocatedDelta > 0 ? "text-emerald-400" : impact.allocatedDelta < 0 ? "text-rose-400" : "text-slate-400"}>{impact.summary}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}
                                        {goalOverview.allocation.tradeoffs.length > 0 && (
                                            <div className="mt-4 space-y-1 text-xs text-slate-300">
                                                {goalOverview.allocation.tradeoffs.slice(0, 3).map((tradeoff) => (
                                                    <div key={tradeoff}>{tradeoff}</div>
                                                ))}
                                            </div>
                                        )}
                                    </Card>
                                )}
                            </>
                        );
                    })()}
                </div>

                <div className="space-y-6 xl:col-span-4">
                    <Card className="overflow-hidden border-blue-700/30 bg-blue-950/10 px-4 py-4 sm:px-6 sm:py-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="text-sm font-semibold text-blue-300">AI Financial Advisor</div>
                                <div className="text-xs text-slate-400">{aiRecommendations?.rationale ?? "Run advisor for personalized recommendations"}</div>
                            </div>
                            <div className="flex items-center gap-2">
                                {aiLastRun && <div className="text-xs text-slate-400">Last run: {new Date(aiLastRun).toLocaleString()}</div>}
                                <Button
                                    size="sm"
                                    onClick={async () => {
                                        try {
                                            setAiLoading(true);
                                            const data = await fetchAIRecommendations(true);
                                            setAiRecommendations(data);
                                            setAiLastRun(new Date().toISOString());
                                        } catch (e) {
                                            console.error(e);
                                        } finally {
                                            setAiLoading(false);
                                        }
                                    }}
                                    className={"rounded-lg"}
                                >
                                    {aiLoading ? "Running..." : "Run advisor"}
                                </Button>
                            </div>
                        </div>

                        {aiRecommendations && (
                            <div className="mt-4 space-y-3">
                                {aiRecommendations.recommendations && aiRecommendations.recommendations.map((rec: AIRecommendation, i: number) => (
                                    <div key={i} className={`rounded-lg border-l-4 p-3 ${rec.priority === "high" ? "border-red-500 bg-red-950/20" : rec.priority === "medium" ? "border-yellow-500 bg-yellow-950/20" : "border-blue-500 bg-blue-950/20"}`}>
                                        <div className="font-medium text-slate-100">{rec.text}</div>
                                        {rec.rationale && <div className="mt-1 text-xs text-slate-400">{rec.rationale}</div>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>

                    <Card className="overflow-hidden border-purple-700/30 bg-purple-950/10 px-4 py-4 sm:px-6 sm:py-6">
                        <div>
                            <div className="text-sm font-semibold text-purple-300">What-If Simulation</div>
                            <div className="text-xs text-slate-400">See how spending changes impact your goals</div>
                        </div>
                        <div className="mt-4 space-y-4">
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1">
                                <Button
                                    variant={whatIfScenario === "capacity" ? "secondary" : "ghost"}
                                    size="sm"
                                    onClick={() => setWhatIfScenario("capacity")}
                                    className="rounded-lg"
                                >
                                    Savings Increase
                                </Button>
                                <Button
                                    variant={whatIfScenario === "spending" ? "secondary" : "ghost"}
                                    size="sm"
                                    onClick={() => setWhatIfScenario("spending")}
                                    className="rounded-lg"
                                >
                                    Reduce Spending
                                </Button>
                                <Button
                                    variant={whatIfScenario === "expense" ? "secondary" : "ghost"}
                                    size="sm"
                                    onClick={() => setWhatIfScenario("expense")}
                                    className="rounded-lg"
                                >
                                    Large Purchase
                                </Button>
                            </div>
                            {whatIfScenario !== "none" && (
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        value={whatIfAmount}
                                        onChange={(e) => setWhatIfAmount(e.target.value)}
                                        placeholder="Amount (₹)"
                                        className="rounded-lg"
                                    />
                                    <Button
                                        onClick={() => runWhatIf()}
                                        disabled={!whatIfAmount || whatIfPending}
                                        className="rounded-lg"
                                    >
                                        {whatIfPending ? "Simulating..." : "Simulate"}
                                    </Button>
                                </div>
                            )}
                            {whatIfResult && whatIfResult.scenario && (
                                <div className="space-y-2 rounded-lg bg-black/20 p-3">
                                    <div className="text-sm font-medium text-slate-100">{whatIfResult.scenario.description}</div>
                                    <div className="text-xs text-slate-400">New capacity: {formatCurrency(whatIfResult.scenario.newMonthlyCapacity)}</div>
                                    <div className="space-y-2">
                                        {whatIfResult.scenario.impacts && whatIfResult.scenario.impacts.map((impact: WhatIfImpact) => (
                                            <div key={impact.goalId} className="flex items-center justify-between text-xs text-slate-300">
                                                <span>{impact.goalTitle}</span>
                                                <span className={impact.daysDelta > 0 ? "text-green-400" : impact.daysDelta < 0 ? "text-red-400" : "text-slate-400"}>
                                                    {impact.summary}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>

            <Dialog open={createGoalOpen} onOpenChange={setCreateGoalOpen}>
                <DialogContent className="rounded-2xl p-4 sm:max-w-2xl sm:p-8">
                    <DialogHeader className="space-y-2">
                        <DialogTitle>Add Goal</DialogTitle>
                        <DialogDescription>
                            Capture the target, timeline, and priority here without taking space from the dashboard.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        className="space-y-6"
                        onSubmit={(e) => {
                            e.preventDefault();
                            createMutation.mutate();
                        }}
                    >
                        <div className="grid gap-3 md:grid-cols-2">
                            <Input
                                label="Title"
                                value={form.title}
                                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                                placeholder="Emergency fund"
                            />
                            <Input
                                label="Target amount"
                                type="number"
                                value={form.targetAmount}
                                onChange={(e) => setForm((prev) => ({ ...prev, targetAmount: e.target.value }))}
                                placeholder="250000"
                            />
                            <Input
                                label="Target date"
                                type="date"
                                value={form.targetDate}
                                onChange={(e) => setForm((prev) => ({ ...prev, targetDate: e.target.value }))}
                            />
                            <Input
                                label="Priority"
                                type="number"
                                min={1}
                                max={5}
                                value={form.priority}
                                onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                                placeholder="3"
                            />
                            <div className="md:col-span-2">
                                <Input
                                    label="Notes"
                                    value={form.notes}
                                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                                    placeholder="6 months of expenses"
                                />
                            </div>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="ghost" className="rounded-lg" onClick={() => setCreateGoalOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={!form.title.trim() || !form.targetAmount || createMutation.isPending}
                                variant="secondary"
                                className="rounded-lg"
                            >
                                {createMutation.isPending ? "Saving..." : "Add goal"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {isLoading && <div className="text-sm text-slate-400">Loading goals...</div>}
                {!isLoading && goals.length === 0 && (
                    <div className="text-sm text-slate-500">No goals yet. Create one above to get started.</div>
                )}
                {goals.map((goal) => {
                    const progress = Math.round((goal.currentAmount / Math.max(1, goal.targetAmount)) * 100);
                    const clamped = Math.min(progress, 100);
                    const edit = editing[goal.id] || {};
                    const patch = buildPatch(edit);
                    const hasChanges = Object.keys(patch).length > 0;

                    return (
                        <Card key={goal.id} className="overflow-hidden border-white/10 bg-slate-950/55 px-4 py-4 sm:px-6 sm:py-6 shadow-lg shadow-black/10 backdrop-blur">
                            <details className="group">
                                <summary className="flex cursor-pointer list-none flex-col gap-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-slate-100 truncate">{goal.title}</div>
                                            <div className="text-xs text-slate-500 mt-1">Target: {formatCurrency(goal.targetAmount, goal.currency || "INR")}</div>
                                            <div className="text-xs text-slate-500">Current: {formatCurrency(goal.currentAmount, goal.currency || "INR")}</div>
                                            <div className="mt-2 text-xs space-y-1">
                                                <div><span className="text-slate-400">Required / month: </span><span className="font-semibold">{goal.requiredMonthlyLabel ?? formatCurrency(goal.recommendedMonthly || 0, goal.currency || "INR")}</span></div>
                                                <div><span className="text-slate-400">ETA: </span><span className="font-semibold">{goal.eta?.eta ? new Date(goal.eta.eta).toLocaleDateString() : "—"}</span></div>
                                            </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            <div className="text-xs text-slate-400">Health</div>
                                            <div className="text-lg font-semibold text-white">{goal.health ?? "—"}</div>
                                            <div className="text-xs text-slate-400">Confidence: {goal.confidenceScore ?? 0}%</div>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="h-2 w-full rounded-full bg-white/5">
                                            <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${clamped}%` }} />
                                        </div>
                                        <div className="mt-2 text-xs text-slate-500 transition group-open:text-slate-300">
                                            Click to view details
                                        </div>
                                    </div>
                                </summary>

                                <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                    <Input
                                        label="Title"
                                        value={edit.title ?? goal.title}
                                        onChange={(e) =>
                                            setEditing((prev) => ({
                                                ...prev,
                                                [goal.id]: { ...prev[goal.id], title: e.target.value },
                                            }))
                                        }
                                    />
                                    <Input
                                        label="Target amount"
                                        type="number"
                                        value={String(edit.targetAmount ?? goal.targetAmount)}
                                        onChange={(e) =>
                                            setEditing((prev) => ({
                                                ...prev,
                                                [goal.id]: { ...prev[goal.id], targetAmount: Number(e.target.value) },
                                            }))
                                        }
                                    />
                                    <Input
                                        label="Priority"
                                        type="number"
                                        min={1}
                                        max={5}
                                        value={String(edit.priority ?? goal.priority)}
                                        onChange={(e) =>
                                            setEditing((prev) => ({
                                                ...prev,
                                                [goal.id]: { ...prev[goal.id], priority: Number(e.target.value) },
                                            }))
                                        }
                                    />

                                    <Input
                                        label="Target date"
                                        type="date"
                                        value={(edit.targetDate ?? goal.targetDate ?? "").slice(0, 10)}
                                        onChange={(e) =>
                                            setEditing((prev) => ({
                                                ...prev,
                                                [goal.id]: { ...prev[goal.id], targetDate: e.target.value },
                                            }))
                                        }
                                    />
                                    <Input
                                        label="Notes"
                                        value={edit.notes ?? goal.notes ?? ""}
                                        onChange={(e) =>
                                            setEditing((prev) => ({
                                                ...prev,
                                                [goal.id]: { ...prev[goal.id], notes: e.target.value },
                                            }))
                                        }
                                    />
                                    <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400 md:col-span-2 lg:col-span-3">
                                        Current amount is derived automatically from balance, savings capacity, allocation, and savings behavior.
                                    </div>
                                </div>
                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => updateMutation.mutate({ id: goal.id, patch })}
                                        disabled={updateMutation.isPending || !hasChanges}
                                        className={"rounded-lg"}
                                    >
                                        {updateMutation.isPending ? "Saving..." : "Save changes"}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setEditing((prev) => ({ ...prev, [goal.id]: {} }))}
                                        className={"rounded-lg"}
                                    >
                                        Reset
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => deleteMutation.mutate(goal.id)}
                                        disabled={deleteMutation.isPending}
                                        className={"rounded-lg"}
                                    >
                                        Delete
                                    </Button>
                                </div>

                                <div className="mt-4 space-y-3 rounded-lg border border-white/5 bg-black/20 p-4">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold text-white">Milestones</div>
                                            <div className="text-xs text-slate-400">Derived progress checkpoints for this goal</div>
                                        </div>
                                        <div className="text-xs text-slate-500">
                                            Recommended monthly: {formatCurrency(goal.recommendedMonthlyContribution || goal.recommendedMonthly || 0, goal.currency || "INR")}
                                        </div>
                                    </div>
                                    <div className="grid gap-2 md:grid-cols-2">
                                        {(goal.milestones || []).map((milestone) => (
                                            <div key={milestone.label} className={`rounded-lg p-3 text-xs ${milestone.achieved ? "bg-emerald-950/20 text-emerald-300" : "bg-slate-900/60 text-slate-300"}`}>
                                                <div className="font-medium">{milestone.label}</div>
                                                <div>{milestone.amountLabel}</div>
                                                <div className="text-slate-500">{milestone.achieved ? "Achieved" : "Pending"}</div>
                                            </div>
                                        ))}
                                    </div>
                                    {goal.nextMilestone && (
                                        <div className="text-xs text-slate-400">
                                            Next milestone: {goal.nextMilestone.label} at {goal.nextMilestone.amountLabel}
                                        </div>
                                    )}
                                    {goal.recommendations && goal.recommendations.length > 0 && (
                                        <div className="mt-3 rounded-lg border border-white/5 bg-slate-900/40 p-3 text-sm">
                                            <div className="font-medium text-white">Recommendations</div>
                                            <ul className="mt-2 list-disc list-inside text-slate-300">
                                                {goal.recommendations.map((r, i) => (
                                                    <li key={i}>{r}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </details>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
