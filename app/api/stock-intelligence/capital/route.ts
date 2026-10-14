import { NextResponse } from "next/server";
import { calculateCapitalAllocation, calculatePortfolioRiskSnapshot } from "../../../../src/services/stockRisk";
import { detectMarketRegime } from "../../../../src/services/stockAnalysis/regime";

export async function GET() {
  try {
    const marketRegime = await detectMarketRegime();
    const capitalAllocation = await calculateCapitalAllocation(marketRegime);
    const riskSnapshot = await calculatePortfolioRiskSnapshot();

    return NextResponse.json({
      ok: true,
      capitalAllocation,
      riskSnapshot,
      marketRegime,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to calculate capital allocation";
    console.error("[api/stock-intelligence/capital] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
