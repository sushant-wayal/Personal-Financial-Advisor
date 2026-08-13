import { prisma } from "../lib/prisma";
import { getTransactionImpact, getLast30DaysNetImpact } from "./balance";
import { INVALID_TRANSACTION_CATEGORIES } from "./shared/formatting";


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
    const profile = await prisma.financialProfile.findUnique({ where: { id: "default" } }) as { balance?: number | null } | null;
    return profile?.balance ?? 0;
}

export async function calculateMonthlySavingsRate() {
    const now = new Date();

    // --- Primary window: Past 90 days (now - 90d to now) ---
    const last90Start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const last90Totals = await aggregateMonthlyTotals(last90Start, now);
    const last90Income = last90Totals.income;
    const last90Expenses = last90Totals.expenses;
    const trailingSavingsRate = last90Income > 0 ? ((last90Income - last90Expenses) / last90Income) * 100 : 0;

    // --- Comparison window: 31 to 120 days ago (now - 120d to now - 30d) ---
    const comparisonStart = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);
    const comparisonEnd = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const comparisonTotals = await aggregateMonthlyTotals(comparisonStart, comparisonEnd);
    const comparisonIncome = comparisonTotals.income;
    const comparisonExpenses = comparisonTotals.expenses;
    const precedingSavingsRate = comparisonIncome > 0 ? ((comparisonIncome - comparisonExpenses) / comparisonIncome) * 100 : 0;

    // --- Current calendar month actuals (kept for goal capacity / AI context) ---
    const { start: currentStart, end: currentEnd } = monthRange(now);
    const currentTotals = await aggregateMonthlyTotals(currentStart, currentEnd);
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
        // Current-month actuals — used by goal capacity & AI context
        monthlyIncome,
        monthlyExpenses,
        monthlySavings,
        // Past 90-day rate is now the primary savings rate signal
        savingsRate: trailingSavingsRate,
        savingsMessage: savingsMessage(trailingSavingsRate),
        currentMonthSavingsRate: trailingSavingsRate,
        // Preceding 90-day window (days 31 to 120 ago) used as baseline for change comparison
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
    const currentBalance = await calculateCurrentBalance();
    const last30DaysDelta = await getLast30DaysNetImpact();
    const previousBalance = currentBalance - last30DaysDelta;

    const burnData = await calculateBurnRate();

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
