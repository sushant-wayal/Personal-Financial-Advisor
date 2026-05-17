"use client";
import React, { useEffect, useState } from "react";
import Card from "../../src/components/ui/Card";

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
            <div>
                <div className="text-sm font-semibold text-white">Goals</div>
                <div className="text-xs text-slate-400">Targets prioritized by impact</div>
            </div>
            <div className="mt-4 space-y-3">
                {goals.length === 0 && <div className="text-sm text-slate-500">No goals yet.</div>}
                {goals.map((g) => {
                    const progress = Math.round((g.currentAmount / Math.max(1, g.targetAmount)) * 100);
                    const clamped = Math.min(progress, 100);
                    return (
                        <div key={g.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <div className="font-medium text-slate-100">{g.title}</div>
                                    <div className="text-xs text-slate-500">Target ₹{g.targetAmount} • Priority {g.priority}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-slate-400">Progress</div>
                                    <div className="text-base font-semibold text-white">{progress}%</div>
                                </div>
                            </div>
                            <div className="mt-3 h-2 w-full rounded-full bg-white/5">
                                <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${clamped}%` }} />
                            </div>
                            <div className="mt-2 text-xs text-slate-400">
                                Rec. monthly: ₹{g.recommendedMonthly} • ETA: {g.eta?.eta ? new Date(g.eta.eta).toLocaleDateString() : "—"}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}
