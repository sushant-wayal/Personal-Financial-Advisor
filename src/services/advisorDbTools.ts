/**
 * advisorDbTools.ts
 *
 * The database abstraction layer for the AI advisor.
 *
 * Provides 8 general-purpose read-only tools the LLM can call at runtime to
 * fetch exactly the data it needs. No Prisma client or raw SQL is ever exposed
 * to the model. Every input is validated and sanitised here before touching
 * the database.
 *
 * IMPORTANT: This file must only perform SELECT/read operations.
 * No INSERT, UPDATE, or DELETE is permitted.
 */

import { prisma } from "../lib/prisma";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToolName =
    | "queryTransactions"
    | "aggregateTransactions"
    | "queryGoals"
    | "querySubscriptions"
    | "queryCategories"
    | "getFinancialProfile"
    | "queryMemories"
    | "queryInsights";

export type ToolCallRequest = {
    name: ToolName;
    args: Record<string, unknown>;
};

export type ToolCallResult = {
    name: ToolName;
    data: unknown;
    error?: string;
};

// ─── Gemini Function Declaration Schema ──────────────────────────────────────
// This is the schema the LLM sees. It describes each tool's purpose and parameters.

export const ADVISOR_TOOL_DECLARATIONS = [
    {
        name: "queryTransactions",
        description:
            "Fetch a filtered, paginated list of transactions from the database. " +
            "Use this when you need raw transaction records — e.g. all transactions for a specific merchant, " +
            "a date range, a category, an amount range, or any combination. " +
            "Results are sorted by date descending by default.",
        parameters: {
            type: "object",
            properties: {
                dateFrom: { type: "string", description: "Start date in ISO format (YYYY-MM-DD), inclusive." },
                dateTo: { type: "string", description: "End date in ISO format (YYYY-MM-DD), inclusive." },
                dateRange: {
                    type: "string",
                    enum: ["today", "last7", "last30", "last90", "this_month", "last_month", "all"],
                    description: "Shorthand date range. Ignored if dateFrom/dateTo are set.",
                },
                merchant: { type: "string", description: "Partial merchant name match (case-insensitive)." },
                category: { type: "string", description: "Exact category name match." },
                type: {
                    type: "string",
                    enum: ["income", "expense", "credit", "debit"],
                    description: "Filter by transaction direction.",
                },
                amountMin: { type: "number", description: "Minimum absolute amount (inclusive)." },
                amountMax: { type: "number", description: "Maximum absolute amount (inclusive)." },
                sortBy: {
                    type: "string",
                    enum: ["date", "amount", "merchant"],
                    description: "Field to sort by. Defaults to date.",
                },
                sortDir: {
                    type: "string",
                    enum: ["asc", "desc"],
                    description: "Sort direction. Defaults to desc.",
                },
                limit: { type: "number", description: "Max number of results. Max 200, default 50." },
                page: { type: "number", description: "Page number (1-indexed). Default 1." },
            },
            required: [],
        },
    },
    {
        name: "aggregateTransactions",
        description:
            "Compute aggregate statistics over transactions — sum, count, or average — grouped by a dimension. " +
            "Use for questions like 'how much did I spend per category last month', " +
            "'what are my top merchants by spend', or 'how has my spending trended month by month'.",
        parameters: {
            type: "object",
            properties: {
                groupBy: {
                    type: "string",
                    enum: ["category", "merchant", "month", "type", "paymentMethod", "bankName"],
                    description: "The dimension to group results by.",
                },
                metric: {
                    type: "string",
                    enum: ["sum", "count", "avg"],
                    description: "The aggregation function to apply.",
                },
                dateFrom: { type: "string", description: "Start date in ISO format." },
                dateTo: { type: "string", description: "End date in ISO format." },
                dateRange: {
                    type: "string",
                    enum: ["today", "last7", "last30", "last90", "this_month", "last_month", "all"],
                    description: "Shorthand date range.",
                },
                type: {
                    type: "string",
                    enum: ["income", "expense", "credit", "debit"],
                    description: "Filter to only income or expense transactions before aggregating.",
                },
                limit: { type: "number", description: "Return top N groups. Default 20, max 50." },
            },
            required: ["groupBy", "metric"],
        },
    },
    {
        name: "queryGoals",
        description: "Fetch financial goals, optionally filtered by status or priority.",
        parameters: {
            type: "object",
            properties: {
                status: {
                    type: "string",
                    enum: ["ACTIVE", "COMPLETED", "PAUSED"],
                    description: "Filter by goal status.",
                },
                priority: { type: "number", description: "Filter by exact priority number." },
                limit: { type: "number", description: "Max goals to return. Default 20." },
            },
            required: [],
        },
    },
    {
        name: "querySubscriptions",
        description: "Fetch tracked subscriptions. Can filter to active only.",
        parameters: {
            type: "object",
            properties: {
                activeOnly: { type: "boolean", description: "If true, only return active subscriptions. Default false." },
                limit: { type: "number", description: "Max subscriptions to return. Default 50." },
            },
            required: [],
        },
    },
    {
        name: "queryCategories",
        description: "List all known transaction categories.",
        parameters: {
            type: "object",
            properties: {},
            required: [],
        },
    },
    {
        name: "getFinancialProfile",
        description: "Fetch the user's financial profile: balance, monthly income, monthly expenses, emergency fund, currency.",
        parameters: {
            type: "object",
            properties: {},
            required: [],
        },
    },
    {
        name: "queryMemories",
        description: "Search stored AI memory entries by key substring or tag.",
        parameters: {
            type: "object",
            properties: {
                tag: { type: "string", description: "Filter memories with this tag." },
                keyContains: { type: "string", description: "Filter memories whose key contains this string." },
                limit: { type: "number", description: "Max results. Default 20, max 50." },
            },
            required: [],
        },
    },
    {
        name: "queryInsights",
        description: "Fetch stored financial insights, optionally filtered by type.",
        parameters: {
            type: "object",
            properties: {
                type: { type: "string", description: "Filter by insight type." },
                limit: { type: "number", description: "Max results. Default 10, max 30." },
            },
            required: [],
        },
    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: unknown, min: number, max: number, def: number): number {
    const n = Number(value);
    if (!Number.isFinite(n) || n < min) return def;
    return Math.min(max, Math.floor(n));
}

function safeString(value: unknown): string | undefined {
    if (typeof value === "string" && value.trim()) return value.trim();
    return undefined;
}

function parseSafeDate(value: unknown): Date | undefined {
    if (!value) return undefined;
    const d = new Date(String(value));
    return Number.isNaN(d.getTime()) ? undefined : d;
}

const INCOME_TYPES = ["CREDIT", "SALARY", "REFUND", "INCOME", "BONUS"];
const EXPENSE_TYPES = ["DEBIT", "SUBSCRIPTION", "TRANSFER", "PAYMENT", "BILL", "CHARGE", "EXPENSE", "PURCHASE", "WITHDRAWAL"];

function resolveTypeFilter(type: unknown): string[] | undefined {
    const t = String(type || "").toLowerCase();
    if (!t) return undefined;
    if (t === "income") return INCOME_TYPES;
    if (t === "expense") return EXPENSE_TYPES;
    if (t === "credit") return ["CREDIT"];
    if (t === "debit") return ["DEBIT"];
    return undefined;
}

function resolveDateBounds(args: Record<string, unknown>): { gte?: Date; lt?: Date } {
    const dateFrom = parseSafeDate(args.dateFrom);
    const dateTo = parseSafeDate(args.dateTo);

    // Explicit dates override shorthand
    if (dateFrom || dateTo) {
        return {
            gte: dateFrom,
            // dateTo is inclusive — add 1 day for the lt bound
            lt: dateTo ? new Date(dateTo.getTime() + 86400000) : undefined,
        };
    }

    const range = String(args.dateRange || "").toLowerCase();
    const now = new Date();

    if (range === "today") {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return { gte: start, lt: new Date(start.getTime() + 86400000) };
    }
    if (range === "last7") {
        return { gte: new Date(now.getTime() - 7 * 86400000) };
    }
    if (range === "last30") {
        return { gte: new Date(now.getTime() - 30 * 86400000) };
    }
    if (range === "last90") {
        return { gte: new Date(now.getTime() - 90 * 86400000) };
    }
    if (range === "this_month") {
        return {
            gte: new Date(now.getFullYear(), now.getMonth(), 1),
            lt: new Date(now.getFullYear(), now.getMonth() + 1, 1),
        };
    }
    if (range === "last_month") {
        return {
            gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
            lt: new Date(now.getFullYear(), now.getMonth(), 1),
        };
    }

    return {};
}

// ─── Tool Implementations ─────────────────────────────────────────────────────

async function toolQueryTransactions(args: Record<string, unknown>): Promise<unknown> {
    const limit = clamp(args.limit, 1, 200, 50);
    const page = clamp(args.page, 1, 1000, 1);
    const skip = (page - 1) * limit;

    const merchant = safeString(args.merchant);
    const category = safeString(args.category);
    const typeFilter = resolveTypeFilter(args.type);
    const dateBounds = resolveDateBounds(args);
    const amountMin = Number.isFinite(Number(args.amountMin)) ? Number(args.amountMin) : undefined;
    const amountMax = Number.isFinite(Number(args.amountMax)) ? Number(args.amountMax) : undefined;

    const sortBy = String(args.sortBy || "date");
    const sortDir = String(args.sortDir || "desc") === "asc" ? "asc" as const : "desc" as const;

    const andConditions: Record<string, unknown>[] = [];

    if (merchant) {
        andConditions.push({ merchant: { contains: merchant, mode: "insensitive" } });
    }
    if (category) {
        andConditions.push({ category: { name: { equals: category, mode: "insensitive" } } });
    }
    if (typeFilter) {
        andConditions.push({ OR: [{ transactionType: { in: typeFilter } }, { type: { in: typeFilter } }] });
    }
    if (dateBounds.gte || dateBounds.lt) {
        andConditions.push({ timestamp: dateBounds });
    }
    if (amountMin !== undefined || amountMax !== undefined) {
        andConditions.push({ amount: { gte: amountMin, lte: amountMax } });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    let orderBy: Record<string, unknown> = { timestamp: sortDir };
    if (sortBy === "amount") orderBy = { amount: sortDir };
    if (sortBy === "merchant") orderBy = { merchant: sortDir };

    const [rows, total] = await prisma.$transaction([
        prisma.transaction.findMany({
            where,
            orderBy,
            skip,
            take: limit,
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
                category: { select: { id: true, name: true } },
            },
        }),
        prisma.transaction.count({ where }),
    ]);

    return { rows, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

async function toolAggregateTransactions(args: Record<string, unknown>): Promise<unknown> {
    const groupBy = String(args.groupBy || "category");
    const metric = String(args.metric || "sum");
    const limit = clamp(args.limit, 1, 50, 20);
    const typeFilter = resolveTypeFilter(args.type);
    const dateBounds = resolveDateBounds(args);

    // Build base where for date/type filters
    const andConditions: Record<string, unknown>[] = [];
    if (dateBounds.gte || dateBounds.lt) {
        andConditions.push({ timestamp: dateBounds });
    }
    if (typeFilter) {
        andConditions.push({ OR: [{ transactionType: { in: typeFilter } }, { type: { in: typeFilter } }] });
    }
    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    // Fetch all matching transactions (capped at 5000 for aggregation safety)
    const txs = await prisma.transaction.findMany({
        where,
        take: 5000,
        select: {
            amount: true,
            merchant: true,
            timestamp: true,
            type: true,
            transactionType: true,
            paymentMethod: true,
            bankName: true,
            category: { select: { name: true } },
        },
    });

    // Group in memory (avoids raw SQL, keeps it database-agnostic)
    const groups = new Map<string, { sum: number; count: number; amounts: number[] }>();

    for (const tx of txs) {
        let key: string;

        switch (groupBy) {
            case "category":
                key = tx.category?.name || "Uncategorized";
                break;
            case "merchant":
                key = tx.merchant || "Unknown";
                break;
            case "month": {
                const d = new Date(tx.timestamp);
                key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                break;
            }
            case "type":
                key = tx.transactionType || tx.type || "OTHER";
                break;
            case "paymentMethod":
                key = tx.paymentMethod || "Unknown";
                break;
            case "bankName":
                key = tx.bankName || "Unknown";
                break;
            default:
                key = "Unknown";
        }

        const entry = groups.get(key) || { sum: 0, count: 0, amounts: [] };
        const amt = Math.abs(Number(tx.amount));
        entry.sum += amt;
        entry.count += 1;
        entry.amounts.push(amt);
        groups.set(key, entry);
    }

    let results = Array.from(groups.entries()).map(([label, g]) => {
        let value: number;
        if (metric === "count") value = g.count;
        else if (metric === "avg") value = g.count > 0 ? g.sum / g.count : 0;
        else value = g.sum;
        return { label, value: Math.round(value * 100) / 100, count: g.count };
    });

    // Sort by value descending, take top N
    results.sort((a, b) => b.value - a.value);
    results = results.slice(0, limit);

    return { groupBy, metric, results, totalTransactionsScanned: txs.length };
}

async function toolQueryGoals(args: Record<string, unknown>): Promise<unknown> {
    const limit = clamp(args.limit, 1, 100, 20);
    const status = safeString(args.status);
    const priority = Number.isFinite(Number(args.priority)) ? Number(args.priority) : undefined;

    const where: Record<string, unknown> = {};
    if (status) where.status = status.toUpperCase();
    if (priority !== undefined) where.priority = priority;

    const goals = await prisma.goal.findMany({
        where,
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        take: limit,
    });

    return { goals, total: goals.length };
}

async function toolQuerySubscriptions(args: Record<string, unknown>): Promise<unknown> {
    const limit = clamp(args.limit, 1, 200, 50);
    const activeOnly = args.activeOnly === true;

    const subscriptions = await prisma.subscription.findMany({
        where: activeOnly ? { active: true } : undefined,
        orderBy: { updatedAt: "desc" },
        take: limit,
    });

    return { subscriptions, total: subscriptions.length };
}

async function toolQueryCategories(): Promise<unknown> {
    const categories = await prisma.category.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, description: true },
    });
    return { categories, total: categories.length };
}

