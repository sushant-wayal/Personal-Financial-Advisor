/**
 * stockRecommendations/index.ts — Recommendation Generation Engine.
 *
 * Daily orchestration pipeline for North Stock Intelligence.
 * Answers the core daily questions:
 * 1. How much money can safely be deployed? (via stockRisk capital allocation)
 * 2. What is the current macro market regime? (via stockAnalysis regime)
 * 3. Which eligible Indian stocks offer attractive risk-adjusted setups? (via stockStrategy)
 * 4. Which stocks to BUY, HOLD, or SELL with whole-share quantities and stop/target levels?
 * 5. Explainable rationale with strict risk controls and zero-forced-trade rule.
 */

import { prisma } from "../../lib/prisma";
import {
  DEFAULT_UNIVERSE_SYMBOLS,
  DATA_FRESHNESS_CONFIG,
  STRATEGY_CONFIGS,
  RISK_CONFIG,
  getSector,
} from "../../config/stockEngineDefaults";
import type {
  RecommendationRun,
  Recommendation,
  BuyRecommendation,
  HoldRecommendation,
  SellRecommendation,
  MarketBar,
  StockIndicators,
  StockScore,
} from "../../types/stockIntelligence";
import { getDataProviderStatus, fetchUniverseData } from "../marketData";
import { detectMarketRegime } from "../stockAnalysis/regime";
import { computeIndicators } from "../stockAnalysis/indicators";
import { computeStockScore, screenUniverse } from "../stockAnalysis/scoring";
import {
  calculateCapitalAllocation,
  calculatePortfolioRiskSnapshot,
  calculatePositionSize,
} from "../stockRisk";
import {
  evaluateStockStrategies,
  selectBestBuySignal,
  evaluateExitRules,
} from "../stockStrategy";
import { generateAiRecommendationExplanation } from "./aiAdvisor";

/**
 * Run the daily Stock Intelligence recommendation pipeline.
 */
