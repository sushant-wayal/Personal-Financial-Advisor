import { buildFinancialContext } from "./aiContext";
import { generateText } from "./gemini";
import { formatCurrency } from "./shared/formatting";

// Fallback suggestions when AI or data is unavailable
export const FALLBACK_SUGGESTIONS = [
    "Can I afford a purchase right now?",
    "What should my priority be this month?",
    "How far am I from my target date?",
];

/**
 * Formats a date into a human-friendly relative time string
 * (e.g., "Today", "Yesterday", "3 days ago", "2 weeks ago", "2 months ago").
 */
export function formatRelativeTime(dateInput: string | Date | null | undefined, referenceDate: Date = new Date()): string {
    if (!dateInput) return "Unknown date";
    const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (Number.isNaN(date.getTime())) return "Unknown date";

    const diffMs = referenceDate.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffDays <= 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
    }
    const months = Math.floor(diffDays / 30);
    return `${months} ${months === 1 ? "month" : "months"} ago`;
}

/**
 * Builds a comprehensive, up-to-date, and temporally grounded context
 * summary for the advisor suggestion prompt.
 */
export function formatSuggestionsContext(
    ctx: Awaited<ReturnType<typeof buildFinancialContext>>,
    referenceDate: Date = new Date()
): string {
    const lines: string[] = [];
    const currency = ctx.profile?.currency ?? "INR";

    // 1. Current Date & Time
    const dateStr = referenceDate.toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
    lines.push(`CURRENT DATE: ${dateStr}`);

    // 2. Financial Profile & Cashflow
    if (ctx.profile) {
        lines.push(`Current Balance: ${ctx.profile.balanceLabel}`);
        lines.push(`Monthly Income (90-day avg): ${ctx.profile.monthlyIncomeLabel}`);
        lines.push(`Monthly Expenses (90-day avg): ${ctx.profile.monthlyExpensesLabel}`);
        lines.push(`Monthly Surplus: ${ctx.monthlySurplusLabel}`);
    }

    // 3. Cash Runway & Health
    if (ctx.analytics?.runway) {
        const runwayMonths = (ctx.analytics.runway as any)?.runwayMonths ?? ctx.analytics.runway;
        if (typeof runwayMonths === "number") {
            lines.push(`Cash Runway: ~${Math.round(runwayMonths)} months`);
        }
    }
    if (ctx.financialHealthSummary?.status) {
        lines.push(`Financial Health Status: ${ctx.financialHealthSummary.status}`);
    }

    // 4. Current Month-To-Date Snapshot
    if (ctx.monthSnapshot) {
        const snap = ctx.monthSnapshot as Record<string, unknown>;
        if (snap.currentMonthExpenses !== undefined) {
            lines.push(`This Month's Spending So Far: ${formatCurrency(Number(snap.currentMonthExpenses), currency)}`);
        }
        if (snap.currentMonthIncome !== undefined && Number(snap.currentMonthIncome) > 0) {
            lines.push(`This Month's Income So Far: ${formatCurrency(Number(snap.currentMonthIncome), currency)}`);
        }
        if (snap.currentMonthSavingsRate !== undefined) {
            lines.push(`This Month's Savings Rate: ${snap.currentMonthSavingsRate}%`);
        }
    }

    // 5. Recent Transactions with Exact Relative Dates
    if (ctx.recentTransactions && ctx.recentTransactions.length > 0) {
        lines.push("\nRECENT TRANSACTIONS (with relative dates):");
        const topRecent = ctx.recentTransactions.slice(0, 8);
        for (const tx of topRecent) {
            const relTime = formatRelativeTime(tx.timestamp, referenceDate);
            const category = tx.category ? ` [${tx.category}]` : "";
            const merchant = tx.merchant || "Unknown";
            const amount = tx.amountLabel || formatCurrency(Math.abs(tx.amount || 0), currency);
            const type = (tx.type || (tx.amount > 0 ? "CREDIT" : "DEBIT")).toUpperCase();
            lines.push(`- ${relTime}: ${type} ${amount} - ${merchant}${category}`);
        }
    }

    // 6. Category Budgets & Limit Usage
    if (ctx.budgets && ctx.budgets.length > 0) {
        lines.push("\nACTIVE CATEGORY BUDGETS:");
        for (const b of ctx.budgets.slice(0, 5)) {
            const cat = b.categoryName || "Category";
            const spent = formatCurrency(b.spent || 0, currency);
            const limit = formatCurrency(b.totalLimit || b.monthlyLimit || 0, currency);
            const pct = b.totalLimit > 0 ? Math.round(((b.spent || 0) / b.totalLimit) * 100) : 0;
            const status = pct > 100 ? "OVER BUDGET" : `${pct}% used`;
            lines.push(`- ${cat}: ${spent} / ${limit} (${status})`);
        }
    }

    // 7. Active Financial Goals
    if (ctx.goalSummary && ctx.goalSummary.totalGoals > 0) {
        lines.push(`\nGOALS (${ctx.goalSummary.totalGoals} total, ${ctx.goalSummary.onTrackCount} on track, ${ctx.goalSummary.offTrackCount} off track):`);
        if (ctx.goals && ctx.goals.length > 0) {
            for (const g of ctx.goals.slice(0, 4)) {
                const target = formatCurrency(g.targetAmount, g.currency || currency);
                const current = formatCurrency(g.currentAmount, g.currency || currency);
                const daysLeft = g.targetDate
                    ? Math.max(0, Math.round((new Date(g.targetDate).getTime() - referenceDate.getTime()) / 86_400_000))
                    : null;
                const deadlineText = daysLeft !== null ? ` — ${daysLeft} days remaining` : "";
                lines.push(`- "${g.title}": ${current} / ${target} (${g.progressPct}% complete${deadlineText})`);
            }
        }
    }

    // 8. Active Investment Suggestions
    if (ctx.investmentSuggestion) {
        const inv = ctx.investmentSuggestion as any;
        if (inv.phaseLabel || inv.baseInvestable) {
            const investable = formatCurrency(inv.baseInvestable || 0, currency);
            lines.push(`\nINVESTMENT ENGINE: Phase "${inv.phaseLabel || 'Active'}", Suggested Investable: ${investable}`);
        }
    }

    // 9. Active Recurring Subscriptions
    if (ctx.subscriptions && ctx.subscriptions.monthlyRecurringSpend > 0) {
        lines.push(`\nSUBSCRIPTIONS: ${ctx.subscriptions.activeCount} active (${ctx.subscriptions.monthlyRecurringSpendLabel}/month)`);
    }

    // 10. Insights (with exact relative age so past events are clearly identified)
    if (ctx.insights && ctx.insights.length > 0) {
        lines.push("\nSTORED INSIGHTS (with creation age):");
        for (const insight of ctx.insights.slice(0, 3)) {
            const age = formatRelativeTime(insight.createdAt, referenceDate);
            lines.push(`- (${age}): ${insight.message}`);
        }
    }

    return lines.join("\n");
}

