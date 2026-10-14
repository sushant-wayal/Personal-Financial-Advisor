import { NextRequest, NextResponse } from "next/server";
import { fetchUniverseData } from "../../../../src/services/marketData";
import { generateDailyRecommendations } from "../../../../src/services/stockRecommendations";
import { syncPaperPortfolioWithMarketBars } from "../../../../src/services/paperTrading";
import { DEFAULT_UNIVERSE_SYMBOLS } from "../../../../src/config/stockEngineDefaults";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Verify Vercel Cron Secret if configured
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const isDev = process.env.NODE_ENV === "development";
      if (!isDev) {
        return NextResponse.json({ ok: false, error: "Unauthorized cron request" }, { status: 401 });
      }
    }

    console.info("[cron] Starting North Stock Intelligence daily pipeline...");

    // 1. Ingest/sync latest daily candles for top universe stocks (₹0 budget Yahoo Finance)
    const symbols = DEFAULT_UNIVERSE_SYMBOLS.slice(0, 30);
    const syncResult = await fetchUniverseData(symbols, "NSE", 250);
    console.info(`[cron] Market data synced: ${syncResult.successCount} symbols updated.`);

    // 2. Generate daily Buy, Hold, and Sell recommendations
    const run = await generateDailyRecommendations({ forceRerun: true });
    console.info(`[cron] Recommendations generated for ${run.marketSessionDate}: ${run.recommendations.length} total signals.`);

    // 3. Mark to market open paper trades
    const paperPortfolio = await syncPaperPortfolioWithMarketBars();
    console.info(`[cron] Paper portfolio synced. Active equity: ₹${paperPortfolio.totalEquity}.`);

    return NextResponse.json({
      ok: true,
      sessionDate: run.marketSessionDate,
      marketRegime: run.marketRegime,
      recommendationsCount: run.recommendations.length,
      symbolsUpdated: syncResult.successCount,
      paperEquity: paperPortfolio.totalEquity,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Cron execution failed";
    console.error("[cron/stock-intelligence] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
