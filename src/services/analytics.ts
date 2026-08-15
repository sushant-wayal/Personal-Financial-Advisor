import { prisma } from "../lib/prisma";
import { getTransactionImpact, getLast30DaysNetImpact } from "./balance";
import { INVALID_TRANSACTION_CATEGORIES } from "./shared/formatting";
import { listInsights } from "./insights";
import { getEnrichedBudgets } from "./budgets";


const INCOME_TYPES = ["CREDIT", "CREDITED", "SALARY", "INCOME", "BONUS", "REFUND"];
const EXPENSE_TYPES = ["DEBIT", "DEBITED", "EXPENSE", "PURCHASE", "WITHDRAWAL", "CHARGE", "BILL", "PAYMENT", "SUBSCRIPTION"];

type AnalyticsTransaction = {
    amount: number | null;
    timestamp?: string | Date | null;
    type?: string | null;
    transactionType?: string | null;
    category?: { name?: string | null } | null;
};

function categoryNameForAnalytics(t: AnalyticsTransaction) {
    const name = (t.category?.name || "Miscellaneous").toString();
    return INVALID_TRANSACTION_CATEGORIES.has(name.toLowerCase()) ? "Miscellaneous" : name;
}

function monthRange(date: Date) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return { start, end };
}

async function aggregateMonthlyTotals(start: Date, end: Date) {
    const [incomeSum, expenseSum, count] = await Promise.all([
        prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
                timestamp: { gte: start, lt: end },
                OR: [
                    { transactionType: { in: INCOME_TYPES } },
                    { type: { in: INCOME_TYPES } },
                ],
            },
        }),
        prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
                timestamp: { gte: start, lt: end },
                OR: [
                    { transactionType: { in: EXPENSE_TYPES } },
                    { type: { in: EXPENSE_TYPES } },
                ],
            },
        }),
        prisma.transaction.count({
            where: { timestamp: { gte: start, lt: end } },
        }),
    ]);

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
    const [expenseSum, expenseCount] = await Promise.all([
        prisma.transaction.aggregate({
            _sum: { amount: true },
            where: {
                timestamp: { gte: start, lt: end },
                OR: [
                    { transactionType: { in: EXPENSE_TYPES } },
                    { type: { in: EXPENSE_TYPES } },
                ],
            },
        }),
        prisma.transaction.count({
            where: {
                timestamp: { gte: start, lt: end },
                OR: [
                    { transactionType: { in: EXPENSE_TYPES } },
                    { type: { in: EXPENSE_TYPES } },
                ],
            },
        }),
    ]);

    return {
        expenses: Math.abs(expenseSum._sum.amount ?? 0),
        expenseCount,
    };
}

export async function calculateCurrentBalance() {
    const profile = await prisma.financialProfile.findUnique({ where: { id: "default" } }) as { balance?: number | null } | null;
    return profile?.balance ?? 0;
}

export async function calculateMonthlySavingsRate() {
    const now = new Date();

    const last90Start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const comparisonStart = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);
    const comparisonEnd = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const { start: currentStart, end: currentEnd } = monthRange(now);

    const [last90Totals, comparisonTotals, currentTotals] = await Promise.all([
        aggregateMonthlyTotals(last90Start, now),
        aggregateMonthlyTotals(comparisonStart, comparisonEnd),
        aggregateMonthlyTotals(currentStart, currentEnd),
    ]);

    const last90Income = last90Totals.income;
    const last90Expenses = last90Totals.expenses;
    const trailingSavingsRate = last90Income > 0 ? ((last90Income - last90Expenses) / last90Income) * 100 : 0;

    const comparisonIncome = comparisonTotals.income;
    const comparisonExpenses = comparisonTotals.expenses;
    const precedingSavingsRate = comparisonIncome > 0 ? ((comparisonIncome - comparisonExpenses) / comparisonIncome) * 100 : 0;

    const monthlyIncome = currentTotals.income;
    const monthlyExpenses = currentTotals.expenses;
    const monthlySavings = monthlyIncome - monthlyExpenses;

    const previousMonthHasData = comparisonTotals.count > 0;
    const savingsRateChange = trailingSavingsRate - precedingSavingsRate;
    const savingsRateChangeDirection = savingsRateChange > 0
        ? "increase"
        : savingsRateChange < 0
            ? "decrease"
            : "neutral";

    return {
        monthlyIncome,
        monthlyExpenses,
        monthlySavings,
        savingsRate: trailingSavingsRate,
        savingsMessage: savingsMessage(trailingSavingsRate),
        currentMonthSavingsRate: trailingSavingsRate,
        previousMonthSavingsRate: precedingSavingsRate,
        savingsRateChange,
        savingsRateChangeDirection,
        previousMonthHasData,
        trailingDays: 90,
    };
}

