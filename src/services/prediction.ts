import { prisma } from "../lib/prisma";

export async function predictMonthEndBalance() {
    const profile = await prisma.financialProfile.findFirst();
    const txs = await prisma.transaction.findMany({ orderBy: { timestamp: "desc" }, take: 90, include: { category: true } });

    const monthlyExpense = profile?.monthlyExpenses ?? estimateMonthlyExpenses(txs);
    const monthlyIncome = profile?.monthlyIncome ?? estimateMonthlyIncome(txs);
    const balance = (profile?.emergencyFund ?? 0) + (monthlyIncome - monthlyExpense);

    // simple projection over next 6 months
    const projection: Array<{ month: string; balance: number }> = [];
    let current = balance;
    const now = new Date();
    for (let i = 0; i < 6; i++) {
        const month = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
        current = current + (monthlyIncome - monthlyExpense);
        projection.push({ month: month.toISOString().slice(0, 7), balance: Math.round(current) });
    }

    return { monthlyIncome, monthlyExpense, currentBalance: balance, projection };
}

function estimateMonthlyExpenses(txs: any[]) {
    const now = Date.now();
    const thirty = 1000 * 60 * 60 * 24 * 30;
    const sum = txs.filter((t: any) => new Date(t.timestamp).getTime() > now - thirty).reduce((acc: number, t: any) => acc + (t.amount || 0), 0);
    return Math.abs(sum);
}

function estimateMonthlyIncome(txs: any[]) {
    const incomes = txs.filter((t: any) => (t.category?.name || "").toLowerCase() === "salary" || (t.type || "").toLowerCase() === "salary");
    if (incomes.length > 0) return incomes.reduce((s: number, t: any) => s + (t.amount || 0), 0);
    return 0;
}
