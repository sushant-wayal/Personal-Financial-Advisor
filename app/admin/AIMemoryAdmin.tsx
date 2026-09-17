"use client";
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MessageSquare, Calendar, Trash2, Edit2, Check, X, Clock, Sparkles } from "lucide-react";
import { parseConversationTurns } from "@/src/services/aiConversation";

interface MemoryItem {
    id: string;
    key: string;
    value: string;
    name?: string | null;
    expiresAt?: string | null;
    tags?: string;
    updatedAt: string;
    isExpired?: boolean;
    expiresInDays?: number | null;
    expiryLabel?: string;
}

export default function AIMemoryAdmin() {
    const [items, setItems] = useState<MemoryItem[]>([]);
    const [key, setKey] = useState("");
    const [value, setValue] = useState("");
    const [name, setName] = useState("");
    const [expiryDays, setExpiryDays] = useState("");
    const [loading, setLoading] = useState(false);

    // Editing state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editExpiryDate, setEditExpiryDate] = useState("");

    async function load() {
        try {
            setLoading(true);
            const res = await fetch("/api/ai/memory");
            const data = await res.json();
            setItems(data.memories || []);
        } catch (e) {
            console.error("Failed to load memories", e);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        let isMounted = true;
        fetch("/api/ai/memory")
            .then((res) => res.json())
            .then((data) => {
                if (isMounted) {
                    setItems(data.memories || []);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (isMounted) setLoading(false);
            });
        return () => {
            isMounted = false;
        };
    }, []);

    async function create() {
        if (!key.trim() || !value.trim()) return;
        const expiresAt = expiryDays ? new Date(Date.now() + Number(expiryDays) * 86400000).toISOString() : undefined;
        await fetch("/api/ai/memory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                key: key.trim(),
                value: value.trim(),
                name: name.trim() || undefined,
                expiresAt,
            }),
        });
        setKey("");
        setValue("");
        setName("");
        setExpiryDays("");
        await load();
    }

    async function remove(id: string) {
        await fetch(`/api/ai/memory?id=${id}`, { method: "DELETE" });
        await load();
    }

    function startEditing(it: MemoryItem) {
        setEditingId(it.id);
        setEditName(it.name || "");
        setEditExpiryDate(it.expiresAt ? it.expiresAt.split("T")[0] : "");
    }

    function cancelEditing() {
        setEditingId(null);
        setEditName("");
        setEditExpiryDate("");
    }

    async function saveEditing(id: string) {
        await fetch("/api/ai/memory", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                id,
                name: editName.trim() || null,
                expiresAt: editExpiryDate ? new Date(editExpiryDate).toISOString() : null,
            }),
        });
        cancelEditing();
        await load();
    }

    return (
        <Card className="border-border">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-purple-400" />
                            AI Memory & Conversations
                        </CardTitle>
                        <CardDescription>
                            Manage persistent knowledge, named AI conversations, and automated expiry schedules.
                        </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="rounded-lg">
                        Refresh
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {/* Creation Form */}
                <div className="mb-6 rounded-xl border border-border/60 bg-muted/20 p-4">
                    <div className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Add Memory / Preference
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Name / Title (optional)"
                        />
                        <Input
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="Key (e.g. risk_tolerance)"
                        />
                        <Input
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder="Value / Content"
                        />
                        <div className="flex gap-2">
                            <Input
                                type="number"
                                min="1"
                                max="365"
                                value={expiryDays}
                                onChange={(e) => setExpiryDays(e.target.value)}
                                placeholder="Expires in days"
                                className="w-32"
                            />
                            <Button onClick={() => void create()} variant="secondary" className="flex-1 rounded-lg">
                                Save
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Items List */}
                <div className="space-y-3">
                    {items.length === 0 && !loading && (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            No memories or AI conversations stored yet.
                        </div>
                    )}

                    {items.map((it) => {
                        const isChat = it.key.startsWith("chat:") || (it.tags && it.tags.includes("chat"));
                        const isEditing = editingId === it.id;
                        const displayName = it.name || (isChat ? "AI Advisor Conversation" : it.key);

                        return (
                            <Card
                                key={it.id}
                                size="sm"
                                className={`transition-all ${
                                    isChat
                                        ? "border-purple-500/20 bg-purple-950/10 hover:border-purple-500/40"
                                        : "bg-muted/40"
                                }`}
                            >
                                <CardContent className="px-4 py-3.5">
                                    {isEditing ? (
                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                            <div className="flex-1 space-y-2">
                                                <div className="text-xs font-medium text-muted-foreground">Edit Name:</div>
                                                <Input
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    placeholder="Conversation Name"
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div className="w-48 space-y-2">
                                                <div className="text-xs font-medium text-muted-foreground">Expiry Date:</div>
                                                <Input
                                                    type="date"
                                                    value={editExpiryDate}
                                                    onChange={(e) => setEditExpiryDate(e.target.value)}
                                                    className="h-8 text-sm"
                                                />
                                            </div>
                                            <div className="flex items-end gap-1.5 pt-6">
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    className="h-8 gap-1 rounded-md"
                                                    onClick={() => void saveEditing(it.id)}
                                                >
                                                    <Check className="h-3.5 w-3.5" /> Save
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-8 rounded-md text-muted-foreground"
                                                    onClick={cancelEditing}
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 space-y-1.5">
                                                {/* Header Line */}
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                                                        {isChat ? (
                                                            <MessageSquare className="h-4 w-4 text-purple-400 shrink-0" />
                                                        ) : (
                                                            <Sparkles className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                                                        )}
                                                        {displayName}
                                                    </span>

                                                    {isChat && (
                                                        <span className="rounded-full bg-purple-500/15 px-2 py-0.5 font-mono text-[10px] font-medium text-purple-300">
                                                            Conversation
                                                        </span>
                                                    )}

                                                    {/* Expiry Pill */}
                                                    {it.expiresAt ? (
                                                        <span
                                                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                                                it.isExpired
                                                                    ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                                                                    : (it.expiresInDays !== null && it.expiresInDays !== undefined && it.expiresInDays <= 3)
                                                                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                                                        : "bg-zinc-800 text-zinc-300"
                                                            }`}
                                                            title={`Expires: ${new Date(it.expiresAt).toLocaleString()}`}
                                                        >
                                                            <Clock className="h-3 w-3 shrink-0" />
                                                            {it.expiryLabel || new Date(it.expiresAt).toLocaleDateString()}
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 rounded-full bg-zinc-800/60 px-2 py-0.5 text-[10px] text-zinc-400">
                                                            <Calendar className="h-3 w-3 shrink-0" /> Permanent
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Content / Narrative */}
                                                {(() => {
                                                    const previewText = isChat
                                                        ? (() => {
                                                            const turns = parseConversationTurns(it.value);
                                                            if (turns.length === 0) return it.value;
                                                            const last = turns[turns.length - 1];
                                                            return `${turns.length} turn${turns.length > 1 ? "s" : ""}: "${last?.question || ""}" → ${last?.response?.narrative?.slice(0, 120) || ""}`;
                                                        })()
                                                        : it.value;

                                                    return (
                                                        <div className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                                            {previewText}
                                                        </div>
                                                    );
                                                })()}

                                                {/* Key Reference Subtitle */}
                                                <div className="font-mono text-[11px] text-zinc-500">
                                                    key: {it.key}
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex items-center gap-1 shrink-0">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                                    onClick={() => startEditing(it)}
                                                    title="Edit Name & Expiry"
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    className="h-8 rounded-lg px-2.5 text-xs gap-1"
                                                    onClick={() => void remove(it.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
