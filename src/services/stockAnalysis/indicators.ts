/**
 * stockAnalysis/indicators.ts — Deterministic Technical Indicator Calculations.
 *
 * All indicators are pure functions that operate on arrays of closing prices,
 * OHLCV candles, or pre-computed values. No database access, no side effects.
 *
 * Indicators implemented:
 *   - SMA (Simple Moving Average)
 *   - EMA (Exponential Moving Average)
 *   - RSI (Relative Strength Index)
 *   - MACD (Moving Average Convergence Divergence)
 *   - ATR (Average True Range)
 *   - Historical Volatility
 *   - Returns over lookback windows
 *   - Relative Strength vs benchmark
 *   - Volume Ratio
 *   - Trend Slope (linear regression)
 *   - Distance from highs/lows
 *   - Maximum Drawdown
 *   - Gap risk
 *   - Average Turnover
 *
 * Each function returns { value, available, warmupComplete } where
 * available=false when there isn't enough history for a valid calculation.
 */

import type { MarketBar } from "../../types/stockIntelligence";
import type { IndicatorValue, StockIndicators } from "../../types/stockIntelligence";
import { INDICATOR_CONFIG } from "../../config/stockEngineDefaults";

// ─── Helper: Create unavailable indicator ────────────────────────────────────

function unavailable(): IndicatorValue {
  return { value: 0, available: false, warmupComplete: false };
}

function available(value: number, warmupComplete: boolean = true): IndicatorValue {
  if (!Number.isFinite(value)) return unavailable();
  return { value, available: true, warmupComplete };
}

// ─── SMA ─────────────────────────────────────────────────────────────────────

export function calcSMA(values: number[], period: number): IndicatorValue {
  if (values.length < period) return unavailable();
  const slice = values.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return available(sum / period);
}

// ─── EMA ─────────────────────────────────────────────────────────────────────

export function calcEMA(values: number[], period: number): IndicatorValue {
  if (values.length < period) return unavailable();

  const k = 2 / (period + 1);
  // Seed with SMA of first 'period' values
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;

  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }

  return available(ema);
}

/**
 * Compute full EMA series (needed for MACD).
 * Returns array of same length as input, with NaN for warmup period.
 */
function emaSeriesFull(values: number[], period: number): number[] {
  const result = new Array<number>(values.length).fill(NaN);
  if (values.length < period) return result;

  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = ema;

  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result[i] = ema;
  }

  return result;
}

// ─── RSI ─────────────────────────────────────────────────────────────────────

export function calcRSI(values: number[], period: number = 14): IndicatorValue {
  if (values.length < period + 1) return unavailable();

  let avgGain = 0;
  let avgLoss = 0;

  // Initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = values[i] - values[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  // Smooth using Wilder's method
  for (let i = period + 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return available(100);
  const rs = avgGain / avgLoss;
  const rsi = 100 - (100 / (1 + rs));
  return available(rsi);
}

// ─── MACD ────────────────────────────────────────────────────────────────────

export function calcMACD(
  values: number[],
  fast: number = INDICATOR_CONFIG.macd.fast,
  slow: number = INDICATOR_CONFIG.macd.slow,
  signalPeriod: number = INDICATOR_CONFIG.macd.signal,
): { macdLine: number; signalLine: number; histogram: number; available: boolean } {
  if (values.length < slow + signalPeriod) {
    return { macdLine: 0, signalLine: 0, histogram: 0, available: false };
  }

  const fastEma = emaSeriesFull(values, fast);
  const slowEma = emaSeriesFull(values, slow);

  // MACD line = Fast EMA - Slow EMA
  const macdLine: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (Number.isFinite(fastEma[i]) && Number.isFinite(slowEma[i])) {
      macdLine.push(fastEma[i] - slowEma[i]);
    }
  }

  if (macdLine.length < signalPeriod) {
    return { macdLine: 0, signalLine: 0, histogram: 0, available: false };
  }

  // Signal line = EMA of MACD line
  const signalSeries = emaSeriesFull(macdLine, signalPeriod);
  const lastMacd = macdLine[macdLine.length - 1];
  const lastSignal = signalSeries[signalSeries.length - 1];

  if (!Number.isFinite(lastMacd) || !Number.isFinite(lastSignal)) {
    return { macdLine: 0, signalLine: 0, histogram: 0, available: false };
  }

  return {
    macdLine: lastMacd,
    signalLine: lastSignal,
    histogram: lastMacd - lastSignal,
    available: true,
  };
}

