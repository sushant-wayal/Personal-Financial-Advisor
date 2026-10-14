/**
 * stockStrategy/index.ts — Strategy Engine for North Stock Intelligence.
 *
 * Implements candidate quantitative swing trading strategies for Indian cash equities:
 * 1. TREND_PULLBACK: Pullback to key moving averages within an established uptrend
 * 2. MOMENTUM: Momentum continuation with RSI 50-70, MACD histogram expansion, volume confirmation
 * 3. RELATIVE_STRENGTH: Outperformance vs Nifty 50 benchmark with breakout confirmation
 *
 * All strategies:
 * - Delivery cash equity only (no shorting, no leverage, no intraday)
 * - Defined holding periods (2-15 trading days)
 * - Quantitative entry, stop-loss (ATR-based), and profit target
 * - Conservative risk-reward ratios (min 1.5R)
 * - Clear reason attribution and invalidation rules
 */

import {
  STRATEGY_CONFIGS,
  REGIME_POLICY,
} from "../../config/stockEngineDefaults";
import type {
  MarketRegime,
} from "../../config/stockEngineDefaults";
import type {
  StockIndicators,
  StockScore,
  StrategySignal,
  MarketBar,
} from "../../types/stockIntelligence";

/**
 * Evaluate the TREND_PULLBACK strategy for a given stock.
 * Setup:
 * - Regime: BULLISH or NEUTRAL
 * - Strong underlying trend: SMA50 > SMA200 (golden cross structure)
 * - Pullback: Price pulled back near SMA20 or EMA20, RSI between 40 and 55
 * - Stop loss: Below recent swing low or 2 * ATR
 * - Target: 2.5 * ATR (approx 1.5R - 2R)
 */
export function evaluateTrendPullbackStrategy(
  symbol: string,
  indicators: StockIndicators,
  score: StockScore,
  latestBar: MarketBar,
  marketRegime: MarketRegime,
): StrategySignal {
  const cfg = STRATEGY_CONFIGS.TREND_PULLBACK;
  const today = latestBar.date;
  const currentPrice = latestBar.close;

  const contraReasons: string[] = [];
  const reasons: string[] = [];
  const cancellationConditions: string[] = [];

  // Check regime permission
  const regimeAllowed = cfg.permittedRegimes.includes(marketRegime);
  if (!regimeAllowed) {
    contraReasons.push(`Market regime ${marketRegime} does not permit TREND_PULLBACK strategy`);
  }

  // Check indicators availability
  if (!indicators.sma50.available || !indicators.sma200.available || !indicators.atr14.available) {
    contraReasons.push("Required trend/ATR indicators not available (insufficient data warmup)");
  }

  // Trend condition: SMA50 > SMA200
  const isUptrend = indicators.sma50.available &&
    indicators.sma200.available &&
    indicators.sma50.value > indicators.sma200.value;

  if (isUptrend) {
    reasons.push(`Long-term uptrend confirmed (SMA50 ₹${indicators.sma50.value.toFixed(2)} > SMA200 ₹${indicators.sma200.value.toFixed(2)})`);
  } else {
    contraReasons.push("Stock is not in a confirmed macro uptrend (SMA50 <= SMA200)");
  }

  // Pullback condition: RSI between 38 and 58
  const rsiVal = indicators.rsi14.available ? indicators.rsi14.value : null;
  const isRsiPullback = rsiVal !== null && rsiVal >= 38 && rsiVal <= 58;

  if (isRsiPullback && rsiVal !== null) {
    reasons.push(`Healthy pullback identified (RSI 14 at ${rsiVal.toFixed(1)}, cooling off from overbought)`);
  } else if (rsiVal !== null && rsiVal > 68) {
    contraReasons.push(`Stock is currently overextended (RSI 14 at ${rsiVal.toFixed(1)} > 68)`);
  } else if (rsiVal !== null && rsiVal < 35) {
    contraReasons.push(`Momentum breakdown risk (RSI 14 deeply depressed at ${rsiVal.toFixed(1)})`);
  }

  // Moving average support: Price within 3% of SMA20 or EMA20
  const sma20Val = indicators.sma20.available ? indicators.sma20.value : null;
  const nearSma20 = sma20Val !== null && Math.abs(currentPrice - sma20Val) / currentPrice <= 0.035;

  if (nearSma20 && sma20Val !== null) {
    reasons.push(`Price is testing 20-day moving average support at ₹${sma20Val.toFixed(2)}`);
  }

  // Overall score threshold
  if (score.totalScore < 50) {
    contraReasons.push(`Composite score ${score.totalScore.toFixed(0)}/100 is below the 50-point quality threshold`);
  } else {
    reasons.push(`Favorable quantitative score of ${score.totalScore.toFixed(0)}/100`);
  }

  const isSignalValid = regimeAllowed && isUptrend && (isRsiPullback || nearSma20) && contraReasons.length === 0;

  if (!isSignalValid) {
    return {
      symbol,
      strategy: "TREND_PULLBACK",
      strategyVersion: cfg.version,
      date: today,
      signal: "NONE",
      entryPrice: null,
      entryCondition: "Conditions not met",
      stopLoss: null,
      targetPrice: null,
      expectedHoldingDays: cfg.maxHoldingDays,
      riskRewardRatio: null,
      confidence: Math.round(score.totalScore * 0.5),
      reasons,
      contraReasons,
      cancellationConditions,
      maxChasePrice: null,
    };
  }

  const atr = indicators.atr14.value;
  const stopLoss = Math.max(1, Number((currentPrice - 2.0 * atr).toFixed(2)));
  const targetPrice = Number((currentPrice + 3.2 * atr).toFixed(2));
  const riskAmount = currentPrice - stopLoss;
  const rewardAmount = targetPrice - currentPrice;
  const riskRewardRatio = riskAmount > 0 ? Number((rewardAmount / riskAmount).toFixed(2)) : 1.6;
  const maxChasePrice = Number((currentPrice * 1.015).toFixed(2));

  cancellationConditions.push(`Close below stop-loss ₹${stopLoss}`);
  cancellationConditions.push(`Open price gapping up above max chase price ₹${maxChasePrice}`);
  cancellationConditions.push(`Market regime transitioning to BEARISH or HIGH_VOLATILITY`);

  return {
    symbol,
    strategy: "TREND_PULLBACK",
    strategyVersion: cfg.version,
    date: today,
    signal: "BUY",
    entryPrice: currentPrice,
    entryCondition: `Limit order near ₹${currentPrice.toFixed(2)} on market open; do not chase above ₹${maxChasePrice.toFixed(2)}`,
    stopLoss,
    targetPrice,
    expectedHoldingDays: 7,
    riskRewardRatio,
    confidence: Math.round(Math.min(95, score.totalScore * 0.9)),
    reasons,
    contraReasons: [],
    cancellationConditions,
    maxChasePrice,
  };
}

