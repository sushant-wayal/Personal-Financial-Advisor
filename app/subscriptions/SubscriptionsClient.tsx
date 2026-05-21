"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function SubscriptionsClient() {
    const [subs, setSubs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function load() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/subscriptions`);
            const data = await res.json();
            setSubs(data.subscriptions || []);
        } catch (e: any) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    }

    async function runDetect() {
        setLoading(true);
        try {
            const res = await fetch(`/api/subscriptions/detect`, { method: "POST" });
            const data = await res.json();
            // detection endpoint both creates/updates subscriptions; reload list
            await load();
        } catch (e: any) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    }

    async function toggleActive(id: string, active: boolean) {
        try {
            await fetch(`/api/subscriptions`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, data: { active: !active } }) });
            await load();
        } catch (e: any) {
            setError(String(e));
        }
    }

    async function remove(id: string) {
        if (!confirm("Delete this subscription?")) return;
        try {
            await fetch(`/api/subscriptions`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
            await load();
        } catch (e: any) {
            setError(String(e));
        }
    }

    useEffect(() => {
        load();
    }, []);

    return (
        <div className="grid gap-4">
            <div className="flex items-center gap-2">
                <Button onClick={load} variant="secondary" className={"rounded-lg"}>Refresh</Button>
                <Button onClick={runDetect} className={"rounded-lg"}>Run Detection</Button>
                {loading && <div className="text-xs text-slate-400">Loading...</div>}
            </div>

            {error && <div className="text-sm text-rose-400">{error}</div>}

            {subs.length === 0 && !loading && <div className="text-sm text-slate-500">No subscriptions found.</div>}

            {subs.map((s) => (
                <Card key={s.id} className="bg-muted/40">
                    <CardContent className="flex items-center justify-between gap-4 px-4 py-3">
                        <div>
                            <div className="font-medium text-foreground">{s.merchant}</div>
                            <div className="text-xs text-muted-foreground">₹{s.amount} • {s.interval}</div>
                            <div className="text-xs text-muted-foreground">Next: {s.nextCharge ? new Date(s.nextCharge).toLocaleDateString() : "-"}</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button size="sm" variant={s.active ? "destructive" : "outline"} onClick={() => toggleActive(s.id, s.active)}>
                                {s.active ? "Disable" : "Enable"}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>Delete</Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
