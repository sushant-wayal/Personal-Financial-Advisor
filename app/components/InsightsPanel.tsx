"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type Insight = {
    id?: string;
    type?: string;
    message: string;
    score?: number | null;
    createdAt?: string;
};

function getInsightColor(type?: string): string {
    const colorMap: Record<string, string> = {
        ai_summary: "border-cyan-500/30 bg-cyan-950/20",
        savings_rate: "border-emerald-500/30 bg-emerald-950/20",
        burn_rate: "border-red-500/30 bg-red-950/20",
        runway: "border-amber-500/30 bg-amber-950/20",
        activity_snapshot: "border-blue-500/30 bg-blue-950/20",
        large_expense: "border-orange-500/30 bg-orange-950/20",
        merchant_frequency: "border-purple-500/30 bg-purple-950/20",
        monthly_spend_trend: "border-pink-500/30 bg-pink-950/20",
        top_category: "border-indigo-500/30 bg-indigo-950/20",
        behavior_weekend_spend: "border-rose-500/30 bg-rose-950/20",
        late_food: "border-lime-500/30 bg-lime-950/20",
        weekend_concentration: "border-teal-500/30 bg-teal-950/20",
        behavior_top_merchant: "border-fuchsia-500/30 bg-fuchsia-950/20",
    };
    return colorMap[type || ""] || "border-slate-500/30 bg-slate-950/20";
}

function getInsightIcon(type?: string): string {
    const iconMap: Record<string, string> = {
        ai_summary: "✨",
        savings_rate: "💰",
        burn_rate: "🔥",
        runway: "📈",
        activity_snapshot: "📊",
        large_expense: "💸",
        merchant_frequency: "🛍️",
        monthly_spend_trend: "📉",
        top_category: "🎯",
        behavior_weekend_spend: "🎉",
        late_food: "🍜",
        weekend_concentration: "📅",
        behavior_top_merchant: "⭐",
    };
    return iconMap[type || ""] || "💡";
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

export default function InsightsPanel() {
    const [insights, setInsights] = useState<Insight[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
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
        setRefreshing(true);
        setError(null);
        try {
            const res = await fetch("/api/insights/generate", { method: "POST" });
            if (!res.ok) {
                throw new Error("Failed to generate insights");
            }
            await loadInsights();
        } catch (analysisError) {
            setError(analysisError instanceof Error ? analysisError.message : String(analysisError));
        } finally {
            setRefreshing(false);
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

    const aiInsight = insights.find((i) => i.type === "ai_summary");
    const otherInsights = insights.filter((i) => i.type !== "ai_summary");

    return (
        <div className="space-y-6">
            <Card className={!error && !loading ? "pb-0" : ""}>
                <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <CardTitle>Insights & Analysis</CardTitle>
                            <CardDescription>Financial signals from your transactions</CardDescription>
                        </div>
                        <CardAction>
                            <Button
                                type="button"
                                variant="outline"
                                size="xs"
                                onClick={runAnalysis}
                                disabled={loading || refreshing}
                            >
                                {refreshing ? "Running..." : "Refresh"}
                            </Button>
                        </CardAction>
                    </div>
                </CardHeader>
                <CardContent className={!error && !loading ? "h-0" : ""}>
                    {error && <div className="text-sm text-rose-400 mb-4">{error}</div>}
                    {loading ? (
                        <div className="text-sm text-muted-foreground">Loading insights...</div>
                    ) : insights.length === 0 ? (
                        <div className="text-sm text-muted-foreground">No insights yet. Run analysis to generate them.</div>
                    ) : null}
                </CardContent>
            </Card>

            {aiInsight && (
                <Card className={`border ${getInsightColor(aiInsight.type)}`}>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">{getInsightIcon(aiInsight.type)}</span>
                            <div>
                                <CardTitle className="text-base">AI-Generated Summary</CardTitle>
                                <CardDescription>Personalized analysis from your transactions</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="prose prose-invert prose-sm max-w-none text-foreground">
                            <ReactMarkdown
                                components={{
                                    p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
                                    ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
                                    ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
                                    li: ({ children }) => <li className="text-sm">{children}</li>,
                                    strong: ({ children }) => <strong className="font-semibold text-emerald-300">{children}</strong>,
                                    em: ({ children }) => <em className="italic text-cyan-300">{children}</em>,
                                    h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                                    h2: ({ children }) => <h2 className="text-base font-semibold mb-2">{children}</h2>,
                                    h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
                                }}
                            >
                                {aiInsight.message}
                            </ReactMarkdown>
                        </div>
                    </CardContent>
                </Card>
            )}

            {otherInsights.length > 0 && (
                <div>
                    <div className="mb-4">
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Key Metrics</h3>
                    </div>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                        {otherInsights.map((insight, index) => (
                            <Card
                                key={insight.id || `${insight.type || "insight"}-${index}`}
                                className={`border ${getInsightColor(insight.type)}`}
                            >
                                <CardContent className="px-4 py-3">
                                    <div className="flex items-start gap-2">
                                        <span className="text-xl flex-shrink-0 mt-0.5">{getInsightIcon(insight.type)}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-foreground leading-relaxed break-words">{insight.message}</p>
                                            {insight.score != null && (
                                                <div className="mt-2 inline-block bg-slate-800/50 rounded px-2 py-1">
                                                    <div className="text-xs text-slate-300">
                                                        Score: <span className="font-semibold text-emerald-400">{Math.round(insight.score)}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
