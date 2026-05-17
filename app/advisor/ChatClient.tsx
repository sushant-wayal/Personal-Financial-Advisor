"use client";
import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import Button from "../../src/components/ui/Button";
import Card from "../../src/components/ui/Card";
import Input from "../../src/components/ui/Input";

export default function ChatClient() {
    const [q, setQ] = useState("");
    const [threads, setThreads] = useState<Array<{ question: string; response: string }>>([]);
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
        setThreads((prev) => [...prev, { question: user, response: "" }]);
        setQ("");
        setLoading(true);
        try {
            // streaming by default
            const res = await fetch('/api/ai/advisor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: user }) });
            if (!res.body) {
                const data = await res.json();
                const reply = data.text || data.result?.text || JSON.stringify(data.result) || data.error || "No response";
                console.log("Non-streaming response:", data);
                setThreads((prev) => {
                    if (!prev.length) return prev;
                    const next = [...prev];
                    const last = next[next.length - 1];
                    next[next.length - 1] = { ...last, response: reply };
                    return next;
                });
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let done = false;
            let assistantText = "";
            while (!done) {
                const { value, done: d } = await reader.read();
                done = !!d;
                console.log("Stream chunk:", { value, done });
                if (value) {
                    const chunk = decoder.decode(value);
                    assistantText += chunk;
                    setThreads((prev) => {
                        if (!prev.length) return prev;
                        const next = [...prev];
                        const last = next[next.length - 1];
                        next[next.length - 1] = { ...last, response: assistantText };
                        return next;
                    });
                }
            }
            const final = assistantText.trim();
            if (final) {
                try {
                    await fetch('/api/ai/memory', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: `chat:${Date.now()}`, value: final, tags: ['chat'] }),
                    });
                } catch (e) { }
            }
        } catch (e: any) {
            setThreads((prev) => {
                if (!prev.length) return prev;
                const next = [...prev];
                const last = next[next.length - 1];
                next[next.length - 1] = { ...last, response: 'Error: ' + String(e) };
                return next;
            });
        } finally {
            setLoading(false);
            inFlightRef.current = false;
        }
    }

    return (
        <Card aria-label="AI financial chat" className="flex h-[70vh] flex-col">
            <div ref={liveRef} className="flex-1 overflow-auto" aria-live="polite">
                <div className="prose prose-invert max-w-none text-sm">
                    {!threads.length && (
                        <div className="text-slate-500">Ask a question to get started.</div>
                    )}
                    {threads.map((entry, index) => (
                        <div key={`${entry.question}-${index}`} className="mb-6">
                            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                                <div className="mt-1 text-slate-100">{entry.question}</div>
                            </div>
                            {entry.response && (
                                <div className="mt-3">
                                    <ReactMarkdown>{entry.response}</ReactMarkdown>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                {loading && <div className="mt-3 text-sm text-slate-500">Assistant is typing...</div>}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row" role="form" aria-label="Send message">
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
                <Button onClick={send} disabled={loading} className="sm:w-28 flex-none">
                    Send
                </Button>
            </div>
        </Card>
    );
}
