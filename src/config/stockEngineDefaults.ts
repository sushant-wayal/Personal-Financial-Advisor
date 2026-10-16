/**
 * stockEngineDefaults.ts — Centralized configuration for North Stock Intelligence.
 *
 * Every tunable parameter for the stock trading engine lives here.
 * Do NOT scatter hardcoded trading constants in services or components.
 *
 * Configuration covers:
 *   - Market regime detection thresholds
 *   - Stock universe eligibility filters
 *   - Quantitative indicator parameters
 *   - Strategy entry/exit rules
 *   - Scoring weights
 *   - Risk management limits
 *   - Position sizing constraints
 *   - Portfolio exposure caps
 *   - Drawdown management thresholds
 *   - Trading cost assumptions (Indian equity delivery)
 *   - Paper trading defaults
 *   - Backtesting assumptions
 *   - Data freshness and validation rules
 *   - Financial phase restrictions
 */

import type { FinancialPhase } from "./investmentDefaults";

// ─── Market Regime ───────────────────────────────────────────────────────────

export type MarketRegime = "BULLISH" | "NEUTRAL" | "BEARISH" | "HIGH_VOLATILITY" | "DATA_UNRELIABLE";

export const MARKET_REGIME_CONFIG = {
  /** Index SMA periods for regime classification */
  sma: { short: 50, long: 200 },
  /** Lookback for realized volatility (trading days) */
  volatilityLookback: 20,
  /** Annualization factor for daily volatility */
  annualizationFactor: Math.sqrt(252),
  /** High volatility threshold (annualized %) */
  highVolatilityThreshold: 30,
  /** Drawdown from recent high triggering BEARISH (%) */
  bearishDrawdownThreshold: 10,
  /** Drawdown warning level (%) */
  bearishWarningThreshold: 5,
  /** Breadth: fraction of universe above SMA50 */
  bullishBreadthThreshold: 0.6,
  bearishBreadthThreshold: 0.3,
  /** Index above both SMAs and slope positive => BULLISH */
  /** Index below SMA200 or steep slope negative => BEARISH */
  /** Minimum data points required for regime classification */
  minimumDataPoints: 200,
} as const;

/** Regime-specific trading policy */
export const REGIME_POLICY: Record<MarketRegime, {
  newPurchasesAllowed: boolean;
  maxExposurePct: number;
  strategies: string[];
  description: string;
}> = {
  BULLISH: {
    newPurchasesAllowed: true,
    maxExposurePct: 100,
    strategies: ["TREND_PULLBACK", "MOMENTUM", "RELATIVE_STRENGTH"],
    description: "Full allocation permitted. All strategies active.",
  },
  NEUTRAL: {
    newPurchasesAllowed: true,
    maxExposurePct: 70,
    strategies: ["TREND_PULLBACK", "RELATIVE_STRENGTH"],
    description: "Reduced exposure. Momentum strategy paused.",
  },
  BEARISH: {
    newPurchasesAllowed: false,
    maxExposurePct: 30,
    strategies: [],
    description: "New purchases blocked. Manage existing positions only.",
  },
  HIGH_VOLATILITY: {
    newPurchasesAllowed: false,
    maxExposurePct: 40,
    strategies: [],
    description: "New purchases blocked. High volatility environment.",
  },
  DATA_UNRELIABLE: {
    newPurchasesAllowed: false,
    maxExposurePct: 0,
    strategies: [],
    description: "New purchases blocked. Market data unreliable.",
  },
};

// ─── Stock Universe ──────────────────────────────────────────────────────────

export const STOCK_UNIVERSE_CONFIG = {
  /** Default universe: Nifty 50 + Next 50 symbols (NSE) */
  defaultIndex: "NIFTY_100",
  /** Minimum trading history in days to be eligible */
  minimumHistoryDays: 200,
  /** Minimum average daily volume (shares) */
  minimumAvgVolume: 100_000,
  /** Maximum allowed gap risk (single-day % move) */
  maxGapRisk: 10,
  /** Minimum data completeness ratio (0-1) */
  minDataCompleteness: 0.9,
  /** Maximum number of stocks to score per run */
  maxCandidatesPerRun: 100,
  /** Stale price threshold (hours after market close) */
  stalePriceThresholdHours: 20,
} as const;

