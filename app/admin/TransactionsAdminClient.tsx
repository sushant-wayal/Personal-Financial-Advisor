"use client";

import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RotateCw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Tx = {
    id: string;
    merchant: string;
    amount: number;
    category?: { name?: string } | null;
    paymentMethod?: string | null;
    bankName?: string | null;
    transactionType?: string | null;
    type?: string | null;
    confidence?: number | null;
    timestamp: string | number;
};

type Draft = {
    merchant: string;
    category: string;
    amount: string;
    timestamp: string;
    paymentMethod: string;
    bankName: string;
    transactionType: string;
};

const CATEGORIES = [
    "Food",
    "Groceries",
    "Shopping",
    "Transport",
    "Bills",
    "Rent",
    "Healthcare",
    "Education",
    "Entertainment",
    "Subscription",
    "Travel",
    "Investment",
    "Insurance",
    "Salary",
    "Refund",
    "Miscellaneous",
];

const TRANSACTION_TYPES = ["DEBIT", "CREDIT", "SALARY", "REFUND", "TRANSFER", "SUBSCRIPTION", "OTHER"];
const PAYMENT_METHODS = ["", "UPI", "Card", "Cash", "Net Banking", "IMPS", "NEFT", "RTGS", "Wallet"];

async function fetchTransactions() {
    const res = await fetch("/api/transactions/list");
    if (!res.ok) throw new Error("failed to fetch");
    const data = await res.json() as { transactions: Tx[] };
    return data.transactions;
}