// ─── ATR ─────────────────────────────────────────────────────────────────────

export function calcATR(candles: MarketBar[], period: number = 14): IndicatorValue {
  if (candles.length < period + 1) return unavailable();

  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trueRanges.push(tr);
  }

  if (trueRanges.length < period) return unavailable();

  // Wilder's smoothed ATR
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
  }

  return available(atr);
}

// ─── Historical Volatility ──────────────────────────────────────────────────

export function calcHistoricalVolatility(
  closes: number[],
  lookback: number = INDICATOR_CONFIG.volatility.lookback,
): IndicatorValue {
  if (closes.length < lookback + 1) return unavailable();

  const recentCloses = closes.slice(-(lookback + 1));
  const logReturns: number[] = [];

  for (let i = 1; i < recentCloses.length; i++) {
    if (recentCloses[i - 1] <= 0 || recentCloses[i] <= 0) continue;
    logReturns.push(Math.log(recentCloses[i] / recentCloses[i - 1]));
  }

  if (logReturns.length < 2) return unavailable();

  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance = logReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (logReturns.length - 1);
  const dailyVol = Math.sqrt(variance);
  const annualizedVol = dailyVol * Math.sqrt(252) * 100; // as percentage

  return available(annualizedVol);
}

// ─── Returns ─────────────────────────────────────────────────────────────────

export function calcReturn(closes: number[], lookback: number): IndicatorValue {
  if (closes.length < lookback + 1) return unavailable();
  const current = closes[closes.length - 1];
  const past = closes[closes.length - 1 - lookback];
  if (past <= 0) return unavailable();
  return available(((current - past) / past) * 100);
}

// ─── Relative Strength ──────────────────────────────────────────────────────

export function calcRelativeStrength(
  stockCloses: number[],
  benchmarkCloses: number[],
  lookback: number = INDICATOR_CONFIG.relativeStrength.lookback,
): IndicatorValue {
  if (stockCloses.length < lookback + 1 || benchmarkCloses.length < lookback + 1) {
    return unavailable();
  }

  const stockReturn = (stockCloses[stockCloses.length - 1] / stockCloses[stockCloses.length - 1 - lookback]) - 1;
  const benchReturn = (benchmarkCloses[benchmarkCloses.length - 1] / benchmarkCloses[benchmarkCloses.length - 1 - lookback]) - 1;

  if (!Number.isFinite(stockReturn) || !Number.isFinite(benchReturn)) {
    return unavailable();
  }

  // RS = (1 + stockReturn) / (1 + benchReturn) - 1, expressed as %
  const rs = ((1 + stockReturn) / (1 + benchReturn) - 1) * 100;
  return available(rs);
}

// ─── Volume Ratio ────────────────────────────────────────────────────────────

export function calcVolumeRatio(
  volumes: number[],
  period: number = INDICATOR_CONFIG.volume.baselinePeriod,
): IndicatorValue {
  if (volumes.length < period + 1) return unavailable();

  const baseline = volumes.slice(-(period + 1), -1);
  const avgVolume = baseline.reduce((a, b) => a + b, 0) / baseline.length;
  if (avgVolume <= 0) return unavailable();

  const current = volumes[volumes.length - 1];
  return available(current / avgVolume);
}

// ─── Trend Slope ─────────────────────────────────────────────────────────────

/**
 * Linear regression slope of closing prices, normalized by the mean.
 * Positive = uptrend, Negative = downtrend.
 */
export function calcTrendSlope(
  closes: number[],
  period: number = INDICATOR_CONFIG.trendSlope.period,
): IndicatorValue {
  if (closes.length < period) return unavailable();

  const data = closes.slice(-period);
  const n = data.length;
  const mean = data.reduce((a, b) => a + b, 0) / n;
  if (mean <= 0) return unavailable();

  let sumXY = 0;
  let sumX2 = 0;
  const xMean = (n - 1) / 2;

  for (let i = 0; i < n; i++) {
    const x = i - xMean;
    sumXY += x * data[i];
    sumX2 += x * x;
  }

  if (sumX2 === 0) return unavailable();

  const slope = sumXY / sumX2;
  const normalizedSlope = (slope / mean) * 100; // percentage per period

  return available(normalizedSlope);
}

