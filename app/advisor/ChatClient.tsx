"use client";
import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import Button from "../../src/components/ui/Button";
import Card from "../../src/components/ui/Card";
import Input from "../../src/components/ui/Input";

export default function ChatClient() {
    const [q, setQ] = useState("");
    const [messages, setMessages] = useState<Array<{ role: string; text: string }>>([]);
    const [loading, setLoading] = useState(false);
    const liveRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (liveRef.current) liveRef.current.scrollTop = liveRef.current.scrollHeight;
    }, [messages]);

    async function send() {
        if (!q.trim()) return;
        const user = q.trim();
        setMessages(m => [...m, { role: "user", text: user }]);
        setQ("");
        setLoading(true);
        try {
            // streaming by default
            const res = await fetch('/api/ai/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: user }) });
            if (!res.body) {
                const data = await res.json();
                const reply = data.text || data.result?.text || JSON.stringify(data.result) || data.error || 'No response';
                setMessages(m => [...m, { role: 'assistant', text: reply }]);
            } else {
                // create a placeholder assistant message and stream into it
                setMessages(m => [...m, { role: 'assistant', text: '' }]);
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let done = false;
                while (!done) {
                    const { value, done: d } = await reader.read();
                    done = !!d;
                    if (value) {
                        const chunk = decoder.decode(value);
                        setMessages(prev => {
                            const copy = [...prev];
                            // append to last assistant message
                            const lastIndex = copy.map(x => x.role).lastIndexOf('assistant');
                            if (lastIndex >= 0) copy[lastIndex].text += chunk;
                            return copy;
                        });
                    }
                }
                // persist final assistant text
                const final = (await (async () => {
                    const current = messages.concat().slice();
                    const last = current.length ? current[current.length - 1] : null;
                    return last?.text || '';
                })()) || '';
                try { await fetch('/api/ai/memory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: `chat:${Date.now()}`, value: final }) }); } catch (e) { }
            }
        } catch (e: any) {
            setMessages(m => [...m, { role: 'assistant', text: 'Error: ' + String(e) }]);
        } finally { setLoading(false); }
    }

    return (
        <Card aria-label="AI financial chat">
            <div ref={liveRef} className="h-64 overflow-auto mb-4 flex flex-col gap-2" aria-live="polite">
                {messages.map((m, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`max-w-[80%] rounded-lg border px-3 py-2 text-sm ${
                            m.role === "user"
                                ? "self-end border-cyan-400/20 bg-cyan-400/10 text-cyan-50"
                                : "self-start border-white/10 bg-white/5 text-slate-100"
                        }`}
                    >
                        {m.text}
                    </motion.div>
                ))}
                {loading && <div className="text-sm text-slate-500">Assistant is typing...</div>}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row" role="form" aria-label="Send message">
                <Input
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
                <Button onClick={send} disabled={loading} className="sm:w-28">
                    Send
                </Button>
            </div>
        </Card>
    );
}
