/**
 * stockIntelligence.ts — Core domain types for North Stock Intelligence.
 *
 * These types define the shape of all domain objects flowing through the
 * stock intelligence pipeline: market data, indicators, signals, scores,
 * recommendations, risk snapshots, backtesting results, and paper trades.
 *
 * Do NOT define ad-hoc inline types in services; import from here instead.
 */

import type { MarketRegime, StrategyName } from "../config/stockEngineDefaults";
import type { FinancialPhase } from "../config/investmentDefaults";

// ─── Market Data ─────────────────────────────────────────────────────────────

export type DataQuality = "VALID" | "STALE" | "PARTIAL" | "INVALID" | "MISSING";

export type MarketBar = {
  symbol: string;
  exchange: string;
  date: string; // ISO date YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
  adjustedClose: number | null;
  volume: number;
  provider: string;
  retrievedAt: Date;
  quality: DataQuality;
};

export type DataProviderStatus = {
  provider: string;
  lastSuccessfulFetch: Date | null;
  lastFailedFetch: Date | null;
  lastError: string | null;
  consecutiveFailures: number;
  isHealthy: boolean;
};

export type MarketDataFreshness = {
  symbol: string;
  latestDate: string | null;
  latestClose: number | null;
  dataAgeHours: number | null;
  isFresh: boolean;
  quality: DataQuality;
};

// ─── Technical Indicators ────────────────────────────────────────────────────

export type IndicatorValue = {
  value: number;
  available: boolean;
  warmupComplete: boolean;
};

export type StockIndicators = {
  symbol: string;
  date: string;
  /** Simple Moving Averages */
  sma20: IndicatorValue;
  sma50: IndicatorValue;
  sma200: IndicatorValue;
  /** Exponential Moving Averages */
  ema20: IndicatorValue;
  ema50: IndicatorValue;
  /** RSI 14 */
  rsi14: IndicatorValue;
  /** MACD */
  macd: { macdLine: number; signalLine: number; histogram: number; available: boolean };
  /** ATR 14 */
  atr14: IndicatorValue;
  /** Historical Volatility (annualized %) */
  historicalVolatility: IndicatorValue;
  /** Returns over lookback windows */
  returns5d: IndicatorValue;
  returns10d: IndicatorValue;
  returns20d: IndicatorValue;
  returns60d: IndicatorValue;
  /** Relative strength vs benchmark */
  relativeStrength: IndicatorValue;
  /** Volume relative to baseline (ratio) */
  volumeRatio: IndicatorValue;
  /** Trend slope (normalized) */
  trendSlope: IndicatorValue;
  /** Distance from 52-week high (%) */
  distanceFromHigh: IndicatorValue;
  /** Distance from 52-week low (%) */
  distanceFromLow: IndicatorValue;
  /** Max drawdown over 60 days */
  maxDrawdown60d: IndicatorValue;
  /** Average daily turnover (₹) */
  avgTurnover: IndicatorValue;
  /** Gap risk: max single-day gap in lookback (%) */
  maxGap: IndicatorValue;
};

// ─── Stock Universe & Eligibility ────────────────────────────────────────────

export type EligibilityStatus = "ELIGIBLE" | "INELIGIBLE";

export type EligibilityResult = {
  symbol: string;
  status: EligibilityStatus;
  reasons: string[];
  dataCompleteness: number; // 0-1
  avgVolume: number;
  historyDays: number;
};

// ─── Scoring ─────────────────────────────────────────────────────────────────

export type ScoreComponent = {
  name: string;
  rawValue: number;
  normalizedValue: number; // 0-100
  weight: number;
  weightedScore: number;
  available: boolean;
};

export type StockScore = {
  symbol: string;
  date: string;
  totalScore: number; // 0-100
  components: {
    trendQuality: ScoreComponent;
    momentum: ScoreComponent;
    marketSectorStrength: ScoreComponent;
    fundamentalQuality: ScoreComponent;
    riskLiquidity: ScoreComponent;
  };
  dataQualityScore: number; // 0-100
  overallConfidence: number; // 0-100 (affected by missing data)
};

// ─── Strategy Signals ────────────────────────────────────────────────────────

export type SignalType = "BUY" | "SELL" | "HOLD" | "NONE";

export type StrategySignal = {
  symbol: string;
  strategy: StrategyName;
  strategyVersion: string;
  date: string;
  signal: SignalType;
  entryPrice: number | null;
  entryCondition: string;
  stopLoss: number | null;
  targetPrice: number | null;
  expectedHoldingDays: number;
  riskRewardRatio: number | null;
  confidence: number; // 0-100
  reasons: string[];
  contraReasons: string[];
  cancellationConditions: string[];
  maxChasePrice: number | null;
};

