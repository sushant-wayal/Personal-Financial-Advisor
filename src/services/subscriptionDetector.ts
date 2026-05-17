import { prisma } from "../lib/prisma";

type Tx = { id: string; merchant: string; amount: number; timestamp: Date };

export async function detectSubscriptions(minOccurrences = 3, tolerance = 0.1) {
    const txs = await prisma.transaction.findMany({ where: {}, orderBy: { timestamp: "desc" } });
    // group by merchant
    const groups: Record<string, Tx[]> = {};
    for (const t of txs) {
        const key = (t.merchant || "Unknown").toLowerCase();
        if (!groups[key]) groups[key] = [];
        groups[key].push({ id: t.id, merchant: t.merchant, amount: t.amount, timestamp: t.timestamp });
    }

    const detected: any[] = [];
    for (const [merchantKey, arr] of Object.entries(groups)) {
        if (arr.length < minOccurrences) continue;
        // compute median amount
        const amounts = arr.map(a => Math.abs(a.amount)).sort((a, b) => a - b);
        const median = amounts[Math.floor(amounts.length / 2)];
        // check for roughly monthly spacing
        const months = arr.map(a => a.timestamp.getMonth() + a.timestamp.getFullYear() * 12);
        const diffs = [] as number[];
        for (let i = 1; i < months.length; i++) diffs.push(Math.abs(months[i] - months[i - 1]));
        const avgDiff = diffs.length ? diffs.reduce((s, v) => s + v, 0) / diffs.length : 0;
        // if avgDiff ≈ 1 month and amounts within tolerance, it's likely a subscription
        const withinTol = amounts.every(a => Math.abs(a - median) / median <= tolerance);
        if (Math.round(avgDiff) === 1 && withinTol) {
            // create or update subscription
            const existing = await prisma.subscription.findFirst({ where: { merchant: arr[0].merchant } });
            const amount = median;
            const nextCharge = new Date(arr[0].timestamp);
            nextCharge.setMonth(nextCharge.getMonth() + 1);
            if (existing) {
                await prisma.subscription.update({ where: { id: existing.id }, data: { amount, nextCharge, active: true } });
                detected.push(existing);
            } else {
                const created = await prisma.subscription.create({ data: { merchant: arr[0].merchant, amount, interval: "monthly", nextCharge, active: true } });
                detected.push(created);
            }
        }
    }
    return detected;
}
