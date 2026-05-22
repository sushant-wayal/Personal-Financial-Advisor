import { generateText } from "./gemini";
import { getGoalOverview } from "./goals";
import { analyzeRiskAndVolatility } from "./RiskVolatilityService";

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

function extractJsonPayload(text: string) {
    const trimmed = text.trim();

    const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fencedMatch?.[1]) {
        return fencedMatch[1].trim();
    }

    const firstArray = trimmed.indexOf("[");
    const lastArray = trimmed.lastIndexOf("]");
    if (firstArray !== -1 && lastArray !== -1 && lastArray > firstArray) {
        return trimmed.slice(firstArray, lastArray + 1).trim();
    }

    const firstObject = trimmed.indexOf("{");
    const lastObject = trimmed.lastIndexOf("}");
    if (firstObject !== -1 && lastObject !== -1 && lastObject > firstObject) {
        return trimmed.slice(firstObject, lastObject + 1).trim();
    }

    return trimmed;
}

export async function generateAIRecommendations() {
    const overview = await getGoalOverview();

    // Get risk and volatility context
    let riskContext = "";
    try {
        const riskAnalysis = await analyzeRiskAndVolatility();
        const summary = riskAnalysis.summary;
        riskContext = `
SPENDING RISK PROFILE:
- Overall Volatility Score: ${summary.overallVolatilityScore.toFixed(1)}/100 (${summary.riskLevel})
- Predictability: ${summary.spendStability.predictable ? "Good - patterns are stable" : "Low - spending is unpredictable"}
- High Risk Categories: ${summary.highRiskCategories.join(", ") || "None"}
- Predicted Monthly Range: ${formatCurrency(summary.predictedSpendRange.min)} - ${formatCurrency(summary.predictedSpendRange.max)}
- Key Recommendations: ${summary.recommendations[0] || "Monitor spending patterns"}
        `;
    } catch (err) {
        console.error("Risk analysis unavailable:", err);
    }

    if (!overview.goals || overview.goals.length === 0) {
        return {
            recommendations: [{ text: "Create a goal to get started with financial planning." }],
            rationale: "No goals yet",
        };
    }

    // Build context for LLM
    const goalsContext = overview.goals
        .map((g) => {
            const daysLeft = g.eta?.months ? Math.round(g.eta.months * 30) : null;
            return `
- **${g.title}** (Priority: ${g.priority})
  - Target: ${formatCurrency(g.targetAmount)} | Current: ${formatCurrency(g.currentAmount)} | Progress: ${g.progressPct}%
  - Required Monthly: ${g.requiredMonthlyLabel}
  - Health: ${g.health} | Confidence: ${g.confidenceScore}%
  - ETA: ${g.eta?.eta ? new Date(g.eta.eta).toLocaleDateString() : "Unknown"}
  - Days Remaining: ${daysLeft || "N/A"}
        `;
        })
        .join("\n");

    const allocationContext = overview.allocation
        ? `
Optimized Allocation: ${overview.allocation.summary}
Utilization: ${overview.allocation.utilizationPct}%
Tradeoffs: ${overview.allocation.tradeoffs.slice(0, 3).join("; ")}`
        : "";

    const scenarioContext = overview.allocationScenarios?.length
        ? `
Scenario Snapshots: ${overview.allocationScenarios
            .map((scenario) => `${scenario.description} -> ${scenario.impacts.slice(0, 2).map((impact) => impact.summary).join(", ")}`)
            .join(" | ")}`
        : "";

    const capacityContext = `
Monthly Capacity: ${overview.monthlyCapacityLabel}
Total Required: ${overview.totalRecommendedMonthlyContributionLabel}
${overview.conflicts.length > 0 ? `Active Conflicts: ${overview.conflicts.map((c) => c.message).join("; ")}` : "No conflicts"}${allocationContext}${scenarioContext}
    `;

    const prompt = `You are a personal financial advisor. Analyze the following goals and financial risk profile, providing 3-5 specific, actionable recommendations.

GOALS:
${goalsContext}

CAPACITY:
${capacityContext}

RISK ANALYSIS:
${riskContext}

INSTRUCTIONS:
1. Prioritize by impact and feasibility
2. Address conflicts and volatility risks
3. Consider both goal acceleration AND spending stability
4. Each recommendation should have:
   - A specific action (e.g., "reduce spending in [category] by ₹X" or "budget for volatility in [category]")
   - Expected impact (e.g., "accelerates goal by Y days" or "reduces financial risk by X%")
   - Reasoning based on allocation, goals, and risk data

Format as JSON array:
[
  {
    "action": "...",
    "impact": "...",
    "priority": "high|medium|low",
    "reasoning": "..."
  }
]

Respond ONLY with valid JSON array, no markdown or extra text.`;

    try {
        const response = await generateText(prompt, { temperature: 0.3 });
        const parsed = JSON.parse(extractJsonPayload(response.text));

        return {
            recommendations: Array.isArray(parsed)
                ? parsed.map((r: any) => ({
                    text: `${r.action}. Expected impact: ${r.impact}`,
                    rationale: r.reasoning,
                    priority: r.priority,
                }))
                : [],
            rationale: "AI analysis based on your financial profile",
        };
    } catch (e) {
        console.error("AI recommendation error:", e);
        // Fallback to deterministic recommendations
        const recs = [];
        const overCapacity = overview.totalRecommendedMonthlyContribution - overview.monthlyCapacity;
        if (overCapacity > 0) {
            recs.push({
                text: `Increase monthly savings by ${formatCurrency(overCapacity)} to meet all goals`,
                rationale: "Current goals require more funding than available capacity",
                priority: "high",
            });
        }
        const atRiskGoals = overview.goals.filter((g) => g.health === "At Risk" || g.health === "Off Track");
        if (atRiskGoals.length > 0) {
            recs.push({
                text: `Prioritize ${atRiskGoals[0].title} by reducing discretionary spending`,
                rationale: `This goal is at risk; current savings pace is insufficient`,
                priority: "high",
            });
        }
        return { recommendations: recs.length > 0 ? recs : [{ text: "Goals are on track", rationale: "Your current savings pace supports your goals" }], rationale: "Data-driven fallback" };
    }
}
