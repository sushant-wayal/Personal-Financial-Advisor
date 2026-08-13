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

export type SingleDeleteDialogProps = {
    deletingTransactionId: string | null;
    onCancel: () => void;
    onConfirm: () => void;
    isLoading: boolean;
    error: string | null;
};

export type BulkDeleteDialogProps = {
    isOpen: boolean;
    selectedCount: number;
    onCancel: () => void;
    onConfirm: () => void;
    isLoading: boolean;
    error: string | null;
};

export function DeleteTransactionDialogs({
    deletingTransactionId,
    onSingleCancel,
    onSingleConfirm,
    isSingleLoading,
    singleError,
    isBulkOpen,
    selectedCount,
    onBulkCancel,
    onBulkConfirm,
    isBulkLoading,
    bulkError,
}: {
    deletingTransactionId: string | null;
    onSingleCancel: () => void;
    onSingleConfirm: () => void;
    isSingleLoading: boolean;
    singleError: string | null;
    isBulkOpen: boolean;
    selectedCount: number;
    onBulkCancel: () => void;
    onBulkConfirm: () => void;
    isBulkLoading: boolean;
    bulkError: string | null;
}) {
    return (
        <>
            {/* Single Delete Confirmation Dialog */}
            <Dialog open={Boolean(deletingTransactionId)} onOpenChange={(open) => !open && onSingleCancel()}>
                <DialogContent className="sm:max-w-md rounded-2xl p-8">
                    <DialogHeader>
                        <DialogTitle>Delete Transaction</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this transaction? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    {singleError && (
                        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            {singleError}
                        </div>
                    )}

                    <DialogFooter className="pt-2">
                        <Button variant="outline" className="rounded-lg" onClick={onSingleCancel} disabled={isSingleLoading}>
                            Cancel
                        </Button>
                        <Button variant="destructive" className="rounded-lg" onClick={onSingleConfirm} disabled={isSingleLoading}>
                            {isSingleLoading ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Bulk Delete Confirmation Dialog */}
            <Dialog open={isBulkOpen} onOpenChange={(open) => !open && onBulkCancel()}>
                <DialogContent className="sm:max-w-md rounded-2xl p-8">
                    <DialogHeader>
                        <DialogTitle>Delete Selected Transactions</DialogTitle>
                        <DialogDescription>
                            This will permanently delete {selectedCount} selected transaction{selectedCount === 1 ? "" : "s"}.
                        </DialogDescription>
                    </DialogHeader>

                    {bulkError && (
                        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            {bulkError}
                        </div>
                    )}

                    <DialogFooter className="pt-2">
                        <Button variant="outline" className="rounded-lg" onClick={onBulkCancel} disabled={isBulkLoading}>
                            Cancel
                        </Button>
                        <Button variant="destructive" className="rounded-lg" onClick={onBulkConfirm} disabled={isBulkLoading}>
                            {isBulkLoading ? "Deleting..." : "Delete selected"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
