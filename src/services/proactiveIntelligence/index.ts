/**
 * proactiveIntelligence/index.ts — Master Proactive Financial Intelligence Orchestrator.
 *
 * Orchestrates all 3 underlying engines proactively in the background:
 * 1. Mutual Funds & Monthly Stock Credit: getOrGenerateInvestmentSuggestion()
 * 2. Daily Swing Stocks: generateDailyRecommendations({ forceRerun: true })
 * 3. Daily IPOs: generateDailyIpoRecommendations({ forceRerun: true })
 *
 * Evaluates actionable suggestions and directly dispatches notifications to the user
 * (WITHOUT saving notifications in the database).
 */

import { getOrGenerateInvestmentSuggestion } from "../investmentEngine";
import { generateDailyRecommendations } from "../stockRecommendations";
import { generateDailyIpoRecommendations } from "../ipoRecommendations";
import { fetchUniverseData, isStockTradingDay } from "../marketData";
import { DEFAULT_UNIVERSE_SYMBOLS } from "../../config/stockEngineDefaults";
import { dispatchDirectNotification } from "./notifier";
import type { ActionableIntelligenceReport } from "./types";

export async function runDailyProactiveIntelligence(options?: {
  forceNotify?: boolean;
}): Promise<ActionableIntelligenceReport> {
  const startTime = Date.now();
  console.info("[proactiveIntelligence] 🌅 Starting master daily pre-computation pipeline...");

  // 1 & 2. Stock Intelligence (only executes on open stock market trading days)
  const tradingDayCheck = isStockTradingDay();
  let stockRun: any = null;
  let stockBuys: any[] = [];
  let stockSells: any[] = [];

  if (tradingDayCheck.isTradingDay) {
    try {
      const symbols = DEFAULT_UNIVERSE_SYMBOLS.slice(0, 30);
      await fetchUniverseData(symbols, "NSE", 250);
    } catch (err) {
      console.warn("[proactiveIntelligence] Market data sync notice:", err);
    }

    stockRun = await generateDailyRecommendations();
    stockBuys = stockRun.recommendations.filter((r: any) => r.type === "BUY");
    stockSells = stockRun.recommendations.filter((r: any) => r.type === "SELL");
  } else {
    console.info(`[proactiveIntelligence] Stock market closed today (${tradingDayCheck.reason}). Skipping stock pre-computation.`);
  }

  // 3. Pre-calculate IPO Intelligence Recommendations (obeys daily session run)
  const ipoRun = await generateDailyIpoRecommendations();
  const bestIpo = ipoRun.bestPick;

  // 4. Pre-calculate / Refresh Monthly Investment Suggestion & Stock Credit Pool
  let monthlySuggestionResult: any = null;
  try {
    monthlySuggestionResult = await getOrGenerateInvestmentSuggestion();
  } catch (err) {
    console.warn("[proactiveIntelligence] Investment engine cycle notice:", err);
  }

  // 5. Actionable Decision Analysis
  const hasStockAction = stockBuys.length > 0 || stockSells.length > 0;
  const hasIpoAction = bestIpo !== null && bestIpo.score.totalScore >= 60;
  
  // Check if a new monthly suggestion was generated in the last 24 hours
  const suggestionRecord = monthlySuggestionResult?.suggestion;
  const isFreshMonthlySuggestion = suggestionRecord
    ? Date.now() - new Date(suggestionRecord.createdAt).getTime() < 24 * 60 * 60 * 1000
    : false;
  const hasMonthlyMfAction = isFreshMonthlySuggestion && (suggestionRecord?.totalInvestable ?? 0) > 0;

  // Extract highlights
  const stockHighlights = stockBuys.map((b) => `${b.symbol} (${b.quantity} sh @ ₹${b.entryPrice.toFixed(0)})`);

  let notificationTitle = "";
  let notificationBody = "";
  let notificationRoute = "/";
  let shouldNotify = options?.forceNotify || false;

  // Formulate direct notification
  if (hasStockAction && hasIpoAction) {
    shouldNotify = true;
    notificationTitle = "☀️ North Morning Intel: Action Items for Today";
    notificationBody = `IPO: Apply for ${bestIpo.companyName} (+${bestIpo.gmpPercent.toFixed(0)}% expected gain). Stocks: ${stockBuys.length} swing setup${stockBuys.length > 1 ? "s" : ""} sized from your monthly credit.`;
    notificationRoute = "/stock-intelligence";
  } else if (hasIpoAction) {
    shouldNotify = true;
    notificationTitle = `🚀 IPO Alert: ${bestIpo.companyName} Open Today`;
    notificationBody = `Ranked #1 Best Pick (+${bestIpo.gmpPercent.toFixed(0)}% expected listing gain, ${bestIpo.qibSub}x QIB demand). Recommended: 1 Lot @ ₹${bestIpo.priceCap} cut-off.`;
    notificationRoute = "/ipo-intelligence";
  } else if (hasStockAction) {
    shouldNotify = true;
    notificationTitle = `🎯 Stock Alert: ${stockBuys.length} Swing Setup${stockBuys.length > 1 ? "s" : ""} Ready`;
    notificationBody = `${stockHighlights.join(", ")} sized within your monthly trading credit with ATR stop-losses.`;
    notificationRoute = "/stock-intelligence";
  } else if (hasMonthlyMfAction) {
    shouldNotify = true;
    const mfAmt = Math.round(suggestionRecord.totalInvestable).toLocaleString("en-IN");
    const stockCredit = Math.round(suggestionRecord.totalStockInvestable ?? 0).toLocaleString("en-IN");
    notificationTitle = "💼 Monthly Investment Plan Ready";
    notificationBody = `Monthly surplus provisioned: ₹${mfAmt} for Mutual Funds (Nifty 50, Next 50, Midcap) and ₹${stockCredit} Stock Credit for this cycle.`;
    notificationRoute = "/investments";
  }

  // 6. Direct Dispatch (No DB Storage)
  let notificationDispatched = false;
  if (shouldNotify && notificationTitle && notificationBody) {
    notificationDispatched = await dispatchDirectNotification({
      title: notificationTitle,
      body: notificationBody,
      route: notificationRoute,
      metadata: {
        stockBuyCount: stockBuys.length,
        bestIpoSymbol: bestIpo?.symbol,
      },
    });
  }

  const durationMs = Date.now() - startTime;
  console.info(`[proactiveIntelligence] ✅ Pre-computation complete in ${durationMs}ms. Notification dispatched: ${notificationDispatched}`);

  return {
    sessionDate: ipoRun.sessionDate,
    hasStockAction,
    stockBuyCount: stockBuys.length,
    stockSellCount: stockSells.length,
    stockHighlights,
    hasIpoAction,
    bestIpoSymbol: bestIpo?.symbol ?? null,
    bestIpoExpectedGain: bestIpo?.gmpPercent ?? null,
    bestIpoVerdict: bestIpo?.verdict ?? null,
    hasMonthlyMfAction,
    monthlyInvestableTotal: suggestionRecord?.totalInvestable ?? null,
    monthlyStockCredit: suggestionRecord?.totalStockInvestable ?? null,
    notificationDispatched,
    notificationTitle: shouldNotify ? notificationTitle : undefined,
    notificationBody: shouldNotify ? notificationBody : undefined,
    notificationRoute: shouldNotify ? notificationRoute : undefined,
  };
}
