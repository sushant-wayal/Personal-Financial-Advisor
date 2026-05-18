"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
        <Card>
            <CardHeader>
                <CardTitle>Gmail Senders</CardTitle>
                <CardDescription>
                    Enter the email addresses that send your bank debit and credit alerts.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="gmail-senders">Allowed senders</Label>
                        <Textarea
                            id="gmail-senders"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            rows={4}
                            placeholder="alerts@bank.com, noreply@bank.com"
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <Button onClick={save} disabled={status === "saving"} className={"rounded-lg"}>
                            {status === "saving" ? "Saving..." : "Save"}
                        </Button>
                        {message && (
                            <span className={`text-xs ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                                {message}
                            </span>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
