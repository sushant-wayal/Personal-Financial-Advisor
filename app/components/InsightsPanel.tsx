"use client";
import React, { useEffect, useState } from "react";
import Card from "../../src/components/ui/Card";

export default function InsightsPanel() {
    const [insights, setInsights] = useState<any[]>([]);

    async function load() {
        const res = await fetch("/api/insights/generate");
        const data = await res.json();
        setInsights(data.insights || []);
    }

    useEffect(() => {
        load();
    }, []);

    return (
        <Card>
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-sm font-semibold text-white">Insights</div>
                    <div className="text-xs text-slate-400">Key signals from recent activity</div>
                </div>
                <div className="text-xs text-slate-500">Auto-refresh</div>
            </div>
            <div className="mt-4 space-y-3">
                {insights.length === 0 && <div className="text-sm text-slate-500">No insights yet.</div>}
                {insights.map((i, idx) => (
                    <div key={idx} className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <div className="text-sm text-slate-100">{i.message}</div>
                        {i.score != null && <div className="mt-1 text-xs text-slate-500">Score: {Math.round(i.score)}</div>}
                    </div>
                ))}
            </div>
        </Card>
    );
}