// ─── Capital Allocation ──────────────────────────────────────────────────────

export type CapitalAllocation = {
  timestamp: Date;
  /** Verified liquid cash balance */
  verifiedLiquidCash: number;
  /** Protected emergency reserve */
  protectedEmergencyReserve: number;
  /** Cash needed for essential expenses */
  essentialExpensesCash: number;
  /** Near-term goal commitments */
  nearTermGoalCommitments: number;
  /** Known upcoming obligations */
  upcomingObligations: number;
  /** Other explicitly protected cash */
  otherProtectedCash: number;
  /** Potentially deployable cash (before phase/risk limits) */
  potentiallyDeployableCash: number;
  /** Current financial phase */
  financialPhase: FinancialPhase;
  /** Phase-specific maximum trading capital percentage */
  phaseMaxPct: number;
  /** Phase-limited trading capital */
  phaseLimitedCapital: number;
  /** Market regime */
  marketRegime: MarketRegime;
  /** Regime-limited exposure */
  regimeLimitedCapital: number;
  /** Capital already deployed in direct equity */
  deployedCapital: number;
  /** Final eligible new-purchase budget */
  eligibleNewPurchaseBudget: number;
  /** Binding constraint that determined the final budget */
  bindingConstraint: string;
  /** Breakdown explanations */
  deductions: Array<{ label: string; amount: number; source: string }>;
  /** Data freshness */
  dataTimestamp: Date;
  /** Warnings */
  warnings: string[];
};

// ─── Position Sizing ─────────────────────────────────────────────────────────

export type PositionSize = {
  symbol: string;
  /** Risk-based quantity */
  riskBasedQuantity: number;
  /** Capital-based quantity */
  capitalBasedQuantity: number;
  /** Final recommended quantity (whole shares) */
  finalQuantity: number;
  /** Binding constraint */
  bindingConstraint: string;
  /** Estimated capital required */
  estimatedCapital: number;
  /** Estimated transaction costs */
  estimatedCosts: number;
  /** Risk amount (quantity × distance to stop) */
  riskAmount: number;
  /** Position allocation after purchase (% of portfolio) */
  allocationPct: number;
  /** Sector exposure after purchase (%) */
  sectorExposurePct: number;
  /** Rejected reason (null if quantity > 0) */
  rejectedReason: string | null;
};

// ─── Recommendations ─────────────────────────────────────────────────────────

export type RecommendationType = "BUY" | "HOLD" | "SELL";

export type BuyRecommendation = {
  type: "BUY";
  symbol: string;
  exchange: string;
  timestamp: Date;
  latestPrice: number;
  latestPriceTimestamp: Date;
  dataSource: string;
  strategy: StrategyName;
  strategyVersion: string;
  score: StockScore;
  entryPrice: number;
  entryCondition: string;
  quantity: number;
  estimatedCapital: number;
  estimatedCosts: number;
  stopLoss: number;
  targetPrice: number | null;
  trailingExitRules: string;
  expectedHoldingDays: number;
  riskRewardRatio: number;
  portfolioAllocationAfter: number;
  sectorExposureAfter: number;
  reasonsFor: string[];
  reasonsAgainst: string[];
  uncertainties: string[];
  cancellationConditions: string[];
  maxChasePrice: number;
};

export type HoldRecommendation = {
  type: "HOLD";
  symbol: string;
  exchange: string;
  timestamp: Date;
  quantity: number;
  averageCost: number | null;
  latestPrice: number;
  latestPriceTimestamp: Date;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  portfolioAllocation: number;
  originalThesis: string;
  currentSignal: string;
  updatedStopLoss: number | null;
  exitConditions: string[];
  reasonsToHold: string[];
  conditionsToChange: string[];
};

export type SellRecommendation = {
  type: "SELL";
  symbol: string;
  exchange: string;
  timestamp: Date;
  heldQuantity: number;
  sellQuantity: number;
  isFullExit: boolean;
  latestPrice: number;
  latestPriceTimestamp: Date;
  averageCost: number | null;
  realizedPnlEstimate: number | null;
  reason: string;
  trigger: string;
  estimatedCosts: number;
  urgency: "IMMEDIATE" | "CONDITIONAL" | "NEXT_SESSION";
};

export type Recommendation = BuyRecommendation | HoldRecommendation | SellRecommendation;

export type RecommendationRun = {
  id: string;
  timestamp: Date;
  marketSessionDate: string;
  marketRegime: MarketRegime;
  financialPhase: FinancialPhase;
  capitalAllocation: CapitalAllocation;
  dataQuality: DataQuality;
  strategyVersions: Record<StrategyName, string>;
  recommendations: Recommendation[];
  candidateCount: number;
  eligibleCount: number;
  rejections: Array<{ symbol: string; reason: string }>;
  warnings: string[];
  aiExplanation: string | null;
  status: "COMPLETE" | "PARTIAL" | "FAILED";
  pipelineDurationMs: number;
};

