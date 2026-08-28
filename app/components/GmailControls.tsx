"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Status = "idle" | "connecting" | "connected" | "error";

type GmailStatusResponse = {
    connected?: boolean;
    watchActive?: boolean;
    watchExpired?: boolean;
    renewalError?: string | null;
};

export default function GmailControls() {
    const [status, setStatus] = useState<Status>("idle");
    const [message, setMessage] = useState("");
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        async function loadStatus() {
            try {
                const res = await fetch("/api/gmail/status");
                const data = await res.json() as GmailStatusResponse;
                if (!cancelled) {
                    setStatus(data.connected ? "connected" : "idle");
                    setMessage(data.connected
                        ? data.watchActive
                            ? "Automatic sync is active."
                            : data.watchExpired
                                ? `Automatic sync expired${data.renewalError ? ": renewal failed." : "."}`
                                : "Connected. Watch setup is pending."
                        : "");
                }
            } catch {
                if (!cancelled) setStatus("error");
            }
        }
        loadStatus();
        return () => {
            cancelled = true;
        };
    }, []);

    const handleSync = async () => {
        setSyncing(true);
        setSyncResult(null);
        try {
            const res = await fetch("/api/gmail/sync", { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Sync failed");
            const count = data.processed?.length ?? data.messageIds?.length ?? 0;
            setSyncResult(`Synced (${count} msgs)`);
            setTimeout(() => setSyncResult(null), 4000);
        } catch (e: any) {
            setSyncResult(e.message || "Sync failed");
            setTimeout(() => setSyncResult(null), 4000);
        } finally {
            setSyncing(false);
        }
    };

    if (status === "idle" || status === "error") {
        return (
            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                        window.location.href = "/api/auth/google/start";
                    }}
                    className={"rounded-lg"}
                >
                    Connect Gmail
                </Button>
                {message && status === "error" && <span className="text-xs text-red-400">{message}</span>}
            </div>
        );
    }

    return (
        <div className="flex items-center gap-3">
            <span className="text-xs text-emerald-400">{syncResult || message || "Gmail connected. Automatic sync is active."}</span>
            <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={syncing}
                className="h-7 px-2.5 text-xs rounded-md bg-zinc-900/50 border-zinc-700 hover:bg-zinc-800 text-zinc-200"
            >
                {syncing ? "Syncing..." : "Sync Now"}
            </Button>
        </div>
    );
}
