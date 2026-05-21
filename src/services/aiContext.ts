import { prisma } from "../lib/prisma";
import { calculateBurnRate, calculateMonthlySavingsRate, calculateRunway, categoryBreakdown, monthlyTrend } from "./analytics";
import { generateText } from "./gemini";
import { listGoals, predictETA, recommendMonthlyContribution } from "./goals";

function formatCurrency(amount: number, currency = "INR") {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
    }).format(amount);
}

function monthsUntil(targetDate?: Date | null) {
    if (!targetDate) return null;
    const now = new Date();
    return Math.max(0, (targetDate.getFullYear() - now.getFullYear()) * 12 + (targetDate.getMonth() - now.getMonth()));
}

function compactTransaction(tx: any, currency: string) {
    return {
        id: tx.id,
        amount: tx.amount,
        amountLabel: formatCurrency(Math.abs(tx.amount || 0), currency),
        merchant: tx.merchant,
        category: tx.category?.name || null,
        type: tx.type || tx.transactionType || null,
        timestamp: tx.timestamp,
        source: tx.source,
        paymentMethod: tx.paymentMethod || null,
        bankName: tx.bankName || null,
        confidence: tx.confidence ?? null,
    };
}

function summarizeGoal(goal: any, currency: string) {
    const targetAmount = Number(goal.targetAmount || 0);
    const currentAmount = Number(goal.currentAmount || 0);
    const progressPct = targetAmount > 0 ? Math.min(100, (currentAmount / targetAmount) * 100) : 0;
    const monthsLeft = monthsUntil(goal.targetDate ? new Date(goal.targetDate) : null) ?? 12;
    const goalCurrency = goal.currency || currency;
    const monthlyContribution = goal.monthlyTarget && goal.monthlyTarget > 0
        ? Number(goal.monthlyTarget)
        : recommendMonthlyContribution(currentAmount, targetAmount, Math.max(1, monthsLeft));

    return {
        id: goal.id,
        title: goal.title,
        priority: goal.priority,
        currency: goalCurrency,
        targetAmount,
        targetAmountLabel: formatCurrency(targetAmount, goalCurrency),
        currentAmount,
        currentAmountLabel: formatCurrency(currentAmount, goalCurrency),
        progressPct: Math.round(progressPct),
        monthlyTarget: goal.monthlyTarget ?? null,
        recommendedMonthlyContribution: Math.round(monthlyContribution),
        eta: monthlyContribution > 0 ? predictETA(currentAmount, monthlyContribution, targetAmount) : null,
        targetDate: goal.targetDate || null,
        notes: goal.notes || null,
    };
}

function summarizeSubscription(sub: any, currency: string) {
    return {
        id: sub.id,
        merchant: sub.merchant,
        amount: sub.amount,
        amountLabel: formatCurrency(sub.amount || 0, currency),
        interval: sub.interval,
        active: sub.active,
        nextCharge: sub.nextCharge || null,
    };
}

