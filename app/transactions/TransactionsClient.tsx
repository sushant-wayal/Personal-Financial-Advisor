"use client";
import React, { useEffect, useState } from "react";
import { Transaction } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type TransactionWithCategory = Transaction & { category: { name: string } | null };

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
            } catch (err: any) {
                setError(err.message);
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
                            <TableHead>Type</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {transactions.map((tx) => (
                            <TableRow key={tx.id}>
                                <TableCell>{new Date(tx.timestamp).toLocaleDateString()}</TableCell>
                                <TableCell className="font-medium">{tx.merchant}</TableCell>
                                <TableCell className={tx.type === "CREDIT" ? "text-emerald-500" : "text-rose-500"}>
                                    {tx.type === "CREDIT" ? "+" : "-"}
                                    {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(tx.amount)}
                                </TableCell>
                                <TableCell>{tx.category?.name || "Uncategorized"}</TableCell>
                                <TableCell>{tx.type}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
