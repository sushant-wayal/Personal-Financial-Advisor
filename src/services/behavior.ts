import { prisma } from "../lib/prisma";
import { getInsightRetentionWindowStart, persistInsightIfNew } from "./insightStore";

const INCOME_TYPES = new Set(["CREDIT", "CREDITED", "SALARY", "INCOME", "BONUS", "REFUND"]);

function isIncomeLike(transaction: any) {
    const type = String(transaction.transactionType || transaction.type || "").toUpperCase();
    const categoryName = String(transaction.category?.name || "").toUpperCase();
    return INCOME_TYPES.has(type) || INCOME_TYPES.has(categoryName);
}

function isExpenseLike(transaction: any) {
    return !isIncomeLike(transaction);
}

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
    }).format(amount);
}

export async function analyzeBehavior() {
    const since = getInsightRetentionWindowStart();
    const txs = await prisma.transaction.findMany({
        where: { timestamp: { gte: since } },
        orderBy: { timestamp: "desc" },
        take: 500,
        include: { category: true },
    });
    const generated: any[] = [];
    const addInsight = async (draft: { type: string; message: string; score?: number | null; meta?: unknown }) => {
        const result = await persistInsightIfNew(draft);
        if (result.created) {
            generated.push(result.insight);
        }
    };

    if (!txs.length) {
        return generated;
    }

    const salaryTxs = txs.filter((tx: any) => String(tx.category?.name || "").toLowerCase() === "salary" || String(tx.transactionType || tx.type || "").toUpperCase() === "SALARY");
    if (salaryTxs.length) {
        const lastSalary = salaryTxs[0];
        const afterSalary = txs.filter((tx: any) => new Date(tx.timestamp) > new Date(lastSalary.timestamp));
        const weekendSpending = afterSalary.filter((tx: any) => {
            const day = new Date(tx.timestamp).getDay();
            return isExpenseLike(tx) && (day === 0 || day === 6);
        });
        const totalWeekendSpend = weekendSpending.reduce((sum: number, tx: any) => sum + Math.abs(tx.amount), 0);
        const avgWeekend = totalWeekendSpend / Math.max(1, weekendSpending.length);
        if (avgWeekend > 1000) {
            await addInsight({
                type: "behavior_weekend_spend",
                message: `You spend on average ${formatCurrency(avgWeekend)} on weekends after salary.`,
                score: Math.min(100, avgWeekend / 10),
                meta: { totalWeekendSpend, weekendCount: weekendSpending.length },
            });
        }
    }

    const foodProviders = ["zomato", "swiggy", "uber eats", "dominos", "pizzahut", "mcdonald"];
    const lateFood = txs.filter((tx: any) => {
        const merchant = String(tx.merchant || "").toLowerCase();
        const hour = new Date(tx.timestamp).getHours();
        return isExpenseLike(tx) && foodProviders.some((provider) => merchant.includes(provider)) && (hour >= 22 || hour <= 4);
    });
    if (lateFood.length > 0) {
        await addInsight({
            type: "late_food",
            message: `Detected ${lateFood.length} late-night food orders.`,
            score: Math.min(100, lateFood.length * 10),
        });
    }

    const expenseTxs = txs.filter((tx: any) => isExpenseLike(tx));
    if (expenseTxs.length > 0) {
        const weekendExpense = expenseTxs.filter((tx: any) => {
            const day = new Date(tx.timestamp).getDay();
            return day === 0 || day === 6;
        });
        const weekendSpend = weekendExpense.reduce((sum: number, tx: any) => sum + Math.abs(tx.amount), 0);
        const totalSpend = expenseTxs.reduce((sum: number, tx: any) => sum + Math.abs(tx.amount), 0);
        const weekendShare = totalSpend > 0 ? weekendSpend / totalSpend : 0;
        if (weekendShare >= 0.35) {
            await addInsight({
                type: "weekend_concentration",
                message: `${Math.round(weekendShare * 100)}% of your tracked spending happens on weekends.`,
                score: Math.min(100, weekendShare * 100),
                meta: { weekendSpend, totalSpend, weekendShare },
            });
        }
    }

    return generated;
}
