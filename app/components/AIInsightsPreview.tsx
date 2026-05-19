"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type Insight = {
    id?: string;
    type?: string;
    message: string;
    score?: number | null;
    createdAt?: string;
};

const INSIGHT_PRIORITY: Record<string, number> = {
    ai_summary: 100,
    monthly_spend_trend: 82,
    top_category: 78,
    large_expense: 72,
    merchant_frequency: 66,
    behavior_top_merchant: 65,
    behavior_weekend_spend: 62,
    weekend_concentration: 60,
    late_food: 58,
    activity_snapshot: 50,
};

const EXCLUDED_PREVIEW_TYPES = new Set(["savings_rate", "runway", "burn_rate"]);

function getInsightLabel(type?: string) {
    const labels: Record<string, string> = {
        ai_summary: "AI Summary",
        savings_rate: "Savings Rate",
        runway: "Runway",
        burn_rate: "Burn Rate",
        monthly_spend_trend: "Spend Trend",
        top_category: "Top Category",
        large_expense: "Large Expense",
        merchant_frequency: "Merchant Pattern",
        behavior_top_merchant: "Merchant Pattern",
        behavior_weekend_spend: "Weekend Spend",
        weekend_concentration: "Weekend Spend",
        late_food: "Late-Night Food",
        activity_snapshot: "Activity Snapshot",
    };

    return labels[type || ""] || "Insight";
}

function getInsightEmoji(type?: string) {
    const icons: Record<string, string> = {
        ai_summary: "✨",
        savings_rate: "💰",
        runway: "📈",
        burn_rate: "🔥",
        monthly_spend_trend: "📉",
        top_category: "🎯",
        large_expense: "💸",
        merchant_frequency: "🛍️",
        behavior_top_merchant: "🛍️",
        behavior_weekend_spend: "🎉",
        weekend_concentration: "📅",
        late_food: "🍜",
        activity_snapshot: "📊",
    };

    return icons[type || ""] || "💡";
}

function getInsightRank(type?: string) {
    return INSIGHT_PRIORITY[type || ""] ?? 0;
}

function truncateMessage(message: string, maxLength: number) {
    const normalized = message.replace(/\s+/g, " ").trim();
    if (normalized.length <= maxLength) {
        return normalized;
    }

    return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

function shouldAutoRunAnalysis(insights: Insight[]) {
    if (!insights.length) {
        return true;
    }

    const latestCreatedAt = insights
        .map((insight) => (insight.createdAt ? new Date(insight.createdAt).getTime() : Number.NaN))
        .find((timestamp) => Number.isFinite(timestamp));

    if (!Number.isFinite(latestCreatedAt)) {
        return true;
    }

    return Date.now() - (latestCreatedAt as number) > ONE_WEEK_MS;
}

function getInsightSummary(insight: Insight) {
    return truncateMessage(insight.message, insight.type === "ai_summary" ? 100 : 78);
}

export default function AIInsightsPreview() {
    const [insights, setInsights] = useState<Insight[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const bootstrappedRef = useRef(false);

    const loadInsights = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/insights/generate", { cache: "no-store" });
            if (!res.ok) {
                throw new Error("Failed to load insights");
            }

            const data = await res.json();
            const nextInsights = Array.isArray(data.insights) ? data.insights : [];
            setInsights(nextInsights);
            return nextInsights as Insight[];
        } catch (loadError) {
            setInsights([]);
            setError(loadError instanceof Error ? loadError.message : String(loadError));
            return [] as Insight[];
        } finally {
            setLoading(false);
        }
    }, []);

    const runAnalysis = useCallback(async () => {
        setError(null);
        try {
            const res = await fetch("/api/insights/generate", { method: "POST" });
            if (!res.ok) {
                throw new Error("Failed to generate insights");
            }

            await loadInsights();
        } catch (analysisError) {
            setError(analysisError instanceof Error ? analysisError.message : String(analysisError));
        }
    }, [loadInsights]);

    useEffect(() => {
        let mounted = true;

        (async () => {
            const currentInsights = await loadInsights();
            if (mounted && shouldAutoRunAnalysis(currentInsights) && !bootstrappedRef.current) {
                bootstrappedRef.current = true;
                await runAnalysis();
            }
        })();

        return () => {
            mounted = false;
        };
    }, [loadInsights, runAnalysis]);

    const previewInsights = useMemo(() => {
        return [...insights]
            .filter((insight) => !EXCLUDED_PREVIEW_TYPES.has(insight.type || ""))
            .sort((left, right) => {
                const leftRank = getInsightRank(left.type);
                const rightRank = getInsightRank(right.type);

                if (leftRank !== rightRank) {
                    return rightRank - leftRank;
                }

                const leftScore = left.score ?? 0;
                const rightScore = right.score ?? 0;

                if (leftScore !== rightScore) {
                    return rightScore - leftScore;
                }

                const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
                const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;

                return rightTime - leftTime;
            })
            .slice(0, 3);
    }, [insights]);

    return (
        <div className="space-y-2">
            {error && <div className="text-xs text-rose-400">{error}</div>}
            {loading ? (
                <div className="text-xs text-muted-foreground">Loading insights...</div>
            ) : previewInsights.length === 0 ? (
                <div className="text-xs text-muted-foreground">No insights yet.</div>
            ) : (
                <div className="grid gap-2 lg:grid-cols-3">
                    {previewInsights.map((insight, index) => (
                        <div
                            key={insight.id || `${insight.type || "insight"}-${index}`}
                            className="rounded-xl border border-border/70 bg-card/70 px-3 py-2.5 shadow-[0_8px_24px_rgba(8,10,18,0.18)] backdrop-blur-sm"
                        >
                            <div className="flex items-start gap-2">
                                <div className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary/15 text-sm ring-1 ring-primary/20">
                                    {getInsightEmoji(insight.type)}
                                </div>
                                <div className="min-w-0 flex-1 space-y-1.5">
                                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                        {getInsightLabel(insight.type)}
                                    </div>
                                    <p className="text-xs leading-snug text-foreground/90">
                                        {getInsightSummary(insight)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <div>
                <Link
                    href="/insights"
                    className={cn(
                        buttonVariants({ variant: "secondary", size: "xs" }),
                        "rounded-lg border border-primary/20 bg-primary/10 text-primary hover:bg-primary/15"
                    )}
                >
                    View Full Insights
                </Link>
            </div>
        </div>
    );
}