"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ArtifactRenderer from "../components/advisor/ArtifactRenderer";
import type { AdvisorResponse } from "@/types/advisor";

type ChatTurn = { question: string; response: AdvisorResponse | null };

type StatusPhase = "thinking" | "querying" | "processing" | "done";

type ToolCallState = { name: string; rowCount?: number; done: boolean };

type LiveStatus = {
    phase: StatusPhase;
    message: string;
    iteration: number;
    toolCalls: ToolCallState[];
} | null;

const POLL_INTERVAL_MS = 1500;

function toolLabel(name: string): string {
    const map: Record<string, string> = {
        queryTransactions: "Transaction Records",
        aggregateTransactions: "Spending Aggregation",
        queryGoals: "Financial Goals",
        querySubscriptions: "Subscriptions",
        queryCategories: "Categories",
        getFinancialProfile: "Financial Profile",
        queryMemories: "Memory",
        queryInsights: "Insights",
    };
    return map[name] ?? name;
}

// ── Orbiting Loader (CSS keyframes, no extra deps) ────────────────────────────
const ORBIT_STYLE = `
@keyframes adv-orbit1 { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes adv-orbit2 { from { transform: rotate(120deg); } to { transform: rotate(480deg); } }
@keyframes adv-orbit3 { from { transform: rotate(240deg); } to { transform: rotate(600deg); } }
`;

