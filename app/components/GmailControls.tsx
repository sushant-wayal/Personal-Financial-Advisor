"use client";
import React, { useEffect, useState } from "react";
import Button from "../../src/components/ui/Button";

type Status = "idle" | "connecting" | "connected" | "syncing" | "error";

export default function GmailControls() {
    const [status, setStatus] = useState<Status>("idle");
    const [message, setMessage] = useState("");

    useEffect(() => {
        let cancelled = false;
        async function loadStatus() {
            try {
                const res = await fetch("/api/gmail/status");
                const data = await res.json();
                if (!cancelled) {
                    setStatus(data.connected ? "connected" : "idle");
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

    async function syncGmail() {
        setStatus("syncing");
        setMessage("");
        try {
            const res = await fetch("/api/gmail/sync", { method: "POST" });
            const data = await res.json();
            if (res.ok) {
                setMessage("Sync complete.");
                setStatus("connected");
            } else {
                setMessage(data?.error || "Sync failed.");
                setStatus("error");
            }
        } catch (e: any) {
            setMessage(String(e));
            setStatus("error");
        }
    }

    if (status === "idle") {
        return (
            <a
                href="/api/auth/google/start"
                className="inline-flex h-8 items-center justify-center rounded-md border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white transition-colors duration-150 hover:bg-white/10"
            >
                Connect Gmail
            </a>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={syncGmail} disabled={status === "syncing"}>
                {status === "syncing" ? "Syncing..." : "Sync Gmail"}
            </Button>
            {message && <span className="text-xs text-slate-400">{message}</span>}
        </div>
    );
}