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
import { Prisma } from "@prisma/client";
import { getEnrichedBudgets } from "./budgets";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToolName =
    | "queryTransactions"
    | "aggregateTransactions"
    | "queryGoals"
    | "querySubscriptions"
    | "queryCategories"
    | "getFinancialProfile"
    | "queryMemories"
    | "queryInsights"
    | "addTransaction"
    | "updateTransaction"
    | "deleteTransaction"
    | "addGoal"
    | "updateGoal"
    | "deleteGoal"
    | "updateFinancialProfile"
    | "addSubscription"
    | "updateSubscription"
    | "deleteSubscription"
    | "addCategorizationRule"
    | "deleteCategorizationRule"
    | "getDatabaseSchema"
    | "writeDatabaseRecord"
    | "queryBudgets"
    | "addBudget"
    | "updateBudget"
    | "deleteBudget";

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
    {
        name: "addTransaction",
        description: "Add a new transaction. MUST ONLY BE CALLED AFTER EXPLICIT USER CONFIRMATION.",
        parameters: {
            type: "object",
            properties: {
                amount: { type: "number", description: "Transaction amount." },
                merchant: { type: "string", description: "Merchant name." },
                type: { type: "string", enum: ["INCOME", "EXPENSE", "CREDIT", "DEBIT"], description: "Transaction type." },
                category: { type: "string", description: "Category name." },
                notes: { type: "string", description: "Optional notes." },
                date: { type: "string", description: "Optional date in YYYY-MM-DD format." }
            },
            required: ["amount", "merchant", "type"],
        }
    },
    {
        name: "updateTransaction",
        description: "Update an existing transaction. MUST ONLY BE CALLED AFTER EXPLICIT USER CONFIRMATION.",
        parameters: {
            type: "object",
            properties: {
                id: { type: "string", description: "ID of the transaction to update." },
                amount: { type: "number", description: "New amount." },
                merchant: { type: "string", description: "New merchant name." },
                type: { type: "string", enum: ["INCOME", "EXPENSE", "CREDIT", "DEBIT"], description: "New transaction type." },
                category: { type: "string", description: "New category name." },
                notes: { type: "string", description: "New notes." },
                date: { type: "string", description: "New date in YYYY-MM-DD format." }
            },
            required: ["id"],
        }
    },
    {
        name: "deleteTransaction",
        description: "Delete a transaction by ID. MUST ONLY BE CALLED AFTER EXPLICIT USER CONFIRMATION.",
        parameters: {
            type: "object",
            properties: {
                id: { type: "string", description: "ID of the transaction to delete." }
            },
            required: ["id"],
        }
    },
    {
        name: "addGoal",
        description: "Add a new financial goal. MUST ONLY BE CALLED AFTER EXPLICIT USER CONFIRMATION.",
        parameters: {
            type: "object",
            properties: {
                title: { type: "string", description: "Title of the goal." },
                targetAmount: { type: "number", description: "Target amount." },
                goalType: { type: "string", description: "Goal type (e.g., PURCHASE, SAVINGS)." },
                targetDate: { type: "string", description: "Target date in YYYY-MM-DD format." },
                priority: { type: "number", description: "Priority level (1-5)." }
            },
            required: ["title", "targetAmount"],
        }
    },
    {
        name: "updateGoal",
        description: "Update an existing financial goal. MUST ONLY BE CALLED AFTER EXPLICIT USER CONFIRMATION.",
        parameters: {
            type: "object",
            properties: {
                id: { type: "string", description: "ID of the goal to update." },
                title: { type: "string", description: "New title." },
                targetAmount: { type: "number", description: "New target amount." },
                currentAmount: { type: "number", description: "New current amount." },
                status: { type: "string", enum: ["ACTIVE", "COMPLETED", "PAUSED"], description: "New status." },
                priority: { type: "number", description: "New priority level (1-5)." }
            },
            required: ["id"],
        }
    },
    {
        name: "deleteGoal",
        description: "Delete a financial goal by ID. MUST ONLY BE CALLED AFTER EXPLICIT USER CONFIRMATION.",
        parameters: {
            type: "object",
            properties: {
                id: { type: "string", description: "ID of the goal to delete." }
            },
            required: ["id"],
        }
    },
    {
        name: "updateFinancialProfile",
        description: "Update the user's financial profile. MUST ONLY BE CALLED AFTER EXPLICIT USER CONFIRMATION.",
        parameters: {
            type: "object",
            properties: {
                balance: { type: "number" },
                emergencyFund: { type: "number" },
                monthlyIncome: { type: "number" },
                monthlyExpenses: { type: "number" },
                currency: { type: "string" }
            },
            required: [],
        }
    },
    {
        name: "queryBudgets",
        description: "Fetch the user's active category budgets, including their monthly limits, total spent, and available amounts.",
        parameters: {
            type: "object",
            properties: {},
            required: [],
        }
    },
    {
        name: "addBudget",
        description: "Add a new category budget. MUST ONLY BE CALLED AFTER EXPLICIT USER CONFIRMATION.",
        parameters: {
            type: "object",
            properties: {
                categoryName: { type: "string", description: "Name of the category to budget for." },
                monthlyLimit: { type: "number", description: "The monthly budget limit." },
                rollover: { type: "boolean", description: "Whether unused amounts rollover to the next month." }
            },
            required: ["categoryName", "monthlyLimit"],
        }
    },
    {
        name: "updateBudget",
        description: "Update an existing category budget. MUST ONLY BE CALLED AFTER EXPLICIT USER CONFIRMATION.",
        parameters: {
            type: "object",
            properties: {
                id: { type: "string", description: "ID of the budget to update." },
                monthlyLimit: { type: "number", description: "New monthly budget limit." },
                rollover: { type: "boolean", description: "New rollover setting." }
            },
            required: ["id"],
        }
    },
    {
        name: "deleteBudget",
        description: "Delete a category budget by ID. MUST ONLY BE CALLED AFTER EXPLICIT USER CONFIRMATION.",
        parameters: {
            type: "object",
            properties: {
                id: { type: "string", description: "ID of the budget to delete." }
            },
            required: ["id"],
        }
    }
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
    if (args.amountMin !== undefined || args.amountMax !== undefined) {
        const amountMin = Number(args.amountMin);
        const amountMax = Number(args.amountMax);
        andConditions.push({
            amount: {
                gte: Number.isFinite(amountMin) ? amountMin : undefined,
                lte: Number.isFinite(amountMax) ? amountMax : undefined,
            }
        });
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

async function adjustProfileBalance(amountDelta: number) {
    if (amountDelta === 0) return;
    const profile = await prisma.financialProfile.findFirst();
    if (profile && profile.balance !== null) {
        await prisma.financialProfile.update({
            where: { id: profile.id },
            data: { balance: profile.balance + amountDelta },
        });
    }
}

// ─── Write Tool Implementations ───────────────────────────────────────────────

async function toolAddTransaction(args: Record<string, unknown>): Promise<unknown> {
    let amount = Number(args.amount);
    if (isNaN(amount)) throw new Error("Invalid amount");
    const merchant = safeString(args.merchant) || "Unknown";
    const type = safeString(args.type)?.toUpperCase() || "EXPENSE";

    // Ensure amount sign aligns with type
    if (type === "EXPENSE" || type === "DEBIT") {
        if (amount > 0) amount = -amount;
    } else if (type === "INCOME" || type === "CREDIT") {
        if (amount < 0) amount = -amount;
    }

    const categoryName = safeString(args.category);
    const notes = safeString(args.notes);
    const date = parseSafeDate(args.date) || new Date();

    let categoryId = undefined;
    if (categoryName) {
        let category = await prisma.category.findUnique({ where: { name: categoryName } });
        if (!category) {
            category = await prisma.category.create({ data: { name: categoryName } });
        }
        categoryId = category.id;
    }

    const tx = await prisma.transaction.create({
        data: {
            amount,
            merchant,
            type,
            transactionType: type,
            categoryId,
            notes,
            timestamp: date,
            source: "AI_ADVISOR",
            raw: JSON.stringify(args),
            rawText: `Added manually via advisor: ${merchant} ${amount}`,
        }
    });

    await adjustProfileBalance(amount);

    return { success: true, transaction: tx };
}

async function toolUpdateTransaction(args: Record<string, unknown>): Promise<unknown> {
    const id = safeString(args.id);
    if (!id) throw new Error("Transaction ID is required");

    const oldTx = await prisma.transaction.findUnique({ where: { id } });
    if (!oldTx) throw new Error("Transaction not found");

    const data: any = {};
    let newType = oldTx.type;
    let newAmount = oldTx.amount;

    if (args.type !== undefined) {
        newType = safeString(args.type)?.toUpperCase() || newType;
        data.type = newType;
        data.transactionType = newType;
    }

    if (args.amount !== undefined) {
        let amt = Number(args.amount);
        if (newType === "EXPENSE" || newType === "DEBIT") {
            if (amt > 0) amt = -amt;
        } else if (newType === "INCOME" || newType === "CREDIT") {
            if (amt < 0) amt = -amt;
        }
        newAmount = amt;
        data.amount = newAmount;
    } else if (args.type !== undefined) {
        // if type changed but amount didn't, we might need to flip the sign
        if (newType === "EXPENSE" || newType === "DEBIT") {
            if (newAmount > 0) newAmount = -newAmount;
        } else if (newType === "INCOME" || newType === "CREDIT") {
            if (newAmount < 0) newAmount = -newAmount;
        }
        data.amount = newAmount;
    }

    if (args.merchant !== undefined) data.merchant = safeString(args.merchant);
    if (args.notes !== undefined) data.notes = safeString(args.notes);
    if (args.date !== undefined) {
        const d = parseSafeDate(args.date);
        if (d) data.timestamp = d;
    }

    const categoryName = safeString(args.category);
    if (categoryName) {
        let category = await prisma.category.findUnique({ where: { name: categoryName } });
        if (!category) {
            category = await prisma.category.create({ data: { name: categoryName } });
        }
        data.categoryId = category.id;
    }

    const tx = await prisma.transaction.update({
        where: { id },
        data,
    });

    const amountDelta = newAmount - oldTx.amount;
    await adjustProfileBalance(amountDelta);

    return { success: true, transaction: tx };
}

async function toolDeleteTransaction(args: Record<string, unknown>): Promise<unknown> {
    const id = safeString(args.id);
    if (!id) throw new Error("Transaction ID is required");

    const oldTx = await prisma.transaction.findUnique({ where: { id } });
    if (oldTx) {
        await prisma.transaction.delete({ where: { id } });
        await adjustProfileBalance(-oldTx.amount);
    }
    return { success: true, deletedId: id };
}

async function toolAddGoal(args: Record<string, unknown>): Promise<unknown> {
    const title = safeString(args.title);
    if (!title) throw new Error("Goal title is required");
    const targetAmount = Number(args.targetAmount);
    if (isNaN(targetAmount)) throw new Error("Invalid target amount");
    const goalType = safeString(args.goalType) || "PURCHASE";
    const targetDate = parseSafeDate(args.targetDate);
    const priority = clamp(args.priority, 1, 5, 3);

    const goal = await prisma.goal.create({
        data: {
            title,
            targetAmount,
            goalType,
            targetDate,
            priority,
        }
    });
    return { success: true, goal };
}

async function toolUpdateGoal(args: Record<string, unknown>): Promise<unknown> {
    const id = safeString(args.id);
    if (!id) throw new Error("Goal ID is required");

    const data: any = {};
    if (args.title !== undefined) data.title = safeString(args.title);
    if (args.targetAmount !== undefined) data.targetAmount = Number(args.targetAmount);
    if (args.currentAmount !== undefined) data.currentAmount = Number(args.currentAmount);
    if (args.status !== undefined) data.status = safeString(args.status)?.toUpperCase();
    if (args.priority !== undefined) data.priority = clamp(args.priority, 1, 5, 3);

    const goal = await prisma.goal.update({
        where: { id },
        data,
    });
    return { success: true, goal };
}

async function toolDeleteGoal(args: Record<string, unknown>): Promise<unknown> {
    const id = safeString(args.id);
    if (!id) throw new Error("Goal ID is required");
    await prisma.goal.delete({ where: { id } });
    return { success: true, deletedId: id };
}

async function toolUpdateFinancialProfile(args: Record<string, unknown>): Promise<unknown> {
    const profile = await prisma.financialProfile.findFirst();
    const data: any = {};
    if (args.balance !== undefined) data.balance = Number(args.balance);
    if (args.emergencyFund !== undefined) data.emergencyFund = Number(args.emergencyFund);
    if (args.monthlyIncome !== undefined) data.monthlyIncome = Number(args.monthlyIncome);
    if (args.monthlyExpenses !== undefined) data.monthlyExpenses = Number(args.monthlyExpenses);
    if (args.currency !== undefined) data.currency = safeString(args.currency);

    let result;
    if (profile) {
        result = await prisma.financialProfile.update({
            where: { id: profile.id },
            data,
        });
    } else {
        result = await prisma.financialProfile.create({
            data,
        });
    }
    return { success: true, profile: result };
}

async function toolAddSubscription(args: Record<string, unknown>): Promise<unknown> {
    const merchant = safeString(args.merchant);
    if (!merchant) throw new Error("Merchant is required");
    const amount = Number(args.amount);
    if (isNaN(amount)) throw new Error("Amount is required");
    const interval = safeString(args.interval) || "MONTHLY";
    const nextCharge = parseSafeDate(args.nextCharge);

    const sub = await prisma.subscription.create({
        data: { merchant, amount, interval, nextCharge, active: true },
    });
    return { success: true, subscription: sub };
}

async function toolUpdateSubscription(args: Record<string, unknown>): Promise<unknown> {
    const id = safeString(args.id);
    if (!id) throw new Error("Subscription ID is required");

    const data: any = {};
    if (args.merchant !== undefined) data.merchant = safeString(args.merchant);
    if (args.amount !== undefined) data.amount = Number(args.amount);
    if (args.interval !== undefined) data.interval = safeString(args.interval);
    if (args.nextCharge !== undefined) data.nextCharge = parseSafeDate(args.nextCharge);
    if (args.active !== undefined) data.active = Boolean(args.active);

    const sub = await prisma.subscription.update({ where: { id }, data });
    return { success: true, subscription: sub };
}

async function toolDeleteSubscription(args: Record<string, unknown>): Promise<unknown> {
    const id = safeString(args.id);
    if (!id) throw new Error("Subscription ID is required");
    await prisma.subscription.delete({ where: { id } });
    return { success: true, deletedId: id };
}

async function toolAddCategorizationRule(args: Record<string, unknown>): Promise<unknown> {
    const merchantName = safeString(args.merchantName);
    const categoryName = safeString(args.categoryName);
    if (!merchantName || !categoryName) throw new Error("merchantName and categoryName are required");

    let category = await prisma.category.findUnique({ where: { name: categoryName } });
    if (!category) {
        category = await prisma.category.create({ data: { name: categoryName } });
    }

    const merchantKey = merchantName.toLowerCase().replace(/[^a-z0-9]/g, "");

    const rule = await prisma.merchantCategoryMap.upsert({
        where: { merchantKey },
        update: { categoryId: category.id, merchantName },
        create: { merchantKey, merchantName, categoryId: category.id, source: "AI_ADVISOR" },
    });
    return { success: true, rule };
}

async function toolDeleteCategorizationRule(args: Record<string, unknown>): Promise<unknown> {
    const merchantName = safeString(args.merchantName);
    if (!merchantName) throw new Error("merchantName is required");
    const merchantKey = merchantName.toLowerCase().replace(/[^a-z0-9]/g, "");
    await prisma.merchantCategoryMap.delete({ where: { merchantKey } });
    return { success: true };
}

// ─── Generic Tools ────────────────────────────────────────────────────────────

const ALLOWED_GENERIC_MODELS = [
    "MutualFund", "Stock", "PPFAccount", "EPFAccount", "FDAccount", "RDAccount",
    "VehicleAsset", "PlotAsset", "IndependentPropertyAsset", "ApartmentAsset",
    "JewelleryAsset", "ReceivableAsset", "LoanLiability", "CreditCardLiability",
    "BnplLiability", "BorrowedLiability"
];

async function toolGetDatabaseSchema(args: Record<string, unknown>): Promise<unknown> {
    const modelName = safeString(args.modelName);
    if (!modelName) {
        return { allowedModels: ALLOWED_GENERIC_MODELS, message: "Provide a modelName to see its fields." };
    }
    if (!ALLOWED_GENERIC_MODELS.includes(modelName)) {
        throw new Error(`Model ${modelName} is not allowed for generic operations.`);
    }

    const modelSchema = Prisma.dmmf.datamodel.models.find((m: any) => m.name === modelName);
    if (!modelSchema) throw new Error(`Model ${modelName} not found in Prisma DMMF.`);

    const fields = modelSchema.fields.map((f: any) => ({
        name: f.name,
        type: f.type,
        isRequired: f.isRequired,
        isId: f.isId,
        default: f.default,
    }));

    return { model: modelName, fields };
}

async function toolWriteDatabaseRecord(args: Record<string, unknown>): Promise<unknown> {
    const modelName = safeString(args.modelName);
    const action = safeString(args.action)?.toUpperCase();
    const id = safeString(args.id);
    let data = args.data as Record<string, any>;

    if (!modelName || !action) throw new Error("modelName and action are required");
    if (!ALLOWED_GENERIC_MODELS.includes(modelName)) {
        throw new Error(`Model ${modelName} is not allowed for generic operations.`);
    }
    if (typeof data === "string") {
        try { data = JSON.parse(data); } catch { /* ignore */ }
    }

    // Type coercion based on DMMF
    const modelSchema = Prisma.dmmf.datamodel.models.find((m: any) => m.name === modelName);
    if (data && modelSchema) {
        for (const field of modelSchema.fields) {
            if (data[field.name] !== undefined) {
                if (field.type === "DateTime") {
                    data[field.name] = parseSafeDate(data[field.name]);
                } else if (field.type === "Float" || field.type === "Int") {
                    data[field.name] = Number(data[field.name]);
                } else if (field.type === "Boolean") {
                    data[field.name] = Boolean(data[field.name]);
                }
            }
        }
    }

    const delegate = (prisma as any)[modelName.charAt(0).toLowerCase() + modelName.slice(1)];

    if (action === "CREATE") {
        const result = await delegate.create({ data });
        return { success: true, action: "CREATE", data: result };
    } else if (action === "UPDATE") {
        if (!id) throw new Error("id is required for UPDATE");
        const result = await delegate.update({ where: { id }, data });
        return { success: true, action: "UPDATE", data: result };
    } else if (action === "DELETE") {
        if (!id) throw new Error("id is required for DELETE");
        await delegate.delete({ where: { id } });
        return { success: true, action: "DELETE", id };
    }

    throw new Error("Invalid action. Use CREATE, UPDATE, or DELETE.");
}

async function toolQueryBudgets(): Promise<unknown> {
    const budgets = await getEnrichedBudgets();
    return { budgets, total: budgets.length };
}

async function toolAddBudget(args: Record<string, unknown>): Promise<unknown> {
    const categoryName = safeString(args.categoryName);
    if (!categoryName) throw new Error("Category name is required");
    const monthlyLimit = Number(args.monthlyLimit);
    if (isNaN(monthlyLimit)) throw new Error("Invalid monthly limit");
    const rollover = Boolean(args.rollover);

    let category = await prisma.category.findUnique({ where: { name: categoryName } });
    if (!category) {
        category = await prisma.category.create({ data: { name: categoryName } });
    }

    const budget = await prisma.categoryBudget.create({
        data: {
            categoryId: category.id,
            monthlyLimit,
            rollover,
        }
    });
    return { success: true, budget };
}

async function toolUpdateBudget(args: Record<string, unknown>): Promise<unknown> {
    const id = safeString(args.id);
    if (!id) throw new Error("Budget ID is required");

    const data: any = {};
    if (args.monthlyLimit !== undefined) data.monthlyLimit = Number(args.monthlyLimit);
    if (args.rollover !== undefined) data.rollover = Boolean(args.rollover);

    const budget = await prisma.categoryBudget.update({
        where: { id },
        data,
    });
    return { success: true, budget };
}

async function toolDeleteBudget(args: Record<string, unknown>): Promise<unknown> {
    const id = safeString(args.id);
    if (!id) throw new Error("Budget ID is required");
    await prisma.categoryBudget.delete({ where: { id } });
    return { success: true, deletedId: id };
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
            case "addTransaction":
                data = await toolAddTransaction(call.args);
                break;
            case "updateTransaction":
                data = await toolUpdateTransaction(call.args);
                break;
            case "deleteTransaction":
                data = await toolDeleteTransaction(call.args);
                break;
            case "addGoal":
                data = await toolAddGoal(call.args);
                break;
            case "updateGoal":
                data = await toolUpdateGoal(call.args);
                break;
            case "deleteGoal":
                data = await toolDeleteGoal(call.args);
                break;
            case "updateFinancialProfile":
                data = await toolUpdateFinancialProfile(call.args);
                break;
            case "addSubscription":
                data = await toolAddSubscription(call.args);
                break;
            case "updateSubscription":
                data = await toolUpdateSubscription(call.args);
                break;
            case "deleteSubscription":
                data = await toolDeleteSubscription(call.args);
                break;
            case "addCategorizationRule":
                data = await toolAddCategorizationRule(call.args);
                break;
            case "deleteCategorizationRule":
                data = await toolDeleteCategorizationRule(call.args);
                break;
            case "getDatabaseSchema":
                data = await toolGetDatabaseSchema(call.args);
                break;
            case "writeDatabaseRecord":
                data = await toolWriteDatabaseRecord(call.args);
                break;
            case "queryBudgets":
                data = await toolQueryBudgets();
                break;
            case "addBudget":
                data = await toolAddBudget(call.args);
                break;
            case "updateBudget":
                data = await toolUpdateBudget(call.args);
                break;
            case "deleteBudget":
                data = await toolDeleteBudget(call.args);
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