export async function calculateBurnRate() {
    const now = new Date();
    const currentStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const previousStart = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);
    const previousEnd = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [currentTotals, previousTotals] = await Promise.all([
        aggregateExpenseTotals(currentStart, now),
        aggregateExpenseTotals(previousStart, previousEnd),
    ]);

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
    const [currentBalance, last30DaysDelta, burnData] = await Promise.all([
        calculateCurrentBalance(),
        getLast30DaysNetImpact(),
        calculateBurnRate(),
    ]);

    const previousBalance = currentBalance - last30DaysDelta;

    const runwayMonths = burnData.burnRate > 0 ? currentBalance / burnData.burnRate : null;
    const previousRunwayMonths = burnData.previousBurnRate > 0 ? previousBalance / burnData.previousBurnRate : null;

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

export async function calculateAveragedMonthlyIncomeAndExpense() {
    const now = new Date();
    const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const totals = await aggregateMonthlyTotals(start, now);
    return {
        monthlyIncome: Math.round(totals.income / 3),
        monthlyExpenses: Math.round(totals.expenses / 3),
    };
}

export async function getEnhancedProfile() {
    const profile = await prisma.financialProfile.findFirst();
    const averages = await calculateAveragedMonthlyIncomeAndExpense();
    if (profile) {
        profile.monthlyIncome = averages.monthlyIncome;
        profile.monthlyExpenses = averages.monthlyExpenses;
    }
    return profile;
}

export async function monthlyTrend(months = 12) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const txs = await prisma.transaction.findMany({
        where: { timestamp: { gte: start, lt: end } },
        select: { amount: true, timestamp: true, type: true, transactionType: true },
    });

    const monthMap = new Map<string, { income: number; expense: number }>();

    for (let i = months - 1; i >= 0; i--) {
        const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
        monthMap.set(key, { income: 0, expense: 0 });
    }

    for (const t of txs as AnalyticsTransaction[]) {
        if (!t.timestamp) continue;
        const d = new Date(t.timestamp as any);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const entry = monthMap.get(key);
        if (entry) {
            const impact = getTransactionImpact(t.amount || 0, t.type, t.transactionType);
            if (impact >= 0) {
                entry.income += impact;
            } else {
                entry.expense += Math.abs(impact);
            }
        }
    }

    return Array.from(monthMap.entries()).map(([month, data]) => ({
        month,
        income: Math.round(data.income),
        expense: Math.round(Math.abs(data.expense)),
    }));
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

export async function categoryTrends(months = 6) {
    const now = new Date();
    const monthLabels: string[] = [];
    const monthRanges: Array<{ month: string; start: Date; end: Date }> = [];

    for (let i = months - 1; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);
        const label = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
        monthLabels.push(label);
        monthRanges.push({ month: label, start, end });
    }

    const txs = await prisma.transaction.findMany({
        where: {
            timestamp: {
                gte: monthRanges[0]?.start ?? new Date(now.getFullYear(), now.getMonth(), 1),
                lt: monthRanges[monthRanges.length - 1]?.end ?? new Date(now.getFullYear(), now.getMonth() + 1, 1),
            },
        },
        include: { category: true },
    });

    const categoryTotals: Record<string, number> = {};
    const perMonth: Record<string, Record<string, number>> = {};

    for (const range of monthRanges) {
        perMonth[range.month] = {};
    }

    for (const tx of txs as AnalyticsTransaction[]) {
        const impact = getTransactionImpact(tx.amount || 0, tx.type, tx.transactionType);
        if (impact >= 0) continue;

        const date = new Date((tx as any).timestamp);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const category = categoryNameForAnalytics(tx);

        categoryTotals[category] = (categoryTotals[category] || 0) + Math.abs(impact);
        if (!perMonth[monthKey]) perMonth[monthKey] = {};
        perMonth[monthKey][category] = (perMonth[monthKey][category] || 0) + Math.abs(impact);
    }

    const topCategories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);

    return monthLabels.map((month) => {
        const row: Record<string, number | string> = { month };
        for (const category of topCategories) {
            row[category] = Math.round(perMonth[month]?.[category] ?? 0);
        }
        return row;
    });
}

function formatDateKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export async function spendingHeatmap(days = 90) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const txs = await prisma.transaction.findMany({
        where: { timestamp: { gte: since } },
        select: { amount: true, timestamp: true, type: true, transactionType: true },
        orderBy: { timestamp: "asc" },
    });

    const map = new Map<string, number>();
    for (const tx of txs as AnalyticsTransaction[]) {
        const impact = getTransactionImpact(tx.amount || 0, tx.type, tx.transactionType);
        if (impact >= 0) continue;
        const date = new Date(tx.timestamp as any);
        const key = formatDateKey(date);
        map.set(key, (map.get(key) || 0) + Math.abs(impact));
    }

    const daysOut: Array<{ date: string; amount: number; weekday: number; weekIndex: number }> = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const key = formatDateKey(date);
        daysOut.push({
            date: key,
            amount: map.get(key) || 0,
            weekday: date.getDay(),
            weekIndex: Math.floor((days - 1 - i) / 7),
        });
    }

    return daysOut;
}

function weekStart(date: Date) {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    copy.setDate(copy.getDate() - copy.getDay());
    return copy;
}

export function monthKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function weekdayLabel(index: number) {
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][index] || "Unknown";
}

export async function spendingAcceleration(weeks = 5) {
    const now = new Date();
    const start = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
    const txs = await prisma.transaction.findMany({
        where: { timestamp: { gte: start } },
        select: { amount: true, timestamp: true, type: true, transactionType: true },
        orderBy: { timestamp: "asc" },
    });

    const weekMap = new Map<string, number>();
    for (let i = weeks - 1; i >= 0; i--) {
        const wStart = weekStart(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7));
        weekMap.set(wStart.toISOString().slice(0, 10), 0);
    }

    for (const tx of txs as AnalyticsTransaction[]) {
        const impact = getTransactionImpact(tx.amount || 0, tx.type, tx.transactionType);
        if (impact >= 0) continue;
        const wStart = weekStart(new Date((tx as any).timestamp));
        const key = wStart.toISOString().slice(0, 10);
        weekMap.set(key, (weekMap.get(key) || 0) + Math.abs(impact));
    }

    const weekly = Array.from(weekMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([week, expense]) => ({ week, expense: Math.round(expense) }));

    const currentWeekItem = weekly[weekly.length - 1];
    const prior4Weeks = weekly.slice(0, Math.max(0, weekly.length - 1));

    const recentAverage = currentWeekItem ? currentWeekItem.expense : 0;
    const previousAverage = prior4Weeks.length ? prior4Weeks.reduce((sum, item) => sum + item.expense, 0) / prior4Weeks.length : 0;
    const recentWindowHasData = (currentWeekItem?.expense ?? 0) > 0;
    const previousWindowHasData = prior4Weeks.some((item) => item.expense > 0);
    const acceleration = recentAverage - previousAverage;
    const accelerationPercent = previousAverage > 0 ? (acceleration / previousAverage) * 100 : 0;
    const direction = acceleration > 0 ? "increase" : acceleration < 0 ? "decrease" : "neutral";

    return {
        weekly,
        recentAverage: Math.round(recentAverage),
        previousAverage: Math.round(previousAverage),
        recentWindowHasData,
        previousWindowHasData,
        acceleration: Math.round(acceleration),
        accelerationPercent: Math.round(accelerationPercent),
        direction,
    };
}

