"use client";
import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type TransactionWithCategory = {
    id: string;
    amount: number;
    merchant: string;
    timestamp: string | number;
    type: string;
    transactionType?: string | null;
    paymentMethod?: string | null;
    bankName?: string | null;
    category: { name: string } | null;
};

export default function TransactionsClient() {
    const [transactions, setTransactions] = useState<TransactionWithCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchTransactions() {
            try {
                const res = await fetch("/api/transactions/list");
                if (!res.ok) {
                    throw new Error("Failed to fetch transactions");
                }
                const data = await res.json();
                setTransactions(data.transactions);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : String(err));
            } finally {
                setLoading(false);
            }
        }
        fetchTransactions();
    }, []);

    if (loading) {
        return <div>Loading transactions...</div>;
    }

    if (error) {
        return <div className="text-red-500">Error: {error}</div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>All Transactions</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Merchant</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Bank</TableHead>
                            <TableHead>Type</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {transactions.map((tx) => (
                            <TableRow key={tx.id}>
                                <TableCell>{new Date(tx.timestamp).toLocaleDateString()}</TableCell>
                                <TableCell className="font-medium">{tx.merchant}</TableCell>
                                <TableCell className={(tx.transactionType || tx.type) === "CREDIT" ? "text-emerald-500" : "text-rose-500"}>
                                    {(tx.transactionType || tx.type) === "CREDIT" ? "+" : "-"}
                                    {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(tx.amount)}
                                </TableCell>
                                <TableCell>{tx.category?.name || "Uncategorized"}</TableCell>
                                <TableCell>{tx.paymentMethod || "-"}</TableCell>
                                <TableCell>{tx.bankName || "-"}</TableCell>
                                <TableCell>{tx.transactionType || tx.type}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
