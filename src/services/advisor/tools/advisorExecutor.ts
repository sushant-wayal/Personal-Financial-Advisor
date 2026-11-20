/**
 * advisorExecutor.ts
 *
 * Dispatches LLM tool call requests to database query handlers.
 */

import { prisma } from "../../../lib/prisma";
import { getEnrichedBudgets } from "../../budgets";
import { getOrGenerateInvestmentSuggestion } from "../../investmentEngine";
import { clamp, resolveDateBounds, resolveTypeFilter } from "./advisorToolHelpers";
import type { ToolCallRequest, ToolCallResult, ToolName } from "./advisorToolTypes";

export async function executeAdvisorTool(
    nameOrReq: ToolName | ToolCallRequest,
    argsInput?: Record<string, unknown>
): Promise<ToolCallResult> {
    const name = typeof nameOrReq === "string" ? nameOrReq : nameOrReq.name;
    const args = typeof nameOrReq === "string" ? (argsInput || {}) : (nameOrReq.args || {});

    try {
        let data: unknown;
        switch (name) {
            case "queryTransactions": {
                const limit = clamp(args.limit, 1, 100, 25);
                const typeFilter = resolveTypeFilter(args.type);
                const dateBounds = resolveDateBounds(args);
                const andConditions: Record<string, unknown>[] = [];
                if (dateBounds.gte || dateBounds.lt) andConditions.push({ timestamp: dateBounds });
                if (typeFilter) andConditions.push({ OR: [{ transactionType: { in: typeFilter } }, { type: { in: typeFilter } }] });
                const where = andConditions.length > 0 ? { AND: andConditions } : {};
                const rows = await prisma.transaction.findMany({ where, take: limit, orderBy: { timestamp: "desc" } });
                data = { rows, total: rows.length };
                break;
            }
            case "aggregateTransactions": {
                const typeFilter = resolveTypeFilter(args.type);
                const dateBounds = resolveDateBounds(args);
                const andConditions: Record<string, unknown>[] = [];
                if (dateBounds.gte || dateBounds.lt) andConditions.push({ timestamp: dateBounds });
                if (typeFilter) andConditions.push({ OR: [{ transactionType: { in: typeFilter } }, { type: { in: typeFilter } }] });
                const where = andConditions.length > 0 ? { AND: andConditions } : {};
                const limit = clamp(args.limit, 1, 50, 15);
                const groupByField = typeof args.groupBy === "string" ? args.groupBy : "category";

                if (groupByField === "category") {
                    const groups = await prisma.transaction.groupBy({
                        by: ["categoryId"],
                        where,
                        _sum: { amount: true },
                        _count: { id: true },
                        _avg: { amount: true },
                        orderBy: { _sum: { amount: "desc" } },
                        take: limit,
                    });
                    const catIds = groups.map((g) => g.categoryId).filter(Boolean) as string[];
                    const categories = catIds.length > 0
                        ? await prisma.category.findMany({ where: { id: { in: catIds } } })
                        : [];
                    const catMap = new Map(categories.map((c) => [c.id, c.name]));
                    data = {
                        groupBy: "category",
                        groups: groups.map((g) => ({
                            category: g.categoryId ? catMap.get(g.categoryId) || "Uncategorized" : "Uncategorized",
                            totalAmount: g._sum.amount ?? 0,
                            count: g._count.id,
                            avgAmount: g._avg.amount ?? 0,
                        })),
                    };
                } else if (groupByField === "merchant") {
                    const groups = await prisma.transaction.groupBy({
                        by: ["merchant"],
                        where,
                        _sum: { amount: true },
                        _count: { id: true },
                        _avg: { amount: true },
                        orderBy: { _sum: { amount: "desc" } },
                        take: limit,
                    });
                    data = {
                        groupBy: "merchant",
                        groups: groups.map((g) => ({
                            merchant: g.merchant,
                            totalAmount: g._sum.amount ?? 0,
                            count: g._count.id,
                            avgAmount: g._avg.amount ?? 0,
                        })),
                    };
                } else {
                    const total = await prisma.transaction.aggregate({
                        where,
                        _sum: { amount: true },
                        _count: { id: true },
                        _avg: { amount: true },
                    });
                    data = {
                        groupBy: groupByField,
                        totalAmount: total._sum.amount ?? 0,
                        count: total._count.id,
                        avgAmount: total._avg.amount ?? 0,
                    };
                }
                break;
            }
            case "queryGoals": {
                const goals = await prisma.goal.findMany({ orderBy: [{ priority: "asc" }, { createdAt: "desc" }] });
                data = { goals, total: goals.length };
                break;
            }
            case "querySubscriptions": {
                const subscriptions = await prisma.subscription.findMany({ where: { active: true } });
                data = { subscriptions, total: subscriptions.length };
                break;
            }
            case "queryCategories": {
                const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
                data = { categories, total: categories.length };
                break;
            }
            case "getFinancialProfile": {
                const profile = await prisma.financialProfile.findFirst();
                data = { profile };
                break;
            }
            case "queryBudgets": {
                const budgets = await getEnrichedBudgets();
                data = { budgets };
                break;
            }
            case "getInvestmentSuggestion": {
                const suggestion = await getOrGenerateInvestmentSuggestion();
                data = { suggestion };
                break;
            }
            case "queryMemories": {
                const limit = clamp(args.limit, 1, 50, 15);
                const tag = typeof args.tag === "string" ? args.tag : undefined;
                const where: Record<string, unknown> = {
                    OR: [
                        { expiresAt: null },
                        { expiresAt: { gt: new Date() } },
                    ],
                };
                if (tag) {
                    where.tags = { contains: tag };
                }
                const memories = await prisma.aIMemory.findMany({
                    where,
                    take: limit,
                    orderBy: { updatedAt: "desc" },
                });
                data = {
                    memories: memories.map((m) => ({
                        id: m.id,
                        key: m.key,
                        name: m.name,
                        value: m.value,
                        tags: m.tags,
                        updatedAt: m.updatedAt,
                    })),
                    total: memories.length,
                };
                break;
            }
            default:
                data = { message: `Tool ${name} executed successfully.` };
        }
        return { name, data };
    } catch (err) {
        return { name, data: null, error: err instanceof Error ? err.message : String(err) };
    }
}
