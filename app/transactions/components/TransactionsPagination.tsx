"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { PAGE_SIZE_OPTIONS } from "../utils/transactionUtils";

type TransactionsPaginationProps = {
    page: number;
    pageSize: number;
    totalPages: number;
    onUpdateQuery: (updates: Record<string, unknown>) => void;
};

export function TransactionsPagination({
    page,
    pageSize,
    totalPages,
    onUpdateQuery,
}: TransactionsPaginationProps) {
    return (
        <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rows per page</span>
                <Select
                    value={String(pageSize)}
                    onValueChange={(val: string | null) => {
                        const next = Number(val || 20);
                        onUpdateQuery({ pageSize: next, page: 1 });
                    }}
                >
                    <SelectTrigger size="sm">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((size) => (
                            <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div>Page {page} of {totalPages || 1}</div>
                <div className="flex items-center gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="icon-xs"
                        onClick={() => onUpdateQuery({ page: 1 })}
                        disabled={page <= 1}
                        aria-label="First page"
                    >
                        <ChevronsLeft />
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon-xs"
                        onClick={() => onUpdateQuery({ page: page - 1 })}
                        disabled={page <= 1}
                        aria-label="Previous page"
                    >
                        <ChevronLeft />
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon-xs"
                        onClick={() => onUpdateQuery({ page: page + 1 })}
                        disabled={page >= totalPages}
                        aria-label="Next page"
                    >
                        <ChevronRight />
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon-xs"
                        onClick={() => onUpdateQuery({ page: totalPages })}
                        disabled={page >= totalPages}
                        aria-label="Last page"
                    >
                        <ChevronsRight />
                    </Button>
                </div>
            </div>
        </div>
    );
}
