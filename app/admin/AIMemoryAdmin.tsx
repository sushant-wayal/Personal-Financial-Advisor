"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
            <CardHeader>
                <CardTitle>AI Memory</CardTitle>
                <CardDescription>Saved notes used for future responses</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
                    <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Key" />
                    <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" />
                    <Button onClick={create} variant="secondary" className={"rounded-lg"}>
                        Save
                    </Button>
                </div>
                <div className="mt-4 space-y-2">
                    {items.map((it) => (
                        <Card key={it.id} size="sm" className="bg-muted/40">
                            <CardContent className="px-4 py-4">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="font-medium text-foreground">{it.key}</div>
                                        <div className="text-xs text-muted-foreground">{it.value}</div>
                                    </div>
                                    <Button variant="destructive" size="sm" onClick={() => remove(it.id)} className={"rounded-lg"}>
                                        Delete
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
