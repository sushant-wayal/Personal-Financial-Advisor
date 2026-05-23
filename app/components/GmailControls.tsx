"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Status = "idle" | "connecting" | "connected" | "error";

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
                    setMessage(data.connected ? (data.watchActive ? "Automatic sync is active." : "Connected. Watch setup is pending.") : "");
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
            <span className="text-xs text-emerald-400">{message || "Gmail connected. Automatic sync is active."}</span>
        </div>
    );
}