export async function seasonalPatterns(days = 365) {
    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const txs = await prisma.transaction.findMany({
        where: { timestamp: { gte: since } },
        select: { amount: true, timestamp: true, type: true, transactionType: true },
        orderBy: { timestamp: "asc" },
    });

    const weekdayCounts = Array(7).fill(0);
    const cursor = new Date(since.getFullYear(), since.getMonth(), since.getDate());
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    while (cursor <= endDate) {
        weekdayCounts[cursor.getDay()]++;
        cursor.setDate(cursor.getDate() + 1);
    }

    const weekdaySums = Array(7).fill(0);
    const monthlyKeySums = new Map<string, number>();

    for (const tx of txs as AnalyticsTransaction[]) {
        const impact = getTransactionImpact(tx.amount || 0, tx.type, tx.transactionType);
        if (impact >= 0) continue;
        const date = new Date((tx as any).timestamp);
        const amount = Math.abs(impact);

        weekdaySums[date.getDay()] += amount;

        const yyyymm = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        monthlyKeySums.set(yyyymm, (monthlyKeySums.get(yyyymm) || 0) + amount);
    }

    const weekdayTotals = Array.from({ length: 7 }, (_, index) => {
        const count = weekdayCounts[index] || 1;
        const avgValue = weekdaySums[index] / count;
        return {
            day: weekdayLabel(index),
            value: Math.round(avgValue),
        };
    });

    const monthCounts = Array(12).fill(0);
    const monthSums = Array(12).fill(0);

    for (const [yyyymm, sum] of monthlyKeySums.entries()) {
        const monthIdx = Number(yyyymm.split("-")[1]) - 1;
        monthSums[monthIdx] += sum;
        monthCounts[monthIdx]++;
    }

    const monthTotals = Array.from({ length: 12 }, (_, index) => {
        const count = monthCounts[index] || 1;
        const avgValue = monthSums[index] / count;
        return {
            month: new Date(2024, index, 1).toLocaleString("en-US", { month: "short" }),
            value: Math.round(avgValue),
        };
    });

    const sortedWeekdays = [...weekdayTotals].sort((a, b) => b.value - a.value);
    const sortedMonths = [...monthTotals].sort((a, b) => b.value - a.value);

    const weekendAvg = (weekdayTotals[0].value + weekdayTotals[6].value) / 2;
    const weekdayAvg = weekdayTotals.slice(1, 6).reduce((sum, entry) => sum + entry.value, 0) / 5;
    const weekendShare = weekendAvg + weekdayAvg > 0 ? Math.round((weekendAvg / (weekendAvg + weekdayAvg)) * 100) : 0;

    return {
        weekdayTotals,
        monthTotals,
        peakWeekday: sortedWeekdays[0] || null,
        peakMonth: sortedMonths[0] || null,
        weekendShare,
        topWeekdays: sortedWeekdays.slice(0, 3),
        topMonths: sortedMonths.slice(0, 3),
    };
}

