"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

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
                if (res.status === 401) {
                    setMessage("Authentication failed. Please reconnect.");
                    setStatus("idle"); // Revert to connect button
                } else {
                    setMessage(data?.error || "Sync failed.");
                    setStatus("error");
                }
            }
        } catch (e: any) {
            setMessage(String(e));
            setStatus("error");
        }
    }

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
        <div className="flex items-center gap-2">
            <Button size="sm" onClick={syncGmail} disabled={status === "syncing"} className={"rounded-lg"}>
                {status === "syncing" ? "Syncing..." : "Sync Gmail"}
            </Button>
            {message && <span className="text-xs text-slate-400">{message}</span>}
        </div>
    );
}