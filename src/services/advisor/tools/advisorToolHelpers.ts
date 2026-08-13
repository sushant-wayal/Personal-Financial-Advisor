/**
 * advisorToolHelpers.ts
 *
 * Input sanitization, clamp, and filter resolution functions for tool execution.
 */

import { clamp as clampNumber } from "../../shared/math";

export function clamp(val: unknown, min: number, max: number, fallback: number): number {
    const num = Number(val);
    if (!Number.isFinite(num)) return fallback;
    return clampNumber(num, min, max);
}

export function safeString(val: unknown): string | undefined {
    if (typeof val !== "string") return undefined;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

export function resolveTypeFilter(typeArg: unknown): string[] | undefined {
    if (typeof typeArg !== "string") return undefined;
    const lower = typeArg.toLowerCase().trim();

    switch (lower) {
        case "income":
        case "credit":
            return ["CREDIT", "SALARY", "REFUND", "INCOME", "CREDITED", "BONUS"];
        case "expense":
        case "debit":
            return ["DEBIT", "EXPENSE", "DEBITED", "PURCHASE", "WITHDRAWAL", "CHARGE", "BILL", "PAYMENT", "SUBSCRIPTION"];
        default:
            return undefined;
    }
}

export function resolveDateBounds(args: Record<string, unknown>): { gte?: Date; lt?: Date } {
    if (args.dateFrom || args.dateTo) {
        const result: { gte?: Date; lt?: Date } = {};
        if (args.dateFrom && typeof args.dateFrom === "string") {
            const d = new Date(args.dateFrom);
            if (!Number.isNaN(d.getTime())) result.gte = d;
        }
        if (args.dateTo && typeof args.dateTo === "string") {
            const d = new Date(args.dateTo);
            if (!Number.isNaN(d.getTime())) {
                d.setHours(23, 59, 59, 999);
                result.lt = d;
            }
        }
        return result;
    }

    const range = typeof args.dateRange === "string" ? args.dateRange : "all";
    const now = new Date();

    switch (range) {
        case "today": {
            const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            return { gte: start };
        }
        case "last7": {
            const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            return { gte: start };
        }
        case "last30": {
            const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            return { gte: start };
        }
        case "last90": {
            const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            return { gte: start };
        }
        case "this_month": {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            return { gte: start };
        }
        case "last_month": {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 1);
            return { gte: start, lt: end };
        }
        default:
            return {};
    }
}