/**
 * Generates dynamic, highly personalized, and temporally grounded suggested questions
 * based on the user's latest live financial snapshot.
 */
export async function getAdvisorDynamicSuggestions(
    existingContext?: Awaited<ReturnType<typeof buildFinancialContext>>
): Promise<string[]> {
    try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) {
            return FALLBACK_SUGGESTIONS;
        }

        const ctx = existingContext ?? (await buildFinancialContext(20));
        const contextSummary = formatSuggestionsContext(ctx);

        const prompt = `You are a personal financial AI advisor. Based on the user's live, up-to-date financial snapshot below, generate exactly 3 short, specific, and personalized questions the user would most benefit from asking their advisor right now.

${contextSummary}

GUIDELINES:
- Ground questions in the user's live current reality: current month budget pacing, upcoming goal targets, recent transactions from the past few days, current surplus, or cash runway.
- Note the relative timestamps on transactions and insights (e.g. "Today", "2 days ago", "2 months ago"). Events from months ago are historical; focus on what is active, upcoming, or recently changed.
- Each question must be concise (max 12 words).
- Use conversational, direct phrasing (e.g., "Can I afford to save more for my emergency fund this month?").
- Do NOT use generic questions like "What is my budget?" or "How are my finances?".
- Return ONLY a JSON array of 3 strings, nothing else.

Example format:
["Question one here?", "Question two here?", "Question three here?"]`;

        const result = await generateText(prompt, { temperature: 0.7 });

        let suggestions: string[] = [];
        try {
            const raw = result.text.trim();
            const jsonStr = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
            const firstBracket = jsonStr.indexOf("[");
            const lastBracket = jsonStr.lastIndexOf("]");
            if (firstBracket !== -1 && lastBracket !== -1) {
                const parsed = JSON.parse(jsonStr.slice(firstBracket, lastBracket + 1));
                if (Array.isArray(parsed) && parsed.length >= 1) {
                    suggestions = parsed
                        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
                        .slice(0, 3);
                }
            }
        } catch {
            console.error("[advisorSuggestions] Failed to parse AI response:", result.text);
        }

        // Fill up with fallbacks if needed
        while (suggestions.length < 3) {
            suggestions.push(FALLBACK_SUGGESTIONS[suggestions.length]);
        }

        return suggestions.slice(0, 3);
    } catch (error: unknown) {
        console.error("[advisorSuggestions] Error generating suggestions:", error);
        return FALLBACK_SUGGESTIONS;
    }
}
