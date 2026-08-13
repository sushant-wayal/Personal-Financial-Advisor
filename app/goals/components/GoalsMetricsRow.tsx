"use client";

import React from "react";
import { formatCurrency } from "@/src/services/shared/formatting";

type GoalsMetricsRowProps = {
    totalGoals: number;
    fullyFundedCount: number;
    totalCurrentAmount: number;
    totalTargetAmount: number;
    fundingGap: number;
    monthlyCapacityLabel?: string;
    conflictsCount?: number;
    totalRecommendedMonthlyLabel?: string;
};

export function GoalsMetricsRow({
    totalGoals,
    fullyFundedCount,
    totalCurrentAmount,
    fundingGap,
    monthlyCapacityLabel,
    conflictsCount = 0,
    totalRecommendedMonthlyLabel,
}: GoalsMetricsRowProps) {
    const dashboardMetrics = [
        {
            label: "Goals tracked",
            value: String(totalGoals),
            detail: totalGoals > 0 ? `${fullyFundedCount} fully funded` : "Start with a goal",
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
            value: monthlyCapacityLabel ?? "₹0",
            detail: `${conflictsCount} conflict${conflictsCount === 1 ? "" : "s"} flagged`,
            accent: "from-amber-400/30 to-amber-500/5",
        },
        {
            label: "Required monthly",
            value: totalRecommendedMonthlyLabel ?? "₹0",
            detail: "Planned commitments across goals",
            accent: "from-violet-400/30 to-violet-500/5",
        },
    ];

    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {dashboardMetrics.map((metric) => (
                <div key={metric.label} className={`rounded-2xl border border-white/10 bg-gradient-to-br ${metric.accent} p-4`}>
                    <div className="text-xs uppercase tracking-[0.28em] text-slate-400">{metric.label}</div>
                    <div className="mt-3 text-2xl font-semibold text-white">{metric.value}</div>
                    <div className="mt-2 text-xs text-slate-400">{metric.detail}</div>
                </div>
            ))}
        </div>
    );
}
