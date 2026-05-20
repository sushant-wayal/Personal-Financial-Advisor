"use client";

import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input as BaseInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
};

type GoalOverview = {
    goals: Goal[];
    conflicts: Array<{ type: string; severity: string; message: string; affectedGoalIds: string[] }>;
    totalRecommendedMonthlyContribution: number;
    totalRecommendedMonthlyContributionLabel: string;
    monthlyCapacity: number;
    monthlyCapacityLabel: string;
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

export default function GoalsManager() {
    const queryClient = useQueryClient();
    const { data: goals = [], isLoading } = useQuery({ queryKey: ["goals"], queryFn: fetchGoals });
    const { data: goalOverview } = useQuery({ queryKey: ["goalOverview"], queryFn: fetchGoalOverview });

    const [form, setForm] = useState({
        title: "",
        targetAmount: "",
        targetDate: "",
        priority: "3",
        notes: "",
    });

    const [editing, setEditing] = useState<Record<string, Partial<Goal>>>({});

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

    const totalGoals = useMemo(() => goals.length, [goals.length]);

    return (
        <div className="space-y-6">
            {goalOverview && goalOverview.conflicts.length > 0 && (
                <Card className="px-10 border-amber-700/30 bg-amber-950/10">
                    <div className="text-sm font-semibold text-amber-300">Goal conflicts</div>
                    <div className="mt-2 space-y-2 text-sm text-slate-200">
                        <div className="text-xs text-slate-400">
                            Monthly capacity: {goalOverview.monthlyCapacityLabel} • Required commitments: {goalOverview.totalRecommendedMonthlyContributionLabel}
                        </div>
                        {goalOverview.conflicts.map((conflict) => (
                            <div key={`${conflict.type}-${conflict.message}`} className="rounded-lg bg-black/20 p-3">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="font-medium capitalize">{conflict.type} conflict</span>
                                    <span className="text-xs uppercase tracking-wide text-amber-300">{conflict.severity}</span>
                                </div>
                                <div className="mt-1 text-xs text-slate-300">{conflict.message}</div>
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            <Card className="px-10">
                <div>
                    <div className="text-sm font-semibold text-white">Create a goal</div>
                    <div className="text-xs text-slate-400">Track a target and the timeline you want</div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
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

                    <Input
                        label="Notes"
                        value={form.notes}
                        onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                        placeholder="6 months of expenses"
                    />
                </div>
                <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs text-slate-500">{totalGoals} goals tracked</div>
                    <Button
                        onClick={() => createMutation.mutate()}
                        disabled={!form.title.trim() || !form.targetAmount || createMutation.isPending}
                        variant="secondary"
                        className={"rounded-lg"}
                    >
                        {createMutation.isPending ? "Saving..." : "Add goal"}
                    </Button>
                </div>
            </Card>

            <div className="grid gap-4">
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
                        <Card key={goal.id} className="px-10">
                            <details className="group">
                                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-4">
                                    <div>
                                        <div className="font-semibold text-slate-100">{goal.title}</div>
                                        <div className="text-xs text-slate-500">Target: {formatCurrency(goal.targetAmount, goal.currency || "INR")}</div>
                                        <div className="text-xs text-slate-500">Current: {formatCurrency(goal.currentAmount, goal.currency || "INR")}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-slate-400">Progress</div>
                                        <div className="text-lg font-semibold text-white">{progress}%</div>
                                    </div>
                                    <div className="w-full">
                                        <div className="mt-3 h-2 w-full rounded-full bg-white/5">
                                            <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${clamped}%` }} />
                                        </div>
                                        <div className="mt-2 text-xs text-slate-500 transition group-open:text-slate-300">
                                            Click to view details
                                        </div>
                                    </div>
                                </summary>

                                <div className="mt-4 grid gap-3 md:grid-cols-2">
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
                                        label="Current amount"
                                        type="number"
                                        value={String(edit.currentAmount ?? goal.currentAmount)}
                                        onChange={(e) =>
                                            setEditing((prev) => ({
                                                ...prev,
                                                [goal.id]: { ...prev[goal.id], currentAmount: Number(e.target.value) },
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
                                </div>
                            </details>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