function OrbitingLoader({ color }: { color: string }) {
    return (
        <div style={{ position: "relative", width: 14, height: 14, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <style>{ORBIT_STYLE}</style>
            <div style={{ position: "absolute", width: "100%", height: "100%", animation: "adv-orbit1 1.5s linear infinite" }}>
                <div style={{ width: 3.5, height: 3.5, borderRadius: "50%", backgroundColor: color, position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)", boxShadow: `0 0 3px ${color}` }} />
            </div>
            <div style={{ position: "absolute", width: "100%", height: "100%", animation: "adv-orbit2 2s linear infinite" }}>
                <div style={{ width: 2.5, height: 2.5, borderRadius: "50%", backgroundColor: color, opacity: 0.7, position: "absolute", top: 2, left: "50%", transform: "translateX(-50%)" }} />
            </div>
            <div style={{ position: "absolute", width: "100%", height: "100%", animation: "adv-orbit3 2.5s linear infinite" }}>
                <div style={{ width: 1.5, height: 1.5, borderRadius: "50%", backgroundColor: color, opacity: 0.5, position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)" }} />
            </div>
        </div>
    );
}

function phaseColor(phase: StatusPhase): string {
    switch (phase) {
        case "querying":   return "#a78bfa";
        case "processing": return "#f59e0b";
        case "done":       return "#34d399";
        default:           return "#60a5fa"; // thinking
    }
}

// ── LiveStatusPanel — mirrors the mobile LiveStatusPanel ─────────────────────
function LiveStatusPanel({ status }: { status: NonNullable<LiveStatus> }) {
    const isDone = status.phase === "done";
    const dot = phaseColor(status.phase);

    return (
        <div
            className={`flex flex-col gap-2.5 rounded-2xl border px-4 py-3 text-[13px] transition-all ${
                isDone
                    ? "border-emerald-800/30 bg-emerald-950/20"
                    : "border-zinc-700/40 bg-zinc-900/50"
            }`}
        >
            {/* Header row */}
            <div className="flex items-center gap-2.5">
                {isDone ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                        <circle cx="7" cy="7" r="7" fill="#34d399" fillOpacity="0.15" />
                        <path d="M4 7l2 2 4-4" stroke="#34d399" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                ) : (
                    <OrbitingLoader color={dot} />
                )}

                <span className={`flex-1 font-medium leading-snug ${isDone ? "text-emerald-400" : "text-zinc-200"}`}>
                    {status.message}
                </span>

                {status.iteration > 0 && !isDone && (
                    <span className="shrink-0 rounded-md bg-zinc-800 px-2 py-0.5 font-mono text-[10px] tracking-wide text-zinc-500">
                        step {status.iteration}
                    </span>
                )}
            </div>

            {/* Tool call rows */}
            {status.toolCalls.length > 0 && (
                <div className="ml-1 flex flex-col gap-1.5 border-l border-zinc-700/50 pl-4">
                    {status.toolCalls.map((tc, i) => (
                        <div key={`${tc.name}-${i}`} className="flex items-center gap-2">
                            {tc.done ? (
                                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="shrink-0">
                                    <path d="M2 5.5l2.5 2.5 4.5-4.5" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            ) : (
                                <OrbitingLoader color="#a78bfa" />
                            )}

                            {/* DB icon */}
                            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="shrink-0 opacity-40">
                                <rect x="1" y="1" width="9" height="9" rx="1.5" stroke={tc.done ? "#34d399" : "#a78bfa"} strokeWidth="1.2" />
                                <line x1="3" y1="4" x2="8" y2="4" stroke={tc.done ? "#34d399" : "#a78bfa"} strokeWidth="1" strokeLinecap="round" />
                                <line x1="3" y1="6.5" x2="6" y2="6.5" stroke={tc.done ? "#34d399" : "#a78bfa"} strokeWidth="1" strokeLinecap="round" />
                            </svg>

                            <span className="flex-1 font-mono text-[11px] text-zinc-400">
                                {toolLabel(tc.name)}
                            </span>

                            {tc.done && tc.rowCount !== undefined ? (
                                <span className="shrink-0 font-mono text-[10px] text-emerald-500">
                                    {tc.rowCount} rows
                                </span>
                            ) : !tc.done ? (
                                <span className="shrink-0 font-mono text-[10px] text-zinc-600">
                                    querying…
                                </span>
                            ) : null}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function useStatusPoller(requestId: string | null, active: boolean): LiveStatus {
    const [status, setStatus] = useState<LiveStatus>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!active || !requestId) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setStatus(null);
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        let cancelled = false;

        async function poll() {
            if (cancelled) return;
            try {
                const res = await fetch(
                    `/api/ai/advisor/status?requestId=${encodeURIComponent(requestId!)}`
                );
                if (!res.ok || cancelled) return;
                const data = await res.json();
                if (data?.type === "status") setStatus(data as LiveStatus);
            } catch { }
        }

        void poll();
        timerRef.current = setInterval(() => void poll(), POLL_INTERVAL_MS);

        return () => {
            cancelled = true;
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [requestId, active]);

    return status;
}

export default function ChatClient() {
    const [q, setQ] = useState("");
    const [threads, setThreads] = useState<ChatTurn[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
    const liveRef = useRef<HTMLDivElement | null>(null);
    const inFlightRef = useRef(false);

    const liveStatus = useStatusPoller(activeRequestId, loading);

    useEffect(() => {
        if (liveRef.current) liveRef.current.scrollTop = liveRef.current.scrollHeight;
    }, [threads, liveStatus]);

    const send = useCallback(async (text?: string) => {
        const messageText = typeof text === "string" ? text : q;
        if (!messageText.trim() || inFlightRef.current) return;
        inFlightRef.current = true;

        const user = messageText.trim();
        const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        setActiveRequestId(requestId);
        setThreads((prev) => [...prev, { question: user, response: null }]);
        if (typeof text !== "string") {
            setQ("");
        }
        setLoading(true);

        try {
            const history = threads.slice(-8).map((turn) => ({
                question: turn.question,
                response: turn.response?.narrative || "",
            }));

            const res = await fetch("/api/ai/advisor", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: user, history, requestId }),
            });

            const contentType = res.headers.get("content-type") || "";
            let reply: AdvisorResponse;

            if (contentType.includes("application/json")) {
                const data = await res.json();
                reply = {
                    narrative:
                        typeof data?.narrative === "string" ? data.narrative
                            : typeof data?.text === "string" ? data.text
                                : typeof data?.error === "string" ? data.error
                                    : JSON.stringify(data),
                    artifacts: Array.isArray(data?.artifacts) ? data.artifacts : [],
                };
            } else {
                const raw = await res.text();
                reply = { narrative: raw.trim() || "No response", artifacts: [] };
            }

            setThreads((prev) => {
                if (!prev.length) return prev;
                const next = [...prev];
                next[next.length - 1] = { ...next[next.length - 1], response: reply };
                return next;
            });

            if (reply.narrative.trim()) {
                fetch("/api/ai/memory", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ key: `chat:${Date.now()}`, value: reply.narrative.trim(), tags: ["chat"] }),
                }).catch(() => { });
            }
        } catch (error) {
            setThreads((prev) => {
                if (!prev.length) return prev;
                const next = [...prev];
                next[next.length - 1] = {
                    ...next[next.length - 1],
                    response: { narrative: "Error: " + String(error), artifacts: [] },
                };
                return next;
            });
        } finally {
            setLoading(false);
            setActiveRequestId(null);
            inFlightRef.current = false;
        }
    }, [q, threads]);

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
                                    <div className="prose prose-invert max-w-none text-sm text-foreground">
                                        <ReactMarkdown>{entry.question}</ReactMarkdown>
                                    </div>
                                </CardContent>
                            </Card>
                            {entry.response && (
                                <div className="mt-3 space-y-4">
                                    <div className="prose prose-invert max-w-none text-sm">
                                        <ReactMarkdown>{entry.response.narrative}</ReactMarkdown>
                                    </div>
                                    {entry.response.artifacts.length > 0 && (
                                        <ArtifactRenderer artifacts={entry.response.artifacts} onAction={send} />
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {loading && liveStatus && (
                    <div className="mb-4 mt-2">
                        <LiveStatusPanel status={liveStatus} />
                    </div>
                )}
                {loading && !liveStatus && (
                    <div className="mt-3 text-sm text-muted-foreground">Assistant is thinking…</div>
                )}
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
                                void send();
                            }
                        }}
                        aria-label="Ask the financial advisor"
                        placeholder="Ask the financial advisor"
                    />
                </div>
                <Button
                    onClick={() => void send()}
                    disabled={loading}
                    className="sm:w-28 flex-none rounded-lg"
                    aria-label="Send message"
                >
                    {loading ? "Thinking…" : "Send"}
                </Button>
            </div>
        </Card>
    );
}