// ─── Portfolio Risk Snapshot ─────────────────────────────────────────────────

export type PortfolioRiskSnapshot = {
  timestamp: Date;
  equityPeak: number;
  currentEquity: number;
  drawdownPct: number;
  drawdownStatus: "NORMAL" | "WARNING" | "RESTRICTED" | "HALTED";
  directEquityExposurePct: number;
  totalEstimatedEquityExposurePct: number;
  sectorConcentration: Record<string, number>;
  positionConcentration: Record<string, number>;
  openPositionCount: number;
  cashPct: number;
};

// ─── Paper Trading ───────────────────────────────────────────────────────────

export type PaperTradeStatus = "OPEN" | "CLOSED" | "STOPPED" | "EXPIRED";

export type PaperTrade = {
  id: string;
  symbol: string;
  exchange: string;
  strategy: StrategyName;
  side: "BUY" | "SELL";
  quantity: number;
  entryPrice: number;
  entryDate: string;
  exitPrice: number | null;
  exitDate: string | null;
  stopLoss: number;
  targetPrice: number | null;
  status: PaperTradeStatus;
  pnl: number;
  pnlPct: number;
  costs: number;
  holdingDays: number;
  exitReason: string | null;
};

export type PaperPortfolio = {
  virtualCash: number;
  initialCash: number;
  positions: PaperTrade[];
  closedTrades: PaperTrade[];
  totalEquity: number;
  equityPeak: number;
  drawdownPct: number;
  totalPnl: number;
  totalCosts: number;
  winRate: number;
  tradeCount: number;
  startDate: string;
};

// ─── Backtesting ─────────────────────────────────────────────────────────────

export type BacktestResult = {
  strategyName: StrategyName;
  strategyVersion: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalCapital: number;
  cumulativeReturn: number;
  annualizedReturn: number | null;
  benchmarkReturn: number;
  excessReturn: number;
  maxDrawdown: number;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  winRate: number;
  avgWinPct: number;
  avgLossPct: number;
  profitFactor: number;
  expectancyPerTrade: number;
  totalTrades: number;
  avgHoldingDays: number;
  volatility: number;
  turnover: number;
  totalCosts: number;
  timeInMarketPct: number;
  worstTrade: { symbol: string; pnlPct: number; date: string } | null;
  trades: Array<{
    symbol: string;
    entryDate: string;
    exitDate: string;
    entryPrice: number;
    exitPrice: number;
    quantity: number;
    pnl: number;
    pnlPct: number;
    costs: number;
    holdingDays: number;
    exitReason: string;
  }>;
  limitations: string[];
  dataRange: { totalDays: number; tradingDays: number; missingDays: number };
};

// ─── Daily Summary ───────────────────────────────────────────────────────────

export type DailySummary = {
  date: string;
  marketRegime: MarketRegime;
  tradingEligible: boolean;
  tradingBlockedReasons: string[];
  portfolioValue: number;
  portfolioValueTimestamp: Date;
  eligibleCapital: number;
  deployedCapital: number;
  proposedNewCapital: number;
  cashRemaining: number;
  drawdownPct: number;
  riskRestrictions: string[];
  buyCount: number;
  holdCount: number;
  sellCount: number;
  dataFreshness: "FRESH" | "STALE" | "UNAVAILABLE";
  lastAnalysis: Date | null;
  systemStatus: "HEALTHY" | "DEGRADED" | "ERROR";
  warnings: string[];
};

// ─── Pipeline Status ─────────────────────────────────────────────────────────

export type PipelineStage =
  | "FINANCIAL_CHECK"
  | "CALENDAR_CHECK"
  | "DATA_FETCH"
  | "DATA_VALIDATE"
  | "UNIVERSE_REFRESH"
  | "REGIME_COMPUTE"
  | "INDICATOR_COMPUTE"
  | "STRATEGY_EVALUATE"
  | "CAPITAL_CALCULATE"
  | "RECOMMENDATION_GENERATE"
  | "AI_EXPLAIN"
  | "DASHBOARD_REFRESH"
  | "STATUS_RECORD";

export type PipelineStatus = {
  runId: string;
  startedAt: Date;
  completedAt: Date | null;
  stages: Array<{
    stage: PipelineStage;
    status: "PENDING" | "RUNNING" | "COMPLETE" | "FAILED" | "SKIPPED";
    startedAt: Date | null;
    completedAt: Date | null;
    error: string | null;
  }>;
  overallStatus: "RUNNING" | "COMPLETE" | "PARTIAL" | "FAILED";
};
