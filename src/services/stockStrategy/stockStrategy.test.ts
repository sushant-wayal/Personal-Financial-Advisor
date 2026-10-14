import { describe, it, expect } from "vitest";
import {
  evaluateTrendPullbackStrategy,
  evaluateMomentumStrategy,
  evaluateRelativeStrengthStrategy,
  evaluateExitRules,
  selectBestBuySignal,
} from "./index";
import type {
  StockIndicators,
  StockScore,
  MarketBar,
  StrategySignal,
} from "../../types/stockIntelligence";

function createMockIndicators(overrides?: Partial<StockIndicators>): StockIndicators {
  return {
    symbol: "RELIANCE",
    date: "2026-10-14",
    sma20: { value: 2500, available: true, warmupComplete: true },
    sma50: { value: 2450, available: true, warmupComplete: true },
    sma200: { value: 2300, available: true, warmupComplete: true },
    ema20: { value: 2510, available: true, warmupComplete: true },
    ema50: { value: 2460, available: true, warmupComplete: true },
    rsi14: { value: 48, available: true, warmupComplete: true },
    macd: { macdLine: 12, signalLine: 8, histogram: 4, available: true },
    atr14: { value: 35, available: true, warmupComplete: true },
    historicalVolatility: { value: 18, available: true, warmupComplete: true },
    returns5d: { value: 1.2, available: true, warmupComplete: true },
    returns10d: { value: 2.5, available: true, warmupComplete: true },
    returns20d: { value: 4.8, available: true, warmupComplete: true },
    returns60d: { value: 8.5, available: true, warmupComplete: true },
    relativeStrength: { value: 1.08, available: true, warmupComplete: true },
    volumeRatio: { value: 1.25, available: true, warmupComplete: true },
    trendSlope: { value: 1.5, available: true, warmupComplete: true },
    distanceFromHigh: { value: -4.5, available: true, warmupComplete: true },
    distanceFromLow: { value: 22.0, available: true, warmupComplete: true },
    maxDrawdown60d: { value: 6.2, available: true, warmupComplete: true },
    avgTurnover: { value: 50_00_000, available: true, warmupComplete: true },
    maxGap: { value: 2.1, available: true, warmupComplete: true },
    ...overrides,
  };
}

function createMockScore(totalScore = 75): StockScore {
  return {
    symbol: "RELIANCE",
    date: "2026-10-14",
    totalScore,
    components: {
      trendQuality: { name: "trendQuality", rawValue: 70, normalizedValue: 70, weight: 0.25, weightedScore: 17.5, available: true },
      momentum: { name: "momentum", rawValue: 75, normalizedValue: 75, weight: 0.20, weightedScore: 15.0, available: true },
      marketSectorStrength: { name: "marketSectorStrength", rawValue: 70, normalizedValue: 70, weight: 0.20, weightedScore: 14.0, available: true },
      fundamentalQuality: { name: "fundamentalQuality", rawValue: 80, normalizedValue: 80, weight: 0.15, weightedScore: 12.0, available: true },
      riskLiquidity: { name: "riskLiquidity", rawValue: 85, normalizedValue: 85, weight: 0.20, weightedScore: 17.0, available: true },
    },
    dataQualityScore: 100,
    overallConfidence: 85,
  };
}

function createMockBar(close = 2520): MarketBar {
  return {
    symbol: "RELIANCE",
    exchange: "NSE",
    date: "2026-10-14",
    open: 2505,
    high: 2535,
    low: 2495,
    close,
    adjustedClose: close,
    volume: 1_200_000,
    provider: "YAHOO",
    retrievedAt: new Date(),
    quality: "VALID",
  };
}

