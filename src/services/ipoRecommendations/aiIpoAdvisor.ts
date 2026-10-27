/**
 * ipoRecommendations/aiIpoAdvisor.ts — AI Prospectus & Risk Explanation Layer.
 *
 * Uses Gemini to generate explainable, institutional-grade rationale for
 * the deterministic IPO recommendations and Best Pick selection.
 */

import { generateText } from "../gemini";
import type { IpoRecommendationItemData } from "../ipoData/types";

export async function generateAiIpoBriefing(params: {
  marketRegime: string;
  financialPhase: string;
  deployableCapital: number;
  bestPick: IpoRecommendationItemData | null;
  openIpos: IpoRecommendationItemData[];
}): Promise<string> {
  if (!params.bestPick) {
    return generateFallbackIpoBriefing(params);
  }

  const prompt = `
You are the North IPO Intelligence AI Advisor, an institutional equity analyst covering the Indian primary IPO market.
Analyze today's open IPO opportunities and provide an executive, balanced investor briefing.

CONTEXT:
- Macro Market Regime: ${params.marketRegime}
- User's Financial Phase: ${params.financialPhase}
- Deployable Cash Surplus: ₹${params.deployableCapital.toLocaleString("en-IN")}
- Available Open IPOs Today: ${params.openIpos.length}

TOP SELECTED RECOMMENDATION:
- Company: ${params.bestPick.companyName} (${params.bestPick.symbol})
- Verdict: ${params.bestPick.verdict}
- Composite Score: ${params.bestPick.score.totalScore}/100
- Strategy: ${params.bestPick.strategy}
- Expected Listing Pop: +${params.bestPick.expectedListingGain.toFixed(1)}%
- Grey Market Premium (GMP): ₹${params.bestPick.gmpAmount} (${params.bestPick.gmpPercent.toFixed(1)}%, Trend: ${params.bestPick.gmpTrend})
- Subscription Multiples: QIB ${params.bestPick.qibSub}x | NII ${params.bestPick.niiSub}x | Retail ${params.bestPick.retailSub}x | Total ${params.bestPick.totalSub}x
- Minimum Investment for 1 Lot: ₹${params.bestPick.minInvestment.toLocaleString("en-IN")} (Lot Size: ${params.bestPick.lotSize} shares @ Cut-off ₹${params.bestPick.priceCap})

OTHER OPEN IPOS CONSIDERED:
${params.openIpos
  .filter((i) => i.symbol !== params.bestPick?.symbol)
  .map(
    (i) =>
      `- ${i.companyName} (${i.symbol}): Score ${i.score.totalScore}/100, Verdict ${i.verdict}, GMP +${i.gmpPercent.toFixed(1)}%, Total Sub ${i.totalSub}x`,
  )
  .join("\n") || "None (Single open issue)"}

INSTRUCTIONS:
1. Provide a sharp 2-paragraph executive synthesis explaining why ${params.bestPick.companyName} is the undisputed best pick to apply to today.
2. Address the Bidding Strategy: explain why retail investors should bid exactly at the Cut-Off price (₹${params.bestPick.priceCap}) for 1 Lot per PAN under SEBI allotment rules.
3. Highlight key prospectus risks or valuation caveats (e.g. OFS component, working capital, peer comparisons).
4. Strictly do NOT guarantee profits or promise risk-free allotment.
`;

  try {
    const res = await generateText(prompt, {
      complexity: "simple",
      temperature: 0.2,
    });
    return res.text?.trim() || generateFallbackIpoBriefing(params);
  } catch (err) {
    console.warn("[aiIpoAdvisor] Gemini fallback triggered:", err);
    return generateFallbackIpoBriefing(params);
  }
}

export function generateFallbackIpoBriefing(params: {
  marketRegime: string;
  bestPick: IpoRecommendationItemData | null;
  openIpos: IpoRecommendationItemData[];
  deployableCapital: number;
}): string {
  if (!params.bestPick) {
    return `### Market Overview: No Qualifying Issues Today\n\nThere are currently no open Indian IPOs that satisfy North's conservative risk-reward hurdle (minimum 60/100 score). Preserving liquidity is recommended until attractive issues with strong institutional backing open for bidding.`;
  }

  const { bestPick } = params;
  return `### Executive Briefing: ${bestPick.companyName} (${bestPick.symbol})

**Top Recommendation**: ${bestPick.companyName} emerges as today's highest-conviction application candidate with a composite score of **${bestPick.score.totalScore}/100** and a **${bestPick.verdict.replace(/_/g, " ")}** rating.

- **Listing Sentiment**: Trading at an estimated Grey Market Premium of **₹${bestPick.gmpAmount} (+${bestPick.gmpPercent.toFixed(1)}%)** with a **${bestPick.gmpTrend.toLowerCase()}** trajectory.
- **Institutional Traction**: Supported by robust institutional participation (${bestPick.qibSub}x QIB subscription) and ${bestPick.totalSub}x total demand.
- **Application Strategy**: Recommended application of **1 Lot (${bestPick.lotSize} shares @ ₹${bestPick.priceCap} cut-off = ₹${bestPick.minInvestment.toLocaleString("en-IN")})**. Retail allotment in oversubscribed issues is lottery-based per unique PAN; applying for 1 lot optimizes capital efficiency.`;
}
