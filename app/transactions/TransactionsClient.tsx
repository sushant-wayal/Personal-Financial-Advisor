"use client";

import React, { useCallback, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { TransactionListItem, TransactionListResponse } from "@/src/types/transactions";
import { useTransactionFilters } from "./hooks/useTransactionFilters";
import { buildQueryString } from "./utils/transactionUtils";
import { TransactionFiltersBar } from "./components/TransactionFiltersBar";
import { EditFormData, EditTransactionDialog } from "./components/EditTransactionDialog";
import { DeleteTransactionDialogs } from "./components/DeleteTransactionDialogs";
import { TransactionsPagination } from "./components/TransactionsPagination";

export default function TransactionsClient() {
    const filters = useTransactionFilters();
    const { queryState, updateQuery, resetFilters } = filters;

    const [meta, setMeta] = useState<TransactionListResponse>({
        data: [],
        total: 0,
        page: queryState.page,
        pageSize: queryState.pageSize,
        totalPages: 1,
    });
    const [error, setError] = useState<string | null>(null);

    // Edit/Delete modal states
    const [editingTransaction, setEditingTransaction] = useState<TransactionListItem | null>(null);
    const [editFormData, setEditFormData] = useState<EditFormData>({
        merchant: "", amount: "", timestamp: "", categoryName: "", paymentMethod: "", bankName: "", transactionType: "", notes: ""
    });
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isEditLoading, setIsEditLoading] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
    const [isDeleteLoading, setIsDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);

    const refetchTransactions = useCallback(async () => {
        try {
            const query = buildQueryString(queryState);
            const res = await fetch(`/api/transactions/list?${query}`);
            if (!res.ok) throw new Error("Failed to reload transactions");
            const payload = (await res.json()) as TransactionListResponse;
            setMeta(payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }, [queryState]);

    useEffect(() => {
        const controller = new AbortController();
        const run = async () => {
            setError(null);
            try {
                const query = buildQueryString(queryState);
                const res = await fetch(`/api/transactions/list?${query}`, { signal: controller.signal });
                if (!res.ok) throw new Error("Failed to load transactions");
                const payload = (await res.json()) as TransactionListResponse;
                setMeta(payload);
            } catch (err: unknown) {
                if (err instanceof DOMException && err.name === "AbortError") return;
                setError(err instanceof Error ? err.message : String(err));
            }
        };
        run();
        return () => controller.abort();
    }, [queryState]);

    const handleEditSave = async () => {
        if (!editingTransaction) return;
        setIsEditLoading(true);
        setEditError(null);
        try {
            const amount = Number(editFormData.amount);
            if (!Number.isFinite(amount) || amount < 0) throw new Error("Enter a valid amount");
            const body = {
                merchant: editFormData.merchant || editingTransaction.merchant,
                amount,
                timestamp: editFormData.timestamp ? new Date(editFormData.timestamp).toISOString() : undefined,
                category: editFormData.categoryName || undefined,
                paymentMethod: editFormData.paymentMethod || null,
                bankName: editFormData.bankName || null,
                transactionType: editFormData.transactionType || undefined,
                notes: editFormData.notes || null,
            };
            const res = await fetch(`/api/transactions/${editingTransaction.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to update transaction");
            }
            setIsEditDialogOpen(false);
            setEditingTransaction(null);
            await refetchTransactions();
        } catch (err) {
            setEditError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsEditLoading(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deletingTransactionId) return;
        setIsDeleteLoading(true);
        setDeleteError(null);
        try {
            const res = await fetch(`/api/transactions/${deletingTransactionId}`, { method: "DELETE" });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to delete transaction");
            }
            setDeletingTransactionId(null);
            await refetchTransactions();
        } catch (err) {
            setDeleteError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsDeleteLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader className="border-b border-border/60">
                <CardTitle>All Transactions ({meta.total})</CardTitle>
                <CardAction>
                    <Button type="button" variant="ghost" size="xs" onClick={resetFilters}>
                        <RotateCcw className="h-3.5 w-3.5 mr-1" />
                        Clear filters
                    </Button>
                </CardAction>
            </CardHeader>
            <CardContent className="space-y-5 sm:space-y-6">
                <TransactionFiltersBar
                    searchInput={filters.searchInput}
                    setSearchInput={filters.setSearchInput}
                    merchantInput={filters.merchantInput}
                    setMerchantInput={filters.setMerchantInput}
                    category={filters.category}
                    setCategory={filters.setCategory}
                    typeFilter={filters.typeFilter}
                    setTypeFilter={filters.setTypeFilter}
                    dateRange={filters.dateRange}
                    setDateRange={filters.setDateRange}
                    dateFrom={filters.dateFrom}
                    setDateFrom={filters.setDateFrom}
                    dateTo={filters.dateTo}
                    setDateTo={filters.setDateTo}
                    amountMin={filters.amountMin}
                    setAmountMin={filters.setAmountMin}
                    amountMax={filters.amountMax}
                    setAmountMax={filters.setAmountMax}
                    onQueryUpdate={updateQuery}
                />

                {error && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {error}
                    </div>
                )}

                <TransactionsPagination
                    page={filters.page}
                    pageSize={filters.pageSize}
                    totalPages={meta.totalPages}
                    onUpdateQuery={updateQuery}
                />
            </CardContent>

            <EditTransactionDialog
                isOpen={isEditDialogOpen}
                onClose={() => setIsEditDialogOpen(false)}
                onSave={handleEditSave}
                editingTransaction={editingTransaction}
                editFormData={editFormData}
                setEditFormData={setEditFormData}
                isLoading={isEditLoading}
                error={editError}
            />

            <DeleteTransactionDialogs
                deletingTransactionId={deletingTransactionId}
                onSingleCancel={() => setDeletingTransactionId(null)}
                onSingleConfirm={handleDeleteConfirm}
                isSingleLoading={isDeleteLoading}
                singleError={deleteError}
                isBulkOpen={isBulkDeleteDialogOpen}
                selectedCount={0}
                onBulkCancel={() => setIsBulkDeleteDialogOpen(false)}
                onBulkConfirm={() => {}}
                isBulkLoading={false}
                bulkError={null}
            />
        </Card>
    );
}
