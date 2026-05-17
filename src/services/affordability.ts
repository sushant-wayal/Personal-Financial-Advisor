import { prisma } from "../lib/prisma";

export async function computeFinancialHealth() {
    const profile = await prisma.financialProfile.findFirst();
    const recentTx = await prisma.transaction.findMany({ orderBy: { timestamp: "desc" }, take: 90, include: { category: true } });

    const monthlyExpenses = profile?.monthlyExpenses ?? estimateMonthlyExpenses(recentTx);
    const monthlyIncome = profile?.monthlyIncome ?? estimateMonthlyIncome(recentTx);
    const emergencyFund = profile?.emergencyFund ?? 0;

    const runwayMonths = monthlyExpenses > 0 ? emergencyFund / monthlyExpenses : Infinity;

    const savingsRate = monthlyIncome > 0 ? Math.max(0, (monthlyIncome - monthlyExpenses) / monthlyIncome) : 0;

    const score = Math.max(0, Math.min(100, (Math.min(runwayMonths, 12) / 12) * 50 + savingsRate * 50));

    return { monthlyExpenses, monthlyIncome, emergencyFund, runwayMonths, savingsRate, score };
}

function estimateMonthlyExpenses(txs: any[]) {
    // crude: sum negative (debits) over last 30 days and normalize to monthly
    const now = Date.now();
    const thirty = 1000 * 60 * 60 * 24 * 30;
    const sum = txs.filter((t: any) => new Date(t.timestamp).getTime() > now - thirty).reduce((acc: number, t: any) => acc + (t.amount || 0), 0);
    return Math.abs(sum);
}

function estimateMonthlyIncome(txs: any[]) {
    // crude: look for salary-type transactions
    const incomes = txs.filter((t: any) => (t.category?.name || "").toLowerCase() === "salary" || (t.type || "").toLowerCase() === "salary");
    if (incomes.length > 0) return incomes.reduce((s: number, t: any) => s + (t.amount || 0), 0);
    return 0;
}

export async function evaluateAffordability(price: number) {
    const state = await computeFinancialHealth();
    const impactOnRunway = state.runwayMonths - price / Math.max(1, state.monthlyExpenses);
    const affordabilityScore = Math.max(0, Math.min(100, (state.emergencyFund >= price ? 90 : 50 * (state.emergencyFund / price))));
    return { affordabilityScore, impactOnRunway, health: state };
}