export async function getUnifiedDashboardOverview() {
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

    const [profile, allTxs, insights, budgets, networthTotals] = await Promise.all([
        prisma.financialProfile.findFirst({ select: { balance: true, ownerName: true, currency: true } }),
        prisma.transaction.findMany({
            where: { timestamp: { gte: oneYearAgo } },
            select: { amount: true, timestamp: true, type: true, transactionType: true, category: { select: { name: true } } },
            orderBy: { timestamp: "asc" },
        }),
        listInsights(20).catch(() => []),
        getEnrichedBudgets().catch(() => []),
        (async () => {
            try {
                const res = await prisma.$queryRaw<Array<{ assets: number | null; liabilities: number | null }>>`
                    SELECT 
                        (
                            COALESCE((SELECT SUM(COALESCE("currentWorth", "currentBalance", 0)) FROM "PPFAccount"), 0) +
                            COALESCE((SELECT SUM(COALESCE("currentWorth", "currentBalance", 0)) FROM "EPFAccount"), 0) +
                            COALESCE((SELECT SUM(COALESCE("currentWorth", "principalAmount", 0)) FROM "FDAccount"), 0) +
                            COALESCE((SELECT SUM(COALESCE("currentWorth", "currentTotalDeposits", 0)) FROM "RDAccount"), 0) +
                            COALESCE((SELECT SUM(COALESCE("currentWorth", "purchasePrice", 0)) FROM "VehicleAsset"), 0) +
                            COALESCE((SELECT SUM(COALESCE("currentWorth", "purchasePrice", 0)) FROM "PlotAsset"), 0) +
                            COALESCE((SELECT SUM(COALESCE("currentWorth", "purchasePrice", 0)) FROM "IndependentPropertyAsset"), 0) +
                            COALESCE((SELECT SUM(COALESCE("currentWorth", "purchasePrice", 0)) FROM "ApartmentAsset"), 0) +
                            COALESCE((SELECT SUM(COALESCE("currentWorth", "purchasePrice", 0)) FROM "JewelleryAsset"), 0) +
                            COALESCE((SELECT SUM(COALESCE("currentWorth", "principalAmount", 0)) FROM "ReceivableAsset"), 0) +
                            COALESCE((SELECT SUM(COALESCE("currentWorth", COALESCE("currentUnits", 0) * COALESCE("currentNav", 0), 0)) FROM "MutualFund"), 0) +
                            COALESCE((SELECT SUM(COALESCE("currentWorth", COALESCE("currentQuantity", 0) * COALESCE("currentPrice", 0), 0)) FROM "Stock"), 0)
                        ) AS assets,
                        (
                            COALESCE((SELECT SUM("outstandingBalance") FROM "LoanLiability"), 0) +
                            COALESCE((SELECT SUM("currentOutstanding") FROM "CreditCardLiability"), 0) +
                            COALESCE((SELECT SUM("currentOutstanding") FROM "BnplLiability"), 0) +
                            COALESCE((SELECT SUM("outstandingAmount") FROM "BorrowedLiability"), 0)
                        ) AS liabilities
                `;
                return {
                    assetsExceptBank: Number(res[0]?.assets ?? 0),
                    liabilities: Number(res[0]?.liabilities ?? 0),
                };
            } catch (queryErr) {
                console.error("Failed to calculate networth totals in dashboard overview:", queryErr);
                return { assetsExceptBank: 0, liabilities: 0 };
            }
        })(),
    ]);

    const bankBal = profile?.balance ?? 0;
    const totalAssets = networthTotals.assetsExceptBank + bankBal;
    const totalLiabilities = networthTotals.liabilities;
    const networthSummary = {
        totals: {
            assets: totalAssets,
            liabilities: totalLiabilities,
            netWorth: totalAssets - totalLiabilities,
        },
    };

    const balanceVal = profile?.balance ?? 0;
    const nowMs = now.getTime();
    const last30Ms = nowMs - 30 * 24 * 60 * 60 * 1000;
    const last90Ms = nowMs - 90 * 24 * 60 * 60 * 1000;
    const compStartMs = nowMs - 120 * 24 * 60 * 60 * 1000;
    const compEndMs = nowMs - 30 * 24 * 60 * 60 * 1000;
    const currMonthStartMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let last30Delta = 0;
    let last90Inc = 0, last90Exp = 0;
    let compInc = 0, compExp = 0, compCount = 0;
    let currMonthInc = 0, currMonthExp = 0;

    const catMap: Record<string, number> = {};
    const heatmapMap = new Map<string, number>();

    const monthMap = new Map<string, { income: number; expense: number }>();
    for (let i = 11; i >= 0; i--) {
        const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
        monthMap.set(key, { income: 0, expense: 0 });
    }

    const weekMap = new Map<string, number>();
    for (let i = 4; i >= 0; i--) {
        const wStart = weekStart(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7));
        weekMap.set(wStart.toISOString().slice(0, 10), 0);
    }

    const weekdaySums = Array(7).fill(0);
    const monthlyKeySums = new Map<string, number>();

    for (const tx of allTxs as AnalyticsTransaction[]) {
        if (!tx.timestamp) continue;
        const txDate = new Date(tx.timestamp as any);
        const txMs = txDate.getTime();
        const impact = getTransactionImpact(tx.amount || 0, tx.type, tx.transactionType);
        const absImpact = Math.abs(impact);

        if (txMs >= last30Ms) {
            last30Delta += impact;
        }

        if (txMs >= last90Ms) {
            if (impact >= 0) last90Inc += impact;
            else last90Exp += absImpact;
        }

        if (txMs >= compStartMs && txMs < compEndMs) {
            compCount++;
            if (impact >= 0) compInc += impact;
            else compExp += absImpact;
        }

        if (txMs >= currMonthStartMs) {
            if (impact >= 0) currMonthInc += impact;
            else currMonthExp += absImpact;
        }

        const mKey = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, "0")}`;
        const mEntry = monthMap.get(mKey);
        if (mEntry) {
            if (impact >= 0) mEntry.income += impact;
            else mEntry.expense += absImpact;
        }

        if (impact < 0) {
            if (txMs >= last30Ms) {
                const cName = categoryNameForAnalytics(tx);
                catMap[cName] = (catMap[cName] || 0) + absImpact;
            }

            if (txMs >= last90Ms) {
                const dKey = formatDateKey(txDate);
                heatmapMap.set(dKey, (heatmapMap.get(dKey) || 0) + absImpact);
            }

            if (txMs >= nowMs - 35 * 24 * 60 * 60 * 1000) {
                const wStart = weekStart(txDate);
                const wKey = wStart.toISOString().slice(0, 10);
                weekMap.set(wKey, (weekMap.get(wKey) || 0) + absImpact);
            }

            weekdaySums[txDate.getDay()] += absImpact;
            monthlyKeySums.set(mKey, (monthlyKeySums.get(mKey) || 0) + absImpact);
        }
    }

    const prevBal = balanceVal - last30Delta;
    const pctChange = prevBal !== 0 ? Math.round((last30Delta / prevBal) * 100) : 0;
    const balance = {
        balance: balanceVal,
        lastMonthDelta: last30Delta,
        last30DaysDelta: last30Delta,
        percentChange: pctChange,
    };

    const trailingSavingsRate = last90Inc > 0 ? ((last90Inc - last90Exp) / last90Inc) * 100 : 0;
    const precedingSavingsRate = compInc > 0 ? ((compInc - compExp) / compInc) * 100 : 0;
    const savings = {
        monthlyIncome: Math.round(currMonthInc),
        monthlyExpenses: Math.round(currMonthExp),
        monthlySavings: Math.round(currMonthInc - currMonthExp),
        savingsRate: Math.round(trailingSavingsRate * 10) / 10,
        savingsMessage: savingsMessage(trailingSavingsRate),
        currentMonthSavingsRate: Math.round(trailingSavingsRate * 10) / 10,
        previousMonthSavingsRate: Math.round(precedingSavingsRate * 10) / 10,
        savingsRateChange: Math.round((trailingSavingsRate - precedingSavingsRate) * 10) / 10,
        savingsRateChangeDirection: (trailingSavingsRate - precedingSavingsRate) > 0 ? "increase" : (trailingSavingsRate - precedingSavingsRate) < 0 ? "decrease" : "neutral",
        previousMonthHasData: compCount > 0,
        trailingDays: 90,
    };

    const burnRateVal = Math.round(last90Exp / 3);
    const prevBurnRateVal = Math.round(compExp / 3);
    const burn = {
        burnRate: burnRateVal,
        previousBurnRate: prevBurnRateVal,
        burnRateChange: burnRateVal - prevBurnRateVal,
        burnRateChangeDirection: (burnRateVal - prevBurnRateVal) > 0 ? "increase" : (burnRateVal - prevBurnRateVal) < 0 ? "decrease" : "neutral",
        previousPeriodHasData: compCount > 0,
    };

    const runwayMonths = burnRateVal > 0 ? Math.round((balanceVal / burnRateVal) * 10) / 10 : null;
    const prevRunwayMonths = prevBurnRateVal > 0 ? Math.round((prevBal / prevBurnRateVal) * 10) / 10 : null;
    const runway = {
        runwayMonths,
        previousRunwayMonths: prevRunwayMonths,
        runwayChange: (runwayMonths !== null && prevRunwayMonths !== null) ? Math.round((runwayMonths - prevRunwayMonths) * 10) / 10 : 0,
        runwayChangeDirection: (runwayMonths !== null && prevRunwayMonths !== null && runwayMonths > prevRunwayMonths) ? "increase" : (runwayMonths !== null && prevRunwayMonths !== null && runwayMonths < prevRunwayMonths) ? "decrease" : "neutral",
    };

    const monthly = Array.from(monthMap.entries()).map(([month, data]) => ({
        month,
        income: Math.round(data.income),
        expense: Math.round(data.expense),
    }));

    const categories = Object.keys(catMap).map((k) => ({ name: k, value: Math.round(catMap[k]) }));

    const heatmap: Array<{ date: string; amount: number; weekday: number; weekIndex: number }> = [];
    for (let i = 89; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const k = formatDateKey(d);
        heatmap.push({
            date: k,
            amount: Math.round(heatmapMap.get(k) || 0),
            weekday: d.getDay(),
            weekIndex: Math.floor((89 - i) / 7),
        });
    }

    const weeklyArr = Array.from(weekMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([week, expense]) => ({ week, expense: Math.round(expense) }));
    const currentWeekItem = weeklyArr[weeklyArr.length - 1];
    const prior4Weeks = weeklyArr.slice(0, Math.max(0, weeklyArr.length - 1));
    const recentAverage = currentWeekItem ? currentWeekItem.expense : 0;
    const previousAverage = prior4Weeks.length ? prior4Weeks.reduce((sum, item) => sum + item.expense, 0) / prior4Weeks.length : 0;
    const accelVal = recentAverage - previousAverage;
    const acceleration = {
        weekly: weeklyArr,
        recentAverage: Math.round(recentAverage),
        previousAverage: Math.round(previousAverage),
        recentWindowHasData: (currentWeekItem?.expense ?? 0) > 0,
        previousWindowHasData: prior4Weeks.some((item) => item.expense > 0),
        acceleration: Math.round(accelVal),
        accelerationPercent: previousAverage > 0 ? Math.round((accelVal / previousAverage) * 100) : 0,
        direction: accelVal > 0 ? "increase" : accelVal < 0 ? "decrease" : "neutral",
    };

    const weekdayCounts = Array(7).fill(52);
    const weekdayTotals = Array.from({ length: 7 }, (_, index) => ({
        day: weekdayLabel(index),
        value: Math.round(weekdaySums[index] / weekdayCounts[index]),
    }));
    const monthCounts = Array(12).fill(1);
    const monthSumsArr = Array(12).fill(0);
    for (const [yyyymm, sum] of monthlyKeySums.entries()) {
        const mIdx = Number(yyyymm.split("-")[1]) - 1;
        if (mIdx >= 0 && mIdx < 12) monthSumsArr[mIdx] += sum;
    }
    const monthTotals = Array.from({ length: 12 }, (_, index) => ({
        month: new Date(2024, index, 1).toLocaleString("en-US", { month: "short" }),
        value: Math.round(monthSumsArr[index] / (monthCounts[index] || 1)),
    }));
    const sortedWeekdays = [...weekdayTotals].sort((a, b) => b.value - a.value);
    const sortedMonths = [...monthTotals].sort((a, b) => b.value - a.value);
    const weekendAvg = (weekdayTotals[0].value + weekdayTotals[6].value) / 2;
    const weekdayAvg = weekdayTotals.slice(1, 6).reduce((sum, entry) => sum + entry.value, 0) / 5;
    const weekendShare = weekendAvg + weekdayAvg > 0 ? Math.round((weekendAvg / (weekendAvg + weekdayAvg)) * 100) : 0;

    const seasonality = {
        weekdayTotals,
        monthTotals,
        peakWeekday: sortedWeekdays[0] || null,
        peakMonth: sortedMonths[0] || null,
        weekendShare,
        topWeekdays: sortedWeekdays.slice(0, 3),
        topMonths: sortedMonths.slice(0, 3),
    };

    return {
        balance,
        networth: networthSummary,
        savings,
        burn,
        runway,
        monthly,
        categories,
        heatmap,
        seasonality,
        acceleration,
        insights,
        budgets,
        profile: {
            ownerName: profile?.ownerName || "",
            currency: profile?.currency || "INR",
        },
    };
}
