"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Calendar, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatCurrency } from "@/src/services/shared/formatting";

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

function formatDisplayDate(dateStr: string) {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-").map(Number);
    if (!year || !month || !day) return dateStr;
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

type HeatmapCell = {
    date: string;
    amount: number;
    weekday?: number;
    weekIndex?: number;
};

export default function SpendingHeatmap() {
    const [data, setData] = useState<Array<HeatmapCell>>([]);
    const [loading, setLoading] = useState(false);
    const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            try {
                const res = await fetch('/api/analytics/heatmap');
                const d = await res.json();
                if (!cancelled) setData(d.data || []);
            } catch {
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
    const firstWeekday = data[0]?.weekday ?? 0;
    const totalSlots = firstWeekday + data.length;
    const totalWeeks = Math.max(1, Math.ceil(totalSlots / 7));
    const weekMatrix = Array.from({ length: totalWeeks }, () =>
        Array.from({ length: 7 }, () => null as HeatmapCell | null)
    );

    data.forEach((cell, index) => {
        const slot = firstWeekday + index;
        const weekIndex = Math.floor(slot / 7);
        const weekday = slot % 7;
        if (weekMatrix[weekIndex]) {
            weekMatrix[weekIndex][weekday] = cell;
        }
    });

    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return (
        <div>
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="text-sm font-semibold text-white">Spending heatmap (last 90 days)</div>
                    <div className="text-xs text-slate-400">Daily spend intensity across the calendar. Click a date to view details.</div>
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
                                        <button
                                            type="button"
                                            key={cell.date}
                                            onClick={() => setSelectedCell((prev) => (prev?.date === cell.date ? null : cell))}
                                            title={`${cell.date}: ₹${Math.round(cell.amount)}`}
                                            className={`h-7 w-full rounded-md border transition-all duration-150 text-left focus:outline-none ${colorFor(cell.amount, max)} ${
                                                selectedCell?.date === cell.date
                                                    ? "border-emerald-400 ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900 scale-105 z-10 shadow-lg shadow-emerald-500/20"
                                                    : "border-white/5 hover:border-white/30 hover:scale-[1.03]"
                                            }`}
                                            aria-label={`Spending for ${cell.date}: ₹${Math.round(cell.amount)}`}
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

            {selectedCell && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-950/40 px-4 py-3 backdrop-blur-md transition-all duration-200">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Calendar className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="text-xs font-semibold text-slate-200">
                                {formatDisplayDate(selectedCell.date)}
                            </div>
                            <div className="text-xs text-slate-400">
                                Total spend: <span className="font-semibold text-emerald-400 font-mono">{formatCurrency(selectedCell.amount)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            href={`/transactions?dateRange=custom&dateFrom=${selectedCell.date}&dateTo=${selectedCell.date}`}
                            className={buttonVariants({
                                size: "xs",
                                className: "bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-medium",
                            })}
                        >
                            Details
                            <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Link>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setSelectedCell(null)}
                            className="text-slate-400 hover:text-white"
                            title="Dismiss"
                        >
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            )}

            <div className="mt-2 text-xs text-slate-400">Legend: low → high</div>
        </div>
    );
}

