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
    const [data, setData] = useState<Array<{ date: string; amount: number; weekday?: number; weekIndex?: number }>>([]);
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

    const amounts = data.map((d) => d.amount);
    const max = Math.max(0, ...amounts);
    const totalWeeks = Math.max(1, Math.ceil(data.length / 7));
    const weekMatrix = Array.from({ length: totalWeeks }, (_, weekIndex) =>
        Array.from({ length: 7 }, (_, weekday) => data.find((d) => d.weekIndex === weekIndex && d.weekday === weekday) || null)
    );
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return (
        <div>
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-sm font-semibold text-white">Spending heatmap (last 90 days)</div>
                    <div className="text-xs text-slate-400">Daily spend intensity across the calendar</div>
                </div>
                {loading && <div className="text-xs text-slate-500">Loading...</div>}
            </div>
            <div className="mt-4 overflow-x-auto pb-1">
                <div className="min-w-[720px] space-y-2">
                    <div className="grid grid-cols-7 gap-1 text-[10px] text-slate-500">
                        {dayLabels.map((label) => <div key={label} className="px-1">{label}</div>)}
                    </div>
                    <div className="space-y-1">
                        {weekMatrix.map((week, weekIndex) => (
                            <div key={weekIndex} className="grid grid-cols-7 gap-1">
                                {week.map((cell, weekday) => (
                                    cell ? (
                                        <div
                                            key={cell.date}
                                            title={`${cell.date}: ₹${Math.round(cell.amount)}`}
                                            className={`h-7 rounded-md border border-white/5 ${colorFor(cell.amount, max)}`}
                                        />
                                    ) : (
                                        <div key={`empty-${weekIndex}-${weekday}`} className="h-7 rounded-md bg-slate-900/40" />
                                    )
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            <div className="mt-2 text-xs text-slate-400">Legend: low → high</div>
        </div>
    );
}
