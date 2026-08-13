import { SortingState } from "@tanstack/react-table";

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
export const DATE_RANGE_OPTIONS = [
    { value: "all", label: "All time" },
    { value: "today", label: "Today" },
    { value: "last7", label: "Last 7 days" },
    { value: "last30", label: "Last 30 days" },
    { value: "last90", label: "Last 90 days" },
    { value: "this_month", label: "This month" },
    { value: "last_month", label: "Last month" },
    { value: "custom", label: "Custom range" },
];
export const TRANSACTION_TYPE_FILTERS = [
    { value: "all", label: "All" },
    { value: "credit", label: "Credit" },
    { value: "debit", label: "Debit" },
    { value: "income", label: "Income" },
    { value: "expense", label: "Expense" },
];
export const DEFAULT_SORT: SortingState = [{ id: "date", desc: true }];
export const DEFAULT_PAGE_SIZE = 20;
export const SEARCH_DEBOUNCE_MS = 600;
export const COLUMN_VISIBILITY_KEY = "transactions.columnVisibility";
export const VALID_SORT_FIELDS = new Set(["date", "amount", "merchant", "category", "type"]);
export const COLUMN_LABELS: Record<string, string> = {
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

export type QueryState = {
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

export function clampNumber(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

export function parseSort(value: string | null): SortingState {
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

export function encodeSort(value: SortingState) {
    if (!value.length) return "";
    return value.map((item) => `${item.id}_${item.desc ? "desc" : "asc"}`).join(",");
}

export function parseQueryState(params: URLSearchParams): QueryState {
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

export function buildQueryString(state: QueryState) {
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

export function isCreditType(value?: string | null) {
    const norm = (value || "").toUpperCase();
    return ["CREDIT", "SALARY", "REFUND"].includes(norm);
}
