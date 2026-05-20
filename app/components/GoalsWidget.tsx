"use client";
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

function formatCurrency(amount: number, currency = "INR") {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount || 0);
}

export default function GoalsWidget() {
    const [goals, setGoals] = useState<any[]>([]);

    async function load() {
        const res = await fetch("/api/goals/recommend");
        const data = await res.json();
        setGoals(data.goals || []);
    }

    useEffect(() => {
        load();
    }, []);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Goals</CardTitle>
                <CardDescription>Targets prioritized by impact</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {goals.length === 0 && <div className="text-sm text-muted-foreground">No goals yet.</div>}
                    {goals.map((g) => {
                        const progress = Math.round((g.currentAmount / Math.max(1, g.targetAmount)) * 100);
                        const clamped = Math.min(progress, 100);
                        return (
                            <Card key={g.id} size="sm" className="bg-muted/40">
                                <CardContent className="px-4 py-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <div className="font-medium text-foreground">{g.title}</div>
                                            <div className="text-xs text-muted-foreground">Target {formatCurrency(g.targetAmount, g.currency || "INR")} • Priority {g.priority}</div>
                                            {g.nextMilestone && (
                                                <div className="text-xs text-muted-foreground">Next milestone: {g.nextMilestone.label} at {g.nextMilestone.amountLabel}</div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs text-muted-foreground">Progress</div>
                                            <div className="text-base font-semibold text-foreground">{progress}%</div>
                                        </div>
                                    </div>
                                    <div className="mt-3 h-2 w-full rounded-full bg-muted">
                                        <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${clamped}%` }} />
                                    </div>
                                    <div className="mt-2 text-xs text-muted-foreground">
                                        Rec. monthly: {formatCurrency(g.recommendedMonthly || 0, g.currency || "INR")} • ETA: {g.eta?.eta ? new Date(g.eta.eta).toLocaleDateString() : "—"}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
