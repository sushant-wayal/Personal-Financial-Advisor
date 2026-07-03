import { prisma } from "../lib/prisma";
import { recommendMonthlyContribution } from "./goals";
import { listGoals } from "./goals";

type TxRow = { timestamp: Date | string; amount: number | null; category?: { name: string } | null; transactionType?: string | null; type?: string | null };

export async function computeFinancialHealth() {
    const profile = await prisma.financialProfile.findFirst();
    const recentTx = await prisma.transaction.findMany({ orderBy: { timestamp: "desc" }, take: 90, include: { category: true } });

    const monthlyExpenses = profile?.monthlyExpenses ?? estimateMonthlyExpenses(recentTx as TxRow[]);
    const monthlyIncome = profile?.monthlyIncome ?? estimateMonthlyIncome(recentTx as TxRow[]);
    const efMonths = Math.max(3, profile?.emergencyFundMonths ?? 6);
    const efTarget = efMonths * (profile?.monthlyExpenses ?? 0);
    const emergencyFund = Math.min(efTarget, profile?.balance ?? 0);

    const runwayMonths = monthlyExpenses > 0 ? emergencyFund / monthlyExpenses : 0;

    const savingsRate = monthlyIncome > 0 ? Math.max(0, (monthlyIncome - monthlyExpenses) / monthlyIncome) : 0;

    const score = Math.max(0, Math.min(100, (Math.min(runwayMonths, 12) / 12) * 50 + savingsRate * 50));

    return { monthlyExpenses, monthlyIncome, emergencyFund, runwayMonths, savingsRate, score };
}

function estimateMonthlyExpenses(txs: TxRow[]) {
    const now = Date.now();
    const thirty = 1000 * 60 * 60 * 24 * 30;
    const sum = txs
        .filter((t) => new Date(t.timestamp).getTime() > now - thirty)
        .reduce((acc, t) => acc + (t.amount || 0), 0);
    return Math.abs(sum);
}

function estimateMonthlyIncome(txs: TxRow[]) {
    const incomes = txs.filter(
        (t) =>
            (t.category?.name || "").toLowerCase() === "salary" ||
            (t.transactionType || t.type || "").toLowerCase() === "salary",
    );
    if (incomes.length > 0) return incomes.reduce((s, t) => s + (t.amount || 0), 0);
    return 0;
}

export async function evaluateAffordability(price: number) {
    const state = await computeFinancialHealth();
    // Guard against Infinity (when monthlyExpenses === 0) to keep JSON-serialisable
    const safeRunway = isFinite(state.runwayMonths) ? state.runwayMonths : 0;
    const impactOnRunway = safeRunway - price / Math.max(1, state.monthlyExpenses);
    const affordabilityScore = Math.max(
        0,
        Math.min(100, state.emergencyFund >= price ? 90 : 50 * (state.emergencyFund / Math.max(1, price))),
    );
    // analyze impact on goals
    const goals = await listGoals();
    const now = new Date();
    const goalImpacts: Array<{
        id: string;
        title: string;
        delayMonths: number | null;
        monthlyContribution: number;
        newEta: string | null;
    }> = [];

    for (const g of goals) {
        const targetAmount = g.targetAmount || 0;
        const currentAmount = g.currentAmount || 0;
        let monthsRemaining = 12;
        if (g.targetDate) {
            const td = new Date(g.targetDate as string | Date);
            monthsRemaining = Math.max(
                1,
                Math.ceil((td.getFullYear() - now.getFullYear()) * 12 + (td.getMonth() - now.getMonth())),
            );
        }

        const monthlyContribution =
            g.monthlyTarget && g.monthlyTarget > 0
                ? g.monthlyTarget
                : recommendMonthlyContribution(currentAmount, targetAmount, monthsRemaining);

        if (!monthlyContribution || monthlyContribution <= 0) {
            goalImpacts.push({ id: g.id, title: g.title, delayMonths: null, monthlyContribution: monthlyContribution || 0, newEta: null });
            continue;
        }

        const delayMonths = price / monthlyContribution;
        const newMonthsRemaining = monthsRemaining + delayMonths;
        const newEta = new Date(now.getFullYear(), now.getMonth() + Math.ceil(newMonthsRemaining), now.getDate());

        goalImpacts.push({
            id: g.id,
            title: g.title,
            delayMonths: Number(delayMonths.toFixed(2)),
            monthlyContribution: Number(monthlyContribution.toFixed(2)),
            newEta: newEta.toISOString(),
        });
    }

    return { affordabilityScore, impactOnRunway, health: state, goalImpacts };
}
