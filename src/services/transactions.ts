import { Prisma } from "@prisma/client";

import { prisma } from "../lib/prisma";
import { TransactionListResponse } from "../types/transactions";

export type TransactionSortField = "date" | "amount" | "merchant" | "category" | "type";
export type TransactionSort = { id: TransactionSortField; desc: boolean };

export type TransactionQueryInput = {
    page?: number;
    pageSize?: number;
    search?: string;
    category?: string;
    type?: string;
    dateRange?: string;
    dateFrom?: string;
    dateTo?: string;
    amountMin?: number;
    amountMax?: number;
    merchant?: string;
    sort?: TransactionSort[];
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const INCOME_TYPES = ["CREDIT", "SALARY", "REFUND", "INCOME", "BONUS"];
const EXPENSE_TYPES = ["DEBIT", "SUBSCRIPTION", "TRANSFER", "PAYMENT", "BILL", "CHARGE", "EXPENSE", "PURCHASE", "WITHDRAWAL"];

function normalizePage(value?: number) {
    const parsed = Number(value ?? 1);
    if (!Number.isFinite(parsed) || parsed < 1) return 1;
    return Math.floor(parsed);
}

function normalizePageSize(value?: number) {
    const parsed = Number(value ?? DEFAULT_PAGE_SIZE);
    if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_PAGE_SIZE;
    return Math.min(MAX_PAGE_SIZE, Math.floor(parsed));
}

function startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function resolveDateRange(input: Pick<TransactionQueryInput, "dateRange" | "dateFrom" | "dateTo">) {
    const now = new Date();
    const range = (input.dateRange || "").toLowerCase();

    if (!range || range === "all") {
        return {};
    }

    if (range === "today") {
        const from = startOfDay(now);
        const to = addDays(from, 1);
        return { from, to };
    }

    if (range === "last7") {
        const to = addDays(startOfDay(now), 1);
        const from = addDays(to, -7);
        return { from, to };
    }

    if (range === "last30") {
        const to = addDays(startOfDay(now), 1);
        const from = addDays(to, -30);
        return { from, to };
    }

    if (range === "last90") {
        const to = addDays(startOfDay(now), 1);
        const from = addDays(to, -90);
        return { from, to };
    }

    if (range === "this_month") {
        const from = new Date(now.getFullYear(), now.getMonth(), 1);
        const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return { from, to };
    }

    if (range === "last_month") {
        const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const to = new Date(now.getFullYear(), now.getMonth(), 1);
        return { from, to };
    }

    if (range === "custom") {
        const from = input.dateFrom ? new Date(input.dateFrom) : null;
        const to = input.dateTo ? addDays(new Date(input.dateTo), 1) : null;
        return {
            from: from && !Number.isNaN(from.getTime()) ? from : undefined,
            to: to && !Number.isNaN(to.getTime()) ? to : undefined,
        };
    }

    return {};
}

function resolveTypeFilter(value?: string) {
    const normalized = (value || "").toLowerCase();
    if (!normalized || normalized === "all") return undefined;
    if (normalized === "credit") return ["CREDIT"];
    if (normalized === "debit") return ["DEBIT"];
    if (normalized === "income") return INCOME_TYPES;
    if (normalized === "expense") return EXPENSE_TYPES;
    return undefined;
}

function buildOrderBy(sort?: TransactionSort[]) {
    const orderBy: Prisma.TransactionOrderByWithRelationInput[] = [];

    for (const entry of sort ?? []) {
        const direction: Prisma.SortOrder = entry.desc ? "desc" : "asc";
        if (entry.id === "date") orderBy.push({ timestamp: direction });
        if (entry.id === "amount") orderBy.push({ amount: direction });
        if (entry.id === "merchant") orderBy.push({ merchant: direction });
        if (entry.id === "category") orderBy.push({ category: { name: direction } });
        if (entry.id === "type") orderBy.push({ transactionType: direction });
    }

    if (orderBy.length === 0) {
        orderBy.push({ timestamp: "desc" });
    }

    return orderBy;
}

export async function getTransactions(input: TransactionQueryInput): Promise<TransactionListResponse> {
    const page = normalizePage(input.page);
    const pageSize = normalizePageSize(input.pageSize);
    const search = input.search?.trim();
    const category = input.category?.trim();
    const merchant = input.merchant?.trim();
    const typeFilter = resolveTypeFilter(input.type);
    const { from, to } = resolveDateRange(input);

    const andConditions: Prisma.TransactionWhereInput[] = [];

    if (search) {
        andConditions.push({
            OR: [
                { merchant: { contains: search } },
                { notes: { contains: search } },
                { bankName: { contains: search } },
                { category: { name: { contains: search } } },
            ],
        });
    }

    if (merchant) {
        andConditions.push({ merchant: { contains: merchant } });
    }

    if (category) {
        andConditions.push({ category: { name: { equals: category } } });
    }

    if (typeFilter) {
        andConditions.push({
            OR: [
                { transactionType: { in: typeFilter } },
                { type: { in: typeFilter } },
            ],
        });
    }

    if (from || to) {
        andConditions.push({
            timestamp: {
                gte: from,
                lt: to,
            },
        });
    }

    const where: Prisma.TransactionWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

    if (input.amountMin !== undefined || input.amountMax !== undefined) {
        andConditions.push({
            amount: {
                gte: Number.isFinite(input.amountMin) ? input.amountMin : undefined,
                lte: Number.isFinite(input.amountMax) ? input.amountMax : undefined,
            },
        });
        if (andConditions.length > 0) {
            where.AND = andConditions;
        }
    }

    if (andConditions.length === 0) {
        delete where.AND;
    }

    const skip = (page - 1) * pageSize;
    const orderBy = buildOrderBy(input.sort);

    try {
        const [data, total] = await prisma.$transaction([
            prisma.transaction.findMany({
                where,
                orderBy,
                skip,
                take: pageSize,
                select: {
                    id: true,
                    amount: true,
                    merchant: true,
                    timestamp: true,
                    type: true,
                    transactionType: true,
                    paymentMethod: true,
                    bankName: true,
                    notes: true,
                    confidence: true,
                    category: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            }),
            prisma.transaction.count({ where }),
        ]);

        const totalPages = Math.max(1, Math.ceil(total / pageSize));

        return {
            data,
            total,
            page,
            pageSize,
            totalPages,
        };
    } catch (error) {
        console.error("getTransactions failed", {
            page,
            pageSize,
            search,
            category,
            merchant,
            type: input.type,
            dateRange: input.dateRange,
            dateFrom: input.dateFrom,
            dateTo: input.dateTo,
            amountMin: input.amountMin,
            amountMax: input.amountMax,
            sort: input.sort,
            error,
        });
        throw error;
    }
}
