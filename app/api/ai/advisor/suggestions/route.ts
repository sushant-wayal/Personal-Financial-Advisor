import { NextResponse } from "next/server";
import { buildFinancialContext } from "../../../../../src/services/aiContext";
import { generateText } from "../../../../../src/services/gemini";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Fallback suggestions when AI or data is unavailable
const FALLBACK_SUGGESTIONS = [
    "Can I afford a purchase right now?",
    "What should my priority be this month?",
    "How far am I from my target date?",
];

export async function GET() {
    try {
        if (!GEMINI_API_KEY) {
            return NextResponse.json({ suggestions: FALLBACK_SUGGESTIONS });
        }

        // Build a lightweight financial snapshot
        const ctx = await buildFinancialContext(20);

        // Compose a compact context summary for the prompt
        const lines: string[] = [];

        if (ctx.profile) {
            lines.push(`Balance: ${ctx.profile.balanceLabel}`);
            lines.push(`Monthly income: ${ctx.profile.monthlyIncomeLabel}, expenses: ${ctx.profile.monthlyExpensesLabel}`);
            lines.push(`Surplus: ${ctx.monthlySurplusLabel}`);
        }

        if (ctx.goalSummary.totalGoals > 0) {
            lines.push(
                `Goals: ${ctx.goalSummary.totalGoals} total — ${ctx.goalSummary.onTrackCount} on track, ${ctx.goalSummary.offTrackCount} off track`
            );
            if (ctx.goalSummary.nearestDeadlineGoal) {
                const g = ctx.goalSummary.nearestDeadlineGoal;
                const daysLeft = g.targetDate
                    ? Math.max(0, Math.round((new Date(g.targetDate).getTime() - Date.now()) / 86_400_000))
                    : null;
                lines.push(
                    `Nearest deadline goal: "${g.title}"${daysLeft !== null ? ` — ${daysLeft} days left` : ""}`
                );
            }
            if (ctx.goalSummary.highestPriorityGoal) {
                const g = ctx.goalSummary.highestPriorityGoal;
                lines.push(`Highest-priority goal: "${g.title}" (${g.progressPct}% complete)`);
            }
        }

        if (ctx.monthSnapshot) {
            const snap = ctx.monthSnapshot as Record<string, unknown>;
            if (snap.currentMonthExpenses) {
                const currency = ctx.profile?.currency ?? "INR";
                lines.push(
                    `This month's spending so far: ${new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(Number(snap.currentMonthExpenses))}`
                );
            }
            if (snap.largestExpenseCategory) {
                lines.push(`Biggest spending category this month: ${snap.largestExpenseCategory}`);
            }
        }

        if (ctx.analytics?.runway) {
            const runwayMonths = (ctx.analytics.runway as any)?.runwayMonths ?? ctx.analytics.runway;
            if (typeof runwayMonths === "number") {
                lines.push(`Cash runway: ~${Math.round(runwayMonths)} months`);
            }
        }

        if (ctx.subscriptions?.monthlyRecurringSpend > 0) {
            lines.push(`Monthly subscriptions: ${ctx.subscriptions.monthlyRecurringSpendLabel}`);
        }

        if (ctx.insights?.length > 0) {
            lines.push(`Recent insight: ${ctx.insights[0].message}`);
        }

        const contextSummary = lines.join("\n");

        const prompt = `You are a personal financial AI advisor. Based on the user's current financial snapshot, generate exactly 3 short, specific, and personalized questions the user would most benefit from asking their advisor right now.

FINANCIAL SNAPSHOT:
${contextSummary}

RULES:
- Each question must be concise (max 12 words)
- Each question must be directly grounded in one of the data points above
- Use plain, conversational language — no jargon
- Do NOT use generic questions like "What is my budget?" or "How are my finances?"
- Do NOT prefix with numbering or bullet characters
- Return ONLY a JSON array of 3 strings, nothing else

Example format:
["Question one here?", "Question two here?", "Question three here?"]`;

        const result = await generateText(prompt, { temperature: 0.7 });

        // Parse the JSON array from the response
        let suggestions: string[] = FALLBACK_SUGGESTIONS;
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
            console.error("[advisor/suggestions] Failed to parse AI response:", result.text);
        }

        // Ensure we always return exactly 3
        while (suggestions.length < 3) {
            suggestions.push(FALLBACK_SUGGESTIONS[suggestions.length]);
        }

        return NextResponse.json({ suggestions }, { headers: { "Cache-Control": "no-store" } });
    } catch (error: unknown) {
        console.error("[advisor/suggestions] Error:", error);
        return NextResponse.json({ suggestions: FALLBACK_SUGGESTIONS });
    }
}