/**
 * Evaluate the MOMENTUM strategy for a given stock.
 * Setup:
 * - Regime: BULLISH only
 * - Strong momentum: RSI 14 between 52 and 68
 * - MACD histogram expanding or positive
 * - Volume ratio > 1.2 (above 20-day average volume)
 * - Close within 8% of 52-week high
 */
export function evaluateMomentumStrategy(
  symbol: string,
  indicators: StockIndicators,
  score: StockScore,
  latestBar: MarketBar,
  marketRegime: MarketRegime,
): StrategySignal {
  const cfg = STRATEGY_CONFIGS.MOMENTUM;
  const today = latestBar.date;
  const currentPrice = latestBar.close;

  const contraReasons: string[] = [];
  const reasons: string[] = [];
  const cancellationConditions: string[] = [];

  // Regime check
  const regimeAllowed = cfg.permittedRegimes.includes(marketRegime);
  if (!regimeAllowed) {
    contraReasons.push(`Momentum strategy requires BULLISH regime (current: ${marketRegime})`);
  }

  // RSI momentum range 52 - 68
  const rsiVal = indicators.rsi14.available ? indicators.rsi14.value : null;
  if (rsiVal !== null && rsiVal >= 52 && rsiVal <= 68) {
    reasons.push(`Strong positive momentum corridor (RSI 14 at ${rsiVal.toFixed(1)})`);
  } else if (rsiVal !== null && rsiVal > 68) {
    contraReasons.push(`Overbought risk (RSI 14 at ${rsiVal.toFixed(1)} > 68)`);
  } else if (rsiVal !== null && rsiVal < 52) {
    contraReasons.push(`Insufficient positive momentum (RSI 14 at ${rsiVal.toFixed(1)} < 52)`);
  }

  // MACD confirmation
  if (indicators.macd.available) {
    if (indicators.macd.histogram > 0 && indicators.macd.macdLine > indicators.macd.signalLine) {
      reasons.push("MACD histogram positive with bullish line crossover");
    } else {
      contraReasons.push("MACD does not confirm bullish acceleration");
    }
  }

  // Volume surge
  const volRatio = indicators.volumeRatio.available ? indicators.volumeRatio.value : null;
  if (volRatio !== null && volRatio >= 1.15) {
    reasons.push(`Volume expansion confirmed (${volRatio.toFixed(2)}x 20-day baseline)`);
  } else {
    contraReasons.push("Volume is below minimum momentum surge threshold (1.15x)");
  }

  // Near highs
  const distFromHigh = indicators.distanceFromHigh.available ? indicators.distanceFromHigh.value : null;
  if (distFromHigh !== null && distFromHigh >= -10) {
    reasons.push(`Trading within ${(Math.abs(distFromHigh)).toFixed(1)}% of 52-week high`);
  } else if (distFromHigh !== null) {
    contraReasons.push(`Stock is ${(Math.abs(distFromHigh)).toFixed(1)}% below 52-week high`);
  }

  if (score.totalScore < 55) {
    contraReasons.push(`Score ${score.totalScore.toFixed(0)}/100 below momentum threshold 55`);
  }

  const isSignalValid = regimeAllowed && contraReasons.length === 0 && indicators.atr14.available;

  if (!isSignalValid) {
    return {
      symbol,
      strategy: "MOMENTUM",
      strategyVersion: cfg.version,
      date: today,
      signal: "NONE",
      entryPrice: null,
      entryCondition: "Conditions not met",
      stopLoss: null,
      targetPrice: null,
      expectedHoldingDays: cfg.maxHoldingDays,
      riskRewardRatio: null,
      confidence: Math.round(score.totalScore * 0.4),
      reasons,
      contraReasons,
      cancellationConditions,
      maxChasePrice: null,
    };
  }

  const atr = indicators.atr14.value;
  const stopLoss = Math.max(1, Number((currentPrice - 1.8 * atr).toFixed(2)));
  const targetPrice = Number((currentPrice + 3.0 * atr).toFixed(2));
  const riskAmount = currentPrice - stopLoss;
  const rewardAmount = targetPrice - currentPrice;
  const riskRewardRatio = riskAmount > 0 ? Number((rewardAmount / riskAmount).toFixed(2)) : 1.67;
  const maxChasePrice = Number((currentPrice * 1.012).toFixed(2));

  cancellationConditions.push(`Close below stop-loss ₹${stopLoss}`);
  cancellationConditions.push(`Immediate gap down through support`);
  cancellationConditions.push(`Holding duration exceeding 10 trading days without profit target hit`);

  return {
    symbol,
    strategy: "MOMENTUM",
    strategyVersion: cfg.version,
    date: today,
    signal: "BUY",
    entryPrice: currentPrice,
    entryCondition: `Enter on market open if price <= ₹${maxChasePrice.toFixed(2)}`,
    stopLoss,
    targetPrice,
    expectedHoldingDays: 5,
    riskRewardRatio,
    confidence: Math.round(Math.min(95, score.totalScore * 0.92)),
    reasons,
    contraReasons: [],
    cancellationConditions,
    maxChasePrice,
  };
}

