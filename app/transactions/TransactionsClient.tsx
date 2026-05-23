"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    ColumnDef,
    RowSelectionState,
    SortingState,
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table";
import {
    ArrowUpDown,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    ChevronUp,
    Edit,
    ListFilter,
    MoreVertical,
    RotateCcw,
    Trash2,
} from "lucide-react";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FALLBACK_CATEGORIES } from "@/src/data/transactionOptions";
import type { TransactionListItem, TransactionListResponse } from "@/src/types/transactions";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const DATE_RANGE_OPTIONS = [
    { value: "all", label: "All time" },
    { value: "today", label: "Today" },
    { value: "last7", label: "Last 7 days" },
    { value: "last30", label: "Last 30 days" },
    { value: "last90", label: "Last 90 days" },
    { value: "this_month", label: "This month" },
    { value: "last_month", label: "Last month" },
    { value: "custom", label: "Custom range" },
];
const TRANSACTION_TYPE_FILTERS = [
    { value: "all", label: "All" },
    { value: "credit", label: "Credit" },
    { value: "debit", label: "Debit" },
    { value: "income", label: "Income" },
    { value: "expense", label: "Expense" },
];
const DEFAULT_SORT: SortingState = [{ id: "date", desc: true }];
const DEFAULT_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 600;
const COLUMN_VISIBILITY_KEY = "transactions.columnVisibility";
const VALID_SORT_FIELDS = new Set(["date", "amount", "merchant", "category", "type"]);
const COLUMN_LABELS: Record<string, string> = {
    date: "Date",
    merchant: "Merchant",
    amount: "Amount",
    category: "Category",
    paymentMethod: "Method",
    bankName: "Bank",
    type: "Type",
    confidence: "Confidence",
    notes: "Notes",
};

type QueryState = {
    page: number;
    pageSize: number;
    search: string;
    category: string;
    type: string;
    dateRange: string;
    dateFrom: string;
    dateTo: string;
    amountMin: string;
    amountMax: string;
    merchant: string;
    sorting: SortingState;
};

type EditFormData = {
    merchant: string;
    amount: string;
    timestamp: string;
    categoryName: string;
    paymentMethod: string;
    bankName: string;
    transactionType: string;
    notes: string;
};

function clampNumber(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function parseSort(value: string | null): SortingState {
    if (!value) return DEFAULT_SORT;
    const parts = value
        .split(",")
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .map((chunk) => {
            const divider = chunk.includes(":") ? ":" : "_";
            const [idRaw, directionRaw] = chunk.split(divider);
            const id = idRaw?.trim();
            if (!id || !VALID_SORT_FIELDS.has(id)) return null;
            return {
                id,
                desc: directionRaw?.trim().toLowerCase() === "desc",
            };
        })
        .filter((entry): entry is SortingState[number] => Boolean(entry));

    return parts.length ? parts : DEFAULT_SORT;
}

function encodeSort(value: SortingState) {
    if (!value.length) return "";
    return value.map((item) => `${item.id}_${item.desc ? "desc" : "asc"}`).join(",");
}

function parseQueryState(params: URLSearchParams): QueryState {
    const page = clampNumber(Number(params.get("page") ?? "1"), 1, Number.MAX_SAFE_INTEGER);
    const pageSize = clampNumber(Number(params.get("pageSize") ?? DEFAULT_PAGE_SIZE), 1, 100);

    return {
        page,
        pageSize,
        search: params.get("search") ?? "",
        category: params.get("category") ?? "",
        type: params.get("type") ?? "all",
        dateRange: params.get("dateRange") ?? "all",
        dateFrom: params.get("dateFrom") ?? "",
        dateTo: params.get("dateTo") ?? "",
        amountMin: params.get("amountMin") ?? "",
        amountMax: params.get("amountMax") ?? "",
        merchant: params.get("merchant") ?? "",
        sorting: parseSort(params.get("sort")),
    };
}

function buildQueryString(state: QueryState) {
    const params = new URLSearchParams();
    params.set("page", String(state.page));
    params.set("pageSize", String(state.pageSize));

    if (state.search) params.set("search", state.search);
    if (state.category) params.set("category", state.category);
    if (state.type && state.type !== "all") params.set("type", state.type);
    if (state.dateRange && state.dateRange !== "all") params.set("dateRange", state.dateRange);
    if (state.dateFrom) params.set("dateFrom", state.dateFrom);
    if (state.dateTo) params.set("dateTo", state.dateTo);
    if (state.amountMin) params.set("amountMin", state.amountMin);
    if (state.amountMax) params.set("amountMax", state.amountMax);
    if (state.merchant) params.set("merchant", state.merchant);

    const sort = encodeSort(state.sorting);
    if (sort) params.set("sort", sort);

    return params.toString();
}

function useDebouncedValue<T>(value: T, delay = SEARCH_DEBOUNCE_MS) {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(value), delay);
        return () => window.clearTimeout(timer);
    }, [value, delay]);

    return debounced;
}

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(amount);
}

