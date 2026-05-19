import { prisma } from "../lib/prisma";
import { getTransactionImpact } from "./balance";

const INVALID_ANALYTICS_CATEGORIES = new Set(["bank", "transfer", "upi", "vpa", "paytm", "phonepe", "google pay", "gpay", "hdfc", "icici"]);
const INCOME_TYPES = ["CREDIT", "CREDITED", "SALARY", "INCOME", "BONUS", "REFUND"];
const EXPENSE_TYPES = ["DEBIT", "DEBITED", "EXPENSE", "PURCHASE", "WITHDRAWAL", "CHARGE", "BILL", "PAYMENT", "SUBSCRIPTION"];

type AnalyticsTransaction = {
    amount: number | null;
    type?: string | null;
    transactionType?: string | null;
    category?: { name?: string | null } | null;
};

function categoryNameForAnalytics(t: AnalyticsTransaction) {
    const name = (t.category?.name || "Miscellaneous").toString();
    return INVALID_ANALYTICS_CATEGORIES.has(name.toLowerCase()) ? "Miscellaneous" : name;
}

function monthRange(date: Date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return { start, end };
}

async function aggregateMonthlyTotals(start: Date, end: Date) {
    const incomeSum = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
            timestamp: { gte: start, lt: end },
            OR: [
                { transactionType: { in: INCOME_TYPES } },
                { type: { in: INCOME_TYPES } },
            ],
        },
    });

    const expenseSum = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
            timestamp: { gte: start, lt: end },
            OR: [
                { transactionType: { in: EXPENSE_TYPES } },
                { type: { in: EXPENSE_TYPES } },
            ],
        },
    });

    const count = await prisma.transaction.count({
        where: { timestamp: { gte: start, lt: end } },
    });

    return {
        income: Math.abs(incomeSum._sum.amount ?? 0),
        expenses: Math.abs(expenseSum._sum.amount ?? 0),
        count,
    };
}

function savingsMessage(rate: number) {
    if (rate < 10) return "Needs improvement";
    if (rate < 20) return "Building savings gradually";
    if (rate < 35) return "Healthy savings habit";
    if (rate < 50) return "Strong financial discipline";
    return "Exceptional savings rate";
}

async function aggregateExpenseTotals(start: Date, end: Date) {
    const expenseSum = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: {
            timestamp: { gte: start, lt: end },
            OR: [
                { transactionType: { in: EXPENSE_TYPES } },
                { type: { in: EXPENSE_TYPES } },
            ],
        },
    });

    const expenseCount = await prisma.transaction.count({
        where: {
            timestamp: { gte: start, lt: end },
            OR: [
                { transactionType: { in: EXPENSE_TYPES } },
                { type: { in: EXPENSE_TYPES } },
            ],
        },
    });

    return {
        expenses: Math.abs(expenseSum._sum.amount ?? 0),
        expenseCount,
    };
}


export async function calculateCurrentBalance() {
    const profile = await prisma.financialProfile.findFirst() as { balance?: number | null } | null;
    return profile?.balance ?? 0;
}

