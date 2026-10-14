/**
 * stockRecommendations/aiAdvisor.ts — AI Explanation Layer for Stock Recommendations.
 *
 * Uses Google Gemini to generate clear, executive, transparent rationale for
 * the deterministic signals produced by North Stock Intelligence.
 *
 * Rules:
 *   - The AI explains the deterministic decisions; it NEVER invents trades or overrides risk controls.
 *   - Never guarantee profits or promise risk-free returns.
 *   - Always highlight capital preservation and drawdown risk limits.
 *   - If Gemini is unreachable or API key is missing, gracefully return a deterministic summary.
 */

import { generateText } from "../gemini";
import type {
  Recommendation,
  CapitalAllocation,
  PortfolioRiskSnapshot,
} from "../../types/stockIntelligence";

export async function generateAiRecommendationExplanation(params: {
  marketRegime: string;
  financialPhase: string;
  capitalAllocation: CapitalAllocation;
  riskSnapshot: PortfolioRiskSnapshot;
  recommendations: Recommendation[];
}): Promise<string> {
  const buys = params.recommendations.filter((r) => r.type === "BUY");
  const sells = params.recommendations.filter((r) => r.type === "SELL");
  const holds = params.recommendations.filter((r) => r.type === "HOLD");

  const prompt = `
You are the North Stock Intelligence AI Advisor, a conservative quantitative equity analyst for Indian cash-equity delivery trading.
Review today's quantitative pipeline run and synthesize an executive briefing for the user.

CONTEXT:
- Macro Market Regime: ${params.marketRegime}
- Personal Financial Phase: ${params.financialPhase}
- Verified Deployable Trading Capital: ₹${params.capitalAllocation.eligibleNewPurchaseBudget.toLocaleString("en-IN")}
- Binding Constraint: ${params.capitalAllocation.bindingConstraint}
- Current Portfolio Drawdown: ${params.riskSnapshot.drawdownPct}% (Status: ${params.riskSnapshot.drawdownStatus}, Target Max: 5%)
- Open Positions: ${params.riskSnapshot.openPositionCount}

DETERMINISTIC RECOMMENDATIONS:
- BUY (${buys.length}):
${buys.map((b) => `  * ${b.symbol}: Strategy ${b.strategy}, Buy ${b.quantity} shares @ ₹${b.entryPrice.toFixed(2)}, Stop: ₹${b.stopLoss.toFixed(2)}, Target: ₹${b.targetPrice?.toFixed(2) ?? "N/A"}, Reasons: ${b.reasonsFor.join(", ")}`).join("\n") || "  None (Capital preservation or no qualifying setups)"}

- HOLD (${holds.length}):
${holds.map((h) => `  * ${h.symbol}: Qty ${h.quantity}, P&L ${h.unrealizedPnlPct > 0 ? "+" : ""}${h.unrealizedPnlPct}%, Stop: ₹${h.updatedStopLoss?.toFixed(2) ?? "N/A"}`).join("\n") || "  None"}

- SELL (${sells.length}):
${sells.map((s) => `  * ${s.symbol}: Qty ${s.sellQuantity}, Reason: ${s.reason}, Trigger: ${s.trigger}`).join("\n") || "  None"}

INSTRUCTIONS:
1. Provide a crisp, 2-3 paragraph executive summary explaining today's action plan.
2. Specifically explain why the trading budget is set to ₹${params.capitalAllocation.eligibleNewPurchaseBudget.toLocaleString("en-IN")} and why capital preservation is prioritized.
3. If 0 buys were generated, praise the discipline of avoiding low-probability setups.
4. If buys are present, emphasize the whole-share sizing, ATR stop loss, and exit conditions.
5. Strictly do NOT guarantee profits or promise returns.
`;

  const response = await generateText(prompt, {
    complexity: "simple",
    temperature: 0.2,
  });

  return response.text || generateFallbackExplanation(params);
}

function generateFallbackExplanation(params: {
  marketRegime: string;
  financialPhase: string;
  capitalAllocation: CapitalAllocation;
  recommendations: Recommendation[];
}): string {
  const buys = params.recommendations.filter((r) => r.type === "BUY");
  const sells = params.recommendations.filter((r) => r.type === "SELL");
  const holds = params.recommendations.filter((r) => r.type === "HOLD");

  return [
    `### North Stock Intelligence Briefing`,
    `**Macro Environment**: Market regime classified as **${params.marketRegime}** with financial phase **${params.financialPhase}**.`,
    `**Safe Capital Deployment**: Permitted new purchase budget is **₹${params.capitalAllocation.eligibleNewPurchaseBudget.toLocaleString("en-IN")}**, determined by **${params.capitalAllocation.bindingConstraint}**.`,
    `**Daily Action Summary**: Generated **${buys.length} Buy**, **${holds.length} Hold**, and **${sells.length} Sell** recommendations.`,
    buys.length === 0
      ? `*Capital Preservation Note: No candidate met the strict quantitative threshold in today's session. Capital remains safely preserved.*`
      : `*Execution Note: All buy recommendations are sized in whole shares with predetermined ATR stop-loss and profit target levels.*`,
  ].join("\n\n");
}