// ─── Quantitative Indicators ─────────────────────────────────────────────────

export const INDICATOR_CONFIG = {
  sma: {
    periods: [20, 50, 200],
  },
  ema: {
    periods: [20, 50],
  },
  rsi: {
    period: 14,
    overbought: 70,
    oversold: 30,
  },
  macd: {
    fast: 12,
    slow: 26,
    signal: 9,
  },
  atr: {
    period: 14,
  },
  volatility: {
    lookback: 20,
  },
  relativeStrength: {
    lookback: 20,
    benchmark: "^NSEI", // Nifty 50 Yahoo symbol
  },
  volume: {
    baselinePeriod: 20,
  },
  returns: {
    lookbacks: [5, 10, 20, 60],
  },
  trendSlope: {
    period: 20,
  },
} as const;

// ─── Scoring Weights ─────────────────────────────────────────────────────────

export const SCORING_WEIGHTS = {
  trendQuality: 0.25,
  momentum: 0.20,
  marketSectorStrength: 0.20,
  fundamentalQuality: 0.15,
  riskLiquidity: 0.20,
} as const;

// ─── Strategy Definitions ────────────────────────────────────────────────────

export type StrategyName = "TREND_PULLBACK" | "MOMENTUM" | "RELATIVE_STRENGTH";

export type StrategyConfig = {
  name: StrategyName;
  version: string;
  description: string;
  minHoldingDays: number;
  maxHoldingDays: number;
  permittedRegimes: MarketRegime[];
  minLiquidity: number; // min avg daily volume
  transactionCostBps: number;
};

export const STRATEGY_CONFIGS: Record<StrategyName, StrategyConfig> = {
  TREND_PULLBACK: {
    name: "TREND_PULLBACK",
    version: "1.0.0",
    description: "Buy strong uptrend stocks on pullback to support. SMA50 > SMA200, price pulls back to SMA20/EMA20.",
    minHoldingDays: 3,
    maxHoldingDays: 15,
    permittedRegimes: ["BULLISH", "NEUTRAL"],
    minLiquidity: 100_000,
    transactionCostBps: 50,
  },
  MOMENTUM: {
    name: "MOMENTUM",
    version: "1.0.0",
    description: "Buy stocks showing strong momentum continuation. RSI 50-70, MACD bullish crossover, high relative strength.",
    minHoldingDays: 2,
    maxHoldingDays: 10,
    permittedRegimes: ["BULLISH"],
    minLiquidity: 200_000,
    transactionCostBps: 50,
  },
  RELATIVE_STRENGTH: {
    name: "RELATIVE_STRENGTH",
    version: "1.0.0",
    description: "Buy top relative-strength stocks breaking out with volume confirmation. Outperforming Nifty 50 benchmark.",
    minHoldingDays: 5,
    maxHoldingDays: 15,
    permittedRegimes: ["BULLISH", "NEUTRAL"],
    minLiquidity: 150_000,
    transactionCostBps: 50,
  },
};

// ─── Risk Management ─────────────────────────────────────────────────────────

export const RISK_CONFIG = {
  /** Maximum portfolio drawdown target (%) */
  maxDrawdownTarget: 5.0,
  /** Warning threshold (% of max drawdown) */
  drawdownWarningPct: 3.0,
  /** New purchases restricted at this drawdown (%) */
  drawdownRestrictedPct: 4.0,
  /** New purchases halted at this drawdown (%) */
  drawdownHaltPct: 4.5,
  /** Recovery: drawdown must fall below this to resume normal trading (%) */
  drawdownRecoveryPct: 2.0,

  /** Maximum per-position risk (% of trading capital) */
  maxPositionRiskPct: 2.0,
  /** Maximum allocation to a single stock (% of trading capital) */
  maxSinglePositionPct: 15.0,
  /** Maximum sector concentration (% of trading capital) */
  maxSectorConcentrationPct: 30.0,
  /** Maximum total direct equity exposure (% of trading capital) */
  maxDirectEquityExposurePct: 100.0,
  /** Maximum correlated positions */
  maxCorrelatedPositions: 3,
  /** Maximum concurrent open positions */
  maxOpenPositions: 10,
  /** Minimum acceptable risk/reward ratio */
  minRiskRewardRatio: 1.5,

  /** ATR multiplier for stop-loss calculation */
  stopLossAtrMultiplier: 2.0,
  /** Maximum stop loss distance (%) */
  maxStopLossDistancePct: 8.0,
  /** Slippage assumption (%) */
  slippageAssumptionPct: 0.2,
  /** Gap risk assumption: additional slippage on gap opens (%) */
  gapSlippagePct: 0.5,
} as const;

