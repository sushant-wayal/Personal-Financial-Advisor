"use client";
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Insights</CardTitle>
                        <CardDescription>Key signals from recent activity</CardDescription>
                    </div>
                    <div className="text-xs text-muted-foreground">Auto-refresh</div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {insights.length === 0 && <div className="text-sm text-muted-foreground">No insights yet.</div>}
                    {insights.map((i, idx) => (
                        <Card key={idx} size="sm" className="bg-muted/40">
                            <CardContent className="px-4 py-4">
                                <div className="text-sm text-foreground">{i.message}</div>
                                {i.score != null && (
                                    <div className="mt-1 text-xs text-muted-foreground">Score: {Math.round(i.score)}</div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