export async function buildFinancialContext(limit = 24) {
    const [transactions, goals, profile, subscriptions, memories, monthly, categoryData, savings, burn, runway] = await Promise.all([
        prisma.transaction.findMany({ orderBy: { timestamp: "desc" }, take: Math.max(12, Math.min(limit, 30)), include: { category: true } }),
        listGoals(),
        prisma.financialProfile.findUnique({ where: { id: "default" } }),
        prisma.subscription.findMany({ orderBy: { updatedAt: "desc" } }),
        prisma.aIMemory.findMany({ orderBy: { updatedAt: "desc" }, take: 20 }),
        monthlyTrend(6),
        categoryBreakdown(30),
        calculateMonthlySavingsRate(),
        calculateBurnRate(),
        calculateRunway(),
    ]);

    const currency = profile?.currency || "INR";
    const activeSubscriptions = subscriptions.filter((subscription: any) => subscription.active !== false);
    const recurringMonthlySpend = activeSubscriptions.reduce((sum: number, subscription: any) => sum + Math.abs(Number(subscription.amount || 0)), 0);

    const merchantMap = new Map<string, number>();
    for (const tx of transactions as any[]) {
        const amount = Math.abs(Number(tx.amount || 0));
        const merchant = String(tx.merchant || "Unknown").trim();
        merchantMap.set(merchant, (merchantMap.get(merchant) || 0) + amount);
    }

    const topMerchants = Array.from(merchantMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([merchant, amount]) => ({ merchant, amount, amountLabel: formatCurrency(amount, currency) }));

    const recentInsights = await prisma.financialInsight.findMany({ orderBy: { createdAt: "desc" }, take: 8 });

    return {
        profile: profile
            ? {
                ownerName: profile.ownerName || null,
                currency,
                balance: profile.balance,
                balanceLabel: formatCurrency(profile.balance || 0, currency),
                emergencyFund: profile.emergencyFund,
                emergencyFundLabel: formatCurrency(profile.emergencyFund || 0, currency),
                monthlyIncome: profile.monthlyIncome,
                monthlyIncomeLabel: formatCurrency(profile.monthlyIncome || 0, currency),
                monthlyExpenses: profile.monthlyExpenses,
                monthlyExpensesLabel: formatCurrency(profile.monthlyExpenses || 0, currency),
            }
            : null,
        analytics: {
            savings,
            burn,
            runway,
            monthlyTrend: monthly,
            categoryBreakdown: categoryData,
        },
        goals: goals.map((goal) => summarizeGoal(goal, currency)),
        subscriptions: {
            activeCount: activeSubscriptions.length,
            monthlyRecurringSpend: recurringMonthlySpend,
            monthlyRecurringSpendLabel: formatCurrency(recurringMonthlySpend, currency),
            nextCharges: activeSubscriptions
                .filter((subscription: any) => subscription.nextCharge)
                .slice(0, 8)
                .map((subscription: any) => summarizeSubscription(subscription, currency)),
            all: subscriptions.slice(0, 12).map((subscription: any) => summarizeSubscription(subscription, currency)),
        },
        merchants: topMerchants,
        recentTransactions: transactions.slice(0, Math.max(12, Math.min(limit, 20))).map((tx: any) => compactTransaction(tx, currency)),
        memories: memories.map((memory: any) => ({
            id: memory.id,
            key: memory.key,
            value: memory.value,
            tags: memory.tags,
            updatedAt: memory.updatedAt,
        })),
        insights: recentInsights.map((insight: any) => ({
            id: insight.id,
            type: insight.type,
            message: insight.message,
            score: insight.score,
            createdAt: insight.createdAt,
        })),
        decisionFrame: [
            "Prioritize deterministic financial analysis over generic advice.",
            "Assess affordability against emergency fund, runway, savings rate, and goal delays.",
            "Call out tradeoffs clearly and quantify impact whenever possible.",
            "Do not invent balances, returns, or unsupported assumptions.",
        ],
    };
}

export function buildAdvisorSystemPrompt() {
    return [
        "You are a disciplined, analytical personal finance advisor for one user.",
        "You must be conservative, specific, and numerically grounded.",
        "Use the provided financial context and deterministic reasoning first.",
        "Do not hallucinate balances, investments, or missing facts.",
        "If the question is about a purchase, explicitly assess emergency fund impact, runway impact, savings impact, and goal delays.",
        "If there is insufficient data, say what is missing and state the safest conclusion.",
        "Keep the answer concise, practical, and protective.",
    ].join(" ");
}

export function buildAdvisorMessages(question: string, context: unknown) {
    return [
        { role: "system", content: buildAdvisorSystemPrompt() },
        {
            role: "user",
            content: `Financial context:\n${JSON.stringify(context)}\n\nUser question:\n${question}`,
        },
    ] as const;
}

export async function askAdvisor(question: string) {
    const context = await buildFinancialContext(24);
    return generateText(buildAdvisorMessages(question, context) as any, {
        temperature: 0.05,
        maxTokens: 1200,
        complexity: "complex",
    });
}
