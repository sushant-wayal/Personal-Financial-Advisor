"use client";

import React from "react";
import { Card } from "@/components/ui/card";

type Conflict = {
    type: string;
    severity: string;
    message: string;
    affectedGoalIds?: string[];
};

type GoalConflictsCardProps = {
    conflicts: Conflict[];
    monthlyCapacityLabel?: string;
    totalRecommendedMonthlyLabel?: string;
};

export function GoalConflictsCard({
    conflicts,
    monthlyCapacityLabel,
    totalRecommendedMonthlyLabel,
}: GoalConflictsCardProps) {
    if (!conflicts || conflicts.length === 0) return null;

    return (
        <Card className="overflow-hidden border-amber-700/30 bg-amber-950/10 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <div className="text-sm font-semibold text-amber-300">Goal conflicts</div>
                    <div className="text-xs text-slate-400">
                        Monthly capacity: {monthlyCapacityLabel} • Required commitments: {totalRecommendedMonthlyLabel}
                    </div>
                </div>
                <div className="text-xs uppercase tracking-[0.25em] text-amber-300/80">Needs attention</div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {conflicts.map((conflict) => (
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
    );
}
