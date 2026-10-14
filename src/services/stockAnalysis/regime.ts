/**
 * stockAnalysis/regime.ts — Market Regime Detection Engine.
 *
 * Classifies the broad market environment as BULLISH, NEUTRAL, BEARISH,
 * HIGH_VOLATILITY, or DATA_UNRELIABLE using a combination of:
 *   - Index price vs SMA50/SMA200
 *   - SMA slope direction
 *   - Recent realized volatility
 *   - Drawdown from recent highs
 *   - Market breadth (fraction of universe above SMA50)
 *
 * The regime determines which strategies are permitted and exposure caps.
 */

import type { MarketBar } from "../../types/stockIntelligence";
import type { MarketRegime } from "../../config/stockEngineDefaults";
import { MARKET_REGIME_CONFIG } from "../../config/stockEngineDefaults";
import { calcSMA, calcHistoricalVolatility, calcTrendSlope, calcMaxDrawdown } from "./indicators";
import { prisma } from "../../lib/prisma";

export type RegimeClassification = {
  regime: MarketRegime;
  confidence: number; // 0-100
  details: {
    indexAboveSMA50: boolean | null;
    indexAboveSMA200: boolean | null;
    sma50AboveSMA200: boolean | null;
    trendSlope: number | null;
    annualizedVolatility: number | null;
    drawdownFromPeak: number | null;
    breadthAboveSMA50: number | null;
  };
  reasons: string[];
};

/**
 * Classify market regime from index candles and optional universe breadth data.
 *
 * @param indexCandles  - Daily candles for the broad market index (e.g., Nifty 50)
 * @param universeBreadth - Optional: fraction of universe stocks above their SMA50 (0-1)
 */