/**
 * Evaluate the RELATIVE_STRENGTH strategy for a given stock.
 * Setup:
 * - Regime: BULLISH or NEUTRAL
 * - Strong relative strength vs Nifty 50 over 20 days (> 1.05)
 * - 20-day price trend slope positive
 * - Low gap risk (< 6%)
 */
export function evaluateRelativeStrengthStrategy(
  symbol: string,
  indicators: StockIndicators,
  score: StockScore,
  latestBar: MarketBar,
  marketRegime: MarketRegime,
): StrategySignal {
  const cfg = STRATEGY_CONFIGS.RELATIVE_STRENGTH;
  const today = latestBar.date;
  const currentPrice = latestBar.close;

  const contraReasons: string[] = [];
  const reasons: string[] = [];
  const cancellationConditions: string[] = [];

  const regimeAllowed = cfg.permittedRegimes.includes(marketRegime);
  if (!regimeAllowed) {
    contraReasons.push(`Regime ${marketRegime} does not permit RELATIVE_STRENGTH strategy`);
  }

  // Relative strength indicator
  const rsVal = indicators.relativeStrength.available ? indicators.relativeStrength.value : null;
  if (rsVal !== null && rsVal >= 1.04) {
    reasons.push(`Outperforming Nifty 50 benchmark (RS ratio ${rsVal.toFixed(2)})`);
  } else if (rsVal !== null) {
    contraReasons.push(`Insufficient alpha vs benchmark (RS ratio ${rsVal.toFixed(2)} < 1.04)`);
  } else {
    // If RS is not computed, check returns20d
    if (indicators.returns20d.available && indicators.returns20d.value > 4.0) {
      reasons.push(`Strong 20-day absolute gain of +${indicators.returns20d.value.toFixed(1)}%`);
    } else {
      contraReasons.push("Relative strength data unavailable and 20d return modest");
    }
  }

  // Trend slope positive
  if (indicators.trendSlope.available && indicators.trendSlope.value > 0.5) {
    reasons.push(`Upward linear trend slope (+${indicators.trendSlope.value.toFixed(1)}%/day)`);
  } else if (indicators.trendSlope.available && indicators.trendSlope.value <= 0) {
    contraReasons.push("Price trend slope is flat or negative");
  }

  // Gap risk check
  if (indicators.maxGap.available && indicators.maxGap.value > 7.0) {
    contraReasons.push(`High gap risk: past 20-day max single gap was ${indicators.maxGap.value.toFixed(1)}%`);
  }

  if (score.totalScore < 52) {
    contraReasons.push(`Overall score ${score.totalScore.toFixed(0)}/100 below 52 threshold`);
  }

  const isSignalValid = regimeAllowed && contraReasons.length === 0 && indicators.atr14.available;

  if (!isSignalValid) {
    return {
      symbol,
      strategy: "RELATIVE_STRENGTH",
      strategyVersion: cfg.version,
      date: today,
      signal: "NONE",
      entryPrice: null,
      entryCondition: "Conditions not met",
      stopLoss: null,
      targetPrice: null,
      expectedHoldingDays: cfg.maxHoldingDays,
      riskRewardRatio: null,
      confidence: Math.round(score.totalScore * 0.45),
      reasons,
      contraReasons,
      cancellationConditions,
      maxChasePrice: null,
    };
  }

  const atr = indicators.atr14.value;
  const stopLoss = Math.max(1, Number((currentPrice - 2.2 * atr).toFixed(2)));
  const targetPrice = Number((currentPrice + 3.8 * atr).toFixed(2));
  const riskAmount = currentPrice - stopLoss;
  const rewardAmount = targetPrice - currentPrice;
  const riskRewardRatio = riskAmount > 0 ? Number((rewardAmount / riskAmount).toFixed(2)) : 1.73;
  const maxChasePrice = Number((currentPrice * 1.015).toFixed(2));

  cancellationConditions.push(`Close below stop-loss ₹${stopLoss}`);
  cancellationConditions.push(`Benchmark drops more than 2% in single session`);
  cancellationConditions.push(`Relative performance reversal vs Nifty`);

  return {
    symbol,
    strategy: "RELATIVE_STRENGTH",
    strategyVersion: cfg.version,
    date: today,
    signal: "BUY",
    entryPrice: currentPrice,
    entryCondition: `Accumulate near ₹${currentPrice.toFixed(2)}, max entry ₹${maxChasePrice.toFixed(2)}`,
    stopLoss,
    targetPrice,
    expectedHoldingDays: 10,
    riskRewardRatio,
    confidence: Math.round(Math.min(95, score.totalScore * 0.9)),
    reasons,
    contraReasons: [],
    cancellationConditions,
    maxChasePrice,
  };
}