// ─── Trading Costs (Indian Equity Delivery) ──────────────────────────────────

export const TRADING_COSTS = {
  /** Brokerage per side (conservative flat estimate in bps) */
  brokerageBps: 3, // ~0.03% for discount brokers
  /** Securities Transaction Tax on buy side (%) */
  sttBuyPct: 0.1,
  /** Securities Transaction Tax on sell side (%) */
  sttSellPct: 0.1,
  /** Exchange transaction charges (%) */
  exchangeChargesPct: 0.00345,
  /** SEBI turnover fees (%) */
  sebiChargesPct: 0.0001,
  /** GST on brokerage + exchange charges (%) */
  gstPct: 18,
  /** Stamp duty on buy side (%) */
  stampDutyBuyPct: 0.015,
  /** DP charges per sell transaction (₹) */
  dpChargesPerSell: 15.93,

  /**
   * Estimate total round-trip cost in bps for a given trade size.
   * This is a conservative approximation.
   */
  estimateRoundTripBps(tradeValueInr: number): number {
    const brokerage = this.brokerageBps * 2; // buy + sell
    const stt = (this.sttBuyPct + this.sttSellPct) * 100; // convert % to bps
    const exchange = this.exchangeChargesPct * 100 * 2;
    const sebi = this.sebiChargesPct * 100 * 2;
    const stampDuty = this.stampDutyBuyPct * 100;
    const gstOnCharges = (brokerage + exchange) * (this.gstPct / 100);
    const dpInBps = tradeValueInr > 0 ? (this.dpChargesPerSell / tradeValueInr) * 10000 : 5;
    return Math.ceil(brokerage + stt + exchange + sebi + stampDuty + gstOnCharges + dpInBps);
  },

  /** Estimate one-way buy cost in ₹ */
  estimateBuyCost(tradeValueInr: number): number {
    const brokerage = tradeValueInr * (this.brokerageBps / 10000);
    const stt = tradeValueInr * (this.sttBuyPct / 100);
    const exchange = tradeValueInr * (this.exchangeChargesPct / 100);
    const sebi = tradeValueInr * (this.sebiChargesPct / 100);
    const stampDuty = tradeValueInr * (this.stampDutyBuyPct / 100);
    const gst = (brokerage + exchange) * (this.gstPct / 100);
    return Math.ceil(brokerage + stt + exchange + sebi + stampDuty + gst);
  },

  /** Estimate one-way sell cost in ₹ */
  estimateSellCost(tradeValueInr: number): number {
    const brokerage = tradeValueInr * (this.brokerageBps / 10000);
    const stt = tradeValueInr * (this.sttSellPct / 100);
    const exchange = tradeValueInr * (this.exchangeChargesPct / 100);
    const sebi = tradeValueInr * (this.sebiChargesPct / 100);
    const gst = (brokerage + exchange) * (this.gstPct / 100);
    return Math.ceil(brokerage + stt + exchange + sebi + gst + this.dpChargesPerSell);
  },
} as const;

// ─── Financial Phase Restrictions ────────────────────────────────────────────

export const PHASE_TRADING_POLICY: Record<FinancialPhase, {
  newPurchasesAllowed: boolean;
  maxTradingCapitalPct: number;
  description: string;
}> = {
  CRISIS: {
    newPurchasesAllowed: false,
    maxTradingCapitalPct: 0,
    description: "Trading disabled in CRISIS phase. Focus on stabilizing finances.",
  },
  EF_BUILDING: {
    newPurchasesAllowed: true,
    maxTradingCapitalPct: 10,
    description: "Very limited trading permitted. Emergency fund building takes priority.",
  },
  GOAL_SPRINT: {
    newPurchasesAllowed: true,
    maxTradingCapitalPct: 30,
    description: "Moderate trading permitted within surplus constraints.",
  },
  WEALTH_BUILDING: {
    newPurchasesAllowed: true,
    maxTradingCapitalPct: 100,
    description: "Full trading permitted within risk constraints.",
  },
};

