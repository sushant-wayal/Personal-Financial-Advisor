import { prisma } from "../lib/prisma";

export async function monthlyTrend(months = 12) {
    const now = new Date();
    const results: Array<{ month: string; income: number; expense: number }> = [];
    for (let i = months - 1; i >= 0; i--) {
        const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = new Date(m.getFullYear(), m.getMonth(), 1);
        const end = new Date(m.getFullYear(), m.getMonth() + 1, 1);
        const txs = await prisma.transaction.findMany({ where: { timestamp: { gte: start, lt: end } }, include: { category: true } });
        const income = txs.filter((t: any) => (t.type || "").toString().toUpperCase() === "CREDIT" || (t.category?.name || "").toString().toLowerCase() === "salary").reduce((s: number, t: any) => s + (t.amount || 0), 0);
        const expense = txs.filter((t: any) => (t.type || "").toString().toUpperCase() !== "CREDIT").reduce((s: number, t: any) => s + (t.amount || 0), 0);
        results.push({ month: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`, income: Math.round(income), expense: Math.round(Math.abs(expense)) });
    }
    return results;
}

export async function categoryBreakdown(sinceDays = 30) {
    const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
    const txs = await prisma.transaction.findMany({ where: { timestamp: { gte: since } }, include: { category: true } });
    const map: Record<string, number> = {};
    for (const t of txs) {
        const k = (t.category?.name || "Miscellaneous").toString();
        map[k] = (map[k] || 0) + Math.abs(t.amount || 0);
    }
    return Object.keys(map).map(k => ({ name: k, value: Math.round(map[k]) }));
}