// ─── Distance from Highs/Lows ────────────────────────────────────────────────

export function calcDistanceFromHigh(
  highs: number[],
  currentClose: number,
  lookbackDays: number = 252,
): IndicatorValue {
  if (highs.length === 0 || currentClose <= 0) return unavailable();
  const relevantHighs = highs.slice(-lookbackDays);
  const high52w = Math.max(...relevantHighs);
  if (high52w <= 0) return unavailable();
  return available(((currentClose - high52w) / high52w) * 100);
}

export function calcDistanceFromLow(
  lows: number[],
  currentClose: number,
  lookbackDays: number = 252,
): IndicatorValue {
  if (lows.length === 0 || currentClose <= 0) return unavailable();
  const relevantLows = lows.slice(-lookbackDays);
  const low52w = Math.min(...relevantLows);
  if (low52w <= 0) return unavailable();
  return available(((currentClose - low52w) / low52w) * 100);
}

// ─── Max Drawdown ────────────────────────────────────────────────────────────

export function calcMaxDrawdown(closes: number[], lookback: number = 60): IndicatorValue {
  if (closes.length < lookback) return unavailable();

  const data = closes.slice(-lookback);
  let peak = data[0];
  let maxDD = 0;

  for (const close of data) {
    if (close > peak) peak = close;
    const dd = (peak - close) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  return available(maxDD * 100); // as percentage
}

// ─── Gap Risk ────────────────────────────────────────────────────────────────

export function calcMaxGap(candles: MarketBar[], lookback: number = 60): IndicatorValue {
  if (candles.length < lookback + 1) return unavailable();

  const recent = candles.slice(-lookback);
  let maxGap = 0;

  for (let i = 1; i < recent.length; i++) {
    const prevClose = recent[i - 1].close;
    if (prevClose <= 0) continue;
    const gap = Math.abs((recent[i].open - prevClose) / prevClose) * 100;
    if (gap > maxGap) maxGap = gap;
  }

  return available(maxGap);
}

// ─── Average Turnover ────────────────────────────────────────────────────────

export function calcAvgTurnover(candles: MarketBar[], lookback: number = 20): IndicatorValue {
  if (candles.length < lookback) return unavailable();

  const recent = candles.slice(-lookback);
  let totalTurnover = 0;

  for (const c of recent) {
    totalTurnover += c.close * c.volume;
  }

  return available(totalTurnover / lookback);
}

// ─── Compute All Indicators for a Stock ──────────────────────────────────────

/**
 * Compute all indicators for a stock given its candle history and benchmark closes.
 * Returns a complete StockIndicators object.
 */
export function computeAllIndicators(
  symbol: string,
  candles: MarketBar[],
  benchmarkCloses: number[] = [],
  date?: string,
): StockIndicators {
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const volumes = candles.map((c) => c.volume);
  const currentClose = closes.length > 0 ? closes[closes.length - 1] : 0;
  const effectiveDate = date || (candles.length > 0 ? candles[candles.length - 1].date : new Date().toISOString().slice(0, 10));

  return {
    symbol,
    date: effectiveDate,
    sma20: calcSMA(closes, 20),
    sma50: calcSMA(closes, 50),
    sma200: calcSMA(closes, 200),
    ema20: calcEMA(closes, 20),
    ema50: calcEMA(closes, 50),
    rsi14: calcRSI(closes, 14),
    macd: calcMACD(closes),
    atr14: calcATR(candles, 14),
    historicalVolatility: calcHistoricalVolatility(closes),
    returns5d: calcReturn(closes, 5),
    returns10d: calcReturn(closes, 10),
    returns20d: calcReturn(closes, 20),
    returns60d: calcReturn(closes, 60),
    relativeStrength: calcRelativeStrength(closes, benchmarkCloses),
    volumeRatio: calcVolumeRatio(volumes),
    trendSlope: calcTrendSlope(closes),
    distanceFromHigh: calcDistanceFromHigh(highs, currentClose),
    distanceFromLow: calcDistanceFromLow(lows, currentClose),
    maxDrawdown60d: calcMaxDrawdown(closes, 60),
    avgTurnover: calcAvgTurnover(candles),
    maxGap: calcMaxGap(candles),
  };
}

export { computeAllIndicators as computeIndicators };
