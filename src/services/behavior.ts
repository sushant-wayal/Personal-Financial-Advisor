import { prisma } from "../lib/prisma";

export async function analyzeBehavior() {
    const txs = await prisma.transaction.findMany({ orderBy: { timestamp: "desc" }, take: 500, include: { category: true } });
    const insights: any[] = [];

    // detect salary-linked spending spikes
    const salaryTxs = txs.filter((t: any) => (t.category?.name || '').toLowerCase() === 'salary' || (t.transactionType || t.type || '').toLowerCase() === 'salary');
    if (salaryTxs.length) {
        const lastSalary = salaryTxs[0];
        const afterSalary = txs.filter((t: any) => new Date(t.timestamp) > new Date(lastSalary.timestamp));
        const weekendSpending = afterSalary.filter((t: any) => {
            const d = new Date(t.timestamp);
            return d.getDay() === 0 || d.getDay() === 6;
        });
        const avgWeekend = weekendSpending.reduce((s: number, v: any) => s + Math.abs(v.amount), 0) / Math.max(1, weekendSpending.length);
        if (avgWeekend > 1000) insights.push({ type: 'behavior_weekend_spend', message: `You spend on average ₹${Math.round(avgWeekend)} on weekends after salary`, score: Math.min(100, avgWeekend / 10) });
    }

    // detect late-night food (heuristic: merchant matches food providers and time between 22:00-04:00)
    const foodProviders = ['zomato', 'swiggy', 'uber eats', 'dominos', 'pizzahut', 'mcdonald'];
    const lateFood = txs.filter((t: any) => {
        const lc = (t.merchant || '').toLowerCase();
        const hour = new Date(t.timestamp).getHours();
        return foodProviders.some(f => lc.includes(f)) && (hour >= 22 || hour <= 4);
    });
    if (lateFood.length > 0) insights.push({ type: 'late_food', message: `Detected ${lateFood.length} late-night food orders`, score: Math.min(100, lateFood.length * 10) });

    // persist summarized behavior insights
    for (const ins of insights) {
        await prisma.financialInsight.create({ data: { type: ins.type, message: ins.message, score: ins.score } });
    }

    return insights;
}
