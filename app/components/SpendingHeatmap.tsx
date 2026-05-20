"use client";

import React, { useEffect, useState } from "react";

function colorFor(value: number, max: number) {
    if (max <= 0) return "bg-slate-800";
    const v = Math.min(1, value / max);
    if (v === 0) return "bg-slate-800";
    if (v < 0.2) return "bg-emerald-900";
    if (v < 0.4) return "bg-emerald-700";
    if (v < 0.6) return "bg-amber-700";
    if (v < 0.8) return "bg-orange-600";
    return "bg-rose-500";
}

export default function SpendingHeatmap() {
    const [data, setData] = useState<Array<{ date: string; amount: number }>>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            try {
                const res = await fetch('/api/analytics/heatmap');
                const d = await res.json();
                if (!cancelled) setData(d.data || []);
            } catch (e) {
                // ignore
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => { cancelled = true; };
    }, []);

    const map = new Map(data.map((d) => [d.date, d.amount]));
    const amounts = data.map((d) => d.amount);
    const max = Math.max(0, ...amounts);

    // build last 90 days array
    const days: { date: string; amount: number }[] = [];
    const now = new Date();
    for (let i = 89; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        days.push({ date: key, amount: map.get(key) || 0 });
    }

    return (
        <div>
            <div className="text-sm font-semibold text-white">Spending heatmap (last 90 days)</div>
            <div className="text-xs text-slate-400 mb-2">Daily spend intensity</div>
            <div className="grid grid-cols-18 gap-1">
                {days.map((d) => (
                    <div key={d.date} title={`${d.date}: ₹${Math.round(d.amount)}`} className={`w-6 h-6 rounded ${colorFor(d.amount, max)}`} />
                ))}
            </div>
            <div className="mt-2 text-xs text-slate-400">Legend: low → high</div>
        </div>
    );
}
