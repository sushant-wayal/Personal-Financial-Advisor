"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FALLBACK_CATEGORIES, PAYMENT_METHODS, TRANSACTION_TYPES } from "@/src/data/transactionOptions";

async function getCategories() {
    const res = await fetch("/api/categories");
    if (!res.ok) throw new Error("Failed to fetch categories");
    return res.json();
}

async function getTransactionOptions() {
    const res = await fetch("/api/transactions/options");
    if (!res.ok) throw new Error("Failed to fetch transaction options");
    return res.json() as Promise<{ transactionTypes: string[]; paymentMethods: string[] }>;
}

async function createTransaction(newTransaction: unknown) {
    const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTransaction),
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create transaction");
    }

    return res.json();
}

export default function NewTransactionDialog({
    open,
    onOpenChange,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [amount, setAmount] = useState("");
    const [merchant, setMerchant] = useState("");
    const [category, setCategory] = useState("");
    const [paymentMethod, setPaymentMethod] = useState("");
    const [bankName, setBankName] = useState("");
    const [account, setAccount] = useState("");
    const [transactionType, setTransactionType] = useState("DEBIT");
    const [timestamp, setTimestamp] = useState(new Date().toISOString().slice(0, 16));
    const [notes, setNotes] = useState("");

    const queryClient = useQueryClient();

    const { data: categories, isLoading: isLoadingCategories } = useQuery({
        queryKey: ["categories"],
        queryFn: getCategories,
    });

    const { data: transactionOptions } = useQuery({
        queryKey: ["transaction-options"],
        queryFn: getTransactionOptions,
    });

    const apiCategoryNames = Array.isArray(categories)
        ? categories
            .map((cat: { name?: string }) => cat?.name)
            .filter((value): value is string => Boolean(value))
        : [];

    const categoryOptions = Array.from(new Set([...apiCategoryNames, ...FALLBACK_CATEGORIES])).sort();

    const transactionTypeOptions = Array.from(new Set([
        ...TRANSACTION_TYPES,
        ...(transactionOptions?.transactionTypes ?? []),
    ])).filter((value): value is string => Boolean(value));

    const paymentMethodOptions = Array.from(new Set([
        ...PAYMENT_METHODS,
        ...(transactionOptions?.paymentMethods ?? []),
    ].filter((value) => value !== null && value !== undefined)));

    const mutation = useMutation({
        mutationFn: createTransaction,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["transactions"] });
            queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
            onOpenChange(false);
            setAmount("");
            setMerchant("");
            setCategory("");
            setPaymentMethod("");
            setBankName("");
            setAccount("");
            setTransactionType("DEBIT");
            setTimestamp(new Date().toISOString().slice(0, 16));
            setNotes("");
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const transactionData = {
            amount: parseFloat(amount),
            merchant,
            category,
            paymentMethod,
            bankName,
            account,
            transactionType,
            timestamp: new Date(timestamp).toISOString(),
            notes,
            source: "manual",
        };

        mutation.mutate(transactionData);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl rounded-2xl p-8">
                <DialogHeader className="space-y-2">
                    <DialogTitle>Add New Transaction</DialogTitle>
                    <DialogDescription>
                        Enter the details below. This uses the same spacing and rounded controls as the edit dialog.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid gap-5 md:grid-cols-2">
                        <label className="space-y-2 md:col-span-1">
                            <Label htmlFor="amount">Amount</Label>
                            <Input
                                id="amount"
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="rounded-lg border border-border bg-background px-3 py-2"
                                required
                            />
                        </label>

                        <label className="space-y-2 md:col-span-1">
                            <Label htmlFor="merchant">Merchant</Label>
                            <Input
                                id="merchant"
                                value={merchant}
                                onChange={(e) => setMerchant(e.target.value)}
                                className="rounded-lg border border-border bg-background px-3 py-2"
                                required
                            />
                        </label>

                        <label className="space-y-2 md:col-span-1">
                            <Label htmlFor="category">Category</Label>
                            <Select
                                value={category}
                                onValueChange={(value) => setCategory(value || "")}
                                disabled={isLoadingCategories}
                            >
                                <SelectTrigger className="rounded-lg border border-border bg-background px-3 py-2">
                                    <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categoryOptions.map((name) => (
                                        <SelectItem key={name} value={name}>
                                            {name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </label>

                        <label className="space-y-2 md:col-span-1">
                            <Label htmlFor="paymentMethod">Method</Label>
                            <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value || "")}>
                                <SelectTrigger className="rounded-lg border border-border bg-background px-3 py-2">
                                    <SelectValue placeholder="Select a payment method" />
                                </SelectTrigger>
                                <SelectContent>
                                    {paymentMethodOptions.map((method) => (
                                        <SelectItem key={method || "none"} value={method}>
                                            {method || "None"}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </label>

                        <label className="space-y-2 md:col-span-1">
                            <Label htmlFor="bankName">Bank</Label>
                            <Input
                                id="bankName"
                                value={bankName}
                                onChange={(e) => setBankName(e.target.value)}
                                className="rounded-lg border border-border bg-background px-3 py-2"
                            />
                        </label>

                        <label className="space-y-2 md:col-span-1">
                            <Label htmlFor="account">Account</Label>
                            <Input
                                id="account"
                                value={account}
                                onChange={(e) => setAccount(e.target.value)}
                                className="rounded-lg border border-border bg-background px-3 py-2"
                            />
                        </label>

                        <label className="space-y-2 md:col-span-1">
                            <Label htmlFor="transactionType">Type</Label>
                            <Select value={transactionType} onValueChange={(value) => setTransactionType(value || "DEBIT")}>
                                <SelectTrigger className="rounded-lg border border-border bg-background px-3 py-2">
                                    <SelectValue placeholder="Select a type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {transactionTypeOptions.map((value) => (
                                        <SelectItem key={value} value={value}>
                                            {value}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </label>

                        <label className="space-y-2 md:col-span-1">
                            <Label htmlFor="timestamp">Date</Label>
                            <Input
                                id="timestamp"
                                type="datetime-local"
                                value={timestamp}
                                onChange={(e) => setTimestamp(e.target.value)}
                                className="rounded-lg border border-border bg-background px-3 py-2"
                                required
                            />
                        </label>

                        <label className="space-y-2 md:col-span-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea
                                id="notes"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="min-h-28 rounded-lg border border-border bg-background px-3 py-2"
                            />
                        </label>
                    </div>

                    <DialogFooter className="pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => onOpenChange(false)}
                            className="rounded-lg"
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={mutation.isPending} className="rounded-lg">
                            {mutation.isPending ? "Saving..." : "Save Transaction"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}