async function toolGetFinancialProfile(): Promise<unknown> {
    const profile = await prisma.financialProfile.findFirst();
    return { profile };
}

async function toolQueryMemories(args: Record<string, unknown>): Promise<unknown> {
    const limit = clamp(args.limit, 1, 50, 20);
    const tag = safeString(args.tag);
    const keyContains = safeString(args.keyContains);

    const andConditions: Record<string, unknown>[] = [];
    if (tag) andConditions.push({ tags: { contains: tag } });
    if (keyContains) andConditions.push({ key: { contains: keyContains, mode: "insensitive" } });

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    const memories = await prisma.aIMemory.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: { id: true, key: true, value: true, tags: true, updatedAt: true },
    });

    return { memories, total: memories.length };
}

async function toolQueryInsights(args: Record<string, unknown>): Promise<unknown> {
    const limit = clamp(args.limit, 1, 30, 10);
    const type = safeString(args.type);

    const insights = await prisma.financialInsight.findMany({
        where: type ? { type: { contains: type, mode: "insensitive" } } : undefined,
        orderBy: { createdAt: "desc" },
        take: limit,
        select: { id: true, type: true, message: true, score: true, createdAt: true },
    });

    return { insights, total: insights.length };
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

/**
 * Execute a tool call requested by the LLM.
 * This is the only entry point — the route/loop never calls Prisma directly.
 */
export async function executeAdvisorTool(call: ToolCallRequest): Promise<ToolCallResult> {
    try {
        let data: unknown;

        switch (call.name) {
            case "queryTransactions":
                data = await toolQueryTransactions(call.args);
                break;
            case "aggregateTransactions":
                data = await toolAggregateTransactions(call.args);
                break;
            case "queryGoals":
                data = await toolQueryGoals(call.args);
                break;
            case "querySubscriptions":
                data = await toolQuerySubscriptions(call.args);
                break;
            case "queryCategories":
                data = await toolQueryCategories();
                break;
            case "getFinancialProfile":
                data = await toolGetFinancialProfile();
                break;
            case "queryMemories":
                data = await toolQueryMemories(call.args);
                break;
            case "queryInsights":
                data = await toolQueryInsights(call.args);
                break;
            default:
                return { name: call.name, data: null, error: `Unknown tool: ${call.name}` };
        }

        return { name: call.name, data };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[advisorDbTools] Tool "${call.name}" failed:`, message);
        return { name: call.name, data: null, error: message };
    }
}