describe("stockStrategy — Quantitative Swing Trading Rules", () => {
  it("TREND_PULLBACK triggers BUY when in strong uptrend and healthy RSI pullback", () => {
    const indicators = createMockIndicators();
    const score = createMockScore(75);
    const bar = createMockBar(2520);

    const signal = evaluateTrendPullbackStrategy("RELIANCE", indicators, score, bar, "BULLISH");

    expect(signal.signal).toBe("BUY");
    expect(signal.strategy).toBe("TREND_PULLBACK");
    expect(signal.entryPrice).toBe(2520);
    // ATR is 35, stop loss = 2520 - 2 * 35 = 2450
    expect(signal.stopLoss).toBe(2450);
    // Target price = 2520 + 3.2 * 35 = 2632
    expect(signal.targetPrice).toBe(2632);
    expect(signal.riskRewardRatio).toBeGreaterThan(1.5);
    expect(signal.maxChasePrice).toBe(Number((2520 * 1.015).toFixed(2)));
    expect(signal.reasons.length).toBeGreaterThan(0);
  });

  it("TREND_PULLBACK blocks BUY when market regime is BEARISH", () => {
    const indicators = createMockIndicators();
    const score = createMockScore(75);
    const bar = createMockBar(2520);

    const signal = evaluateTrendPullbackStrategy("RELIANCE", indicators, score, bar, "BEARISH");

    expect(signal.signal).toBe("NONE");
    expect(signal.contraReasons).toContain("Market regime BEARISH does not permit TREND_PULLBACK strategy");
  });

  it("TREND_PULLBACK rejects stock when RSI is overbought (> 68)", () => {
    const indicators = createMockIndicators({
      rsi14: { value: 74, available: true, warmupComplete: true },
    });
    const score = createMockScore(75);
    const bar = createMockBar(2520);

    const signal = evaluateTrendPullbackStrategy("RELIANCE", indicators, score, bar, "BULLISH");

    expect(signal.signal).toBe("NONE");
    expect(signal.contraReasons.some((r) => r.includes("overextended"))).toBe(true);
  });

  it("MOMENTUM strategy triggers BUY in BULLISH regime with volume and momentum expansion", () => {
    const indicators = createMockIndicators({
      rsi14: { value: 60, available: true, warmupComplete: true },
      volumeRatio: { value: 1.45, available: true, warmupComplete: true },
      distanceFromHigh: { value: -2.0, available: true, warmupComplete: true },
    });
    const score = createMockScore(80);
    const bar = createMockBar(2520);

    const signal = evaluateMomentumStrategy("RELIANCE", indicators, score, bar, "BULLISH");

    expect(signal.signal).toBe("BUY");
    expect(signal.strategy).toBe("MOMENTUM");
    expect(signal.stopLoss).toBeLessThan(2520);
    expect(signal.targetPrice).toBeGreaterThan(2520);
  });

  it("MOMENTUM strategy blocks BUY in NEUTRAL regime", () => {
    const indicators = createMockIndicators();
    const score = createMockScore(80);
    const bar = createMockBar(2520);

    const signal = evaluateMomentumStrategy("RELIANCE", indicators, score, bar, "NEUTRAL");

    expect(signal.signal).toBe("NONE");
    expect(signal.contraReasons.some((r) => r.includes("requires BULLISH"))).toBe(true);
  });

  it("RELATIVE_STRENGTH triggers BUY when alpha ratio > 1.04 vs Nifty", () => {
    const indicators = createMockIndicators({
      relativeStrength: { value: 1.10, available: true, warmupComplete: true },
      trendSlope: { value: 1.8, available: true, warmupComplete: true },
    });
    const score = createMockScore(72);
    const bar = createMockBar(2520);

    const signal = evaluateRelativeStrengthStrategy("RELIANCE", indicators, score, bar, "BULLISH");

    expect(signal.signal).toBe("BUY");
    expect(signal.strategy).toBe("RELATIVE_STRENGTH");
    expect(signal.reasons.some((r) => r.includes("Outperforming Nifty"))).toBe(true);
  });

  it("selectBestBuySignal picks the highest confidence BUY signal", () => {
    const sig1: StrategySignal = {
      symbol: "RELIANCE",
      strategy: "TREND_PULLBACK",
      strategyVersion: "1.0.0",
      date: "2026-10-14",
      signal: "BUY",
      entryPrice: 2500,
      entryCondition: "Limit",
      stopLoss: 2400,
      targetPrice: 2650,
      expectedHoldingDays: 7,
      riskRewardRatio: 1.5,
      confidence: 70,
      reasons: [],
      contraReasons: [],
      cancellationConditions: [],
      maxChasePrice: 2520,
    };

    const sig2: StrategySignal = {
      ...sig1,
      strategy: "MOMENTUM",
      confidence: 85,
      riskRewardRatio: 1.8,
    };

    const best = selectBestBuySignal([sig1, sig2]);
    expect(best?.strategy).toBe("MOMENTUM");
    expect(best?.confidence).toBe(85);
  });

  describe("evaluateExitRules", () => {
    it("triggers IMMEDIATE SELL when stop loss is breached", () => {
      const exit = evaluateExitRules(
        "TCS",
        3500, // entry
        3350, // current <= stop
        3400, // stopLoss
        3700, // target
        3,    // holdingDays
        15,   // maxHoldingDays
        null,
        "BULLISH",
      );

      expect(exit.action).toBe("SELL");
      expect(exit.trigger).toBe("STOP_LOSS");
      expect(exit.urgency).toBe("IMMEDIATE");
    });

    it("triggers NEXT_SESSION SELL when profit target is achieved", () => {
      const exit = evaluateExitRules(
        "TCS",
        3500,
        3720, // current >= target
        3400,
        3700,
        5,
        15,
        null,
        "BULLISH",
      );

      expect(exit.action).toBe("SELL");
      expect(exit.trigger).toBe("TARGET_REACHED");
    });

    it("triggers SELL when holding days reach horizon with stale return", () => {
      const exit = evaluateExitRules(
        "TCS",
        3500,
        3510, // barely moved (0.28% in 15 days)
        3400,
        3750,
        15, // holdingDays >= maxHoldingDays
        15,
        null,
        "BULLISH",
      );

      expect(exit.action).toBe("SELL");
      expect(exit.trigger).toBe("TIME_HORIZON_EXPIRED");
    });

    it("triggers SELL on macro regime deterioration to BEARISH", () => {
      const exit = evaluateExitRules(
        "TCS",
        3500,
        3550,
        3400,
        3750,
        4,
        15,
        null,
        "BEARISH",
      );

      expect(exit.action).toBe("SELL");
      expect(exit.trigger).toBe("REGIME_CHANGE");
    });

    it("maintains HOLD when thesis remains valid and stop/target not hit", () => {
      const exit = evaluateExitRules(
        "TCS",
        3500,
        3580,
        3400,
        3750,
        4,
        15,
        null,
        "BULLISH",
      );

      expect(exit.action).toBe("HOLD");
      expect(exit.trigger).toBe("THESIS_VALID");
    });
  });
});
