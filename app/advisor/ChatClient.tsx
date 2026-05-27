"use client";
import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ArtifactRenderer from "../components/advisor/ArtifactRenderer";
import type { AdvisorResponse } from "@/types/advisor";

type ChatTurn = { question: string; response: AdvisorResponse | null };

function coerceAdvisorResponse(value: unknown): AdvisorResponse {
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) {
            return { narrative: "No response", artifacts: [] };
        }

        try {
            const parsed = JSON.parse(trimmed);
            return coerceAdvisorResponse(parsed);
        } catch {
            return { narrative: trimmed, artifacts: [] };
        }
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
        const record = value as Record<string, unknown>;
        const narrative = typeof record.narrative === "string"
            ? record.narrative
            : typeof record.text === "string"
                ? record.text
                : typeof record.content === "string"
                    ? record.content
                    : "";
        const artifacts = Array.isArray(record.artifacts) ? record.artifacts as AdvisorResponse["artifacts"] : [];

        if (!narrative.trim() && typeof record === "object") {
            return { narrative: JSON.stringify(record), artifacts: [] };
        }

        return { narrative: narrative.trim() || "No response", artifacts };
    }

    return { narrative: String(value ?? "No response"), artifacts: [] };
}

export default function ChatClient() {
    const [q, setQ] = useState("");
    const [threads, setThreads] = useState<ChatTurn[]>([]);
    const [loading, setLoading] = useState(false);
    const liveRef = useRef<HTMLDivElement | null>(null);
    const inFlightRef = useRef(false);

    useEffect(() => {
        if (liveRef.current) liveRef.current.scrollTop = liveRef.current.scrollHeight;
    }, [threads]);

    async function send() {
        if (!q.trim()) return;
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        const user = q.trim();
        setThreads((prev) => [...prev, { question: user, response: null }]);
        setQ("");
        setLoading(true);
        try {
            const history: Array<{ question: string; response: string }> = threads
                .slice(-8)
                .map((turn) => ({
                    question: turn.question,
                    response: turn.response?.narrative || "",
                }));
            const res = await fetch('/api/ai/advisor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: user, history }),
            });
            const contentType = res.headers.get("content-type") || "";
            let reply: AdvisorResponse;

            if (contentType.includes("application/json")) {
                const data = await res.json();
                reply = coerceAdvisorResponse(data);
            } else {
                const raw = await res.text();
                reply = coerceAdvisorResponse(raw);
            }

            setThreads((prev) => {
                if (!prev.length) return prev;
                const next = [...prev];
                const last = next[next.length - 1];
                next[next.length - 1] = { ...last, response: reply };
                return next;
            });

            if (reply.narrative.trim()) {
                try {
                    await fetch('/api/ai/memory', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: `chat:${Date.now()}`, value: reply.narrative.trim(), tags: ['chat'] }),
                    });
                } catch {
                }
            }
        } catch (error) {
            setThreads((prev) => {
                if (!prev.length) return prev;
                const next = [...prev];
                const last = next[next.length - 1];
                next[next.length - 1] = { ...last, response: { narrative: "Error: " + String(error), artifacts: [] } };
                return next;
            });
        } finally {
            setLoading(false);
            inFlightRef.current = false;
        }
    }

    return (
        <Card aria-label="AI financial chat" className="flex h-[70vh] flex-col px-10">
            <div ref={liveRef} className="flex-1 overflow-auto" aria-live="polite">
                <div className="prose prose-invert max-w-none text-sm">
                    {!threads.length && (
                        <div className="text-muted-foreground">Ask a question to get started.</div>
                    )}
                    {threads.map((entry, index) => (
                        <div key={`${entry.question}-${index}`} className="mb-6">
                            <Card size="sm" className="bg-muted/40">
                                <CardContent className="px-4 py-3">
                                    <div className="text-sm text-foreground">{entry.question}</div>
                                </CardContent>
                            </Card>
                            {entry.response && (
                                <div className="mt-3 space-y-4">
                                    <div className="prose prose-invert max-w-none text-sm">
                                        <ReactMarkdown>{entry.response.narrative}</ReactMarkdown>
                                    </div>
                                    {entry.response.artifacts.length > 0 && (
                                        <ArtifactRenderer artifacts={entry.response.artifacts} />
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                {loading && <div className="mt-3 text-sm text-muted-foreground">Assistant is typing...</div>}
            </div>
            <div className="mt-4 flex flex-col gap-5 sm:flex-row" role="form" aria-label="Send message">
                <div className="flex-1">
                    <Input
                        className="w-full"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                send();
                            }
                        }}
                        aria-label="Ask the financial advisor"
                        placeholder="Ask the financial advisor"
                    />
                </div>
                <Button onClick={send} disabled={loading} className="sm:w-28 flex-none rounded-lg" aria-label="Send message">
                    Send
                </Button>
            </div>
        </Card>
    );
}