function normalizeType(value?: string | null) {
    return (value || "").toUpperCase();
}

function isCreditType(value?: string | null) {
    return ["CREDIT", "SALARY", "REFUND"].includes(normalizeType(value));
}

export default function TransactionsClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryState = useMemo(() => parseQueryState(searchParams), [searchParams]);

    const [page, setPage] = useState(queryState.page);
    const [pageSize, setPageSize] = useState(queryState.pageSize);
    const [searchInput, setSearchInput] = useState(queryState.search);
    const [merchantInput, setMerchantInput] = useState(queryState.merchant);
    const [category, setCategory] = useState(queryState.category);
    const [typeFilter, setTypeFilter] = useState(queryState.type);
    const [dateRange, setDateRange] = useState(queryState.dateRange);
    const [dateFrom, setDateFrom] = useState(queryState.dateFrom);
    const [dateTo, setDateTo] = useState(queryState.dateTo);
    const [amountMin, setAmountMin] = useState(queryState.amountMin);
    const [amountMax, setAmountMax] = useState(queryState.amountMax);
    const [sorting, setSorting] = useState<SortingState>(queryState.sorting);
    const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({
        notes: false,
        confidence: false,
    });
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [transactions, setTransactions] = useState<TransactionListItem[]>([]);
    const [meta, setMeta] = useState<TransactionListResponse>({
        data: [],
        total: 0,
        page: queryState.page,
        pageSize: queryState.pageSize,
        totalPages: 1,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Edit and delete state
    const [editingTransaction, setEditingTransaction] = useState<TransactionListItem | null>(null);
    const [editFormData, setEditFormData] = useState<EditFormData>({
        merchant: "",
        amount: "",
        timestamp: "",
        categoryName: "",
        paymentMethod: "",
        bankName: "",
        transactionType: "",
        notes: "",
    });
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isEditLoading, setIsEditLoading] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
    const [isDeleteLoading, setIsDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
    const [isBulkDeleteLoading, setIsBulkDeleteLoading] = useState(false);
    const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

    const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);
    const debouncedMerchant = useDebouncedValue(merchantInput, SEARCH_DEBOUNCE_MS);

    const updateQuery = useCallback((updates: Partial<QueryState>) => {
        const params = new URLSearchParams(searchParams);

        const nextState = { ...queryState, ...updates };
        const sortParam = encodeSort(nextState.sorting);

        params.set("page", String(nextState.page));
        params.set("pageSize", String(nextState.pageSize));

        const optionalParams: Array<[string, string | undefined]> = [
            ["search", nextState.search || undefined],
            ["category", nextState.category || undefined],
            ["type", nextState.type !== "all" ? nextState.type : undefined],
            ["dateRange", nextState.dateRange !== "all" ? nextState.dateRange : undefined],
            ["dateFrom", nextState.dateFrom || undefined],
            ["dateTo", nextState.dateTo || undefined],
            ["amountMin", nextState.amountMin || undefined],
            ["amountMax", nextState.amountMax || undefined],
            ["merchant", nextState.merchant || undefined],
            ["sort", sortParam || undefined],
        ];

        for (const [key, value] of optionalParams) {
            if (!value) {
                params.delete(key);
            } else {
                params.set(key, value);
            }
        }

        router.replace(`?${params.toString()}`, { scroll: false });
    }, [router, searchParams, queryState]);

    const refetchTransactions = useCallback(async () => {
        setLoading(true);
        try {
            const query = buildQueryString(queryState);
            const res = await fetch(`/api/transactions/list?${query}`);
            if (!res.ok) throw new Error("Failed to reload transactions");
            const payload = await res.json() as TransactionListResponse;
            setTransactions(payload.data ?? []);
            setMeta(payload);
            setRowSelection({});
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, [queryState]);

    const handleEditOpen = useCallback((transaction: TransactionListItem) => {
        setEditingTransaction(transaction);
        setEditFormData({
            merchant: transaction.merchant,
            amount: String(transaction.amount),
            timestamp: typeof transaction.timestamp === "string"
                ? new Date(transaction.timestamp).toISOString().slice(0, 16)
                : transaction.timestamp.toISOString().slice(0, 16),
            categoryName: transaction.category?.name || "",
            paymentMethod: transaction.paymentMethod || "",
            bankName: transaction.bankName || "",
            transactionType: transaction.transactionType || "",
            notes: transaction.notes || "",
        });
        setEditError(null);
        setIsEditDialogOpen(true);
    }, []);

    const handleEditClose = useCallback(() => {
        setIsEditDialogOpen(false);
        setEditingTransaction(null);
        setEditFormData({
            merchant: "",
            amount: "",
            timestamp: "",
            categoryName: "",
            paymentMethod: "",
            bankName: "",
            transactionType: "",
            notes: "",
        });
        setEditError(null);
    }, []);

    const handleEditSave = useCallback(async () => {
        if (!editingTransaction) return;

        setIsEditLoading(true);
        setEditError(null);

        try {
            const amount = Number(editFormData.amount);
            if (!Number.isFinite(amount) || amount < 0) {
                throw new Error("Enter a valid amount");
            }

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
                const errorData = await res.json();
                throw new Error(errorData.error || "Failed to update transaction");
            }

            handleEditClose();
            await refetchTransactions();
        } catch (err) {
            setEditError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsEditLoading(false);
        }
    }, [editingTransaction, editFormData, handleEditClose, refetchTransactions]);

    const handleDeleteOpen = useCallback((transactionId: string) => {
        setDeletingTransactionId(transactionId);
        setDeleteError(null);
    }, []);

    const handleDeleteConfirm = useCallback(async () => {
        if (!deletingTransactionId) return;

        setIsDeleteLoading(true);
        setDeleteError(null);

        try {
            const res = await fetch(`/api/transactions/${deletingTransactionId}`, {
                method: "DELETE",
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Failed to delete transaction");
            }

            setDeletingTransactionId(null);
            await refetchTransactions();
        } catch (err) {
            setDeleteError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsDeleteLoading(false);
        }
    }, [deletingTransactionId, refetchTransactions]);

    const handleDeleteCancel = useCallback(() => {
        setDeletingTransactionId(null);
        setDeleteError(null);
    }, []);

    useEffect(() => {
        setPage(queryState.page);
        setPageSize(queryState.pageSize);
        setSearchInput(queryState.search);
        setMerchantInput(queryState.merchant);
        setCategory(queryState.category);
        setTypeFilter(queryState.type);
        setDateRange(queryState.dateRange);
        setDateFrom(queryState.dateFrom);
        setDateTo(queryState.dateTo);
        setAmountMin(queryState.amountMin);
        setAmountMax(queryState.amountMax);
        setSorting(queryState.sorting);
    }, [queryState]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const stored = window.localStorage.getItem(COLUMN_VISIBILITY_KEY);
        if (!stored) return;

        try {
            const parsed = JSON.parse(stored) as Record<string, boolean>;
            setColumnVisibility(parsed);
        } catch {
            // ignore invalid local storage
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(columnVisibility));
    }, [columnVisibility]);

    useEffect(() => {
        if (debouncedSearch === queryState.search) return;
        updateQuery({ search: debouncedSearch, page: 1 });
    }, [debouncedSearch, queryState.search, updateQuery]);

    useEffect(() => {
        if (debouncedMerchant === queryState.merchant) return;
        updateQuery({ merchant: debouncedMerchant, page: 1 });
    }, [debouncedMerchant, queryState.merchant, updateQuery]);

    useEffect(() => {
        const controller = new AbortController();
        const run = async () => {
            setLoading(true);
            setError(null);
            try {
                const query = buildQueryString(queryState);
                const res = await fetch(`/api/transactions/list?${query}`, { signal: controller.signal });
                if (!res.ok) throw new Error("Failed to load transactions");
                const payload = await res.json() as TransactionListResponse;
                setTransactions(payload.data ?? []);
                setMeta(payload);
                setRowSelection({});
            } catch (err: unknown) {
                if (err instanceof DOMException && err.name === "AbortError") return;
                setError(err instanceof Error ? err.message : String(err));
            } finally {
                setLoading(false);
            }
        };

        run();
        return () => controller.abort();
    }, [queryState]);

    const columns = useMemo<ColumnDef<TransactionListItem>[]>(() => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    indeterminate={table.getIsSomePageRowsSelected()}
                    onCheckedChange={(checked) => table.toggleAllPageRowsSelected(Boolean(checked))}
                    aria-label="Select all transactions on page"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(checked) => row.toggleSelected(Boolean(checked))}
                    aria-label={`Select transaction ${row.original.merchant}`}
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "timestamp",
            id: "date",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    size="xs"
                    onClick={column.getToggleSortingHandler()}
                    className="gap-1"
                >
                    Date
                    {column.getIsSorted() === "asc" ? <ChevronUp /> : column.getIsSorted() === "desc" ? <ChevronDown /> : <ArrowUpDown />}
                </Button>
            ),
            cell: ({ row }) => {
                const value = row.original.timestamp;
                const date = typeof value === "string" || typeof value === "number" ? new Date(value) : value;
                return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString() : "-";
            },
        },
        {
            accessorKey: "merchant",
            id: "merchant",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    size="xs"
                    onClick={column.getToggleSortingHandler()}
                    className="gap-1"
                >
                    Merchant
                    {column.getIsSorted() === "asc" ? <ChevronUp /> : column.getIsSorted() === "desc" ? <ChevronDown /> : <ArrowUpDown />}
                </Button>
            ),
            cell: ({ row }) => <span className="font-medium">{row.original.merchant}</span>,
        },
        {
            accessorKey: "amount",
            id: "amount",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    size="xs"
                    onClick={column.getToggleSortingHandler()}
                    className="gap-1"
                >
                    Amount
                    {column.getIsSorted() === "asc" ? <ChevronUp /> : column.getIsSorted() === "desc" ? <ChevronDown /> : <ArrowUpDown />}
                </Button>
            ),
            cell: ({ row }) => {
                const type = row.original.transactionType || row.original.type;
                const credit = isCreditType(type);
                return (
                    <span className={credit ? "text-emerald-500" : "text-rose-500"}>
                        {credit ? "+" : "-"}
                        {formatCurrency(row.original.amount)}
                    </span>
                );
            },
        },
        {
            id: "category",
            accessorFn: (row) => row.category?.name ?? "Uncategorized",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    size="xs"
                    onClick={column.getToggleSortingHandler()}
                    className="gap-1"
                >
                    Category
                    {column.getIsSorted() === "asc" ? <ChevronUp /> : column.getIsSorted() === "desc" ? <ChevronDown /> : <ArrowUpDown />}
                </Button>
            ),
            cell: ({ row }) => row.original.category?.name || "Uncategorized",
        },
        {
            accessorKey: "paymentMethod",
            id: "paymentMethod",
            header: "Method",
            cell: ({ row }) => row.original.paymentMethod || "-",
        },
        {
            accessorKey: "bankName",
            id: "bankName",
            header: "Bank",
            cell: ({ row }) => row.original.bankName || "-",
        },
        {
            id: "type",
            accessorFn: (row) => row.transactionType || row.type || "OTHER",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    size="xs"
                    onClick={column.getToggleSortingHandler()}
                    className="gap-1"
                >
                    Type
                    {column.getIsSorted() === "asc" ? <ChevronUp /> : column.getIsSorted() === "desc" ? <ChevronDown /> : <ArrowUpDown />}
                </Button>
            ),
        },
        {
            accessorKey: "confidence",
            id: "confidence",
            header: "Confidence",
            cell: ({ row }) => {
                const confidence = row.original.confidence;
                return typeof confidence === "number" ? `${Math.round(confidence * 100)}%` : "-";
            },
        },
        {
            accessorKey: "notes",
            id: "notes",
            header: "Notes",
            cell: ({ row }) => row.original.notes || "-",
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
                <DropdownMenu>
                    <DropdownMenuTrigger
                        aria-label="Open transaction actions"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <MoreVertical className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditOpen(row.original)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteOpen(row.original.id)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
            enableSorting: false,
            enableHiding: false,
        },
    ], [handleEditOpen, handleDeleteOpen]);

    const table = useReactTable({
        data: transactions,
        columns,
        state: {
            sorting,
            columnVisibility,
            rowSelection,
            pagination: {
                pageIndex: page - 1,
                pageSize,
            },
        },
        manualSorting: true,
        manualPagination: true,
        enableMultiSort: true,
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
        onColumnVisibilityChange: setColumnVisibility,
        onSortingChange: (updater) => {
            const next = typeof updater === "function" ? updater(sorting) : updater;
            setSorting(next);
            updateQuery({ sorting: next, page: 1 });
        },
        onPaginationChange: (updater) => {
            const next = typeof updater === "function"
                ? updater({ pageIndex: page - 1, pageSize })
                : updater;
            updateQuery({ page: next.pageIndex + 1, pageSize: next.pageSize });
        },
        pageCount: meta.totalPages,
        getCoreRowModel: getCoreRowModel(),
    });

    const selectedCount = table.getSelectedRowModel().rows.length;
    const selectedTransactionIds = table.getSelectedRowModel().rows.map((row) => row.original.id);

    const handleBulkDeleteConfirm = useCallback(async () => {
        if (!selectedTransactionIds.length) return;

        setIsBulkDeleteLoading(true);
        setBulkDeleteError(null);

        try {
            const res = await fetch("/api/transactions/bulk", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids: selectedTransactionIds }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Failed to delete selected transactions");
            }

            setIsBulkDeleteDialogOpen(false);
            setRowSelection({});
            await refetchTransactions();
        } catch (err) {
            setBulkDeleteError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsBulkDeleteLoading(false);
        }
    }, [refetchTransactions, selectedTransactionIds]);

    const handleBulkDeleteCancel = useCallback(() => {
        setIsBulkDeleteDialogOpen(false);
        setBulkDeleteError(null);
    }, []);

    const hasFilters = Boolean(
        queryState.search ||
        queryState.category ||
        (queryState.type && queryState.type !== "all") ||
        (queryState.dateRange && queryState.dateRange !== "all") ||
        queryState.amountMin ||
        queryState.amountMax ||
        queryState.merchant
    );

    const emptyMessage = hasFilters
        ? "No transactions match the current filters."
        : "No transactions yet. Start by importing or adding one.";

    return (
        <Card>
            <CardHeader className="border-b border-border/60">
                <CardTitle>All Transactions</CardTitle>
                <CardAction>
                    <DropdownMenu>
                        <DropdownMenuTrigger className={buttonVariants({ variant: "outline", size: "xs" })}>
                            <ListFilter />
                            Columns
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {table.getAllLeafColumns().filter((column) => column.getCanHide()).map((column) => (
                                <DropdownMenuCheckboxItem
                                    key={column.id}
                                    checked={column.getIsVisible()}
                                    onCheckedChange={(checked) => column.toggleVisibility(Boolean(checked))}
                                >
                                    {COLUMN_LABELS[column.id] ?? column.id}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </CardAction>
            </CardHeader>
            <CardContent className="space-y-5 sm:space-y-6">
                <div className="grid gap-3 lg:grid-cols-4">
                    <label className="space-y-1">
                        <Label>Global search</Label>
                        <Input
                            value={searchInput}
                            onChange={(event) => setSearchInput(event.target.value)}
                            placeholder="Search merchant, notes, category, bank"
                        />
                    </label>
                    <label className="space-y-1">
                        <Label>Merchant</Label>
                        <Input
                            value={merchantInput}
                            onChange={(event) => setMerchantInput(event.target.value)}
                            placeholder="Search merchant"
                        />
                    </label>
                    <label className="space-y-1">
                        <Label>Category</Label>
                        <Select
                            value={category || "all"}
                            onValueChange={(value) => {
                                const next = value === "all" ? "" : value;
                                setCategory(value === "all" ? "" : (value as string));
                                updateQuery({ category: next as string, page: 1 });
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="All categories" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All categories</SelectItem>
                                {FALLBACK_CATEGORIES.map((item) => (
                                    <SelectItem key={item} value={item}>{item}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </label>
                    <label className="space-y-1">
                        <Label>Transaction type</Label>
                        <Select
                            value={typeFilter}
                            onValueChange={(value) => {
                                setTypeFilter(value as string);
                                updateQuery({ type: value as string, page: 1 });
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="All types" />
                            </SelectTrigger>
                            <SelectContent>
                                {TRANSACTION_TYPE_FILTERS.map((item) => (
                                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <label className="space-y-1">
                        <Label>Date range</Label>
                        <Select
                            value={dateRange}
                            onValueChange={(value) => {
                                setDateRange(value as string);
                                const resetDates = value !== "custom";
                                setDateFrom(resetDates ? "" : dateFrom);
                                setDateTo(resetDates ? "" : dateTo);
                                updateQuery({
                                    dateRange: value as string,
                                    dateFrom: resetDates ? "" : dateFrom,
                                    dateTo: resetDates ? "" : dateTo,
                                    page: 1,
                                });
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="All time" />
                            </SelectTrigger>
                            <SelectContent>
                                {DATE_RANGE_OPTIONS.map((item) => (
                                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </label>
                    {dateRange === "custom" && (
                        <label className="space-y-1">
                            <Label>From</Label>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(event) => {
                                    const next = event.target.value;
                                    setDateFrom(next);
                                    updateQuery({ dateFrom: next, page: 1 });
                                }}
                            />
                        </label>
                    )}
                    {dateRange === "custom" && (
                        <label className="space-y-1">
                            <Label>To</Label>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(event) => {
                                    const next = event.target.value;
                                    setDateTo(next);
                                    updateQuery({ dateTo: next, page: 1 });
                                }}
                            />
                        </label>
                    )}
                    <label className="space-y-1">
                        <Label>Min amount</Label>
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={amountMin}
                            onChange={(event) => {
                                const next = event.target.value;
                                setAmountMin(next);
                                updateQuery({ amountMin: next, page: 1 });
                            }}
                            placeholder="e.g. 500"
                        />
                    </label>
                    <label className="space-y-1">
                        <Label>Max amount</Label>
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={amountMax}
                            onChange={(event) => {
                                const next = event.target.value;
                                setAmountMax(next);
                                updateQuery({ amountMax: next, page: 1 });
                            }}
                            placeholder="e.g. 10000"
                        />
                    </label>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-muted-foreground">
                        {selectedCount > 0 ? `${selectedCount} selected` : `${meta.total} total`}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {selectedCount > 0 && (
                            <Button
                                type="button"
                                variant="destructive"
                                size="xs"
                                className="rounded-lg"
                                onClick={() => setIsBulkDeleteDialogOpen(true)}
                            >
                                <Trash2 />
                                Delete selected
                            </Button>
                        )}
                        <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => {
                                setSearchInput("");
                                setMerchantInput("");
                                setCategory("");
                                setTypeFilter("all");
                                setDateRange("all");
                                setDateFrom("");
                                setDateTo("");
                                setAmountMin("");
                                setAmountMax("");
                                setSorting(DEFAULT_SORT);
                                updateQuery({
                                    page: 1,
                                    pageSize,
                                    search: "",
                                    merchant: "",
                                    category: "",
                                    type: "all",
                                    dateRange: "all",
                                    dateFrom: "",
                                    dateTo: "",
                                    amountMin: "",
                                    amountMax: "",
                                    sorting: DEFAULT_SORT,
                                });
                            }}
                        >
                            <RotateCcw />
                            Clear filters
                        </Button>
                    </div>
                </div>

                {error && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {error}
                    </div>
                )}

                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {loading && Array.from({ length: pageSize }).map((_, index) => (
                            <TableRow key={`skeleton-${index}`}>
                                {table.getVisibleLeafColumns().map((column) => (
                                    <TableCell key={`${column.id}-${index}`}>
                                        <Skeleton className="h-5 w-full" />
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                        {!loading && table.getRowModel().rows.map((row) => (
                            <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id}>
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                        {!loading && table.getRowModel().rows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={table.getVisibleLeafColumns().length} className="py-10 text-center text-muted-foreground">
                                    {emptyMessage}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>

                <div className="flex flex-col gap-3 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Rows per page</span>
                        <Select
                            value={String(pageSize)}
                            onValueChange={(value) => {
                                const next = Number(value);
                                setPageSize(Number(value as string));
                                updateQuery({ pageSize: next, page: 1 });
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
                    <div className="text-sm text-muted-foreground">
                        Page {page} of {meta.totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            onClick={() => updateQuery({ page: 1 })}
                            disabled={page <= 1}
                            aria-label="First page"
                        >
                            <ChevronsLeft />
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            onClick={() => updateQuery({ page: page - 1 })}
                            disabled={page <= 1}
                            aria-label="Previous page"
                        >
                            <ChevronLeft />
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            onClick={() => updateQuery({ page: page + 1 })}
                            disabled={page >= meta.totalPages}
                            aria-label="Next page"
                        >
                            <ChevronRight />
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            onClick={() => updateQuery({ page: meta.totalPages })}
                            disabled={page >= meta.totalPages}
                            aria-label="Last page"
                        >
                            <ChevronsRight />
                        </Button>
                    </div>
                </div>
            </CardContent>

            {/* Edit Transaction Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="rounded-2xl p-4 sm:max-w-2xl sm:p-8">
                    <DialogHeader>
                        <DialogTitle>Edit Transaction</DialogTitle>
                        <DialogDescription>
                            Update transaction details below. Changes will be saved immediately when you click Save.
                        </DialogDescription>
                    </DialogHeader>

                    {editError && (
                        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            {editError}
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
                        <Button variant="outline" className="rounded-lg" onClick={handleEditClose} disabled={isEditLoading}>
                            Cancel
                        </Button>
                        <Button className="rounded-lg" onClick={handleEditSave} disabled={isEditLoading}>
                            {isEditLoading ? "Saving..." : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={Boolean(deletingTransactionId)} onOpenChange={(open) => {
                if (!open) handleDeleteCancel();
            }}>
                <DialogContent className="sm:max-w-md rounded-2xl p-8">
                    <DialogHeader>
                        <DialogTitle>Delete Transaction</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this transaction? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    {deleteError && (
                        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            {deleteError}
                        </div>
                    )}

                    <DialogFooter className="pt-2">
                        <Button variant="outline" className="rounded-lg" onClick={handleDeleteCancel} disabled={isDeleteLoading}>
                            Cancel
                        </Button>
                        <Button variant="destructive" className="rounded-lg" onClick={handleDeleteConfirm} disabled={isDeleteLoading}>
                            {isDeleteLoading ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isBulkDeleteDialogOpen} onOpenChange={(open) => {
                if (!open) handleBulkDeleteCancel();
            }}>
                <DialogContent className="sm:max-w-md rounded-2xl p-8">
                    <DialogHeader>
                        <DialogTitle>Delete Selected Transactions</DialogTitle>
                        <DialogDescription>
                            This will permanently delete {selectedCount} selected transaction{selectedCount === 1 ? "" : "s"}.
                        </DialogDescription>
                    </DialogHeader>

                    {bulkDeleteError && (
                        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                            {bulkDeleteError}
                        </div>
                    )}

                    <DialogFooter className="pt-2">
                        <Button variant="outline" className="rounded-lg" onClick={handleBulkDeleteCancel} disabled={isBulkDeleteLoading}>
                            Cancel
                        </Button>
                        <Button variant="destructive" className="rounded-lg" onClick={handleBulkDeleteConfirm} disabled={isBulkDeleteLoading}>
                            {isBulkDeleteLoading ? "Deleting..." : "Delete selected"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
