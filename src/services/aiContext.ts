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

    const summarizedGoals = (goals as any[]).map((goal: any) => summarizeGoal(goal, currency));

    // Derived: monthly surplus
    const monthlyIncomeVal = profile?.monthlyIncome ?? 0;
    const monthlyExpensesVal = profile?.monthlyExpenses ?? 0;
    const monthlySurplusVal = monthlyIncomeVal - monthlyExpensesVal;

    // Derived: goal summary
    const totalTargetAmount = summarizedGoals.reduce((sum: number, goal: any) => sum + (goal.targetAmount || 0), 0);
    const totalCurrentAmount = summarizedGoals.reduce((sum: number, goal: any) => sum + (goal.currentAmount || 0), 0);
    const totalGoals = summarizedGoals.length;
    const onTrackCount = summarizedGoals.filter((goal: any) => (goal.progressPct ?? 0) >= 80).length;
    const offTrackCount = summarizedGoals.filter((goal: any) => (goal.progressPct ?? 0) < 50).length;
    const atRiskCount = Math.max(0, totalGoals - onTrackCount - offTrackCount);
    const highestPriorityGoal = (() => {
        if (summarizedGoals.length === 0) return null;
        const sorted = [...summarizedGoals].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
        const g = sorted[0];
        return { id: g.id, title: g.title, progressPct: g.progressPct };
    })();
    const nearestDeadlineGoal = (() => {
        const withDates = summarizedGoals.filter((goal: any) => goal.targetDate);
        if (withDates.length === 0) return null;
        const sorted = [...withDates].sort((a, b) => new Date(a.targetDate!).getTime() - new Date(b.targetDate!).getTime());
        const g = sorted[0];
        return { id: g.id, title: g.title, targetDate: g.targetDate };
    })();
    const overallProgressPercent = totalTargetAmount > 0 ? Math.round((totalCurrentAmount / totalTargetAmount) * 100) : 0;

    // Derived: month snapshot (current calendar month)
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const txsThisMonth = transactions.filter((tx: any) => {
        const t = new Date(tx.timestamp);
        return t >= monthStart && t < monthEnd;
    });
    const currentMonthIncome = txsThisMonth.reduce((s: number, t: any) => s + (Number(t.amount) > 0 ? Number(t.amount) : 0), 0);
    const currentMonthExpenses = Math.abs(txsThisMonth.reduce((s: number, t: any) => s + (Number(t.amount) < 0 ? Number(t.amount) : 0), 0));
    const currentMonthSavings = currentMonthIncome - currentMonthExpenses;
    const currentMonthSavingsRate = currentMonthIncome > 0 ? Math.round((currentMonthSavings / currentMonthIncome) * 100) : 0;
    const transactionCountThisMonth = txsThisMonth.length;

    // Derived: transaction summary (last 30 days)
    const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const txs30 = transactions.filter((tx: any) => new Date(tx.timestamp) >= days30);
    const totalSpendingLast30Days = Math.abs(txs30.reduce((s: number, t: any) => s + (Number(t.amount) < 0 ? Number(t.amount) : 0), 0));
    const totalIncomeLast30Days = txs30.reduce((s: number, t: any) => s + (Number(t.amount) > 0 ? Number(t.amount) : 0), 0);
    const avgTxSize = txs30.length ? Math.round(txs30.reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0) / txs30.length) : 0;
    let largestExpenseCategory: string | null = null;
    let largestExpenseAmount = 0;
    const categoryMap = new Map<string, number>();
    for (const t of txs30) {
        const amt = Number(t.amount);
        if (amt < 0) {
            const cat = (t.category && t.category.name) || "Unknown";
            categoryMap.set(cat, (categoryMap.get(cat) || 0) + Math.abs(amt));
        }
    }
    if (categoryMap.size > 0) {
        const sortedCats = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]);
        largestExpenseCategory = sortedCats[0][0];
        largestExpenseAmount = sortedCats[0][1];
    }
    const topMerchantObj = topMerchants.length > 0 ? topMerchants[0] : null;
    const topMerchant = topMerchantObj ? topMerchantObj.merchant : null;
    const topMerchantSpend = topMerchantObj ? topMerchantObj.amount : 0;
    const largestTransaction = (() => {
        if (txs30.length === 0) return null;
        const sorted = [...txs30].sort((a, b) => Math.abs(Number(b.amount)) - Math.abs(Number(a.amount)));
        const t = sorted[0];
        return compactTransaction(t, currency);
    })();

    // Derived: financial health summary
    const runwayMonths = (runway && typeof runway === "object" && "runwayMonths" in (runway as any))
        ? Number((runway as any).runwayMonths ?? 0)
        : Number(runway ?? 0);
    const emergencyFundCoverageMonths = profile && profile.emergencyFund && profile.monthlyExpenses ? Number(profile.emergencyFund) / Math.max(1, Number(profile.monthlyExpenses)) : null;
    const savingsRate = (savings && typeof savings === "object" && "savingsRate" in (savings as any))
        ? Number((savings as any).savingsRate ?? 0)
        : Number(savings ?? 0);
    const fh_monthlySurplus = monthlySurplusVal;
    let status = "Needs Attention";
    if (runwayMonths >= 12 && (emergencyFundCoverageMonths ?? 0) >= 6 && (savingsRate ?? 0) >= 20 && fh_monthlySurplus > 0) status = "Excellent";
    else if (runwayMonths >= 6 && (emergencyFundCoverageMonths ?? 0) >= 3 && (savingsRate ?? 0) >= 10) status = "Healthy";
    else if (runwayMonths >= 3) status = "Needs Attention";
    else status = "Critical";

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
        goals: summarizedGoals,
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
        // New derived summary fields
        monthlySurplus: monthlySurplusVal,
        monthlySurplusLabel: formatCurrency(monthlySurplusVal, currency),
        goalSummary: {
            totalGoals,
            onTrackCount,
            atRiskCount,
            offTrackCount,
            highestPriorityGoal,
            nearestDeadlineGoal,
            totalTargetAmount,
            totalCurrentAmount,
            overallProgressPercent,
        },
        monthSnapshot: {
            currentMonthIncome,
            currentMonthExpenses,
            currentMonthSavings,
            currentMonthSavingsRate,
            transactionCountThisMonth,
        },
        transactionSummary: {
            largestExpenseCategory,
            largestExpenseAmount,
            topMerchant,
            topMerchantSpend,
            largestTransaction,
            averageTransactionSize: avgTxSize,
            totalSpendingLast30Days,
            totalIncomeLast30Days,
        },
        financialHealthSummary: {
            runwayMonths,
            emergencyFundCoverageMonths,
            monthlySurplus: fh_monthlySurplus,
            savingsRate,
            status,
        },
        decisionFrame: [
            "Prioritize deterministic financial analysis over generic advice.",
            "Assess affordability against emergency fund, runway, savings rate, and goal delays.",
            "Call out tradeoffs clearly and quantify impact whenever possible.",
            "Do not invent balances, returns, or unsupported assumptions.",
        ],
    };
}