// ─── Paper Trading ───────────────────────────────────────────────────────────

export const PAPER_TRADING_CONFIG = {
  /** Default virtual starting cash (₹) */
  defaultVirtualCash: 100_000,
  /** Minimum observation days before strategy eligible for live consideration */
  minimumObservationDays: 60,
  /** Minimum number of completed trades for evaluation */
  minimumTradesForEvaluation: 10,
} as const;

// ─── Backtesting ─────────────────────────────────────────────────────────────

export const BACKTEST_CONFIG = {
  /** Default slippage per trade in bps */
  defaultSlippageBps: 20,
  /** Minimum historical data for backtesting (trading days) */
  minimumHistoryDays: 252, // ~1 year
  /** Default execution delay (sessions after signal) */
  executionDelaySessions: 1,
} as const;

// ─── Data Freshness ──────────────────────────────────────────────────────────

export const DATA_FRESHNESS_CONFIG = {
  /** Maximum age of market data for new recommendations (hours) */
  maxDataAgeHours: 20,
  /** Provider retry attempts */
  maxRetries: 3,
  /** Base delay between retries (ms) */
  retryBaseDelayMs: 2000,
  /** Concurrency limit for fetching prices */
  maxConcurrentFetches: 5,
  /** Request timeout (ms) */
  requestTimeoutMs: 15_000,
  /** NSE timezone */
  exchangeTimezone: "Asia/Kolkata",
  /** Market open time (IST) */
  marketOpenTime: "09:15",
  /** Market close time (IST) */
  marketCloseTime: "15:30",
} as const;

// ─── Nifty 50 + Next 50 Universe ─────────────────────────────────────────────
// These are the symbols as of the configuration date.
// The spec warns about survivorship bias — for backtesting, historical
// constituents should be used if available. This list is for current screening.

export const NIFTY_50_SYMBOLS = [
  "ADANIENT", "ADANIPORTS", "APOLLOHOSP", "ASIANPAINT", "AXISBANK",
  "BAJAJ-AUTO", "BAJFINANCE", "BAJAJFINSV", "BEL", "BPCL",
  "BHARTIARTL", "BRITANNIA", "CIPLA", "COALINDIA", "DRREDDY",
  "EICHERMOT", "ETERNAL", "GRASIM", "HCLTECH", "HDFCBANK",
  "HDFCLIFE", "HEROMOTOCO", "HINDALCO", "HINDUNILVR", "ICICIBANK",
  "ITC", "INDUSINDBK", "INFY", "JSWSTEEL", "KOTAKBANK",
  "LT", "LTIM", "M&M", "MARUTI", "NESTLEIND",
  "NTPC", "ONGC", "POWERGRID", "RELIANCE", "SBILIFE",
  "SBIN", "SUNPHARMA", "TCS", "TATACONSUM", "TATAMOTORS",
  "TATASTEEL", "TECHM", "TITAN", "TRENT", "ULTRACEMCO",
  "WIPRO",
] as const;

export const NIFTY_NEXT_50_SYMBOLS = [
  "ABB", "ACC", "AMBUJACEM", "ATGL", "BAJAJHLDNG",
  "BANKBARODA", "BHEL", "BOSCHLTD", "CANBK", "CHOLAFIN",
  "COLPAL", "DABUR", "DLF", "GAIL", "GODREJCP",
  "HAL", "HAVELLS", "HINDPETRO", "ICICIPRULI", "IIFL",
  "INDHOTEL", "INDIGO", "IOC", "IRCTC", "IRFC",
  "JINDALSTEL", "JIOFIN", "LODHA", "MARICO", "MOTHERSON",
  "NHPC", "NAUKRI", "OFSS", "PFC", "PIDILITIND",
  "PNB", "RECLTD", "SAIL", "SBICARD", "SHREECEM",
  "SHRIRAMFIN", "SIEMENS", "SRF", "TATAELXSI", "TATAPOWER",
  "TORNTPHARM", "TVSMOTOR", "UNITDSPR", "VBL", "VEDL",
] as const;

export const DEFAULT_UNIVERSE_SYMBOLS = [
  ...NIFTY_50_SYMBOLS,
  ...NIFTY_NEXT_50_SYMBOLS,
];

