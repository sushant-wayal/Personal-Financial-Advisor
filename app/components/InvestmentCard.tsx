"use client";

import React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Flame, CheckCircle2, ShieldAlert, Sparkles, PieChart } from "lucide-react";

function formatCurrency(amount: number, currency = "INR") {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount || 0);
}

export function InvestmentCard() {
    const { data, isLoading, isError } = useQuery({
        queryKey: ["investmentSuggestion"],
        queryFn: async () => {
            const res = await fetch("/api/investments");
            if (!res.ok) throw new Error("Failed to load investments");
            return res.json();
        },
        staleTime: 1000 * 30, // 30s
    });

    if (isLoading) {
        return (
            <Card className="overflow-hidden border-indigo-700/30 bg-gradient-to-br from-indigo-950/30 via-slate-900/40 to-slate-950/60 p-5 shadow-lg shadow-indigo-950/20">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 animate-pulse rounded-xl bg-indigo-500/20" />
                    <div className="space-y-1.5">
                        <div className="h-4 w-32 animate-pulse rounded bg-indigo-500/20" />
                        <div className="h-3 w-20 animate-pulse rounded bg-slate-700/30" />
                    </div>
                </div>
            </Card>
        );
    }

    if (isError || !data?.ok) {
        return (
            <Card className="overflow-hidden border-rose-500/30 bg-gradient-to-br from-rose-950/30 via-slate-900/60 to-slate-950/80 p-5 shadow-xl">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 font-bold">
                            ⚠️
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-white">Monthly Investment Widget</h3>
                            <p className="text-xs text-rose-300 mt-0.5">
                                {data?.error || "Unable to load investment suggestion."}
                            </p>
                        </div>
                    </div>
                    <Link href="/investments">
                        <Button size="sm" variant="outline" className="rounded-xl border-rose-500/30 text-rose-200 hover:bg-rose-500/10">
                            Open Investments Page
                        </Button>
                    </Link>
                </div>
            </Card>
        );
    }

    const { suggestion } = data;
    const isInvested = suggestion.status === "INVESTED";
    const isCrisis = suggestion.phase === "CRISIS";
    const total = suggestion.totalInvestable;
    const buckets = suggestion.buckets;

    return (
        <Card className={`group relative overflow-hidden border transition-all duration-300 shadow-xl ${
            isInvested
                ? "border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 via-slate-900/60 to-slate-950/80 shadow-emerald-950/10"
                : isCrisis
                ? "border-rose-500/30 bg-gradient-to-br from-rose-950/30 via-slate-900/60 to-slate-950/80 shadow-rose-950/10"
                : "border-indigo-500/30 bg-gradient-to-br from-indigo-950/30 via-slate-900/60 to-slate-950/80 hover:border-indigo-500/50 shadow-indigo-950/20"
        }`}>
            {/* Top Glow Accent */}
            <div className={`absolute -top-12 left-1/2 h-24 w-2/3 -translate-x-1/2 rounded-full blur-2xl transition-opacity group-hover:opacity-100 ${
                isInvested ? "bg-emerald-500/15 opacity-60" : "bg-indigo-500/20 opacity-70"
            }`} />

            <div className="relative p-5 sm:p-6 space-y-4">
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold shadow-inner ${
                            isInvested
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                        }`}>
                            {isInvested ? <CheckCircle2 className="h-5 w-5" /> : <PieChart className="h-5 w-5" />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-white tracking-wide">Monthly Investment</h3>
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                                    isCrisis
                                        ? "bg-rose-500/10 text-rose-300 border-rose-500/30"
                                        : "bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
                                }`}>
                                    <Sparkles className="h-3 w-3" />
                                    {suggestion.phaseLabel}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {isInvested
                                    ? `Next suggestion in ${suggestion.nextSuggestionIn ?? suggestion.cycleDays} days`
                                    : `Investable surplus: ${formatCurrency(suggestion.smoothedSurplus)}`}
                            </p>
                        </div>
                    </div>

                    {/* Streak & Status Badges */}
                    <div className="flex items-center gap-2">
                        {suggestion.streak > 0 && (
                            <div className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300 shadow-sm">
                                <Flame className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                <span>{suggestion.streak} Cycle Streak</span>
                            </div>
                        )}

                        {isInvested && (
                            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span>Invested</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Amount Display */}
                {!isCrisis ? (
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pt-1">
                        <div>
                            <div className="text-xs font-mono uppercase tracking-wider text-slate-400 font-medium">
                                {isInvested ? "Total Invested" : "Recommended Allocation"}
                            </div>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
                                    isInvested ? "text-emerald-300" : "text-white"
                                }`}>
                                    {formatCurrency(total)}
                                </span>
                                {suggestion.isManuallyEdited && (
                                    <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                                        Custom Edited
                                    </span>
                                )}
                            </div>
                        </div>

                        <Link href="/investments">
                            <Button size="sm" className="rounded-xl font-medium shadow-md transition-all group-hover:translate-x-0.5 bg-indigo-600 hover:bg-indigo-500 text-white">
                                <span>{isInvested ? "View History & Details" : "Configure & Invest"}</span>
                                <ArrowRight className="ml-1.5 h-4 w-4" />
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-3 flex items-start gap-2.5">
                        <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                        <div className="text-xs text-rose-200/90 leading-relaxed">
                            <span className="font-semibold text-rose-300">Investment Paused:</span> Expenses currently exceed income or financial runway is below 1 month. Focus on reducing expenses to build investable surplus.
                        </div>
                    </div>
                )}

                {/* Sub-Allocation Visual Bar */}
                {total > 0 && (
                    <div className="space-y-2 pt-1">
                        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-900 border border-white/5 p-0.5">
                            {buckets.equity.pct > 0 && (
                                <div style={{ width: `${buckets.equity.pct}%` }} className="h-full bg-indigo-500 rounded-l-full transition-all duration-500" title={`Equity: ${formatCurrency(buckets.equity.final)} (${buckets.equity.pct}%)`} />
                            )}
                            {buckets.debt.pct > 0 && (
                                <div style={{ width: `${buckets.debt.pct}%` }} className="h-full bg-emerald-500 transition-all duration-500" title={`Debt: ${formatCurrency(buckets.debt.final)} (${buckets.debt.pct}%)`} />
                            )}
                            {buckets.gold.pct > 0 && (
                                <div style={{ width: `${buckets.gold.pct}%` }} className="h-full bg-amber-400 transition-all duration-500" title={`Gold: ${formatCurrency(buckets.gold.final)} (${buckets.gold.pct}%)`} />
                            )}
                            {buckets.cash.pct > 0 && (
                                <div style={{ width: `${buckets.cash.pct}%` }} className="h-full bg-slate-400 rounded-r-full transition-all duration-500" title={`Cash: ${formatCurrency(buckets.cash.final)} (${buckets.cash.pct}%)`} />
                            )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono gap-y-1">
                            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-500" />Equity: {formatCurrency(buckets.equity.final)} ({buckets.equity.pct}%)</span>
                            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Debt: {formatCurrency(buckets.debt.final)} ({buckets.debt.pct}%)</span>
                            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />Gold: {formatCurrency(buckets.gold.final)} ({buckets.gold.pct}%)</span>
                            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400" />Cash: {formatCurrency(buckets.cash.final)} ({buckets.cash.pct}%)</span>
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}