export function buildAdvisorSystemPrompt(options?: { structured?: boolean }) {
    const parts = [
        "You are a trusted personal financial advisor and decision-making partner for a single user.",

        "Your purpose is not to report financial data. Your purpose is to help the user make better financial decisions.",

        "Speak like an experienced financial planner having a real conversation with the user.",

        "Answer the user's actual question first before discussing details.",

        "Use the provided financial context as the source of truth.",

        "Base recommendations on balance, emergency fund, savings rate, burn rate, runway, goals, spending patterns, subscriptions, and other available financial information.",

        "Be practical, protective, and realistic rather than optimistic.",

        "When evaluating purchases, explain affordability, tradeoffs, impact on financial safety, impact on goals, and potential risks.",

        "If information is missing, ask for it naturally as a financial advisor would. Do not refuse analysis simply because some information is unavailable. Give the best provisional recommendation possible and explain what additional information would improve the answer.",

        "Avoid sounding like a dashboard, spreadsheet, audit report, API response, or financial compliance document.",

        "Do not use phrases such as 'risk posture', 'goal impact available', 'confidence score', 'analysis result', or other internal terminology.",

        "Do not expose internal calculations unless they help explain the recommendation.",

        "Use numbers when they strengthen the advice, but focus on interpretation rather than calculation.",

        "Explain reasoning in plain language.",

        "When recommending an action, explain why it is beneficial and what outcome it is expected to improve.",

        "When the user's financial situation is weak, prioritize financial stability and emergency preparedness over discretionary spending.",

        "When the user's financial situation is strong, acknowledge opportunities while still discussing tradeoffs.",

        "Be concise by default. Most answers should be 2-6 short paragraphs.",

        "Do not create sections, headings, bullet lists, or report formatting unless the user explicitly requests a detailed breakdown.",

        "The user should feel like they are speaking with a thoughtful personal financial advisor, not reading a generated report."
    ];

    if (options?.structured) {
        parts.push(
            "Return structured JSON only.",
            "Do not output markdown fences, HTML, frontend code, or extra commentary.",
            "The response must be a JSON object with narrative and artifacts.",
            "narrative is required and should remain conversational, direct, and natural.",
            "artifacts is optional and should usually contain 0-3 items. Some responses may contain no artifacts.",
            "Use artifacts only when they improve clarity or make the advice easier to act on.",
            "Avoid repetitive layouts. Choose the artifact types that fit the question best.",
            "Never force a template or include an artifact just to fill space.",
            "Use these exact artifact types and exact property names. Do not rename keys. Do not wrap the object in another envelope. Do not add commentary outside JSON.",
            "Supported artifact JSON shapes:",
            "healthCard: { type: \"healthCard\", title: string, status: \"critical\" | \"warning\" | \"neutral\" | \"healthy\" | \"success\", summary?: string, metrics?: [{ label: string, value: string, tone?: \"critical\" | \"warning\" | \"neutral\" | \"success\" | \"positive\" | \"negative\" | \"info\", note?: string }], note?: string }",
            "Example: { type: \"healthCard\", title: \"Financial Health Status\", status: \"critical\", summary: \"Immediate attention is needed.\", metrics: [{ label: \"Current Balance\", value: \"₹8,772\" }, { label: \"Runway\", value: \"1.3 months\" }, { label: \"Savings Rate\", value: \"-0.3%\" }], note: \"Focus on stability before new purchases.\" }",
            "dualMetric: { type: \"dualMetric\", left: { label: string, value: string, tone?: string, note?: string }, right: { label: string, value: string, tone?: string, note?: string } }",
            "Example: { type: \"dualMetric\", left: { label: \"Financial Runway Risk\", value: \"Critical Level\", tone: \"critical\" }, right: { label: \"Available Liquidity\", value: \"₹9,437\" } }",
            "metricsGrid: { type: \"metricsGrid\", title?: string, metrics: [{ label: string, value: string, tone?: string, note?: string }] }",
            "Example: { type: \"metricsGrid\", title: \"Stability Snapshot\", metrics: [{ label: \"Emergency Fund\", value: \"₹0\" }, { label: \"Runway\", value: \"1.3 months\" }, { label: \"Savings Rate\", value: \"-0.3%\" }, { label: \"Balance\", value: \"₹8,772\" }] }",
            "riskList: { type: \"riskList\", title: string, items: [{ title: string, description: string, severity?: string }] }",
            "Example: { type: \"riskList\", title: \"Key Detractors\", items: [{ title: \"Low Emergency Fund\", description: \"Current reserves are below target.\" }, { title: \"Negative Savings Rate\", description: \"You are spending slightly more than you earn.\" }] }",
            "warning: { type: \"warning\", title: string, content: string, severity?: string }",
            "Example: { type: \"warning\", title: \"Hold the Purchase\", content: \"This would weaken your runway at the wrong time.\", severity: \"warning\" }",
            "directive: { type: \"directive\", title: string, content: string, priority?: \"critical\" | \"high\" | \"medium\" | \"low\" }",
            "Example: { type: \"directive\", title: \"Recommended Action\", content: \"Build emergency savings before discretionary spending.\", priority: \"critical\" }",
            "recommendation: { type: \"recommendation\", title: string, content: string, reasoning?: string, nextStep?: string, tone?: string }",
            "Example: { type: \"recommendation\", title: \"Best Move\", content: \"Delay the purchase for now.\", reasoning: \"It protects runway and avoids pushing savings further negative.\", nextStep: \"Set aside a fixed emergency-fund amount this month.\" }",
            "goalCard: { type: \"goalCard\", title: string, status?: \"critical\" | \"warning\" | \"neutral\" | \"healthy\" | \"success\", progressPct?: number, progressLabel?: string, currentLabel?: string, targetLabel?: string, note?: string }",
            "Example: { type: \"goalCard\", title: \"Mobile Goal\", status: \"warning\", progressPct: 42, progressLabel: \"42% complete\", currentLabel: \"₹8,800\", targetLabel: \"₹20,000\", note: \"On track only if spending stays controlled.\" }",
            "goalTimeline: { type: \"goalTimeline\", title: string, items: [{ label: string, date?: string, status?: string, note?: string }] }",
            "Example: { type: \"goalTimeline\", title: \"Recovery Plan\", items: [{ label: \"Build buffer\", date: \"This month\", status: \"critical\", note: \"Stop discretionary purchases until the buffer is positive.\" }, { label: \"Resume goals\", date: \"Next month\", status: \"neutral\", note: \"Restart mobile and earbuds only after runway improves.\" }] }",
            "comparisonTable: { type: \"comparisonTable\", title: string, columns: [string, string, ...], rows: [{ label: string, values: [string, ...] }] }",
            "Example: { type: \"comparisonTable\", title: \"Buy Now vs Delay\", columns: [\"Buy now\", \"Delay 60 days\"], rows: [{ label: \"Cash impact\", values: [\"Lower buffer\", \"Preserve liquidity\"] }, { label: \"Risk\", values: [\"Higher\", \"Lower\"] }] }",
            "priorityCard: { type: \"priorityCard\", title: string, priority: \"critical\" | \"high\" | \"medium\" | \"low\", summary: string, reasons?: [string, ...] }",
            "Important: if the model has a list of items from an earlier draft, convert them into reasons for priorityCard rather than inventing a different structure.",
            "Example: { type: \"priorityCard\", title: \"Immediate Priorities\", priority: \"critical\", summary: \"Stabilize cash flow before discretionary spending.\", reasons: [\"Build emergency fund\", \"Reduce non-essential spend\", \"Protect runway\"] }",
            "decisionSummary: { type: \"decisionSummary\", title: string, decision: string, recommendation: string, tradeoffs?: [string, ...], nextStep?: string }",
            "Example: { type: \"decisionSummary\", title: \"Should you buy this now?\", decision: \"Not yet.\", recommendation: \"Delay the purchase until your emergency buffer is positive.\", tradeoffs: [\"You keep liquidity intact\", \"The purchase is postponed\"], nextStep: \"Review again after one month of consistent savings.\" }",
            "Keep artifact content concise, specific, and financially grounded.",
            "Use exact lowercase artifact type names. Keep enums lowercase exactly as written. Do not emit any other artifact types."
        );
    }

    return parts.join(" ");
}

