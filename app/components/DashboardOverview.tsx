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

export default function DashboardOverview() {
    const { data: monthly = [], isLoading: loadingMonthly } = useQuery({ queryKey: ["monthlyTrend"], queryFn: fetchMonthly });
    const { data: categories = [], isLoading: loadingCats } = useQuery({ queryKey: ["categoryBreakdown"], queryFn: fetchCategories });

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
                            <div className="text-3xl font-semibold text-white">₹ 1,23,456</div>
                            <div className="mt-1 text-sm text-emerald-400">+3.2% since last month</div>
                        </CardContent>
                    </Card>
                </motion.div>
                <motion.div variants={itemMotion}>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Savings rate</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="mt-3 text-3xl font-semibold text-white">32%</div>
                            <div className="mt-1 text-sm text-slate-400">On track for your quarterly goal</div>
                        </CardContent>
                    </Card>
                </motion.div>
                <motion.div variants={itemMotion}>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Burn rate</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="mt-3 text-3xl font-semibold text-white">₹ 3,300 / mo</div>
                            <div className="mt-1 text-sm text-amber-300">Watch discretionary spend</div>
                        </CardContent>
                    </Card>
                </motion.div>
                <motion.div variants={itemMotion}>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Runway</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="mt-3 text-3xl font-semibold text-white">14.2 mo</div>
                            <div className="mt-1 text-sm text-slate-400">Based on last 60 days</div>
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
