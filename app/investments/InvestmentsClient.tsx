"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flame, CheckCircle2, RotateCcw, Save, ShieldAlert, Sparkles, Info, Calendar, ArrowLeft, History, PieChart } from "lucide-react";
import Link from "next/link";

function formatCurrency(amount: number, currency = "INR") {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount || 0);
}

export default function InvestmentsClient() {
    const queryClient = useQueryClient();
    const [equity, setEquity] = useState<number>(0);
    const [debt, setDebt] = useState<number>(0);
    const [gold, setGold] = useState<number>(0);
    const [cash, setCash] = useState<number>(0);

    const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Fetch active investment suggestion
    const { data: suggestData } = useQuery({
        queryKey: ["investmentSuggestion"],
        queryFn: async () => {
            const res = await fetch("/api/investments");
            if (!res.ok) throw new Error("Failed to fetch investment suggestion");
            return res.json();
        },
    });

    // Fetch investment history
    const { data: historyData, isLoading: isHistoryLoading } = useQuery({
        queryKey: ["investmentHistory"],
        queryFn: async () => {
            const res = await fetch("/api/investments/history");
            if (!res.ok) throw new Error("Failed to fetch history");
            return res.json();
        },
    });

    const suggestion = suggestData?.suggestion;

    // Sync state when suggestion loads or changes
    useEffect(() => {
        if (!suggestion?.buckets) return;

        const timer = window.setTimeout(() => {
            setEquity(suggestion.buckets.equity.final);
            setDebt(suggestion.buckets.debt.final);
            setGold(suggestion.buckets.gold.final);
            setCash(suggestion.buckets.cash.final);
        }, 0);

        return () => window.clearTimeout(timer);
    }, [suggestion]);

    // Save Edits Mutation
    const saveMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/investments", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ equity, debt, gold, cash }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to save allocation");
            return data;
        },
        onSuccess: () => {
            setStatusMsg({ type: "success", text: "Custom allocations saved successfully!" });
            queryClient.invalidateQueries({ queryKey: ["investmentSuggestion"] });
            queryClient.invalidateQueries({ queryKey: ["emergencyFund"] });
            queryClient.invalidateQueries({ queryKey: ["goalOverview"] });
        },
        onError: (err: any) => {
            setStatusMsg({ type: "error", text: err.message });
        },
    });

    // Reset Mutation
    const resetMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/investments/reset", { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to reset allocation");
            return data;
        },
        onSuccess: () => {
            setStatusMsg({ type: "success", text: "Reset to system defaults!" });
            queryClient.invalidateQueries({ queryKey: ["investmentSuggestion"] });
            queryClient.invalidateQueries({ queryKey: ["emergencyFund"] });
            queryClient.invalidateQueries({ queryKey: ["goalOverview"] });
        },
        onError: (err: any) => {
            setStatusMsg({ type: "error", text: err.message });
        },
    });

    // Invest Mutation
    const investMutation = useMutation({
        mutationFn: async () => {
            // First save any unsaved manual edits if needed
            await fetch("/api/investments", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ equity, debt, gold, cash }),
            });
            const res = await fetch("/api/investments/invest", { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to record investment");
            return data;
        },
        onSuccess: () => {
            setStatusMsg({ type: "success", text: "Marked as invested! Streak updated." });
            queryClient.invalidateQueries({ queryKey: ["investmentSuggestion"] });
            queryClient.invalidateQueries({ queryKey: ["investmentHistory"] });
            queryClient.invalidateQueries({ queryKey: ["emergencyFund"] });
            queryClient.invalidateQueries({ queryKey: ["goalOverview"] });
        },
        onError: (err: any) => {
            setStatusMsg({ type: "error", text: err.message });
        },
    });

    const currentTotal = equity + debt + gold + cash;
    const maxAllowed = suggestion?.maxInvestable ?? 0;
    const isOverCap = currentTotal > maxAllowed;
    const isInvested = suggestion?.status === "INVESTED";

    return (
        <div className="container max-w-6xl mx-auto space-y-8 p-4 sm:p-6 lg:p-8">
            {/* Header & Back Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
                <div>
                    <Link href="/goals" className="inline-flex items-center text-xs text-indigo-400 hover:text-indigo-300 font-mono mb-2">
                        <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back to Goals
                    </Link>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                        <span>Monthly Investment Strategy</span>
                        {suggestion?.streak > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                                <Flame className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                {suggestion.streak} Cycle Streak
                            </span>
                        )}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">
                        Dynamic percentage-of-surplus allocation based on your current financial phase and salary cycle.
                    </p>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs text-slate-400 bg-slate-900/80 border border-white/10 px-3 py-2 rounded-xl">
                    <Calendar className="h-4 w-4 text-indigo-400" />
                    <span>Pay cycle: <strong className="text-slate-200">{suggestion?.cycleDays ?? 33} days</strong></span>
                </div>
            </div>

            {/* Notification Banner */}
            {statusMsg && (
                <div className={`p-4 rounded-xl border text-xs font-medium flex items-center justify-between ${
                    statusMsg.type === "success" ? "bg-emerald-950/30 border-emerald-500/30 text-emerald-300" : "bg-rose-950/30 border-rose-500/30 text-rose-300"
                }`}>
                    <span>{statusMsg.text}</span>
                    <button onClick={() => setStatusMsg(null)} className="text-xs underline opacity-70 hover:opacity-100">Dismiss</button>
                </div>
            )}

            {/* Threshold Warning Banner if Surplus < ₹500 */}
            {suggestion?.belowMinThreshold && !isInvested && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 flex items-start gap-3">
                    <Info className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-200/90 leading-relaxed">
                        <span className="font-semibold text-amber-300">Low Surplus Warning:</span> Your computed smoothed surplus ({formatCurrency(suggestion.smoothedSurplus)}) is below the recommended minimum threshold of ₹500. Consider building emergency reserves before making micro-allocations.
                    </div>
                </div>
            )}

            {/* Main Interactive Allocation Section */}
            {!isInvested ? (
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Left 2 Cols: Editable Sub-Allocation Inputs */}
                    <Card className="lg:col-span-2 border-indigo-500/20 bg-slate-900/60 shadow-xl backdrop-blur">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                                        <PieChart className="h-5 w-5 text-indigo-400" />
                                        <span>Active Allocation Breakdown</span>
                                    </CardTitle>
                                    <CardDescription>
                                        Edit amounts below. Capital changes adjust liquid EF/Goal balance automatically.
                                    </CardDescription>
                                </div>
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    {suggestion?.phaseLabel}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Inputs Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Equity Input */}
                                <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-950/20 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="equity-input" className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                                            <span className="h-2 w-2 rounded-full bg-indigo-500" />
                                            Equity (Growth)
                                        </Label>
                                        <span className="text-[11px] font-mono text-slate-400">
                                            {currentTotal > 0 ? Math.round((equity / currentTotal) * 100) : 0}%
                                        </span>
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">₹</span>
                                        <Input
                                            id="equity-input"
                                            type="number"
                                            min={0}
                                            value={equity || ""}
                                            onChange={(e) => setEquity(Math.max(0, Number(e.target.value)))}
                                            className="pl-7 font-mono text-sm bg-black/40 border-indigo-500/30 text-white"
                                        />
                                    </div>
                                    <div className="text-[11px] text-slate-500">Suggested: {formatCurrency(suggestion?.buckets.equity.suggested ?? 0)}</div>
                                </div>

                                {/* Debt Input */}
                                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/20 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="debt-input" className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                            Debt (Stability)
                                        </Label>
                                        <span className="text-[11px] font-mono text-slate-400">
                                            {currentTotal > 0 ? Math.round((debt / currentTotal) * 100) : 0}%
                                        </span>
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">₹</span>
                                        <Input
                                            id="debt-input"
                                            type="number"
                                            min={0}
                                            value={debt || ""}
                                            onChange={(e) => setDebt(Math.max(0, Number(e.target.value)))}
                                            className="pl-7 font-mono text-sm bg-black/40 border-emerald-500/30 text-white"
                                        />
                                    </div>
                                    <div className="text-[11px] text-slate-500">Suggested: {formatCurrency(suggestion?.buckets.debt.suggested ?? 0)}</div>
                                </div>

                                {/* Gold Input */}
                                <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-950/20 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="gold-input" className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                                            <span className="h-2 w-2 rounded-full bg-amber-400" />
                                            Gold (Hedge)
                                        </Label>
                                        <span className="text-[11px] font-mono text-slate-400">
                                            {currentTotal > 0 ? Math.round((gold / currentTotal) * 100) : 0}%
                                        </span>
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">₹</span>
                                        <Input
                                            id="gold-input"
                                            type="number"
                                            min={0}
                                            value={gold || ""}
                                            onChange={(e) => setGold(Math.max(0, Number(e.target.value)))}
                                            className="pl-7 font-mono text-sm bg-black/40 border-amber-500/30 text-white"
                                        />
                                    </div>
                                    <div className="text-[11px] text-slate-500">Suggested: {formatCurrency(suggestion?.buckets.gold.suggested ?? 0)}</div>
                                </div>

                                {/* Cash Input */}
                                <div className="p-4 rounded-xl border border-slate-500/20 bg-slate-900/40 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="cash-input" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                                            <span className="h-2 w-2 rounded-full bg-slate-400" />
                                            Cash (Liquid)
                                        </Label>
                                        <span className="text-[11px] font-mono text-slate-400">
                                            {currentTotal > 0 ? Math.round((cash / currentTotal) * 100) : 0}%
                                        </span>
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">₹</span>
                                        <Input
                                            id="cash-input"
                                            type="number"
                                            min={0}
                                            value={cash || ""}
                                            onChange={(e) => setCash(Math.max(0, Number(e.target.value)))}
                                            className="pl-7 font-mono text-sm bg-black/40 border-slate-500/30 text-white"
                                        />
                                    </div>
                                    <div className="text-[11px] text-slate-500">Suggested: {formatCurrency(suggestion?.buckets.cash.suggested ?? 0)}</div>
                                </div>
                            </div>

                            {/* Total Allocation Counter & OverCap Warning */}
                            <div className="rounded-xl border border-white/10 bg-black/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <div className="text-xs uppercase tracking-wider text-slate-400 font-mono">Total Allocation</div>
                                    <div className={`text-2xl font-extrabold font-mono mt-0.5 ${isOverCap ? "text-rose-400" : "text-emerald-400"}`}>
                                        {formatCurrency(currentTotal)}
                                    </div>
                                </div>
                                <div className="text-xs text-right font-mono text-slate-400">
                                    Max Cap: <strong className="text-slate-200">{formatCurrency(maxAllowed)}</strong>
                                </div>
                            </div>

                            {isOverCap && (
                                <p className="text-xs text-rose-400 font-semibold flex items-center gap-1">
                                    <ShieldAlert className="h-4 w-4" /> Total allocation exceeds maximum available liquid balance. Please reduce inputs.
                                </p>
                            )}

                            {/* Action Buttons */}
                            <div className="flex flex-wrap items-center gap-3 pt-2">
                                <Button
                                    onClick={() => saveMutation.mutate()}
                                    disabled={saveMutation.isPending || isOverCap}
                                    className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
                                >
                                    <Save className="h-4 w-4 mr-1.5" />
                                    <span>{saveMutation.isPending ? "Saving..." : "Save Custom Allocations"}</span>
                                </Button>

                                <Button
                                    onClick={() => investMutation.mutate()}
                                    disabled={investMutation.isPending || isOverCap || currentTotal === 0}
                                    className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                                >
                                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                                    <span>{investMutation.isPending ? "Recording..." : "Mark as Invested ✓"}</span>
                                </Button>

                                <Button
                                    variant="outline"
                                    onClick={() => resetMutation.mutate()}
                                    disabled={resetMutation.isPending}
                                    className="rounded-xl border-white/10 hover:bg-white/5"
                                    title="Reset to system defaults"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Right 1 Col: Computation Audit Panel */}
                    <Card className="border-white/10 bg-slate-900/40">
                        <CardHeader>
                            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                                <Info className="h-4 w-4 text-indigo-400" />
                                <span>Computation Audit</span>
                            </CardTitle>
                            <CardDescription className="text-xs">
                                How your monthly investable surplus was calculated.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-xs font-mono">
                            <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                <span className="text-slate-400">Salary Cycle</span>
                                <span className="text-slate-200">{suggestion?.cycleDays ?? 33} days</span>
                            </div>

                            <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                <span className="text-slate-400">Raw Cycle Surplus</span>
                                <span className="text-slate-200">{formatCurrency(suggestion?.rawSurplus ?? 0)}</span>
                            </div>

                            <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                <span className="text-slate-400">Smoothed Surplus (0.7/0.3)</span>
                                <span className="text-indigo-300 font-semibold">{formatCurrency(suggestion?.smoothedSurplus ?? 0)}</span>
                            </div>

                            <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                <span className="text-slate-400">Phase Rate ({suggestion?.phase})</span>
                                <span className="text-slate-200">{suggestion?.investableRate ?? 0}%</span>
                            </div>

                            <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                <span className="text-slate-400">Base Investable</span>
                                <span className="text-slate-200">{formatCurrency(suggestion?.baseInvestable ?? 0)}</span>
                            </div>

                            <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                <span className="text-slate-400">EF/Goal Spillover</span>
                                <span className="text-emerald-400">{formatCurrency(suggestion?.spillover ?? 0)}</span>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-sm">
                                <span className="text-white font-bold">Suggested Total</span>
                                <span className="text-emerald-300 font-bold">{formatCurrency(suggestion?.totalInvestable ?? 0)}</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                /* Invested Mode Confirmation Card */
                <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900/80 to-slate-950 p-6 shadow-2xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-emerald-500/20">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                                <CheckCircle2 className="h-6 w-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Investment Confirmed for this Cycle</h2>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Recorded on {suggestion?.investedAt ? new Date(suggestion.investedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "today"}.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 bg-emerald-950/50 border border-emerald-500/30 px-4 py-2 rounded-xl text-xs font-mono text-emerald-300">
                            <Calendar className="h-4 w-4" />
                            <span>Next suggestion in: <strong>{suggestion?.nextSuggestionIn ?? suggestion?.cycleDays} days</strong></span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                        <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-950/20">
                            <div className="text-xs font-semibold text-indigo-300">Equity</div>
                            <div className="text-lg font-bold font-mono text-white mt-1">{formatCurrency(suggestion?.buckets.equity.final ?? 0)}</div>
                        </div>

                        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/20">
                            <div className="text-xs font-semibold text-emerald-300">Debt</div>
                            <div className="text-lg font-bold font-mono text-white mt-1">{formatCurrency(suggestion?.buckets.debt.final ?? 0)}</div>
                        </div>

                        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-950/20">
                            <div className="text-xs font-semibold text-amber-300">Gold</div>
                            <div className="text-lg font-bold font-mono text-white mt-1">{formatCurrency(suggestion?.buckets.gold.final ?? 0)}</div>
                        </div>

                        <div className="p-4 rounded-xl border border-slate-500/20 bg-slate-900/40">
                            <div className="text-xs font-semibold text-slate-300">Cash</div>
                            <div className="text-lg font-bold font-mono text-white mt-1">{formatCurrency(suggestion?.buckets.cash.final ?? 0)}</div>
                        </div>
                    </div>
                </Card>
            )}

            {/* Investment History Section */}
            <Card className="border-white/10 bg-slate-900/40">
                <CardHeader>
                    <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                        <History className="h-5 w-5 text-indigo-400" />
                        <span>Investment History</span>
                    </CardTitle>
                    <CardDescription>
                        Chronological record of past completed monthly investments.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isHistoryLoading ? (
                        <div className="text-xs font-mono text-slate-500 py-4">Loading history...</div>
                    ) : !historyData?.history?.length ? (
                        <div className="text-xs text-slate-500 py-6 text-center">No past investments recorded yet.</div>
                    ) : (
                        <div className="space-y-3">
                            {historyData.history.map((item: any) => (
                                <div key={item.id} className="p-4 rounded-xl border border-white/5 bg-black/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-white">{formatCurrency(item.totalInvested)}</span>
                                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-300">
                                                {item.phase}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-400 mt-1 font-mono">
                                            Equity: {formatCurrency(item.equity)} · Debt: {formatCurrency(item.debt)} · Gold: {formatCurrency(item.gold)} · Cash: {formatCurrency(item.cash)}
                                        </div>
                                    </div>

                                    <div className="text-xs text-slate-500 font-mono">
                                        {new Date(item.investedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
