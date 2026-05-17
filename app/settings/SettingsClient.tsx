"use client";
import React, { useEffect, useState } from "react";
import Button from "../../src/components/ui/Button";

export default function SettingsClient() {
    const [input, setInput] = useState("");
    const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [message, setMessage] = useState("");

    useEffect(() => {
        let cancelled = false;
        async function load() {
            try {
                const res = await fetch("/api/gmail/senders");
                const data = await res.json();
                if (!cancelled) {
                    setInput((data.senders || []).join(", "));
                }
            } catch (e: any) {
                if (!cancelled) setMessage(String(e));
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    async function save() {
        setStatus("saving");
        setMessage("");
        try {
            const res = await fetch("/api/gmail/senders", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ senders: input }),
            });
            const data = await res.json();
            if (!res.ok) {
                setStatus("error");
                setMessage(data?.error || "Failed to save senders.");
                return;
            }
            setStatus("saved");
            setMessage("Saved sender list.");
        } catch (e: any) {
            setStatus("error");
            setMessage(String(e));
        }
    }

    return (
        <div className="space-y-4">
            <div>
                <div className="text-sm font-semibold text-white">Gmail Senders</div>
                <div className="text-xs text-slate-400">
                    Enter the email addresses that send your bank debit and credit alerts.
                </div>
            </div>
            <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Allowed senders</label>
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    rows={4}
                    className="mt-2 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
                    placeholder="alerts@bank.com, noreply@bank.com"
                />
            </div>
            <div className="flex items-center gap-3">
                <Button onClick={save} disabled={status === "saving"}>
                    {status === "saving" ? "Saving..." : "Save"}
                </Button>
                {message && (
                    <span className={`text-xs ${status === "error" ? "text-red-300" : "text-slate-400"}`}>
                        {message}
                    </span>
                )}
            </div>
        </div>
    );
}