/** Sector mappings for concentration limits (approximate, can be refined) */
export const SECTOR_MAPPINGS: Record<string, string> = {
  // Financial Services
  HDFCBANK: "FINANCIAL", ICICIBANK: "FINANCIAL", KOTAKBANK: "FINANCIAL",
  AXISBANK: "FINANCIAL", SBIN: "FINANCIAL", INDUSINDBK: "FINANCIAL",
  BAJFINANCE: "FINANCIAL", BAJAJFINSV: "FINANCIAL", HDFCLIFE: "FINANCIAL",
  SBILIFE: "FINANCIAL", SBICARD: "FINANCIAL", ICICIPRULI: "FINANCIAL",
  CHOLAFIN: "FINANCIAL", SHRIRAMFIN: "FINANCIAL", PFC: "FINANCIAL",
  RECLTD: "FINANCIAL", BANKBARODA: "FINANCIAL", PNB: "FINANCIAL",
  CANBK: "FINANCIAL", JIOFIN: "FINANCIAL", BAJAJHLDNG: "FINANCIAL",
  IRFC: "FINANCIAL",
  // IT
  TCS: "IT", INFY: "IT", HCLTECH: "IT", WIPRO: "IT", TECHM: "IT",
  LTIM: "IT", NAUKRI: "IT", OFSS: "IT", TATAELXSI: "IT",
  // Energy & Oil
  RELIANCE: "ENERGY", ONGC: "ENERGY", BPCL: "ENERGY", IOC: "ENERGY",
  HINDPETRO: "ENERGY", GAIL: "ENERGY", NTPC: "ENERGY", POWERGRID: "ENERGY",
  COALINDIA: "ENERGY", TATAPOWER: "ENERGY", NHPC: "ENERGY", ATGL: "ENERGY",
  ADANIENT: "ENERGY", ADANIPORTS: "ENERGY",
  // Pharma & Healthcare
  SUNPHARMA: "PHARMA", DRREDDY: "PHARMA", CIPLA: "PHARMA",
  APOLLOHOSP: "PHARMA", TORNTPHARM: "PHARMA",
  // Auto
  "BAJAJ-AUTO": "AUTO", MARUTI: "AUTO", TATAMOTORS: "AUTO",
  "M&M": "AUTO", EICHERMOT: "AUTO", HEROMOTOCO: "AUTO",
  MOTHERSON: "AUTO", TVSMOTOR: "AUTO", BOSCHLTD: "AUTO",
  // FMCG
  HINDUNILVR: "FMCG", ITC: "FMCG", NESTLEIND: "FMCG",
  BRITANNIA: "FMCG", TATACONSUM: "FMCG", DABUR: "FMCG",
  COLPAL: "FMCG", GODREJCP: "FMCG", MARICO: "FMCG",
  UNITDSPR: "FMCG", VBL: "FMCG", ETERNAL: "FMCG",
  // Metals & Mining
  TATASTEEL: "METALS", JSWSTEEL: "METALS", HINDALCO: "METALS",
  VEDL: "METALS", SAIL: "METALS", JINDALSTEL: "METALS",
  // Cement & Construction
  ULTRACEMCO: "CEMENT", GRASIM: "CEMENT", ACC: "CEMENT",
  AMBUJACEM: "CEMENT", SHREECEM: "CEMENT",
  // Real Estate
  DLF: "REALESTATE", LODHA: "REALESTATE",
  // Capital Goods / Industrials
  LT: "INDUSTRIALS", SIEMENS: "INDUSTRIALS", ABB: "INDUSTRIALS",
  HAL: "INDUSTRIALS", HAVELLS: "INDUSTRIALS", BEL: "INDUSTRIALS",
  BHEL: "INDUSTRIALS", PIDILITIND: "INDUSTRIALS", SRF: "INDUSTRIALS",
  // Consumer Discretionary
  TITAN: "CONSUMER", TRENT: "CONSUMER", ASIANPAINT: "CONSUMER",
  INDHOTEL: "CONSUMER",
  // Transport
  INDIGO: "TRANSPORT", IRCTC: "TRANSPORT",
  // Telecom
  BHARTIARTL: "TELECOM",
  // Insurance (already in FINANCIAL)
  IIFL: "FINANCIAL",
};

export function getSector(symbol: string): string {
  return SECTOR_MAPPINGS[symbol] || "OTHER";
}
