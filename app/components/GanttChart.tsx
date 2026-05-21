"use client";

import React from "react";
import { GanttChartData } from "@/src/services/GoalTimelineService";

interface GanttChartProps {
    data: GanttChartData;
    height?: number;
    showLegend?: boolean;
}

export function GanttChart({ data, height = 300, showLegend = true }: GanttChartProps) {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthLabels: string[] = [];
    let current = new Date(data.startDate);

    for (let i = 0; i < data.numMonths; i++) {
        const shortMonth = monthNames[current.getMonth()];
        const year = current.getFullYear() % 100;
        monthLabels.push(i % 3 === 0 ? `${shortMonth}\n${year}` : "");
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }

    const pixelsPerMonth = Math.max(20, 800 / Math.max(1, data.numMonths));
    const rowHeight = 40;
    const chartHeight = data.segments.length * rowHeight + 60 + (showLegend ? 40 : 0);

    function getSegmentPosition(segment: any): { left: number; width: number } {
        const startMonths = Math.round(monthsBetween(data.startDate, segment.startDate));
        const endDate = segment.endDate || data.today;
        const durationMonths = Math.max(0.5, monthsBetween(segment.startDate, endDate));

        return {
            left: startMonths * pixelsPerMonth,
            width: durationMonths * pixelsPerMonth,
        };
    }

    function monthsBetween(from: Date, to: Date): number {
        return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    }

    function getProgressIndicator(segment: any): number {
        return Math.min(100, Math.max(0, segment.progressPct || 0));
    }

    return (
        <div className="w-full overflow-x-auto rounded-lg border border-slate-700 bg-slate-950">
            <div className="inline-block min-w-full">
                {/* Header */}
                <div className="sticky top-0 flex border-b border-slate-700 bg-slate-900">
                    <div className="w-32 flex-shrink-0 border-r border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300">Goal</div>
                    <div className="flex flex-1">
                        {monthLabels.map((label, i) => (
                            <div
                                key={i}
                                style={{ width: `${pixelsPerMonth}px` }}
                                className="border-r border-slate-700 px-1 py-2 text-right text-xs text-slate-500"
                            >
                                {label}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Segments */}
                {data.segments.map((segment, idx) => {
                    const { left, width } = getSegmentPosition(segment);
                    const progress = getProgressIndicator(segment);
                    const isOverdue = segment.endDate && segment.endDate < data.today;

                    return (
                        <div key={segment.goalId} className="flex border-b border-slate-700">
                            <div className="w-32 flex-shrink-0 border-r border-slate-700 bg-slate-900/50 px-3 py-2">
                                <div className="text-xs font-medium text-slate-100 truncate">{segment.goalTitle}</div>
                                <div className="text-xs text-slate-400">P{segment.priority}</div>
                            </div>
                            <div className="relative flex-1" style={{ height: `${rowHeight}px` }}>
                                {/* Month grid lines */}
                                {monthLabels.map((_, i) => (
                                    <div
                                        key={`grid-${i}`}
                                        className="absolute top-0 bottom-0 border-r border-slate-800"
                                        style={{ left: `${i * pixelsPerMonth}px`, width: "1px" }}
                                    />
                                ))}

                                {/* Today line */}
                                <div
                                    className="absolute top-0 bottom-0 border-l border-dashed border-red-500/50"
                                    style={{ left: `${(data.numMonths + monthsBetween(data.endDate, data.today)) * pixelsPerMonth}px` }}
                                />

                                {/* Bar */}
                                <div
                                    className={`absolute top-1/2 -translate-y-1/2 rounded border-l-4 px-2 py-1 text-xs font-medium text-white/90 shadow-md transition-all ${isOverdue ? "bg-red-900/60 border-l-red-500" : `bg-opacity-80 border-l-[${segment.color}]`
                                        }`}
                                    style={{
                                        left: `${left}px`,
                                        width: `${Math.max(40, width)}px`,
                                        backgroundColor: isOverdue ? "#7c2d12" : segment.color,
                                        borderLeftColor: segment.color,
                                    }}
                                >
                                    <div className="flex items-center gap-1 truncate">
                                        <span>{progress}%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Legend */}
                {showLegend && (
                    <div className="border-t border-slate-700 bg-slate-900/50 px-4 py-2 flex gap-4 text-xs text-slate-300">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500" />
                            <span>Ahead of Schedule</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500" />
                            <span>On Track</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-amber-500" />
                            <span>At Risk</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <span>Off Track / Overdue</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