export function buildAdvisorMessages(question: string, context: unknown) {
    return [
        { role: "system", content: buildAdvisorSystemPrompt() },
        {
            role: "user",
            content: `Financial context:\n${JSON.stringify(context)}\n\nUser question:\n${question}`,
        },
    ];
}

export type AdvisorChatTurn = {
    question: string;
    response: string;
};

export function buildAdvisorChatMessages(
    question: string,
    context: unknown,
    history: AdvisorChatTurn[] = [],
    options?: { structured?: boolean }
) {
    const messages = [{ role: "system", content: buildAdvisorSystemPrompt(options) }];
    const contextText = `Financial context:\n${JSON.stringify(context)}`;

    for (const turn of history) {
        if (turn.question?.trim()) {
            messages.push({ role: "user", content: `${contextText}\n\nUser question:\n${turn.question.trim()}` });
        }
        if (turn.response?.trim()) {
            messages.push({ role: "assistant", content: turn.response.trim() });
        }
    }

    messages.push({
        role: "user",
        content: `${contextText}\n\nUser question:\n${question}`,
    });

    return messages;
}

export async function askAdvisor(question: string) {
    const context = await buildFinancialContext(24);
    return generateText(buildAdvisorMessages(question, context) as any, {
        temperature: 0.05,
        complexity: "complex",
    });
}
