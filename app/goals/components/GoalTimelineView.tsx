"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { GanttChart } from "@/app/components/GanttChart";
import {
    buildGanttData,
    buildTimelineInsight,
    computeTimelineDeltas,
    formatTimelineInsight,
    normalizeGoalForTimeline,
} from "@/src/services/GoalTimelineService";
import { formatCurrency } from "@/src/services/shared/formatting";
import type { Goal, AllocationPlan, AllocationScenario } from "@/src/types/goal";

type GoalTimelineViewProps = {
    goals: Goal[];
    allocation?: AllocationPlan;
    allocationStrategies?: Record<string, AllocationPlan>;
    allocationScenarios?: AllocationScenario[];
};

export function GoalTimelineView({
    goals,
    allocation,
    allocationStrategies,
    allocationScenarios,
}: GoalTimelineViewProps) {
    if (!goals || goals.length === 0) return null;

    const timelineGoals = goals.map((g) => normalizeGoalForTimeline(g));
    const ganttData = buildGanttData(timelineGoals);
    const deltas = computeTimelineDeltas(timelineGoals.slice(0, 1), timelineGoals);
    const timelineInsight = buildTimelineInsight(timelineGoals, deltas);
    const insightLines = formatTimelineInsight(timelineInsight);

    return (
        <div className="space-y-6">
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

            {allocation && allocationStrategies && (
                <Card className="overflow-hidden border-emerald-700/30 bg-emerald-950/10 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div>
                            <div className="text-sm font-semibold text-emerald-300">Allocation engine</div>
                            <div className="text-xs text-slate-400">Optimized monthly funding across competing goals</div>
                        </div>
                        <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Decision layer</div>
                    </div>
                    <div className="mt-4 text-xs text-slate-400">{allocation.summary}</div>
                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                        {[
                            ["priorityFirst", "Priority-first"],
                            ["proportional", "Proportional"],
                            ["utility", "Utility-based"],
                        ].map(([key, label]) => {
                            const plan = allocationStrategies?.[key];
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
                    {allocationScenarios?.length ? (
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                            {allocationScenarios.map((scenario) => (
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
                    {allocation.tradeoffs.length > 0 && (
                        <div className="mt-4 space-y-1 text-xs text-slate-300">
                            {allocation.tradeoffs.slice(0, 3).map((tradeoff) => (
                                <div key={tradeoff}>{tradeoff}</div>
                            ))}
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}
