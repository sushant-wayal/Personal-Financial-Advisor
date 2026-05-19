"use client";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "../../src/components/ui/Card";

const COLORS = ["#38bdf8", "#22c55e", "#f59e0b", "#a855f7", "#f472b6", "#94a3b8"];

async function fetchMonthly() {
    const res = await fetch('/api/analytics/monthly');
    if (!res.ok) throw new Error('Failed');
    const d = await res.json();
    return d.data;
}

async function fetchCategories() {
    const res = await fetch('/api/analytics/categories');
    if (!res.ok) throw new Error('Failed');
    const d = await res.json();
    return d.data;
}

async function fetchBalance() {
    const res = await fetch('/api/analytics/balance');
    if (!res.ok) throw new Error('Failed');
    const d = await res.json();
    return d.data ?? { balance: 0, lastMonthDelta: 0, percentChange: 0 };
}

async function fetchSavingsRate() {
    const res = await fetch('/api/analytics/savings-rate');
    if (!res.ok) throw new Error('Failed');
    const d = await res.json();
    return d.data ?? {
        currentMonthSavingsRate: 0,
        savingsRateChange: 0,
        savingsRateChangeDirection: "neutral",
        previousMonthHasData: false,
        savingsMessage: "Needs improvement",
    };
}

async function fetchBurnRate() {
    const res = await fetch('/api/analytics/burn-rate');
    if (!res.ok) throw new Error('Failed');
    const d = await res.json();
    return d.data ?? {
        burnRate: 0,
        burnRateChange: 0,
        burnRateChangeDirection: "neutral",
        previousPeriodHasData: false,
    };
}

async function fetchRunway() {
    const res = await fetch('/api/analytics/runway');
    if (!res.ok) throw new Error('Failed');
    const d = await res.json();
    return d.data ?? {
        runwayMonths: null,
        previousRunwayMonths: null,
        runwayChange: 0,
        runwayChangeDirection: "neutral",
    };
}

