"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    MessageSquare,
    Search,
    X,
    Plus,
    Clock,
    Trash2,
    Calendar,
    ChevronRight,
    Loader2,
} from "lucide-react";
import type { EnrichedConversation } from "@/src/services/aiConversation";

interface ConversationSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectConversation: (conversation: EnrichedConversation) => void;
    activeConversationId: string | null;
    onNewChat: () => void;
}

export default function ConversationSidebar({
    isOpen,
    onClose,
    onSelectConversation,
    activeConversationId,
    onNewChat,
}: ConversationSidebarProps) {
    const [searchInput, setSearchInput] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [conversations, setConversations] = useState<EnrichedConversation[]>([]);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const listRef = useRef<HTMLDivElement | null>(null);

    // Debounce search input (350ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchInput.trim());
        }, 350);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Fetch conversations when drawer opens or debounced query changes
    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        Promise.resolve().then(() => {
            if (isMounted) setLoading(true);
        });

        const params = new URLSearchParams();
        if (debouncedQuery) params.set("q", debouncedQuery);
        params.set("page", "1");
        params.set("limit", "10");

        fetch(`/api/ai/conversations?${params.toString()}`)
            .then((res) => res.json())
            .then((data) => {
                if (!isMounted) return;
                if (data?.ok) {
                    setConversations(data.conversations || []);
                    setPage(data.pagination.page);
                    setHasMore(data.pagination.hasMore);
                    setTotal(data.pagination.total);
                }
            })
            .catch((e) => {
                console.error("[ConversationSidebar] Error fetching conversations:", e);
            })
            .finally(() => {
                if (isMounted) {
                    setLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen, debouncedQuery]);

    // Load next page
    const handleLoadMore = useCallback(async () => {
        if (!hasMore || loadingMore || loading) return;
        try {
            setLoadingMore(true);
            const params = new URLSearchParams();
            if (debouncedQuery) params.set("q", debouncedQuery);
            params.set("page", String(page + 1));
            params.set("limit", "10");

            const res = await fetch(`/api/ai/conversations?${params.toString()}`);
            const data = await res.json();

            if (data?.ok) {
                setConversations((prev) => [...prev, ...(data.conversations || [])]);
                setPage(data.pagination.page);
                setHasMore(data.pagination.hasMore);
                setTotal(data.pagination.total);
            }
        } catch (e) {
            console.error("[ConversationSidebar] Error loading more:", e);
        } finally {
            setLoadingMore(false);
        }
    }, [hasMore, loadingMore, loading, debouncedQuery, page]);

    // Infinite scroll trigger
    const handleScroll = useCallback(() => {
        if (!listRef.current || !hasMore || loadingMore || loading) return;
        const { scrollTop, scrollHeight, clientHeight } = listRef.current;
        if (scrollHeight - scrollTop - clientHeight < 60) {
            handleLoadMore();
        }
    }, [hasMore, loadingMore, loading, handleLoadMore]);

    // Delete a conversation
    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            setDeletingId(id);
            await fetch(`/api/ai/memory?id=${encodeURIComponent(id)}`, { method: "DELETE" });
            setConversations((prev) => prev.filter((c) => c.id !== id));
            setTotal((prev) => Math.max(0, prev - 1));
        } catch (err) {
            console.error("[ConversationSidebar] Failed to delete conversation:", err);
        } finally {
            setDeletingId(null);
        }
    };

    if (!isOpen) return null;

    const normalizedActiveKey = activeConversationId?.startsWith("chat:")
        ? activeConversationId
        : `chat:${activeConversationId}`;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
            {/* Click outside backdrop to close */}
            <div className="flex-1" onClick={onClose} aria-hidden="true" />

            {/* Sidebar drawer panel */}
            <aside
                className="relative flex h-full w-full max-w-md flex-col border-l border-zinc-800 bg-zinc-950/95 shadow-2xl backdrop-blur-xl sm:w-96"
                role="dialog"
                aria-label="Past Conversations"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3.5">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-purple-400" />
                        <h2 className="text-sm font-semibold text-zinc-100">Past Conversations</h2>
                        {total > 0 && (
                            <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[10px] font-mono text-purple-300">
                                {total}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                onNewChat();
                                onClose();
                            }}
                            className="h-8 gap-1.5 rounded-lg px-2.5 text-xs text-purple-300 hover:bg-purple-950/30 hover:text-purple-200"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            New Chat
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            className="h-8 w-8 rounded-lg p-0 text-zinc-400 hover:text-zinc-200"
                            aria-label="Close past conversations sidebar"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Search Bar with Debounce */}
                <div className="border-b border-zinc-800/80 p-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                        <Input
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search all conversations…"
                            className="h-9 w-full bg-zinc-900/80 pl-8.5 pr-8 text-xs placeholder:text-zinc-500 focus-visible:ring-purple-500/30"
                        />
                        {searchInput ? (
                            <button
                                onClick={() => setSearchInput("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                                aria-label="Clear search"
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        ) : loading ? (
                            <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-purple-400" />
                        ) : null}
                    </div>
                </div>

                {/* Conversations List with Lazy Loading */}
                <div
                    ref={listRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto p-3 space-y-2.5 divide-y-0"
                >
                    {loading && conversations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-2">
                            <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
                            <span className="text-xs">Loading conversations…</span>
                        </div>
                    ) : conversations.length === 0 ? (
                        <div className="py-16 text-center text-xs text-zinc-500">
                            {debouncedQuery ? (
                                <>
                                    No conversations matching <span className="text-zinc-300">&quot;{debouncedQuery}&quot;</span>
                                </>
                            ) : (
                                "No conversations saved yet. Start chatting with the advisor!"
                            )}
                        </div>
                    ) : (
                        conversations.map((item) => {
                            const isActive = item.key === normalizedActiveKey;
                            const displayName = item.name || "AI Conversation";
                            const updatedDate = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                            }) : "";

                            return (
                                <div
                                    key={item.id}
                                    onClick={() => {
                                        onSelectConversation(item);
                                        onClose();
                                    }}
                                    className={`group relative flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                                        isActive
                                            ? "border-purple-500/60 bg-purple-950/25 shadow-xs"
                                            : "border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/80"
                                    }`}
                                >
                                    {/* Top Row: Title + Date */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-1.5 font-medium text-xs text-zinc-200 group-hover:text-purple-300 line-clamp-1 flex-1">
                                            <MessageSquare className="h-3 w-3 text-purple-400 shrink-0" />
                                            <span className="truncate">{displayName}</span>
                                        </div>
                                        {updatedDate && (
                                            <span className="shrink-0 text-[10px] text-zinc-400 flex items-center gap-1">
                                                <Calendar className="h-2.5 w-2.5" />
                                                {updatedDate}
                                            </span>
                                        )}
                                    </div>

                                    {/* Snippet */}
                                    <p className="line-clamp-2 text-[11px] leading-relaxed text-zinc-300">
                                        {item.value ? (
                                            item.value.startsWith("[{") ? "Saved conversation turns" : item.value
                                        ) : "No message preview"}
                                    </p>

                                    {/* Bottom Row: Expiry Badge + Delete Button */}
                                    <div className="flex items-center justify-between pt-1 text-[10px]">
                                        {item.expiresAt ? (
                                            <span
                                                className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium ${
                                                    item.isExpired
                                                        ? "bg-rose-500/15 text-rose-400"
                                                        : (item.expiresInDays !== null && item.expiresInDays <= 3)
                                                            ? "bg-amber-500/15 text-amber-400"
                                                            : "bg-zinc-800/90 text-zinc-400"
                                                }`}
                                            >
                                                <Clock className="h-2.5 w-2.5" />
                                                {item.expiryLabel || "Expires"}
                                            </span>
                                        ) : (
                                            <span className="text-zinc-400 font-mono text-[10px]">Permanent</span>
                                        )}

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                type="button"
                                                onClick={(e) => void handleDelete(item.id, e)}
                                                disabled={deletingId === item.id}
                                                className="p-1 text-zinc-400 hover:text-rose-400 rounded-md hover:bg-zinc-800"
                                                title="Delete conversation"
                                                aria-label="Delete conversation"
                                            >
                                                {deletingId === item.id ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <Trash2 className="h-3 w-3" />
                                                )}
                                            </button>
                                            <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}

                    {/* Load More Button for Lazy Loading */}
                    {hasMore && (
                        <div className="pt-2 text-center">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                                className="h-8 w-full rounded-lg text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                            >
                                {loadingMore ? (
                                    <>
                                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin text-purple-400" />
                                        Loading more…
                                    </>
                                ) : (
                                    "Load more past conversations"
                                )}
                            </Button>
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
}