/**
 * Evaluate all candidate strategies for a stock and return all valid signals.
 * Filters out strategies that the current market regime disallows.
 */
export function evaluateStockStrategies(
  symbol: string,
  indicators: StockIndicators,
  score: StockScore,
  latestBar: MarketBar,
  marketRegime: MarketRegime,
): StrategySignal[] {
  const allowedStrategies = REGIME_POLICY[marketRegime].strategies;
  const signals: StrategySignal[] = [];

  if (allowedStrategies.includes("TREND_PULLBACK")) {
    signals.push(evaluateTrendPullbackStrategy(symbol, indicators, score, latestBar, marketRegime));
  }
  if (allowedStrategies.includes("MOMENTUM")) {
    signals.push(evaluateMomentumStrategy(symbol, indicators, score, latestBar, marketRegime));
  }
  if (allowedStrategies.includes("RELATIVE_STRENGTH")) {
    signals.push(evaluateRelativeStrengthStrategy(symbol, indicators, score, latestBar, marketRegime));
  }

  return signals;
}

/**
 * Pick the single best Buy signal among active strategy signals, if any.
 * Returns null if no strategy triggered a BUY.
 */
export function selectBestBuySignal(signals: StrategySignal[]): StrategySignal | null {
  const buySignals = signals.filter((s) => s.signal === "BUY");
  if (buySignals.length === 0) return null;

  // Sort by highest confidence, then highest risk/reward ratio
  return buySignals.sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    return (b.riskRewardRatio ?? 0) - (a.riskRewardRatio ?? 0);
  })[0];
}

