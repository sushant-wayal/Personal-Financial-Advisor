"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import type { EmergencyFundData } from "@/src/types/goal";
import { formatCurrency } from "@/src/services/shared/formatting";

export function EmergencyFundWidget({ ef }: { ef?: EmergencyFundData }) {
    if (!ef) {
        return (
            <Card className="overflow-hidden border-orange-700/30 bg-gradient-to-br from-orange-950/30 to-amber-950/10 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 shadow-lg shadow-orange-900/10">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">🛡️</span>
                    <div>
                        <div className="text-sm font-semibold text-orange-300">Emergency Fund</div>
                        <div className="text-xs text-slate-500">Loading...</div>
                    </div>
                </div>
            </Card>
        );
    }

    const progressClamped = Math.min(100, Math.max(0, ef.progressPct));
    const fmt = (n: number) => formatCurrency(n, "INR");

    const etaLabel = ef.estimatedCompletionDate
        ? new Date(ef.estimatedCompletionDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
        : null;

    return (
        <Card className={`overflow-hidden border shadow-xl shadow-black/20 backdrop-blur ${
            ef.isComplete
                ? "border-emerald-700/40 bg-gradient-to-br from-emerald-950/30 to-teal-950/10"
                : "border-orange-700/40 bg-gradient-to-br from-orange-950/30 to-amber-950/10"
        }`}>
            <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
                {/* Header */}
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl text-2xl shadow-inner ${
                            ef.isComplete ? "bg-emerald-500/20" : "bg-orange-500/20"
                        }`}>
                            {ef.isComplete ? "✅" : "🛡️"}
                        </div>
                        <div>
                            <div className={`text-xs font-semibold uppercase tracking-[0.3em] ${
                                ef.isComplete ? "text-emerald-400/80" : "text-orange-400/80"
                            }`}>First Priority</div>
                            <div className="mt-0.5 text-xl font-bold text-white">Emergency Fund</div>
                            <div className="text-xs text-slate-400">{ef.targetMonths} months of expenses covered</div>
                        </div>
                    </div>

                    {/* Status badge */}
                    {ef.isComplete ? (
                        <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5">
                            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs font-medium text-emerald-300">Fully Funded — Goals Unlocked</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5">
                            <div className="h-2 w-2 rounded-full bg-orange-400 animate-pulse" />
                            <span className="text-xs font-medium text-orange-300">All Goal Allocations Paused</span>
                        </div>
                    )}
                </div>

                {/* Progress bar */}
                <div className="mt-6">
                    <div className="mb-2 flex items-end justify-between">
                        <div>
                            <span className={`text-3xl font-bold ${
                                ef.isComplete ? "text-emerald-300" : "text-orange-300"
                            }`}>{progressClamped.toFixed(1)}%</span>
                            <span className="ml-2 text-sm text-slate-400">funded</span>
                        </div>
                        {!ef.isComplete && etaLabel && (
                            <div className="text-right">
                                <div className="text-xs text-slate-500 uppercase tracking-wide">Est. completion</div>
                                <div className="text-sm font-semibold text-orange-200">{etaLabel}</div>
                                {ef.monthsToComplete && (
                                    <div className="text-xs text-slate-500">{ef.monthsToComplete} month{ef.monthsToComplete === 1 ? "" : "s"} away</div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="relative h-4 w-full overflow-hidden rounded-full bg-white/5">
                        <div
                            className={`h-4 rounded-full transition-all duration-700 ease-out ${
                                ef.isComplete
                                    ? "bg-gradient-to-r from-emerald-400 to-teal-400"
                                    : "bg-gradient-to-r from-orange-500 to-amber-400"
                            }`}
                            style={{ width: `${progressClamped}%` }}
                        />
                        {/* Shimmer effect */}
                        {!ef.isComplete && progressClamped > 5 && (
                            <div
                                className="absolute inset-y-0 left-0 w-full rounded-full"
                                style={{
                                    background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)",
                                    width: `${progressClamped}%`,
                                    animation: "shimmer 2s infinite",
                                }}
                            />
                        )}
                    </div>
                </div>

                {/* Stat grid */}
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                        <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Needed</div>
                        <div className="mt-2 text-base font-semibold text-white">{fmt(ef.targetAmount)}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{ef.targetMonths}M × avg spend</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                        <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Saved</div>
                        <div className={`mt-2 text-base font-semibold ${
                            ef.savedAmount >= ef.targetAmount ? "text-emerald-300" : "text-white"
                        }`}>{fmt(ef.savedAmount)}</div>
                        <div className="mt-0.5 text-xs text-slate-500">in emergency fund</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                        <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Shortfall</div>
                        <div className={`mt-2 text-base font-semibold ${
                            ef.shortfall === 0 ? "text-emerald-300" : "text-rose-300"
                        }`}>{ef.shortfall === 0 ? "None" : fmt(ef.shortfall)}</div>
                        <div className="mt-0.5 text-xs text-slate-500">remaining to save</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
                        <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Avg Spend/M</div>
                        <div className="mt-2 text-base font-semibold text-white">{fmt(ef.avgMonthlyExpenses)}</div>
                        <div className="mt-0.5 text-xs text-slate-500">3-month average</div>
                    </div>
                </div>

                {/* Blocking banner */}
                {!ef.isComplete && (
                    <div className="mt-4 flex items-start gap-3 rounded-xl border border-orange-500/20 bg-orange-950/20 px-4 py-3">
                        <span className="mt-0.5 text-orange-400 text-base">⚠️</span>
                        <div className="text-xs text-orange-200/80 leading-relaxed">
                            <span className="font-semibold text-orange-300">Emergency Fund is incomplete.</span>{" "}
                            All available monthly savings are directed to fully funding this emergency reserve before goal allocations resume. This protects your financial stability.
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}