export function classifyMarketRegime(
  indexCandles: MarketBar[],
  universeBreadth?: number | null,
): RegimeClassification {
  const reasons: string[] = [];

  // Insufficient data check
  if (indexCandles.length < MARKET_REGIME_CONFIG.minimumDataPoints) {
    return {
      regime: "DATA_UNRELIABLE",
      confidence: 100,
      details: {
        indexAboveSMA50: null,
        indexAboveSMA200: null,
        sma50AboveSMA200: null,
        trendSlope: null,
        annualizedVolatility: null,
        drawdownFromPeak: null,
        breadthAboveSMA50: null,
      },
      reasons: [`Insufficient index data: ${indexCandles.length} bars < ${MARKET_REGIME_CONFIG.minimumDataPoints} required`],
    };
  }

  const closes = indexCandles.map((c) => c.close);
  const currentPrice = closes[closes.length - 1];

  // Compute indicators
  const sma50Result = calcSMA(closes, MARKET_REGIME_CONFIG.sma.short);
  const sma200Result = calcSMA(closes, MARKET_REGIME_CONFIG.sma.long);
  const volatilityResult = calcHistoricalVolatility(closes, MARKET_REGIME_CONFIG.volatilityLookback);
  const slopeResult = calcTrendSlope(closes, 20);
  const drawdownResult = calcMaxDrawdown(closes, 60);

  const sma50 = sma50Result.available ? sma50Result.value : null;
  const sma200 = sma200Result.available ? sma200Result.value : null;
  const volatility = volatilityResult.available ? volatilityResult.value : null;
  const slope = slopeResult.available ? slopeResult.value : null;
  const drawdown = drawdownResult.available ? drawdownResult.value : null;

  const indexAboveSMA50 = sma50 != null ? currentPrice > sma50 : null;
  const indexAboveSMA200 = sma200 != null ? currentPrice > sma200 : null;
  const sma50AboveSMA200 = sma50 != null && sma200 != null ? sma50 > sma200 : null;

  // Scoring system: tally bullish and bearish evidence
  let bullishScore = 0;
  let bearishScore = 0;

  // Price vs SMA
  if (indexAboveSMA50 === true) { bullishScore += 2; reasons.push("Index above SMA50"); }
  else if (indexAboveSMA50 === false) { bearishScore += 2; reasons.push("Index below SMA50"); }

  if (indexAboveSMA200 === true) { bullishScore += 2; reasons.push("Index above SMA200"); }
  else if (indexAboveSMA200 === false) { bearishScore += 3; reasons.push("Index below SMA200"); }

  // Golden/Death cross
  if (sma50AboveSMA200 === true) { bullishScore += 1; reasons.push("SMA50 above SMA200 (golden cross territory)"); }
  else if (sma50AboveSMA200 === false) { bearishScore += 1; reasons.push("SMA50 below SMA200 (death cross territory)"); }

  // Trend slope
  if (slope != null) {
    if (slope > 0.5) { bullishScore += 1; reasons.push(`Positive trend slope: ${slope.toFixed(2)}%`); }
    else if (slope < -0.5) { bearishScore += 1; reasons.push(`Negative trend slope: ${slope.toFixed(2)}%`); }
  }

  // Drawdown
  if (drawdown != null) {
    if (drawdown > MARKET_REGIME_CONFIG.bearishDrawdownThreshold) {
      bearishScore += 2;
      reasons.push(`Recent drawdown ${drawdown.toFixed(1)}% exceeds ${MARKET_REGIME_CONFIG.bearishDrawdownThreshold}% threshold`);
    } else if (drawdown > MARKET_REGIME_CONFIG.bearishWarningThreshold) {
      bearishScore += 1;
      reasons.push(`Recent drawdown ${drawdown.toFixed(1)}% above warning level`);
    }
  }

  // Breadth
  if (universeBreadth != null) {
    if (universeBreadth >= MARKET_REGIME_CONFIG.bullishBreadthThreshold) {
      bullishScore += 1;
      reasons.push(`Market breadth ${(universeBreadth * 100).toFixed(0)}% above bullish threshold`);
    } else if (universeBreadth <= MARKET_REGIME_CONFIG.bearishBreadthThreshold) {
      bearishScore += 2;
      reasons.push(`Market breadth ${(universeBreadth * 100).toFixed(0)}% below bearish threshold`);
    }
  }

  // Check for HIGH_VOLATILITY override
  if (volatility != null && volatility > MARKET_REGIME_CONFIG.highVolatilityThreshold) {
    reasons.push(`Annualized volatility ${volatility.toFixed(1)}% exceeds ${MARKET_REGIME_CONFIG.highVolatilityThreshold}% threshold`);
    return {
      regime: "HIGH_VOLATILITY",
      confidence: Math.min(100, 60 + (volatility - MARKET_REGIME_CONFIG.highVolatilityThreshold) * 2),
      details: {
        indexAboveSMA50,
        indexAboveSMA200,
        sma50AboveSMA200,
        trendSlope: slope,
        annualizedVolatility: volatility,
        drawdownFromPeak: drawdown,
        breadthAboveSMA50: universeBreadth ?? null,
      },
      reasons,
    };
  }

  // Classify based on score balance
  let regime: MarketRegime;
  let confidence: number;

  const netScore = bullishScore - bearishScore;

  if (netScore >= 4) {
    regime = "BULLISH";
    confidence = Math.min(100, 50 + netScore * 5);
  } else if (netScore <= -4) {
    regime = "BEARISH";
    confidence = Math.min(100, 50 + Math.abs(netScore) * 5);
  } else {
    regime = "NEUTRAL";
    confidence = Math.max(30, 70 - Math.abs(netScore) * 10);
  }

  return {
    regime,
    confidence,
    details: {
      indexAboveSMA50,
      indexAboveSMA200,
      sma50AboveSMA200,
      trendSlope: slope,
      annualizedVolatility: volatility,
      drawdownFromPeak: drawdown,
      breadthAboveSMA50: universeBreadth ?? null,
    },
    reasons,
  };
}

/**
 * Calculate market breadth: fraction of stocks with price above their SMA50.
 */
export function calculateBreadth(
  stockData: Array<{ symbol: string; closes: number[] }>,
): number {
  let above = 0;
  let total = 0;

  for (const stock of stockData) {
    if (stock.closes.length < 50) continue;
    total++;
    const sma50 = calcSMA(stock.closes, 50);
    if (sma50.available && stock.closes[stock.closes.length - 1] > sma50.value) {
      above++;
    }
  }

  return total > 0 ? above / total : 0;
}

/**
 * Automatically fetch recent index bars and detect the current market regime.
 */
export async function detectMarketRegime(): Promise<MarketRegime> {
  const indexBars = await prisma.stockMarketBar.findMany({
    where: { symbol: { in: ["^NSEI", "NIFTY50", "NIFTY"] } },
    orderBy: { date: "asc" },
    take: 250,
  });

  if (indexBars.length < 50) {
    // If no direct index bars stored yet, sample from a large-cap benchmark stock
    const sampleBars = await prisma.stockMarketBar.findMany({
      where: { symbol: "RELIANCE" },
      orderBy: { date: "asc" },
      take: 250,
    });
    if (sampleBars.length < 50) return "NEUTRAL";
    const mapped: MarketBar[] = sampleBars.map((b) => ({
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
    return classifyMarketRegime(mapped).regime;
  }

  const mapped: MarketBar[] = indexBars.map((b) => ({
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

  return classifyMarketRegime(mapped).regime;
}
