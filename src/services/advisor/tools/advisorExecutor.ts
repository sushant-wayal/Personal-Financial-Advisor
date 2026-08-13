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
            default:
                data = { message: `Tool ${name} executed successfully.` };
        }
        return { name, data };
    } catch (err) {
        return { name, data: null, error: err instanceof Error ? err.message : String(err) };
    }
}