function toDateInput(value: string | number) {
    const date = typeof value === "number" ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function txToDraft(tx: Tx): Draft {
    return {
        merchant: tx.merchant || "Unknown",
        category: tx.category?.name || "Miscellaneous",
        amount: String(tx.amount ?? 0),
        timestamp: toDateInput(tx.timestamp),
        paymentMethod: tx.paymentMethod || "",
        bankName: tx.bankName || "",
        transactionType: tx.transactionType || tx.type || "OTHER",
    };
}

function selectClassName(extra = "") {
    return `h-10 w-full min-w-0 border border-transparent border-b-input bg-transparent px-0 py-1 text-sm outline-none transition-[color,border-color] focus-visible:border-b-ring ${extra}`;
}

function TransactionEditor({
    tx,
    selected,
    saving,
    deleting,
    onToggleSelected,
    onSave,
    onDelete,
}: {
    tx: Tx;
    selected: boolean;
    saving: boolean;
    deleting: boolean;
    onToggleSelected: (id: string, checked: boolean) => void;
    onSave: (id: string, draft: Draft) => void;
    onDelete: (id: string) => void;
}) {
    const [draft, setDraft] = React.useState<Draft>(() => txToDraft(tx));
    const confidence = typeof tx.confidence === "number" ? tx.confidence : null;
    const needsReview = confidence !== null && confidence < 0.7;

    function update<K extends keyof Draft>(key: K, value: Draft[K]) {
        setDraft((current) => ({ ...current, [key]: value }));
    }

    return (
        <div className="rounded-md border border-border/70 bg-muted/30 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={(event) => onToggleSelected(tx.id, event.target.checked)}
                        className="mt-1 size-4 accent-primary"
                        aria-label={`Select transaction from ${tx.merchant}`}
                    />
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-foreground">{tx.merchant}</div>
                            {needsReview && (
                                <span className="inline-flex items-center gap-1 border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-xs font-medium text-amber-300">
                                    <AlertTriangle className="size-3" />
                                    Review
                                </span>
                            )}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                            {new Date(tx.timestamp).toLocaleString()}
                            {" · "}
                            {tx.paymentMethod || "method unknown"}
                            {tx.bankName ? ` · ${tx.bankName}` : ""}
                            {confidence !== null ? ` · ${Math.round(confidence * 100)}% confidence` : ""}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onSave(tx.id, draft)}
                        disabled={saving || deleting}
                        aria-label="Save transaction changes"
                    >
                        <Save />
                        Save
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => onDelete(tx.id)}
                        disabled={saving || deleting}
                        aria-label="Delete transaction"
                    >
                        <Trash2 />
                        Delete
                    </Button>
                </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Merchant</span>
                    <Input value={draft.merchant} onChange={(event) => update("merchant", event.target.value)} />
                </label>
                <label className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Category</span>
                    <select className={selectClassName()} value={draft.category} onChange={(event) => update("category", event.target.value)}>
                        {CATEGORIES.map((category) => (
                            <option key={category} value={category}>{category}</option>
                        ))}
                    </select>
                </label>
                <label className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Amount</span>
                    <Input type="number" min="0" step="0.01" value={draft.amount} onChange={(event) => update("amount", event.target.value)} />
                </label>
                <label className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Date</span>
                    <Input type="date" value={draft.timestamp} onChange={(event) => update("timestamp", event.target.value)} />
                </label>
                <label className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Type</span>
                    <select className={selectClassName()} value={draft.transactionType} onChange={(event) => update("transactionType", event.target.value)}>
                        {TRANSACTION_TYPES.map((type) => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </select>
                </label>
                <label className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">Payment method</span>
                    <select className={selectClassName()} value={draft.paymentMethod} onChange={(event) => update("paymentMethod", event.target.value)}>
                        {PAYMENT_METHODS.map((method) => (
                            <option key={method || "empty"} value={method}>{method || "Unknown"}</option>
                        ))}
                    </select>
                </label>
                <label className="space-y-1 md:col-span-2">
                    <span className="text-xs font-medium text-muted-foreground">Bank / provider</span>
                    <Input value={draft.bankName} placeholder="Optional" onChange={(event) => update("bankName", event.target.value)} />
                </label>
            </div>
        </div>
    );
}

export default function TransactionsAdminClient() {
    const { data: txs = [], isLoading, error } = useQuery({ queryKey: ["transactions"], queryFn: fetchTransactions });
    const queryClient = useQueryClient();
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
    const selectedCount = selectedIds.size;
    const allVisibleSelected = txs.length > 0 && txs.every((tx) => selectedIds.has(tx.id));

    const updateMutation = useMutation({
        mutationFn: async ({ id, draft }: { id: string; draft: Draft }) => {
            const res = await fetch(`/api/transactions/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(draft),
            });
            if (!res.ok) throw new Error("update failed");
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["transactions"] }),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
            if (!res.ok) throw new Error("delete failed");
            return id;
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ["transactions"] });
            const previous = queryClient.getQueryData<Tx[]>(["transactions"]);
            queryClient.setQueryData<Tx[] | undefined>(["transactions"], (old) => old?.filter((tx) => tx.id !== id));
            return { previous };
        },
        onError: (_err, _id, context: { previous?: Tx[] } | undefined) => {
            if (context?.previous) queryClient.setQueryData(["transactions"], context.previous);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ["transactions"] }),
    });

    const bulkDeleteMutation = useMutation({
        mutationFn: async (payload: { ids?: string[]; all?: boolean }) => {
            const res = await fetch("/api/transactions/bulk", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("bulk delete failed");
            return payload;
        },
        onMutate: async (payload) => {
            await queryClient.cancelQueries({ queryKey: ["transactions"] });
            const previous = queryClient.getQueryData<Tx[]>(["transactions"]);
            if (payload.all) {
                queryClient.setQueryData<Tx[]>(["transactions"], []);
                setSelectedIds(new Set());
            } else if (payload.ids?.length) {
                const remove = new Set(payload.ids);
                queryClient.setQueryData<Tx[] | undefined>(["transactions"], (old) => old?.filter((tx) => !remove.has(tx.id)));
                setSelectedIds((current) => new Set([...current].filter((id) => !remove.has(id))));
            }
            return { previous };
        },
        onError: (_err, _payload, context: { previous?: Tx[] } | undefined) => {
            if (context?.previous) queryClient.setQueryData(["transactions"], context.previous);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ["transactions"] }),
    });

    function toggleSelected(id: string, checked: boolean) {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    }

    function toggleAllVisible(checked: boolean) {
        setSelectedIds((current) => {
            const next = new Set(current);
            for (const tx of txs) {
                if (checked) next.add(tx.id);
                else next.delete(tx.id);
            }
            return next;
        });
    }

    function deleteTransaction(id: string) {
        if (window.confirm("Delete this transaction? This cannot be undone.")) {
            deleteMutation.mutate(id);
        }
    }

    function deleteSelectedTransactions() {
        const ids = [...selectedIds];
        if (!ids.length) return;
        if (window.confirm(`Delete ${ids.length} selected transaction${ids.length === 1 ? "" : "s"}? This cannot be undone.`)) {
            bulkDeleteMutation.mutate({ ids });
        }
    }

    function deleteAllTransactions() {
        if (window.confirm("Delete ALL transactions in the database? This cannot be undone.")) {
            bulkDeleteMutation.mutate({ all: true });
        }
    }

    if (isLoading) return <div className="text-sm text-slate-400">Loading...</div>;
    if (error) return <div className="text-sm text-destructive">Failed to load transactions.</div>;

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <CardTitle>Transactions Admin</CardTitle>
                        <CardDescription>Edit parsed transaction details or remove bad imports</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["transactions"] })}>
                            <RotateCw />
                            Refresh
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={deleteSelectedTransactions}
                            disabled={!selectedCount || bulkDeleteMutation.isPending}
                        >
                            <Trash2 />
                            Delete selected
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={deleteAllTransactions}
                            disabled={!txs.length || bulkDeleteMutation.isPending}
                        >
                            <Trash2 />
                            Delete all
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                            <input
                                type="checkbox"
                                checked={allVisibleSelected}
                                onChange={(event) => toggleAllVisible(event.target.checked)}
                                className="size-4 accent-primary"
                                aria-label="Select all visible transactions"
                            />
                            Select all visible
                        </label>
                        <div className="text-xs text-muted-foreground">
                            {selectedCount} selected · {txs.length} visible
                        </div>
                    </div>
                    {txs.map((tx) => (
                        <TransactionEditor
                            key={tx.id}
                            tx={tx}
                            selected={selectedIds.has(tx.id)}
                            saving={updateMutation.isPending && updateMutation.variables?.id === tx.id}
                            deleting={deleteMutation.isPending && deleteMutation.variables === tx.id}
                            onToggleSelected={toggleSelected}
                            onSave={(id, draft) => updateMutation.mutate({ id, draft })}
                            onDelete={deleteTransaction}
                        />
                    ))}
                    {!txs.length && <div className="text-sm text-muted-foreground">No transactions found.</div>}
                </div>
            </CardContent>
        </Card>
    );
}