/**
 * Evaluate whether an existing held position should be SOLD or HELD.
 * Triggers SELL on:
 * 1. Target price reached
 * 2. Stop loss breached
 * 3. Max holding days exceeded with stagnant performance
 * 4. Technical trend breakdown (e.g. price drops below SMA50)
 * 5. Market regime deterioration to BEARISH or HIGH_VOLATILITY
 */
export function evaluateExitRules(
  symbol: string,
  entryPrice: number,
  currentPrice: number,
  stopLoss: number,
  targetPrice: number | null,
  holdingDays: number,
  maxHoldingDays: number,
  indicators: StockIndicators | null,
  marketRegime: MarketRegime,
): {
  action: "SELL" | "HOLD";
  reason: string;
  trigger: string;
  urgency: "IMMEDIATE" | "CONDITIONAL" | "NEXT_SESSION";
  updatedStopLoss?: number;
} {
  // 1. Hard stop loss hit
  if (currentPrice <= stopLoss) {
    return {
      action: "SELL",
      reason: `Stop-loss breached: current price ₹${currentPrice.toFixed(2)} is at or below stop level ₹${stopLoss.toFixed(2)}`,
      trigger: "STOP_LOSS",
      urgency: "IMMEDIATE",
    };
  }

  // 2. Profit target reached
  if (targetPrice !== null && currentPrice >= targetPrice) {
    return {
      action: "SELL",
      reason: `Profit target achieved: current price ₹${currentPrice.toFixed(2)} reached target ₹${targetPrice.toFixed(2)}`,
      trigger: "TARGET_REACHED",
      urgency: "NEXT_SESSION",
    };
  }

  // 3. Market regime breakdown
  if (marketRegime === "BEARISH" || marketRegime === "HIGH_VOLATILITY") {
    return {
      action: "SELL",
      reason: `Market regime deteriorated to ${marketRegime}; risk reduction triggered for capital preservation`,
      trigger: "REGIME_CHANGE",
      urgency: "NEXT_SESSION",
    };
  }

  // 4. Time horizon expiration (2-15 days) with stale or negative return
  if (holdingDays >= maxHoldingDays) {
    const returnPct = ((currentPrice - entryPrice) / entryPrice) * 100;
    if (returnPct < 2.0) {
      return {
        action: "SELL",
        reason: `Maximum swing trading horizon of ${maxHoldingDays} days reached with modest return (${returnPct.toFixed(1)}%); capital freed for higher-momentum opportunities`,
        trigger: "TIME_HORIZON_EXPIRED",
        urgency: "NEXT_SESSION",
      };
    }
  }

  // 5. Technical invalidation (close below SMA50)
  if (indicators?.sma50.available && currentPrice < indicators.sma50.value * 0.985) {
    return {
      action: "SELL",
      reason: `Technical trend failure: price dropped below SMA50 (₹${indicators.sma50.value.toFixed(2)}) support`,
      trigger: "TECHNICAL_BREAKDOWN",
      urgency: "NEXT_SESSION",
    };
  }

  // Trailing stop loss logic: If stock moved in profit > 1.5 * ATR, raise stop to breakeven + buffer
  let updatedStopLoss = stopLoss;
  if (indicators?.atr14.available) {
    const atr = indicators.atr14.value;
    const profit = currentPrice - entryPrice;
    if (profit > 1.8 * atr) {
      // Trail stop up to lock in profit (currentPrice - 1.5 * atr)
      const trailingStop = Number((currentPrice - 1.5 * atr).toFixed(2));
      if (trailingStop > stopLoss) {
        updatedStopLoss = trailingStop;
      }
    }
  }

  return {
    action: "HOLD",
    reason: `Position intact. Target: ₹${targetPrice?.toFixed(2) ?? "Trailing"}, Stop: ₹${updatedStopLoss.toFixed(2)}`,
    trigger: "THESIS_VALID",
    urgency: "CONDITIONAL",
    updatedStopLoss,
  };
}
