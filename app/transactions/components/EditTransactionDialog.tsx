"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FALLBACK_CATEGORIES } from "@/src/data/transactionOptions";
import type { TransactionListItem } from "@/src/types/transactions";

export type EditFormData = {
    merchant: string;
    amount: string;
    timestamp: string;
    categoryName: string;
    paymentMethod: string;
    bankName: string;
    transactionType: string;
    notes: string;
};

type EditTransactionDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    editingTransaction: TransactionListItem | null;
    editFormData: EditFormData;
    setEditFormData: React.Dispatch<React.SetStateAction<EditFormData>>;
    isLoading: boolean;
    error: string | null;
};

export function EditTransactionDialog({
    isOpen,
    onClose,
    onSave,
    editingTransaction,
    editFormData,
    setEditFormData,
    isLoading,
    error,
}: EditTransactionDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="rounded-2xl p-4 sm:max-w-2xl sm:p-8">
                <DialogHeader>
                    <DialogTitle>Edit Transaction</DialogTitle>
                    <DialogDescription>
                        Update transaction details below. Changes will be saved immediately when you click Save.
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {error}
                    </div>
                )}

                {editingTransaction && (
                    <div className="grid gap-5 md:grid-cols-2">
                        <label className="space-y-2 md:col-span-2">
                            <Label>Merchant</Label>
                            <Input
                                className="rounded-lg border border-border bg-background px-3 py-2"
                                value={editFormData.merchant || ""}
                                onChange={(e) => setEditFormData({ ...editFormData, merchant: e.target.value })}
                                placeholder="e.g., Starbucks, Amazon"
                            />
                        </label>

                        <label className="space-y-2">
                            <Label>Amount</Label>
                            <Input
                                className="rounded-lg border border-border bg-background px-3 py-2"
                                type="number"
                                step="0.01"
                                min="0"
                                value={editFormData.amount}
                                onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                                placeholder="0.00"
                            />
                        </label>

                        <label className="space-y-2">
                            <Label>Date</Label>
                            <Input
                                className="rounded-lg border border-border bg-background px-3 py-2"
                                type="datetime-local"
                                value={editFormData.timestamp}
                                onChange={(e) => setEditFormData({ ...editFormData, timestamp: e.target.value })}
                            />
                        </label>

                        <label className="space-y-2">
                            <Label>Category</Label>
                            <Select
                                value={editFormData.categoryName}
                                onValueChange={(value) => {
                                    setEditFormData({ ...editFormData, categoryName: value as string });
                                }}
                            >
                                <SelectTrigger className="rounded-lg border border-border bg-background px-3 py-2">
                                    <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Uncategorized</SelectItem>
                                    {FALLBACK_CATEGORIES.map((item) => (
                                        <SelectItem key={item} value={item}>{item}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </label>

                        <label className="space-y-2">
                            <Label>Payment Method</Label>
                            <Input
                                className="rounded-lg border border-border bg-background px-3 py-2"
                                value={editFormData.paymentMethod}
                                onChange={(e) => setEditFormData({ ...editFormData, paymentMethod: e.target.value })}
                                placeholder="e.g., Credit Card, Debit Card, Cash"
                            />
                        </label>

                        <label className="space-y-2">
                            <Label>Bank Name</Label>
                            <Input
                                className="rounded-lg border border-border bg-background px-3 py-2"
                                value={editFormData.bankName}
                                onChange={(e) => setEditFormData({ ...editFormData, bankName: e.target.value })}
                                placeholder="e.g., Chase, Bank of America"
                            />
                        </label>

                        <label className="space-y-2">
                            <Label>Transaction Type</Label>
                            <Select
                                value={editFormData.transactionType}
                                onValueChange={(value) => setEditFormData({ ...editFormData, transactionType: value as string })}
                            >
                                <SelectTrigger className="rounded-lg border border-border bg-background px-3 py-2">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="DEBIT">Debit</SelectItem>
                                    <SelectItem value="CREDIT">Credit</SelectItem>
                                    <SelectItem value="EXPENSE">Expense</SelectItem>
                                    <SelectItem value="INCOME">Income</SelectItem>
                                    <SelectItem value="SALARY">Salary</SelectItem>
                                    <SelectItem value="REFUND">Refund</SelectItem>
                                </SelectContent>
                            </Select>
                        </label>

                        <label className="space-y-2 md:col-span-2">
                            <Label>Notes</Label>
                            <Textarea
                                className="rounded-lg border border-border bg-background px-3 py-2"
                                value={editFormData.notes}
                                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                                placeholder="Add any additional notes"
                            />
                        </label>
                    </div>
                )}

                <DialogFooter className="pt-2">
                    <Button variant="outline" className="rounded-lg" onClick={onClose} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button className="rounded-lg" onClick={onSave} disabled={isLoading}>
                        {isLoading ? "Saving..." : "Save Changes"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