export default function DashboardOverview() {
    const { data: monthly = [], isLoading: loadingMonthly } = useQuery({ queryKey: ["monthlyTrend"], queryFn: fetchMonthly });
    const { data: categories = [], isLoading: loadingCats } = useQuery({ queryKey: ["categoryBreakdown"], queryFn: fetchCategories });
    const { data: balanceData, isLoading: loadingBalance } = useQuery({ queryKey: ["currentBalance"], queryFn: fetchBalance });
    const { data: savingsData, isLoading: loadingSavings } = useQuery({ queryKey: ["monthlySavingsRate"], queryFn: fetchSavingsRate });
    const { data: burnData, isLoading: loadingBurn } = useQuery({ queryKey: ["burnRate"], queryFn: fetchBurnRate });
    const { data: runwayData, isLoading: loadingRunway } = useQuery({ queryKey: ["runway"], queryFn: fetchRunway });

    const balance = balanceData?.balance ?? 0;
    const lastMonthDelta = balanceData?.lastMonthDelta ?? 0;
    const percentChange = balanceData?.percentChange ?? 0;
    const isPositive = lastMonthDelta >= 0;
    const savingsRate = savingsData?.currentMonthSavingsRate ?? 0;
    const savingsRateChange = savingsData?.savingsRateChange ?? 0;
    const savingsDirection = savingsData?.savingsRateChangeDirection ?? "neutral";
    const savingsMessage = savingsData?.savingsMessage ?? "Needs improvement";
    const previousMonthHasData = savingsData?.previousMonthHasData ?? false;
    const burnRate = burnData?.burnRate ?? 0;
    const burnRateChange = burnData?.burnRateChange ?? 0;
    const burnRateDirection = burnData?.burnRateChangeDirection ?? "neutral";
    const previousBurnHasData = burnData?.previousPeriodHasData ?? false;
    const runwayMonths = runwayData?.runwayMonths ?? null;
    const previousRunwayMonths = runwayData?.previousRunwayMonths ?? null;
    const runwayChange = runwayData?.runwayChange ?? 0;
    const runwayDirection = runwayData?.runwayChangeDirection ?? "neutral";

    const runwayLabel = runwayMonths === null ? "Unlimited" : `${runwayMonths.toFixed(1)} mo`;
    const runwayDeltaLabel = Math.abs(runwayChange).toFixed(1);

    const balanceFormatter = new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    const percentFormatter = new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });

    const gridMotion = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.08 } },
    };

    const itemMotion = {
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
    };

    return (
        <div className="space-y-6">
            <motion.div variants={gridMotion} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <motion.div variants={itemMotion}>
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Balance</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-semibold text-white">
                                {balanceFormatter.format(balance)}
                            </div>
                            {loadingBalance ? (
                                <div className="mt-1 text-sm text-slate-400">Loading balance...</div>
                            ) : (
                                <div className={`mt-1 text-sm ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                                    {isPositive ? "▲" : "▼"} {balanceFormatter.format(Math.abs(lastMonthDelta))}
                                    {` (${percentFormatter.format(Math.abs(percentChange))}%) vs last month`}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
                <motion.div variants={itemMotion}>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Savings Rate (This Month)</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="mt-3 text-3xl font-semibold text-white">
                                {Math.round(savingsRate)}%
                            </div>
                            {loadingSavings ? (
                                <div className="mt-1 text-sm text-slate-400">Loading savings rate...</div>
                            ) : previousMonthHasData ? (
                                <div className={`mt-1 text-sm ${savingsDirection === "increase" ? "text-emerald-400" : savingsDirection === "decrease" ? "text-rose-400" : "text-slate-400"}`}>
                                    {savingsDirection === "increase" ? "▲" : savingsDirection === "decrease" ? "▼" : "•"} {Math.abs(Math.round(savingsRateChange))}% vs last month
                                </div>
                            ) : (
                                <div className="mt-1 text-sm text-slate-400">No previous month data</div>
                            )}
                            <div className="mt-1 text-sm text-slate-400">{savingsMessage}</div>
                        </CardContent>
                    </Card>
                </motion.div>
                <motion.div variants={itemMotion}>
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Burn rate</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="mt-3 text-3xl font-semibold text-white">
                                {balanceFormatter.format(Math.round(burnRate))} / mo
                            </div>
                            {loadingBurn ? (
                                <div className="mt-1 text-sm text-slate-400">Loading burn rate...</div>
                            ) : previousBurnHasData ? (
                                <div className={`mt-1 text-sm ${burnRateDirection === "increase" ? "text-rose-400" : burnRateDirection === "decrease" ? "text-emerald-400" : "text-slate-400"}`}>
                                    {burnRateDirection === "increase" ? "▲" : burnRateDirection === "decrease" ? "▼" : "•"} {balanceFormatter.format(Math.abs(Math.round(burnRateChange)))} vs previous period
                                </div>
                            ) : (
                                <div className="mt-1 text-sm text-slate-400">No previous period data</div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
                <motion.div variants={itemMotion}>
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Runway</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="mt-3 text-3xl font-semibold text-white">{runwayLabel}</div>
                            {loadingRunway ? (
                                <div className="mt-1 text-sm text-slate-400">Loading runway...</div>
                            ) : previousRunwayMonths === null ? (
                                <div className="mt-1 text-sm text-slate-400">No previous period data</div>
                            ) : runwayDirection === "neutral" ? (
                                <div className="mt-1 text-sm text-slate-400">No change vs previous period</div>
                            ) : (
                                <div className={`mt-1 text-sm ${runwayDirection === "increase" ? "text-emerald-400" : "text-rose-400"}`}>
                                    {runwayDirection === "increase" ? "▲" : "▼"} {runwayDeltaLabel} mo vs previous period
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            </motion.div>

            <motion.div variants={gridMotion} initial="hidden" animate="show" className="grid gap-6 lg:grid-cols-3">
                <motion.div variants={itemMotion} className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-semibold text-white">Monthly cashflow</CardTitle>
                            <div className="text-xs text-slate-400">Income vs expense across the last 6 months</div>
                        </CardHeader>
                        <CardContent>
                            <div className="mt-4" style={{ width: "100%", height: 240 }}>
                                <ResponsiveContainer>
                                    <LineChart data={monthly} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                                        <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={{ stroke: "#1f2937" }} tickLine={false} />
                                        <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={{ stroke: "#1f2937" }} tickLine={false} />
                                        <Tooltip
                                            contentStyle={{
                                                background: "#0b0d10",
                                                border: "1px solid rgba(255,255,255,0.12)",
                                                borderRadius: "10px",
                                                color: "#e5e7eb",
                                            }}
                                        />
                                        <Line type="monotone" dataKey="income" stroke="#22c55e" strokeWidth={2} dot={false} />
                                        <Line type="monotone" dataKey="expense" stroke="#f97316" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                                {loadingMonthly && <div className="mt-3 text-xs text-slate-500">Loading cashflow...</div>}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
                <motion.div variants={itemMotion}>
                    <Card className="h-full">
                        <div className="text-sm font-semibold text-white">Category breakdown</div>
                        <div className="text-xs text-slate-400">Last 30 days of spend</div>
                        <div className="mt-4" style={{ width: "100%", height: 220 }}>
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie data={categories} dataKey="value" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={2}>
                                        {categories.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            background: "#0b0d10",
                                            border: "1px solid rgba(255,255,255,0.12)",
                                            borderRadius: "10px"
                                        }}
                                        itemStyle={{
                                            color: "#e5e7eb"
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            {loadingCats && <div className="mt-3 text-xs text-slate-500">Loading categories...</div>}
                        </div>
                    </Card>
                </motion.div>
            </motion.div>
        </div>
    );
}
