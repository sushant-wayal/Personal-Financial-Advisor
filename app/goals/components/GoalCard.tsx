"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input as BaseInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/src/services/shared/formatting";
import type { Goal } from "@/src/types/goal";

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

function getDisplayProgress(currentAmount: number, targetAmount: number) {
    if (targetAmount <= 0) return 0;
    if (currentAmount >= targetAmount) return 100;
    const pct = (currentAmount / targetAmount) * 100;
    return Math.max(0, Math.min(99.9, Math.round(pct * 10) / 10));
}

function buildPatch(patch: Partial<Goal>) {
    const cleaned: Record<string, unknown> = {};
    Object.entries(patch).forEach(([key, value]) => {
        if (value === undefined) return;
        if (typeof value === "string" && value.trim() === "") return;
        cleaned[key] = value;
    });
    return cleaned;
}

type GoalCardProps = {
    goal: Goal;
    onUpdate: (id: string, patch: Partial<Goal>) => void;
    onDelete: (id: string) => void;
    isUpdating: boolean;
    isDeleting: boolean;
};

export function GoalCard({ goal, onUpdate, onDelete, isUpdating, isDeleting }: GoalCardProps) {
    const [edit, setEdit] = useState<Partial<Goal>>({});

    const progress = getDisplayProgress(goal.currentAmount || 0, goal.targetAmount || 0);
    const clamped = Math.min(progress, 100);
    const patch = buildPatch(edit);
    const hasChanges = Object.keys(patch).length > 0;

    return (
        <Card className="overflow-hidden border-white/10 bg-slate-950/55 px-4 py-4 sm:px-6 sm:py-6 shadow-lg shadow-black/10 backdrop-blur">
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
                        onChange={(e) => setEdit((prev) => ({ ...prev, title: e.target.value }))}
                    />
                    <Input
                        label="Target amount"
                        type="number"
                        value={String(edit.targetAmount ?? goal.targetAmount)}
                        onChange={(e) => setEdit((prev) => ({ ...prev, targetAmount: Number(e.target.value) }))}
                    />
                    <Input
                        label="Priority"
                        type="number"
                        min={1}
                        max={5}
                        value={String(edit.priority ?? goal.priority)}
                        onChange={(e) => setEdit((prev) => ({ ...prev, priority: Number(e.target.value) }))}
                    />
                    <Input
                        label="Target date"
                        type="date"
                        value={(edit.targetDate ?? goal.targetDate ?? "").slice(0, 10)}
                        onChange={(e) => setEdit((prev) => ({ ...prev, targetDate: e.target.value }))}
                    />
                    <Input
                        label="Notes"
                        value={edit.notes ?? goal.notes ?? ""}
                        onChange={(e) => setEdit((prev) => ({ ...prev, notes: e.target.value }))}
                    />
                    <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-400 md:col-span-2 lg:col-span-3">
                        Current amount is derived automatically from balance, savings capacity, allocation, and savings behavior.
                    </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onUpdate(goal.id, patch)}
                        disabled={isUpdating || !hasChanges}
                        className="rounded-lg"
                    >
                        {isUpdating ? "Saving..." : "Save changes"}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEdit({})}
                        className="rounded-lg"
                    >
                        Reset
                    </Button>
                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => onDelete(goal.id)}
                        disabled={isDeleting}
                        className="rounded-lg"
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
}