export async function calculateMonthlySavingsRate() {
    const now = new Date();
    const { start: currentStart, end: currentEnd } = monthRange(now);
    const { start: previousStart, end: previousEnd } = monthRange(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    const currentTotals = await aggregateMonthlyTotals(currentStart, currentEnd);
    const previousTotals = await aggregateMonthlyTotals(previousStart, previousEnd);

    const monthlyIncome = currentTotals.income;
    const monthlyExpenses = currentTotals.expenses;
    const monthlySavings = monthlyIncome - monthlyExpenses;
    const currentMonthSavingsRate = monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;

    const previousMonthHasData = previousTotals.count > 0;
    const previousMonthIncome = previousTotals.income;
    const previousMonthExpenses = previousTotals.expenses;
    const previousMonthSavings = previousMonthIncome - previousMonthExpenses;
    const previousMonthSavingsRate = previousMonthIncome > 0 ? (previousMonthSavings / previousMonthIncome) * 100 : 0;

    const savingsRateChange = currentMonthSavingsRate - previousMonthSavingsRate;
    const savingsRateChangeDirection = savingsRateChange > 0
        ? "increase"
        : savingsRateChange < 0
            ? "decrease"
            : "neutral";

    return {
        monthlyIncome,
        monthlyExpenses,
        monthlySavings,
        savingsRate: currentMonthSavingsRate,
        savingsMessage: savingsMessage(currentMonthSavingsRate),
        currentMonthSavingsRate,
        previousMonthSavingsRate,
        savingsRateChange,
        savingsRateChangeDirection,
        previousMonthHasData,
    };
}

export async function calculateBurnRate() {
    const now = new Date();
    const currentStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const previousStart = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const previousEnd = currentStart;

    const currentTotals = await aggregateExpenseTotals(currentStart, now);
    const previousTotals = await aggregateExpenseTotals(previousStart, previousEnd);

    const burnRate = currentTotals.expenses / 3;
    const previousBurnRate = previousTotals.expenses / 3;
    const burnRateChange = burnRate - previousBurnRate;
    const burnRateChangeDirection = burnRateChange > 0
        ? "increase"
        : burnRateChange < 0
            ? "decrease"
            : "neutral";

    return {
        burnRate,
        previousBurnRate,
        burnRateChange,
        burnRateChangeDirection,
        previousPeriodHasData: previousTotals.expenseCount > 0,
    };
}

export async function calculateRunway() {
    const balance = await calculateCurrentBalance();
    const burnData = await calculateBurnRate();

    const runwayMonths = burnData.burnRate > 0 ? balance / burnData.burnRate : null;
    const previousRunwayMonths = burnData.previousBurnRate > 0 ? balance / burnData.previousBurnRate : null;

    let runwayChange = 0;
    let runwayChangeDirection: "increase" | "decrease" | "neutral" = "neutral";

    if (runwayMonths !== null && previousRunwayMonths !== null) {
        runwayChange = runwayMonths - previousRunwayMonths;
        runwayChangeDirection = runwayChange > 0
            ? "increase"
            : runwayChange < 0
                ? "decrease"
                : "neutral";
    }

    return {
        runwayMonths,
        previousRunwayMonths,
        runwayChange,
        runwayChangeDirection,
    };
}

export async function monthlyTrend(months = 12) {
    const now = new Date();
    const results: Array<{ month: string; income: number; expense: number }> = [];
    for (let i = months - 1; i >= 0; i--) {
        const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = new Date(m.getFullYear(), m.getMonth(), 1);
        const end = new Date(m.getFullYear(), m.getMonth() + 1, 1);
        const txs = await prisma.transaction.findMany({ where: { timestamp: { gte: start, lt: end } }, include: { category: true } });
        const typedTxs = txs as AnalyticsTransaction[];
        let income = 0;
        let expense = 0;
        for (const t of typedTxs) {
            const impact = getTransactionImpact(t.amount || 0, t.type, t.transactionType);
            if (impact >= 0) {
                income += impact;
            } else {
                expense += Math.abs(impact);
            }
        }
        results.push({ month: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`, income: Math.round(income), expense: Math.round(Math.abs(expense)) });
    }
    return results;
}

export async function categoryBreakdown(sinceDays = 30) {
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    const txs = await prisma.transaction.findMany({ where: { timestamp: { gte: since } }, include: { category: true } });
    const typedTxs = txs as AnalyticsTransaction[];
    const map: Record<string, number> = {};
    for (const t of typedTxs) {
        const impact = getTransactionImpact(t.amount || 0, t.type, t.transactionType);
        if (impact >= 0) continue;
        const k = categoryNameForAnalytics(t);
        map[k] = (map[k] || 0) + Math.abs(impact);
    }
    return Object.keys(map).map(k => ({ name: k, value: Math.round(map[k]) }));
}
