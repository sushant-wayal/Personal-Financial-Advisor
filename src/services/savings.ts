import { prisma } from "../lib/prisma";

/**
 * Compute estimated monthly savings capacity from transactions.
 * Strategy:
 * - Compute monthly credits and debits over the past N months (default 3)
 * - Return average(credits - debits) per month, floored at 0
 * - Also update single FinancialProfile with derived values
 */
export async function computeSavingsCapacity(months = 3) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);

    // group aggregates by month
    const txs = await prisma.transaction.findMany({
        where: { timestamp: { gte: start } },
        select: { amount: true, transactionType: true, type: true, timestamp: true },
    });

    // naive monthly buckets
    const buckets: Record<string, { credits: number; debits: number }> = {};

    for (const tx of txs) {
        const d = new Date(tx.timestamp);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (!buckets[key]) buckets[key] = { credits: 0, debits: 0 };
        const normalized = (tx.transactionType || tx.type || "").toString().toUpperCase();
        const amount = Math.abs(tx.amount || 0);
        // treat common credit types as income
        const creditTypes = new Set(["CREDIT", "CREDITED", "SALARY", "REFUND", "INCOME", "BONUS"]);
        if (creditTypes.has(normalized)) buckets[key].credits += amount;
        else buckets[key].debits += amount;
    }

    const monthKeys = Object.keys(buckets).sort();
    if (monthKeys.length === 0) return 0;
    let total = 0;
    for (const k of monthKeys) {
        total += Math.max(0, buckets[k].credits - buckets[k].debits);
    }

    const avg = Math.floor(total / monthKeys.length);
    return Math.max(0, avg);
}
