"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SortingState } from "@tanstack/react-table";
import { DEFAULT_SORT, encodeSort, parseQueryState, QueryState, SEARCH_DEBOUNCE_MS } from "../utils/transactionUtils";

function useDebouncedValue<T>(value: T, delay = SEARCH_DEBOUNCE_MS) {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(value), delay);
        return () => window.clearTimeout(timer);
    }, [value, delay]);

    return debounced;
}

export function useTransactionFilters() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryState = useMemo(() => parseQueryState(searchParams), [searchParams]);

    const [searchInput, setSearchInput] = useState(queryState.search);
    const [merchantInput, setMerchantInput] = useState(queryState.merchant);

    const debouncedSearch = useDebouncedValue(searchInput);
    const debouncedMerchant = useDebouncedValue(merchantInput);

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
            if (!value) params.delete(key);
            else params.set(key, value);
        }

        router.replace(`?${params.toString()}`, { scroll: false });
    }, [router, searchParams, queryState]);

    useEffect(() => {
        if (debouncedSearch === queryState.search) return;
        updateQuery({ search: debouncedSearch, page: 1 });
    }, [debouncedSearch, queryState.search, updateQuery]);

    useEffect(() => {
        if (debouncedMerchant === queryState.merchant) return;
        updateQuery({ merchant: debouncedMerchant, page: 1 });
    }, [debouncedMerchant, queryState.merchant, updateQuery]);

    const resetFilters = useCallback(() => {
        setSearchInput("");
        setMerchantInput("");
        updateQuery({
            page: 1,
            pageSize: queryState.pageSize,
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
    }, [queryState.pageSize, updateQuery]);

    return {
        queryState,
        page: queryState.page,
        pageSize: queryState.pageSize,
        setPageSize: (size: number) => updateQuery({ pageSize: size, page: 1 }),
        searchInput,
        setSearchInput,
        merchantInput,
        setMerchantInput,
        category: queryState.category,
        setCategory: (cat: string) => updateQuery({ category: cat, page: 1 }),
        typeFilter: queryState.type,
        setTypeFilter: (type: string) => updateQuery({ type, page: 1 }),
        dateRange: queryState.dateRange,
        setDateRange: (range: string) => updateQuery({ dateRange: range, page: 1 }),
        dateFrom: queryState.dateFrom,
        setDateFrom: (from: string) => updateQuery({ dateFrom: from, page: 1 }),
        dateTo: queryState.dateTo,
        setDateTo: (to: string) => updateQuery({ dateTo: to, page: 1 }),
        amountMin: queryState.amountMin,
        setAmountMin: (min: string) => updateQuery({ amountMin: min, page: 1 }),
        amountMax: queryState.amountMax,
        setAmountMax: (max: string) => updateQuery({ amountMax: max, page: 1 }),
        sorting: queryState.sorting,
        setSorting: (sorting: SortingState) => updateQuery({ sorting, page: 1 }),
        updateQuery,
        resetFilters,
    };
}