export async function generateDailyRecommendations(options?: {
  symbols?: string[];
  forceRerun?: boolean;
}): Promise<RecommendationRun> {
  const startTime = Date.now();
  const now = new Date();

  // Session date in IST (YYYY-MM-DD)
  const sessionDateStr = now.toLocaleDateString("en-CA", {
    timeZone: DATA_FRESHNESS_CONFIG.exchangeTimezone,
  });
  const sessionDateObj = new Date(sessionDateStr);

  // If already run for today and not forced, return cached run
  if (!options?.forceRerun) {
    const existingRun = await prisma.stockRecommendationRun.findUnique({
      where: { marketSessionDate: sessionDateObj },
      include: { items: true },
    });

    if (existingRun) {
      return formatPersistedRun(existingRun);
    }
  }

  const warnings: string[] = [];
  const rejections: Array<{ symbol: string; reason: string }> = [];

  // 1. Data Provider Health & Status
  const providerStatus = await getDataProviderStatus();
  if (!providerStatus.isHealthy) {
    warnings.push(`Market data provider reporting issues: ${providerStatus.lastError ?? "Unknown error"}`);
  }

  // 2. Market Regime Classification
  const marketRegime = await detectMarketRegime();

  // 3. Personal Finance Capital Allocation
  const capitalAllocation = await calculateCapitalAllocation(marketRegime);
  if (capitalAllocation.warnings.length > 0) {
    warnings.push(...capitalAllocation.warnings);
  }

  // 4. Portfolio Risk Snapshot
  const riskSnapshot = await calculatePortfolioRiskSnapshot();

  // 5. Stock Universe Screening
  const symbolsToAnalyze = options?.symbols ?? DEFAULT_UNIVERSE_SYMBOLS.slice(0, 30);

  // Auto-seed initial historical market bars if database is fresh
  const existingBarCount = await prisma.stockMarketBar.count();
  if (existingBarCount < 50) {
    try {
      await fetchUniverseData(symbolsToAnalyze.slice(0, 15), "NSE", 250);
    } catch (err) {
      warnings.push(`Initial market data auto-fetch encountered error: ${String(err)}`);
    }
  }

  const screeningResults = await screenUniverse(symbolsToAnalyze);

  const eligibleCandidates: Array<{
    symbol: string;
    bars: MarketBar[];
    indicators: StockIndicators;
    score: StockScore;
  }> = [];

  for (const screen of screeningResults) {
    if (screen.status === "INELIGIBLE") {
      rejections.push({
        symbol: screen.symbol,
        reason: screen.reasons.join("; "),
      });
      continue;
    }

    // Load recent bars for indicator calculation (last 200 days)
    const rawBars = await prisma.stockMarketBar.findMany({
      where: { symbol: screen.symbol },
      orderBy: { date: "asc" },
      take: 220,
    });

    if (rawBars.length < 50) {
      rejections.push({
        symbol: screen.symbol,
        reason: `Insufficient market bars (${rawBars.length}/50 minimum required)`,
      });
      continue;
    }

    const bars: MarketBar[] = rawBars.map((b) => ({
      symbol: b.symbol,
      exchange: b.exchange,
      date: b.date.toISOString().slice(0, 10),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      adjustedClose: b.adjustedClose,
      volume: b.volume,
      provider: b.provider,
      retrievedAt: b.retrievedAt,
      quality: b.quality as MarketBar["quality"],
    }));

    const indicators = computeIndicators(screen.symbol, bars);
    const score = computeStockScore(indicators, marketRegime, sessionDateStr);

    eligibleCandidates.push({
      symbol: screen.symbol,
      bars,
      indicators,
      score,
    });
  }

  // 6. Generate Candidate Buy Recommendations
  const buyRecommendations: BuyRecommendation[] = [];
  const canMakePurchases =
    capitalAllocation.eligibleNewPurchaseBudget > 0 &&
    riskSnapshot.drawdownStatus !== "HALTED" &&
    riskSnapshot.drawdownStatus !== "RESTRICTED" &&
    marketRegime !== "BEARISH" &&
    marketRegime !== "DATA_UNRELIABLE";

  if (!canMakePurchases) {
    warnings.push(
      `New purchases blocked by safety controls: ${capitalAllocation.bindingConstraint || `Regime is ${marketRegime}`}`,
    );
  } else {
    let remainingBudget = capitalAllocation.eligibleNewPurchaseBudget;

    for (const cand of eligibleCandidates) {
      if (remainingBudget <= 0) break;

      const latestBar = cand.bars[cand.bars.length - 1];
      const signals = evaluateStockStrategies(
        cand.symbol,
        cand.indicators,
        cand.score,
        latestBar,
        marketRegime,
      );

      const bestBuy = selectBestBuySignal(signals);
      if (!bestBuy || bestBuy.entryPrice === null || bestBuy.stopLoss === null) {
        continue;
      }

      // Check sector concentration
      const sector = getSector(cand.symbol);
      const sectorExposure = riskSnapshot.sectorConcentration[sector] ?? 0;

      // Calculate position sizing
      const sizing = calculatePositionSize(
        cand.symbol,
        bestBuy.entryPrice,
        bestBuy.stopLoss,
        remainingBudget,
        Math.max(10000, riskSnapshot.currentEquity),
        sectorExposure,
        riskSnapshot.openPositionCount + buyRecommendations.length,
      );

      if (sizing.finalQuantity <= 0 || sizing.rejectedReason !== null) {
        rejections.push({
          symbol: cand.symbol,
          reason: `Position size rejected: ${sizing.rejectedReason ?? "Zero whole-share quantity"}`,
        });
        continue;
      }

      const estimatedCapital = sizing.finalQuantity * bestBuy.entryPrice;
      remainingBudget -= (estimatedCapital + sizing.estimatedCosts);

      buyRecommendations.push({
        type: "BUY",
        symbol: cand.symbol,
        exchange: "NSE",
        timestamp: now,
        latestPrice: latestBar.close,
        latestPriceTimestamp: latestBar.retrievedAt,
        dataSource: latestBar.provider,
        strategy: bestBuy.strategy,
        strategyVersion: bestBuy.strategyVersion,
        score: cand.score,
        entryPrice: bestBuy.entryPrice,
        entryCondition: bestBuy.entryCondition,
        quantity: sizing.finalQuantity,
        estimatedCapital: Number(estimatedCapital.toFixed(2)),
        estimatedCosts: Number(sizing.estimatedCosts.toFixed(2)),
        stopLoss: bestBuy.stopLoss,
        targetPrice: bestBuy.targetPrice,
        trailingExitRules: `Trail stop to breakeven after +1.8x ATR gain. Hard exit below ₹${bestBuy.stopLoss.toFixed(2)}.`,
        expectedHoldingDays: bestBuy.expectedHoldingDays,
        riskRewardRatio: bestBuy.riskRewardRatio ?? 1.6,
        portfolioAllocationAfter: sizing.allocationPct,
        sectorExposureAfter: sizing.sectorExposurePct,
        reasonsFor: bestBuy.reasons,
        reasonsAgainst: bestBuy.contraReasons,
        uncertainties: [
          `Market regime currently ${marketRegime}`,
          `Overnight gap risk: max allowed slippage ${RISK_CONFIG.gapSlippagePct}%`,
        ],
        cancellationConditions: bestBuy.cancellationConditions,
        maxChasePrice: bestBuy.maxChasePrice ?? bestBuy.entryPrice * 1.015,
      });

      // Max 3 new recommendations per day to ensure high conviction
      if (buyRecommendations.length >= 3) break;
    }
  }

  // 7. Evaluate Existing Portfolio Holdings for HOLD / SELL
  const holdRecommendations: HoldRecommendation[] = [];
  const sellRecommendations: SellRecommendation[] = [];

  const existingStocks = await prisma.stock.findMany();
  for (const st of existingStocks) {
    if (st.currentQuantity <= 0) continue;

    // Load recent bar
    const latestBar = await prisma.stockMarketBar.findFirst({
      where: { symbol: st.symbol },
      orderBy: { date: "desc" },
    });

    const currentPrice = latestBar ? latestBar.close : (st.currentPrice ?? 100);
    const avgCost = st.currentPrice ?? currentPrice;
    const marketVal = currentPrice * st.currentQuantity;
    const unrealizedPnl = (currentPrice - avgCost) * st.currentQuantity;
    const unrealizedPct = avgCost > 0 ? ((currentPrice - avgCost) / avgCost) * 100 : 0;

    // Evaluate exit rules
    const exitEval = evaluateExitRules(
      st.symbol,
      avgCost,
      currentPrice,
      avgCost * 0.94, // 6% initial stop proxy
      avgCost * 1.08, // 8% initial target proxy
      5, // approximate holding days
      STRATEGY_CONFIGS.TREND_PULLBACK.maxHoldingDays,
      null,
      marketRegime,
    );

    if (exitEval.action === "SELL") {
      sellRecommendations.push({
        type: "SELL",
        symbol: st.symbol,
        exchange: st.exchange,
        timestamp: now,
        heldQuantity: Math.floor(st.currentQuantity),
        sellQuantity: Math.floor(st.currentQuantity),
        isFullExit: true,
        latestPrice: currentPrice,
        latestPriceTimestamp: latestBar?.retrievedAt ?? now,
        averageCost: avgCost,
        realizedPnlEstimate: Number(unrealizedPnl.toFixed(2)),
        reason: exitEval.reason,
        trigger: exitEval.trigger,
        estimatedCosts: Math.ceil(marketVal * 0.001 + 15.93),
        urgency: exitEval.urgency,
      });
    } else {
      holdRecommendations.push({
        type: "HOLD",
        symbol: st.symbol,
        exchange: st.exchange,
        timestamp: now,
        quantity: Math.floor(st.currentQuantity),
        averageCost: avgCost,
        latestPrice: currentPrice,
        latestPriceTimestamp: latestBar?.retrievedAt ?? now,
        marketValue: Number(marketVal.toFixed(2)),
        unrealizedPnl: Number(unrealizedPnl.toFixed(2)),
        unrealizedPnlPct: Number(unrealizedPct.toFixed(2)),
        portfolioAllocation: riskSnapshot.currentEquity > 0
          ? Number(((marketVal / riskSnapshot.currentEquity) * 100).toFixed(1))
          : 0,
        originalThesis: "Swing trading holding thesis intact",
        currentSignal: exitEval.trigger,
        updatedStopLoss: exitEval.updatedStopLoss ?? (avgCost * 0.94),
        exitConditions: [
          `Breach of stop level ₹${(exitEval.updatedStopLoss ?? avgCost * 0.94).toFixed(2)}`,
          `Macro market regime deterioration to BEARISH`,
        ],
        reasonsToHold: [exitEval.reason],
        conditionsToChange: ["Stop-loss hit", "Target price reached"],
      });
    }
  }

  const allRecommendations: Recommendation[] = [
    ...buyRecommendations,
    ...holdRecommendations,
    ...sellRecommendations,
  ];

  // 8. AI Advisor Explanation Enrichment (non-blocking)
  let aiExplanation: string | null = null;
  try {
    aiExplanation = await generateAiRecommendationExplanation({
      marketRegime,
      financialPhase: capitalAllocation.financialPhase,
      capitalAllocation,
      riskSnapshot,
      recommendations: allRecommendations,
    });
  } catch (err) {
    console.warn("[recommendations] AI explanation generator fallback:", err);
    aiExplanation = generateFallbackAiExplanation({
      marketRegime,
      capitalAllocation,
      recommendations: allRecommendations,
    });
  }

  // 9. Persist Recommendation Run in Prisma
  const pipelineDurationMs = Date.now() - startTime;
  const savedRun = await prisma.stockRecommendationRun.upsert({
    where: { marketSessionDate: sessionDateObj },
    update: {
      marketRegime,
      financialPhase: capitalAllocation.financialPhase,
      capitalAllocation: JSON.stringify(capitalAllocation),
      dataQuality: providerStatus.isHealthy ? "VALID" : "PARTIAL",
      strategyVersions: JSON.stringify({
        TREND_PULLBACK: STRATEGY_CONFIGS.TREND_PULLBACK.version,
        MOMENTUM: STRATEGY_CONFIGS.MOMENTUM.version,
        RELATIVE_STRENGTH: STRATEGY_CONFIGS.RELATIVE_STRENGTH.version,
      }),
      candidateCount: symbolsToAnalyze.length,
      eligibleCount: eligibleCandidates.length,
      rejections: JSON.stringify(rejections),
      warnings: JSON.stringify(warnings),
      aiExplanation,
      status: "COMPLETE",
      pipelineDurationMs,
    },
    create: {
      marketSessionDate: sessionDateObj,
      marketRegime,
      financialPhase: capitalAllocation.financialPhase,
      capitalAllocation: JSON.stringify(capitalAllocation),
      dataQuality: providerStatus.isHealthy ? "VALID" : "PARTIAL",
      strategyVersions: JSON.stringify({
        TREND_PULLBACK: STRATEGY_CONFIGS.TREND_PULLBACK.version,
        MOMENTUM: STRATEGY_CONFIGS.MOMENTUM.version,
        RELATIVE_STRENGTH: STRATEGY_CONFIGS.RELATIVE_STRENGTH.version,
      }),
      candidateCount: symbolsToAnalyze.length,
      eligibleCount: eligibleCandidates.length,
      rejections: JSON.stringify(rejections),
      warnings: JSON.stringify(warnings),
      aiExplanation,
      status: "COMPLETE",
      pipelineDurationMs,
    },
  });

  // Re-create items
  await prisma.stockRecommendationItem.deleteMany({
    where: { runId: savedRun.id },
  });

  for (const rec of allRecommendations) {
    await prisma.stockRecommendationItem.create({
      data: {
        runId: savedRun.id,
        symbol: rec.symbol,
        exchange: rec.exchange,
        type: rec.type,
        detail: JSON.stringify(rec),
      },
    });
  }

  return {
    id: savedRun.id,
    timestamp: now,
    marketSessionDate: sessionDateStr,
    marketRegime,
    financialPhase: capitalAllocation.financialPhase,
    capitalAllocation,
    dataQuality: providerStatus.isHealthy ? "VALID" : "PARTIAL",
    strategyVersions: {
      TREND_PULLBACK: STRATEGY_CONFIGS.TREND_PULLBACK.version,
      MOMENTUM: STRATEGY_CONFIGS.MOMENTUM.version,
      RELATIVE_STRENGTH: STRATEGY_CONFIGS.RELATIVE_STRENGTH.version,
    },
    recommendations: allRecommendations,
    candidateCount: symbolsToAnalyze.length,
    eligibleCount: eligibleCandidates.length,
    rejections,
    warnings,
    aiExplanation,
    status: "COMPLETE",
    pipelineDurationMs,
  };
}

