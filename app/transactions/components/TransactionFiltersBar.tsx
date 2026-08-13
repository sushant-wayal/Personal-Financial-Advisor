"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FALLBACK_CATEGORIES } from "@/src/data/transactionOptions";
import { DATE_RANGE_OPTIONS, TRANSACTION_TYPE_FILTERS } from "../utils/transactionUtils";

type TransactionFiltersBarProps = {
    searchInput: string;
    setSearchInput: (v: string) => void;
    merchantInput: string;
    setMerchantInput: (v: string) => void;
    category: string;
    setCategory: (v: string) => void;
    typeFilter: string;
    setTypeFilter: (v: string) => void;
    dateRange: string;
    setDateRange: (v: string) => void;
    dateFrom: string;
    setDateFrom: (v: string) => void;
    dateTo: string;
    setDateTo: (v: string) => void;
    amountMin: string;
    setAmountMin: (v: string) => void;
    amountMax: string;
    setAmountMax: (v: string) => void;
    onQueryUpdate: (updates: Record<string, unknown>) => void;
    onReset?: () => void;
};

export function TransactionFiltersBar({
    searchInput,
    setSearchInput,
    merchantInput,
    setMerchantInput,
    category,
    setCategory,
    typeFilter,
    setTypeFilter,
    dateRange,
    setDateRange,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    amountMin,
    setAmountMin,
    amountMax,
    setAmountMax,
    onQueryUpdate,
}: TransactionFiltersBarProps) {
    return (
        <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-4">
                <label className="space-y-1">
                    <Label>Global search</Label>
                    <Input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search merchant, notes, category, bank"
                    />
                </label>
                <label className="space-y-1">
                    <Label>Merchant</Label>
                    <Input
                        value={merchantInput}
                        onChange={(e) => setMerchantInput(e.target.value)}
                        placeholder="Search merchant"
                    />
                </label>
                <label className="space-y-1">
                    <Label>Category</Label>
                    <Select
                        value={category || "all"}
                        onValueChange={(val: string | null) => {
                            const next = val === "all" || !val ? "" : val;
                            setCategory(next);
                            onQueryUpdate({ category: next, page: 1 });
                        }}
                    >
                        <SelectTrigger><SelectValue placeholder="All categories" /></SelectTrigger>
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
                        onValueChange={(val: string | null) => {
                            const next = val || "all";
                            setTypeFilter(next);
                            onQueryUpdate({ type: next, page: 1 });
                        }}
                    >
                        <SelectTrigger><SelectValue placeholder="All types" /></SelectTrigger>
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
                        onValueChange={(val: string | null) => {
                            const next = val || "all";
                            setDateRange(next);
                            const resetDates = next !== "custom";
                            setDateFrom(resetDates ? "" : dateFrom);
                            setDateTo(resetDates ? "" : dateTo);
                            onQueryUpdate({
                                dateRange: next,
                                dateFrom: resetDates ? "" : dateFrom,
                                dateTo: resetDates ? "" : dateTo,
                                page: 1,
                            });
                        }}
                    >
                        <SelectTrigger><SelectValue placeholder="All time" /></SelectTrigger>
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
                            onChange={(e) => {
                                setDateFrom(e.target.value);
                                onQueryUpdate({ dateFrom: e.target.value, page: 1 });
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
                            onChange={(e) => {
                                setDateTo(e.target.value);
                                onQueryUpdate({ dateTo: e.target.value, page: 1 });
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
                        onChange={(e) => {
                            setAmountMin(e.target.value);
                            onQueryUpdate({ amountMin: e.target.value, page: 1 });
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
                        onChange={(e) => {
                            setAmountMax(e.target.value);
                            onQueryUpdate({ amountMax: e.target.value, page: 1 });
                        }}
                        placeholder="e.g. 10000"
                    />
                </label>
            </div>
        </div>
    );
}
