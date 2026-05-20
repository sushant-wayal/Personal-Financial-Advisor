import { prisma } from "../lib/prisma";
import { recommendMonthlyContribution } from "./goals";

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
    const incomes = txs.filter((t: any) => (t.category?.name || "").toLowerCase() === "salary" || (t.transactionType || t.type || "").toLowerCase() === "salary");
    if (incomes.length > 0) return incomes.reduce((s: number, t: any) => s + (t.amount || 0), 0);
    return 0;
}

export async function evaluateAffordability(price: number) {
    const state = await computeFinancialHealth();
    const impactOnRunway = state.runwayMonths - price / Math.max(1, state.monthlyExpenses);
    const affordabilityScore = Math.max(0, Math.min(100, (state.emergencyFund >= price ? 90 : 50 * (state.emergencyFund / price))));
    // analyze impact on goals
    const goals = await prisma.goal.findMany({ orderBy: { priority: "asc" } });
    const now = new Date();
    const goalImpacts: Array<any> = [];
    for (const g of goals) {
        const targetAmount = g.targetAmount || 0;
        const currentAmount = g.currentAmount || 0;
        // months remaining until target date (fallback to 12 months if not set)
        let monthsRemaining = 12;
        if (g.targetDate) {
            const td = new Date(g.targetDate as any);
            monthsRemaining = Math.max(1, Math.ceil((td.getFullYear() - now.getFullYear()) * 12 + (td.getMonth() - now.getMonth())));
        }

        const monthlyContribution = (g.monthlyTarget && g.monthlyTarget > 0) ? g.monthlyTarget : recommendMonthlyContribution(currentAmount, targetAmount, monthsRemaining);

        if (!monthlyContribution || monthlyContribution <= 0) {
            goalImpacts.push({ id: g.id, title: g.title, delayMonths: null, monthlyContribution: monthlyContribution || 0, newEta: null });
            continue;
        }

        const delayMonths = price / monthlyContribution;
        const newMonthsRemaining = monthsRemaining + delayMonths;
        const newEta = new Date(now.getFullYear(), now.getMonth() + Math.ceil(newMonthsRemaining), now.getDate());

        goalImpacts.push({ id: g.id, title: g.title, delayMonths: Number(delayMonths.toFixed(2)), monthlyContribution: Number(monthlyContribution.toFixed(2)), newEta: newEta.toISOString() });
    }

    return { affordabilityScore, impactOnRunway, health: state, goalImpacts };
}