/**
 * Format a persisted database run record to a domain RecommendationRun.
 */
function formatPersistedRun(record: {
  id: string;
  marketSessionDate: Date;
  marketRegime: string;
  financialPhase: string;
  capitalAllocation: string;
  dataQuality: string;
  strategyVersions: string;
  candidateCount: number;
  eligibleCount: number;
  rejections: string;
  warnings: string;
  aiExplanation: string | null;
  status: string;
  pipelineDurationMs: number;
  createdAt: Date;
  items: Array<{
    id: string;
    symbol: string;
    exchange: string;
    type: string;
    detail: string;
  }>;
}): RecommendationRun {
  const recommendations: Recommendation[] = record.items.map((item) => {
    try {
      return JSON.parse(item.detail) as Recommendation;
    } catch {
      return {
        type: item.type as "BUY" | "HOLD" | "SELL",
        symbol: item.symbol,
        exchange: item.exchange,
        timestamp: record.createdAt,
      } as unknown as Recommendation;
    }
  });

  return {
    id: record.id,
    timestamp: record.createdAt,
    marketSessionDate: record.marketSessionDate.toISOString().slice(0, 10),
    marketRegime: record.marketRegime as RecommendationRun["marketRegime"],
    financialPhase: record.financialPhase as RecommendationRun["financialPhase"],
    capitalAllocation: JSON.parse(record.capitalAllocation),
    dataQuality: record.dataQuality as RecommendationRun["dataQuality"],
    strategyVersions: JSON.parse(record.strategyVersions),
    recommendations,
    candidateCount: record.candidateCount,
    eligibleCount: record.eligibleCount,
    rejections: JSON.parse(record.rejections),
    warnings: JSON.parse(record.warnings),
    aiExplanation: record.aiExplanation,
    status: record.status as RecommendationRun["status"],
    pipelineDurationMs: record.pipelineDurationMs,
  };
}

/**
 * Deterministic briefing fallback when AI model is unreachable.
 */
function generateFallbackAiExplanation(params: {
  marketRegime: string;
  capitalAllocation: { eligibleNewPurchaseBudget: number; bindingConstraint: string };
  recommendations: Recommendation[];
}): string {
  const buys = params.recommendations.filter((r) => r.type === "BUY");
  const sells = params.recommendations.filter((r) => r.type === "SELL");
  const holds = params.recommendations.filter((r) => r.type === "HOLD");

  return [
    `### North Stock Intelligence Briefing`,
    `**Market Regime**: ${params.marketRegime}`,
    `**Eligible Trading Capital**: ₹${params.capitalAllocation.eligibleNewPurchaseBudget.toLocaleString("en-IN")} (${params.capitalAllocation.bindingConstraint})`,
    `**Actions**: ${buys.length} Buy, ${holds.length} Hold, ${sells.length} Sell recommendations generated today.`,
    buys.length === 0
      ? `*Note: Capital preservation active — zero purchases forced when setups do not meet conservative criteria.*`
      : `*All recommendations include whole-share sizing, ATR stop-loss limits, and strict profit targets.*`,
  ].join("\n\n");
}
