"use client";
import React, { useEffect, useState } from "react";
import Card from "../../src/components/ui/Card";
import Button from "../../src/components/ui/Button";
import Input from "../../src/components/ui/Input";

export default function AIMemoryAdmin() {
    const [items, setItems] = useState<any[]>([]);
    const [key, setKey] = useState("");
    const [value, setValue] = useState("");

    async function load() {
        const res = await fetch("/api/ai/memory");
        const data = await res.json();
        setItems(data.memories || []);
    }

    useEffect(() => {
        load();
    }, []);

    async function create() {
        await fetch("/api/ai/memory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, value }),
        });
        setKey("");
        setValue("");
        await load();
    }

    async function remove(id: string) {
        await fetch(`/api/ai/memory?id=${id}`, { method: "DELETE" });
        await load();
    }

    return (
        <Card>
            <div>
                <div className="text-sm font-semibold text-white">AI Memory</div>
                <div className="text-xs text-slate-400">Saved notes used for future responses</div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_2fr_auto]">
                <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Key" />
                <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" />
                <Button onClick={create} variant="secondary">
                    Save
                </Button>
            </div>
            <div className="mt-4 space-y-2">
                {items.map((it) => (
                    <div key={it.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="font-medium text-slate-100">{it.key}</div>
                                <div className="text-xs text-slate-500">{it.value}</div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => remove(it.id)}>
                                Delete
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
}
