"use client";

import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InvestmentCard } from "@/app/components/InvestmentCard";
import { EmergencyFundData, Goal } from "@/src/types/goal";
import { GoalCard } from "./components/GoalCard";
import { EmergencyFundWidget } from "./components/EmergencyFundWidget";
import { GoalTimelineView } from "./components/GoalTimelineView";
import { CreateGoalDialog, GoalFormData } from "./components/CreateGoalDialog";
import { GoalsMetricsRow } from "./components/GoalsMetricsRow";
import { GoalConflictsCard } from "./components/GoalConflictsCard";
import { GoalWhatIfSim } from "./components/GoalWhatIfSim";

async function fetchGoals(): Promise<Goal[]> {
    const res = await fetch("/api/goals");
    if (!res.ok) throw new Error("Failed to load goals");
    const data = await res.json();
    return data.goals || [];
}

async function fetchGoalOverview() {
    const res = await fetch("/api/goals/recommend");
    if (!res.ok) throw new Error("Failed to load goal overview");
    return res.json();
}

async function fetchEmergencyFund(): Promise<EmergencyFundData> {
    const res = await fetch("/api/emergency-fund");
    if (!res.ok) throw new Error("Failed to load emergency fund");
    return res.json();
}

export default function GoalsManager() {
    const queryClient = useQueryClient();
    const { data: goals = [], isLoading } = useQuery({ queryKey: ["goals"], queryFn: fetchGoals });
    const { data: goalOverview } = useQuery({ queryKey: ["goalOverview"], queryFn: fetchGoalOverview });
    const { data: efData } = useQuery({ queryKey: ["emergencyFund"], queryFn: fetchEmergencyFund, refetchInterval: 30000 });
    const ef = goalOverview?.emergencyFund ?? efData;

    const [createGoalOpen, setCreateGoalOpen] = useState(false);
    const [form, setForm] = useState<GoalFormData>({ title: "", targetAmount: "", targetDate: "", priority: "3", notes: "" });

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

    const totalCurrentAmount = useMemo(() => goals.reduce((sum, g) => sum + (g.currentAmount || 0), 0), [goals]);
    const totalTargetAmount = useMemo(() => goals.reduce((sum, g) => sum + (g.targetAmount || 0), 0), [goals]);
    const fundingGap = Math.max(0, totalTargetAmount - totalCurrentAmount);

    return (
        <div className="space-y-8">
            <EmergencyFundWidget ef={ef} />
            <InvestmentCard initialSuggestion={goalOverview?.investmentSuggestion} />

            <Card className="overflow-hidden border-white/10 bg-slate-950/55 shadow-2xl backdrop-blur p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
                    <div>
                        <div className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300/80">Goals dashboard</div>
                        <div className="mt-2 text-2xl font-semibold text-white">Plan and fund every goal from one center.</div>
                    </div>
                    <Button onClick={() => setCreateGoalOpen(true)} variant="secondary" className="rounded-lg">
                        Add goal
                    </Button>
                </div>
                <GoalsMetricsRow
                    totalGoals={goals.length}
                    fullyFundedCount={goals.filter((g) => g.currentAmount >= g.targetAmount).length}
                    totalCurrentAmount={totalCurrentAmount}
                    totalTargetAmount={totalTargetAmount}
                    fundingGap={fundingGap}
                    monthlyCapacityLabel={goalOverview?.monthlyCapacityLabel}
                    conflictsCount={goalOverview?.conflicts?.length}
                    totalRecommendedMonthlyLabel={goalOverview?.totalRecommendedMonthlyContributionLabel}
                />
            </Card>

            <GoalConflictsCard
                conflicts={goalOverview?.conflicts || []}
                monthlyCapacityLabel={goalOverview?.monthlyCapacityLabel}
                totalRecommendedMonthlyLabel={goalOverview?.totalRecommendedMonthlyContributionLabel}
            />

            <div className="grid gap-4 xl:grid-cols-12">
                <div className="space-y-6 xl:col-span-8">
                    <GoalTimelineView
                        goals={goals}
                        allocation={goalOverview?.allocation}
                        allocationStrategies={goalOverview?.allocationStrategies}
                        allocationScenarios={goalOverview?.allocationScenarios}
                    />
                </div>
                <div className="space-y-6 xl:col-span-4">
                    <GoalWhatIfSim />
                </div>
            </div>

            <CreateGoalDialog
                isOpen={createGoalOpen}
                onOpenChange={setCreateGoalOpen}
                form={form}
                setForm={setForm}
                onSubmit={() => createMutation.mutate()}
                isPending={createMutation.isPending}
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {isLoading && <div className="text-sm text-slate-400">Loading goals...</div>}
                {!isLoading && goals.length === 0 && (
                    <div className="text-sm text-slate-500">No goals yet. Create one above to get started.</div>
                )}
                {goals.map((goal) => (
                    <GoalCard
                        key={goal.id}
                        goal={goal}
                        onUpdate={(id, patch) => updateMutation.mutate({ id, patch })}
                        onDelete={(id) => deleteMutation.mutate(id)}
                        isUpdating={updateMutation.isPending}
                        isDeleting={deleteMutation.isPending}
                    />
                ))}
            </div>
        </div>
    );
}
