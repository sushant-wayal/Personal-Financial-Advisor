/**
 * stockAnalysis/scoring.ts — Stock Scoring and Ranking Engine.
 *
 * Produces a deterministic composite score (0-100) for each stock based on:
 *   - Trend quality (25%)
 *   - Momentum (20%)
 *   - Market & sector strength (20%)
 *   - Fundamental quality (15%) — marked incomplete when data unavailable
 *   - Risk & liquidity quality (20%)
 *
 * Scores are normalized and combined with configurable weights.
 * Missing indicators reduce the overall confidence score.
 */

import type { StockIndicators, StockScore, ScoreComponent, EligibilityResult } from "../../types/stockIntelligence";
import type { MarketRegime } from "../../config/stockEngineDefaults";
import { SCORING_WEIGHTS } from "../../config/stockEngineDefaults";
import { clamp } from "../shared/math";
import { prisma } from "../../lib/prisma";

// ─── Normalization Helpers ───────────────────────────────────────────────────

/**
 * Normalize a value to 0-100 range using min-max bounds.
 * Values outside bounds are clamped.
 */
function normalize(value: number, min: number, max: number): number {
  if (max <= min) return 50;
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

/**
 * Invert a normalized score (high raw = low score, e.g., volatility).
 */
function invertNormalize(value: number, min: number, max: number): number {
  return 100 - normalize(value, min, max);
}

// ─── Component Scoring Functions ─────────────────────────────────────────────

function scoreTrendQuality(indicators: StockIndicators): ScoreComponent {
  const weight = SCORING_WEIGHTS.trendQuality;
  let score = 0;
  let components = 0;
  let available = false;

  // SMA20 above SMA50 (short-term trend confirmation)
  if (indicators.sma20.available && indicators.sma50.available) {
    const shortBullish = indicators.sma20.value > indicators.sma50.value;
    score += shortBullish ? 70 : 30;
    components++;
    available = true;
  }

  // SMA50 above SMA200 (golden cross)
  if (indicators.sma50.available && indicators.sma200.available) {
    const golden = indicators.sma50.value > indicators.sma200.value;
    score += golden ? 70 : 20;
    components++;
    available = true;
  }

  // Trend slope
  if (indicators.trendSlope.available) {
    // Slope of -5% to +5%, map to 0-100
    score += normalize(indicators.trendSlope.value, -5, 5);
    components++;
    available = true;
  }

  // Distance from 52-week high (closer = stronger trend)
  if (indicators.distanceFromHigh.available) {
    // 0% from high = 100, -30% from high = 0
    score += normalize(indicators.distanceFromHigh.value, -30, 0);
    components++;
    available = true;
  }

  const rawValue = components > 0 ? score / components : 0;
  const normalizedValue = clamp(rawValue, 0, 100);

  return {
    name: "trendQuality",
    rawValue,
    normalizedValue,
    weight,
    weightedScore: normalizedValue * weight,
    available,
  };
}

function scoreMomentum(indicators: StockIndicators): ScoreComponent {
  const weight = SCORING_WEIGHTS.momentum;
  let score = 0;
  let components = 0;
  let available = false;

  // RSI in sweet spot (40-70 = good momentum without being overbought)
  if (indicators.rsi14.available) {
    const rsi = indicators.rsi14.value;
    if (rsi >= 40 && rsi <= 70) {
      score += normalize(rsi, 40, 70);
    } else if (rsi > 70) {
      score += invertNormalize(rsi, 70, 90); // Overbought penalty
    } else {
      score += normalize(rsi, 20, 40) * 0.5; // Weak momentum
    }
    components++;
    available = true;
  }

  // MACD histogram positive
  if (indicators.macd.available) {
    const hist = indicators.macd.histogram;
    score += normalize(hist, -2, 2);
    components++;
    available = true;
  }

  // 20-day returns
  if (indicators.returns20d.available) {
    score += normalize(indicators.returns20d.value, -10, 15);
    components++;
    available = true;
  }

  // Volume confirmation
  if (indicators.volumeRatio.available) {
    // Volume ratio 0.5-2.0, higher during uptrend = better
    score += normalize(indicators.volumeRatio.value, 0.5, 2.0);
    components++;
    available = true;
  }

  const rawValue = components > 0 ? score / components : 0;
  const normalizedValue = clamp(rawValue, 0, 100);

  return {
    name: "momentum",
    rawValue,
    normalizedValue,
    weight,
    weightedScore: normalizedValue * weight,
    available,
  };
}

function scoreMarketSectorStrength(
  indicators: StockIndicators,
  _marketRegime: MarketRegime,
): ScoreComponent {
  const weight = SCORING_WEIGHTS.marketSectorStrength;
  let score = 0;
  let components = 0;
  let available = false;

  // Relative strength vs benchmark
  if (indicators.relativeStrength.available) {
    score += normalize(indicators.relativeStrength.value, -15, 15);
    components++;
    available = true;
  }

  // 60-day returns (longer-term sector/stock momentum)
  if (indicators.returns60d.available) {
    score += normalize(indicators.returns60d.value, -20, 25);
    components++;
    available = true;
  }

  const rawValue = components > 0 ? score / components : 0;
  const normalizedValue = clamp(rawValue, 0, 100);

  return {
    name: "marketSectorStrength",
    rawValue,
    normalizedValue,
    weight,
    weightedScore: normalizedValue * weight,
    available,
  };
}

function scoreFundamentalQuality(_indicators: StockIndicators): ScoreComponent {
  const weight = SCORING_WEIGHTS.fundamentalQuality;

  // Fundamental data not available with free market data sources.
  // Mark as unavailable and use neutral score (50).
  return {
    name: "fundamentalQuality",
    rawValue: 50,
    normalizedValue: 50,
    weight,
    weightedScore: 50 * weight,
    available: false, // Explicitly flagged as unavailable
  };
}

function scoreRiskLiquidity(indicators: StockIndicators): ScoreComponent {
  const weight = SCORING_WEIGHTS.riskLiquidity;
  let score = 0;
  let components = 0;
  let available = false;

  // Lower volatility = higher score (for conservative strategy)
  if (indicators.historicalVolatility.available) {
    // 10% vol = great, 50% vol = bad
    score += invertNormalize(indicators.historicalVolatility.value, 10, 50);
    components++;
    available = true;
  }

  // Lower max drawdown = higher score
  if (indicators.maxDrawdown60d.available) {
    score += invertNormalize(indicators.maxDrawdown60d.value, 0, 20);
    components++;
    available = true;
  }

  // Higher average turnover = better liquidity
  if (indicators.avgTurnover.available) {
    // ₹10Cr+ turnover = great, <₹1Cr = poor
    score += normalize(indicators.avgTurnover.value, 1_00_00_000, 10_00_00_000);
    components++;
    available = true;
  }

  // Lower gap risk = higher score
  if (indicators.maxGap.available) {
    score += invertNormalize(indicators.maxGap.value, 0, 10);
    components++;
    available = true;
  }

  const rawValue = components > 0 ? score / components : 0;
  const normalizedValue = clamp(rawValue, 0, 100);

  return {
    name: "riskLiquidity",
    rawValue,
    normalizedValue,
    weight,
    weightedScore: normalizedValue * weight,
    available,
  };
}

// ─── Main Scoring Function ───────────────────────────────────────────────────

/**
 * Compute the composite stock score from indicators.
 */
export function scoreStock(
  indicators: StockIndicators,
  marketRegime: MarketRegime = "NEUTRAL",
  date?: string,
): StockScore {
  const trendQuality = scoreTrendQuality(indicators);
  const momentum = scoreMomentum(indicators);
  const marketSectorStrength = scoreMarketSectorStrength(indicators, marketRegime);
  const fundamentalQuality = scoreFundamentalQuality(indicators);
  const riskLiquidity = scoreRiskLiquidity(indicators);

  const effectiveDate = date || indicators.date || new Date().toISOString().slice(0, 10);

  const components = { trendQuality, momentum, marketSectorStrength, fundamentalQuality, riskLiquidity };

  // Calculate total weighted score
  const totalScore = trendQuality.weightedScore +
    momentum.weightedScore +
    marketSectorStrength.weightedScore +
    fundamentalQuality.weightedScore +
    riskLiquidity.weightedScore;

  // Data quality score: penalize for missing indicators
  const allComponents = [trendQuality, momentum, marketSectorStrength, fundamentalQuality, riskLiquidity];
  const availableCount = allComponents.filter((c) => c.available).length;
  const dataQualityScore = (availableCount / allComponents.length) * 100;

  // Overall confidence: affected by data quality and individual component confidence
  const overallConfidence = dataQualityScore * 0.8 + (fundamentalQuality.available ? 20 : 0);

  return {
    symbol: indicators.symbol,
    date: effectiveDate,
    totalScore: Math.round(clamp(totalScore, 0, 100)),
    components,
    dataQualityScore: Math.round(dataQualityScore),
    overallConfidence: Math.round(clamp(overallConfidence, 0, 100)),
  };
}

/**
 * Screen an array of universe symbols against minimum liquidity and data completeness criteria.
 */
export async function screenUniverse(symbols: string[]): Promise<EligibilityResult[]> {
  const results: EligibilityResult[] = [];

  for (const sym of symbols) {
    const bars = await prisma.stockMarketBar.findMany({
      where: { symbol: sym },
      orderBy: { date: "desc" },
      take: 60,
      select: { volume: true, close: true, date: true, quality: true },
    });

    const reasons: string[] = [];
    const historyDays = bars.length;

    if (historyDays < 20) {
      reasons.push(`Insufficient history: ${historyDays} days recorded (< 20 minimum)`);
    }

    const validBars = bars.filter((b) => b.quality === "VALID");
    const dataCompleteness = historyDays > 0 ? validBars.length / historyDays : 0;
    if (dataCompleteness < 0.8) {
      reasons.push(`Low data completeness: ${(dataCompleteness * 100).toFixed(0)}% valid candles`);
    }

    const avgVolume = historyDays > 0
      ? bars.reduce((acc, b) => acc + b.volume, 0) / historyDays
      : 0;

    if (avgVolume < 25_000) {
      reasons.push(`Liquidity below minimum threshold: avg volume ${Math.round(avgVolume)} shares`);
    }

    results.push({
      symbol: sym,
      status: reasons.length === 0 ? "ELIGIBLE" : "INELIGIBLE",
      reasons,
      dataCompleteness,
      avgVolume: Math.round(avgVolume),
      historyDays,
    });
  }

  return results;
}

export { scoreStock as computeStockScore };
