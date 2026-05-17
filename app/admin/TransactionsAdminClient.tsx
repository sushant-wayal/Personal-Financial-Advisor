"use client";
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import useStore from "../../src/store/useStore";
import Card from "../../src/components/ui/Card";
import Button from "../../src/components/ui/Button";
import Input from "../../src/components/ui/Input";

type Tx = {
    id: string;
    merchant: string;
    amount: number;
    category?: string;
    timestamp: string;
};

async function fetchTransactions() {
    const res = await fetch("/api/transactions/list");
    if (!res.ok) throw new Error("failed to fetch");
    const data = await res.json();
    return data.transactions as Tx[];
}

export default function TransactionsAdminClient() {
    const { data: txs = [], isLoading } = useQuery({ queryKey: ["transactions"], queryFn: fetchTransactions });
    const queryClient = useQueryClient();
    const setSelected = useStore((s) => s.setSelected);

    const mutation = useMutation({
        mutationFn: async ({ id, category }: { id: string; category: string }) => {
            const res = await fetch(`/api/transactions/${id}/categorize`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category }) });
            if (!res.ok) throw new Error("update failed");
            return res.json();
        },
        onMutate: async ({ id, category }) => {
            await queryClient.cancelQueries({ queryKey: ["transactions"] });
            const previous = queryClient.getQueryData<Tx[]>(["transactions"]);
            queryClient.setQueryData<Tx[] | undefined>(["transactions"], (old) => old?.map(t => t.id === id ? { ...t, category } : t));
            return { previous };
        },
        onError: (err, variables, context: any) => {
            if (context?.previous) queryClient.setQueryData(["transactions"], context.previous);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["transactions"] });
        }
    });

    if (isLoading) return <div className="text-sm text-slate-400">Loading...</div>;

    return (
        <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <div className="text-sm font-semibold text-white">Transactions Admin</div>
                    <div className="text-xs text-slate-400">Triage and recategorize transactions</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["transactions"] })}>
                    Refresh
                </Button>
            </div>
            <div className="mt-4 space-y-3">
                {txs.map((tx) => (
                    <div key={tx.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <div className="font-medium text-slate-100">{tx.merchant} — ₹{tx.amount}</div>
                                <div className="text-xs text-slate-500">{new Date(tx.timestamp).toLocaleString()}</div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Input
                                    defaultValue={tx.category || ""}
                                    placeholder="Category"
                                    id={`cat-${tx.id}`}
                                    className="h-9 w-40"
                                />
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        const val = (document.getElementById(`cat-${tx.id}`) as HTMLInputElement).value;
                                        mutation.mutate({ id: tx.id, category: val });
                                    }}
                                >
                                    Save
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => setSelected(tx.id)}>
                                    Select
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
}
