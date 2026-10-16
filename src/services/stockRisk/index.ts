/**
 * stockRisk/index.ts — Risk Management and Position Sizing Engine.
 *
 * This is the HIGHEST PRIORITY module. Risk management is a mandatory gate.
 * A high score cannot override a risk violation.
 *
 * Responsibilities:
 *   - Portfolio drawdown tracking and enforcement
 *   - Position sizing (risk-based and capital-based)
 *   - Sector/position concentration limits
 *   - Capital allocation from financial profile
 *   - Financial phase trading restrictions
 *   - Stop-loss calculation (ATR-based)
 *   - Trade eligibility verification
 */

import { prisma } from "../../lib/prisma";
import {
  RISK_CONFIG,
  TRADING_COSTS,
  PHASE_TRADING_POLICY,
  REGIME_POLICY,
  getSector,
} from "../../config/stockEngineDefaults";
import type { MarketRegime } from "../../config/stockEngineDefaults";
import type { FinancialPhase } from "../../config/investmentDefaults";
import type {
  CapitalAllocation,
  AllocationStatus,
  PositionSize,
  PortfolioRiskSnapshot,
  IndicatorValue,
} from "../../types/stockIntelligence";
import { calculateBurnRate, calculateRunway } from "../analytics";
import { getEmergencyFundStatus } from "../emergencyFund";
import { determinePhase, computeSurplus, detectSalaryCycle, getOrGenerateInvestmentSuggestion } from "../investmentEngine";

// ─── Capital Allocation ──────────────────────────────────────────────────────

/**
 * Calculate the eligible trading capital from the user's complete financial position.
 * This is the most critical function — it determines how much money is safe to deploy.
 *
 * Formula:
 *   Verified liquid cash
 *   − protected emergency reserve
 *   − cash needed for essential expenses
 *   − near-term goal commitments
 *   − known upcoming obligations
 *   − other explicitly protected cash
 *   = potentially deployable cash
 *
 * Then apply: min(deployable, phase limit, regime limit, risk limit)
 */
export async function calculateCapitalAllocation(
  marketRegime: MarketRegime,
): Promise<CapitalAllocation> {
  const now = new Date();
  const deductions: CapitalAllocation["deductions"] = [];
  const warnings: string[] = [];

  // 1. Get financial profile
  const profile = await prisma.financialProfile.findFirst();
  if (!profile) {
    return createBlockedAllocation(
      "MISSING_PROFILE",
      "No financial profile found. Complete profile setup to determine trading budget.",
      now,
      marketRegime
    );
  }

  const verifiedLiquidCash = Math.max(0, profile.balance ?? 0);
  if (verifiedLiquidCash === 0) {
    warnings.push("Liquid bank balance is ₹0. No cash available for trading.");
  }

  // 2. Emergency fund reserve accounting (Authoritative from emergencyFund.ts)
  let efStatus: Awaited<ReturnType<typeof getEmergencyFundStatus>>;
  try {
    efStatus = await getEmergencyFundStatus();
  } catch (err) {
    console.warn("[stockRisk] Failed to fetch emergency fund status, using fallback:", err);
    const fallbackMonths = Math.max(3, profile.emergencyFundMonths ?? 6);
    const fallbackExp = Math.max(0, profile.monthlyExpenses ?? 0);
    const fallbackTarget = fallbackMonths * fallbackExp;
    efStatus = {
      targetMonths: fallbackMonths,
      avgMonthlyExpenses: fallbackExp,
      targetAmount: fallbackTarget,
      savedAmount: Math.min(verifiedLiquidCash, fallbackTarget),
      availableBalance: Math.max(0, verifiedLiquidCash - fallbackTarget),
      progressPct: fallbackTarget > 0 ? (verifiedLiquidCash / fallbackTarget) * 100 : 100,
      shortfall: Math.max(0, fallbackTarget - verifiedLiquidCash),
      monthsToComplete: null,
      estimatedCompletionDate: null,
      isComplete: verifiedLiquidCash >= fallbackTarget && fallbackTarget > 0,
      monthlyCapacity: Math.max(0, (profile.monthlyIncome ?? 0) - (profile.monthlyExpenses ?? 0)),
      efStrategy: (profile.efStrategy as any) || "BALANCED",
      efRatio: 0.7,
      goalsRatio: 0.3,
      tier: verifiedLiquidCash >= fallbackTarget ? 3 : 2,
      efMonthlyDrip: 0,
      availableGoalCapacity: 0,
      investableCarveout: 0,
      mfInvestableCarveout: 0,
      stockInvestableCarveout: 0,
    };
    warnings.push("Authoritative emergency fund status unavailable; using profile fallback.");
  }

  const efTargetAmount = Math.max(0, efStatus.targetAmount);
  const efAllocatedCash = Math.min(verifiedLiquidCash, Math.max(0, efStatus.savedAmount));
  const efShortfall = Math.max(0, efTargetAmount - efAllocatedCash);
  const protectedEmergencyReserve = efAllocatedCash;
  const essentialExpensesCash = 0;
  const nearTermGoalCommitments = 0;
  const upcomingObligations = 0;
  const otherProtectedCash = 0;
  const totalDeductions = 0;

  // 2. Authoritative Cycle Stock Trading Allocation from Investment Engine
  let currentCycleSuggestion: any = null;
  try {
    const sugResult = await getOrGenerateInvestmentSuggestion();
    currentCycleSuggestion = sugResult?.suggestion ?? null;
  } catch {
    currentCycleSuggestion = await prisma.investmentSuggestion.findFirst({
      orderBy: { createdAt: "desc" },
    });
  }

  // Cycle Stock Trading Balance from current cycle suggestion
  const cycleStockTradingPool = currentCycleSuggestion?.stockCycle?.totalInvestable
    ?? currentCycleSuggestion?.totalStockInvestable
    ?? 0;
  const remainingCycleStockBalance = currentCycleSuggestion?.stockCycle?.remainingStockBalance
    ?? currentCycleSuggestion?.remainingStockBalance
    ?? cycleStockTradingPool;

  const cycleMfInvestable = currentCycleSuggestion?.totalInvestable ?? 0;

  // Direct-equity swing trading operates on the cycle's stock credit, bounded by available bank balance
  const potentiallyDeployableCash = Math.min(verifiedLiquidCash, remainingCycleStockBalance);

  // 3. Financial phase restriction
  const cycleInfo = await detectSalaryCycle();
  const surplusComp = await computeSurplus(cycleInfo.cycleDays);
  const burnData = await calculateBurnRate();
  const runway = await calculateRunway({ burnData });

  const efComplete = efStatus.isComplete;
  const sixMonthsFromNow = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
  const imminentGoals = await prisma.goal.findMany({
    where: {
      targetDate: { lte: sixMonthsFromNow },
      status: { not: "COMPLETED" },
    },
    select: { id: true },
  });

  const financialPhase = determinePhase(
    surplusComp.smoothedSurplus,
    runway.runwayMonths ?? 0,
    efComplete,
    imminentGoals.length > 0,
  );

  const phasePolicy = PHASE_TRADING_POLICY[financialPhase];
  const phaseMaxPct = phasePolicy.maxTradingCapitalPct;

  const phaseLimitedCapital = phasePolicy.newPurchasesAllowed
    ? potentiallyDeployableCash
    : 0;

  if (!phasePolicy.newPurchasesAllowed) {
    warnings.push(`New purchases blocked: ${phasePolicy.description}`);
  }

  // 8. Market regime restriction
  const regimePolicy = REGIME_POLICY[marketRegime];
  const regimeLimitedCapital = regimePolicy.newPurchasesAllowed
    ? Math.round(phaseLimitedCapital * (regimePolicy.maxExposurePct / 100))
    : 0;

  if (!regimePolicy.newPurchasesAllowed) {
    warnings.push(`New purchases blocked by market regime: ${regimePolicy.description}`);
  }

  // 9. Existing direct-equity exposure (Section 4: Separate cash from exposure)
  const stocks = prisma.stock
    ? await prisma.stock.findMany({
        where: { currentQuantity: { gt: 0 } },
      })
    : [];
  const deployedCapital = stocks.reduce((sum, s) => sum + (s.currentWorth ?? 0), 0);

  // Total trading capital base: unreserved liquid cash + existing equity holdings
  const totalTradingBase = potentiallyDeployableCash + deployedCapital;

  // Maximum permitted total direct-equity exposure across portfolio governed by phase & regime caps
  const maxPermittedExposure = (phasePolicy.newPurchasesAllowed && regimePolicy.newPurchasesAllowed)
    ? (cycleStockTradingPool > 0
        ? Math.round(totalTradingBase * (regimePolicy.maxExposurePct / 100))
        : Math.round(totalTradingBase * (phaseMaxPct / 100) * (regimePolicy.maxExposurePct / 100)))
    : 0;

  // Remaining exposure capacity after accounting for existing holdings
  const remainingExposureCapacity = Math.max(0, maxPermittedExposure - deployedCapital);

  // Cash constraint: available unreserved cash scaled by phase and regime policy
  const cashCapacity = regimeLimitedCapital;

  // 10. Final eligible budget: CANNOT exceed unreserved cash capacity AND CANNOT exceed remaining exposure capacity
  let eligibleNewPurchaseBudget = 0;
  let status: AllocationStatus = "ACTIVE";
  let statusReason = "Calculated safe trading budget";
  let bindingConstraint = "none";

  if (!phasePolicy.newPurchasesAllowed) {
    eligibleNewPurchaseBudget = 0;
    status = "BLOCKED_BY_PHASE";
    statusReason = phasePolicy.description;
    bindingConstraint = `phase_blocked_${financialPhase.toLowerCase()}`;
  } else if (!regimePolicy.newPurchasesAllowed) {
    eligibleNewPurchaseBudget = 0;
    status = "BLOCKED_BY_REGIME";
    statusReason = regimePolicy.description;
    bindingConstraint = `regime_blocked_${marketRegime.toLowerCase()}`;
  } else if (potentiallyDeployableCash === 0) {
    eligibleNewPurchaseBudget = 0;
    status = remainingCycleStockBalance === 0
      ? "CYCLE_BUDGET_EXHAUSTED"
      : "ZERO_SURPLUS";
    statusReason = cycleStockTradingPool > 0
      ? "Cycle stock trading credit is exhausted (₹0 remaining). Budget resets on next cycle rollover."
      : "No stock trading credit allocated for current cycle. Generates on next investment cycle.";
    bindingConstraint = "cycle_budget_exhausted";
  } else if (remainingExposureCapacity === 0 && deployedCapital > 0) {
    eligibleNewPurchaseBudget = 0;
    status = "EXPOSURE_CAP_REACHED";
    statusReason = `Existing stock exposure (₹${deployedCapital.toLocaleString("en-IN")}) meets or exceeds the permitted exposure cap (₹${maxPermittedExposure.toLocaleString("en-IN")}).`;
    bindingConstraint = "exposure_cap_limit";
  } else {
    eligibleNewPurchaseBudget = Math.min(cashCapacity, remainingExposureCapacity);
    status = "ACTIVE";
    statusReason = eligibleNewPurchaseBudget > 0
      ? "Budget verified and ready for deployment."
      : "Calculated zero budget.";
    if (remainingExposureCapacity < cashCapacity) {
      bindingConstraint = "exposure_cap_limit";
    } else {
      bindingConstraint = cycleStockTradingPool > 0 ? "cycle_stock_credit_limit" : "cash_capacity_limit";
    }
  }

  return {
    timestamp: now,
    status,
    statusReason,
    verifiedLiquidCash,
    efTargetAmount,
    efAllocatedCash,
    efShortfall,
    protectedEmergencyReserve,
    essentialExpensesCash,
    nearTermGoalCommitments,
    upcomingObligations,
    otherProtectedCash,
    totalDeductions,
    potentiallyDeployableCash,
    financialPhase,
    phaseMaxPct,
    phaseLimitedCapital,
    marketRegime,
    regimeLimitedCapital,
    totalTradingBase,
    maxPermittedExposure,
    remainingExposureCapacity,
    deployedCapital,
    eligibleNewPurchaseBudget,
    bindingConstraint,
    deductions,
    dataTimestamp: now,
    warnings,
    cycleStockTradingPool,
    remainingCycleStockBalance,
    cycleMfInvestable,
  };
}

function createBlockedAllocation(
  status: AllocationStatus,
  reason: string,
  now: Date,
  regime: MarketRegime,
  verifiedLiquidCash = 0,
): CapitalAllocation {
  return {
    timestamp: now,
    status,
    statusReason: reason,
    verifiedLiquidCash,
    efTargetAmount: 0,
    efAllocatedCash: 0,
    efShortfall: 0,
    protectedEmergencyReserve: 0,
    essentialExpensesCash: 0,
    nearTermGoalCommitments: 0,
    upcomingObligations: 0,
    otherProtectedCash: 0,
    totalDeductions: 0,
    potentiallyDeployableCash: 0,
    financialPhase: "CRISIS",
    phaseMaxPct: 0,
    phaseLimitedCapital: 0,
    marketRegime: regime,
    regimeLimitedCapital: 0,
    totalTradingBase: 0,
    maxPermittedExposure: 0,
    remainingExposureCapacity: 0,
    deployedCapital: 0,
    eligibleNewPurchaseBudget: 0,
    bindingConstraint: reason,
    deductions: [],
    dataTimestamp: now,
    warnings: [reason],
    cycleStockTradingPool: 0,
    remainingCycleStockBalance: 0,
    cycleMfInvestable: 0,
  };
}

// ─── Drawdown Management ────────────────────────────────────────────────────

/**
 * Calculate portfolio drawdown from the equity peak.
 */
export async function calculateDrawdown(): Promise<PortfolioRiskSnapshot> {
  const now = new Date();

  // Get current stock portfolio value
  const stocks = await prisma.stock.findMany({
    where: { currentQuantity: { gt: 0 } },
  });

  const stockValue = stocks.reduce((sum, s) => sum + (s.currentWorth ?? 0), 0);

  // Get paper portfolio value
  const paperPortfolio = await prisma.stockPaperPortfolio.findFirst({
    where: { isActive: true },
    include: { trades: { where: { status: "OPEN" } } },
  });

  const paperValue = paperPortfolio
    ? paperPortfolio.virtualCash + paperPortfolio.trades.reduce((sum, t) => sum + t.entryPrice * t.quantity, 0)
    : 0;

  const currentEquity = stockValue + paperValue;

  // Get last recorded peak, or use current equity as the initial peak
  const lastSnapshot = await prisma.stockPortfolioRiskSnapshot.findFirst({
    orderBy: { snapshotAt: "desc" },
  });

  const equityPeak = lastSnapshot
    ? Math.max(lastSnapshot.equityPeak, currentEquity)
    : currentEquity > 0 ? currentEquity : 1; // Avoid division by zero

  const drawdownPct = equityPeak > 0 ? ((equityPeak - currentEquity) / equityPeak) * 100 : 0;

  let drawdownStatus: PortfolioRiskSnapshot["drawdownStatus"] = "NORMAL";
  if (drawdownPct >= RISK_CONFIG.drawdownHaltPct) {
    drawdownStatus = "HALTED";
  } else if (drawdownPct >= RISK_CONFIG.drawdownRestrictedPct) {
    drawdownStatus = "RESTRICTED";
  } else if (drawdownPct >= RISK_CONFIG.drawdownWarningPct) {
    drawdownStatus = "WARNING";
  }

  // Sector and position concentration
  const sectorConcentration: Record<string, number> = {};
  const positionConcentration: Record<string, number> = {};
  const totalValue = currentEquity || 1;

  for (const stock of stocks) {
    const value = stock.currentWorth ?? 0;
    const pct = (value / totalValue) * 100;
    positionConcentration[stock.symbol] = pct;

    const sector = getSector(stock.symbol);
    sectorConcentration[sector] = (sectorConcentration[sector] ?? 0) + pct;
  }

  const snapshot: PortfolioRiskSnapshot = {
    timestamp: now,
    equityPeak,
    currentEquity,
    drawdownPct: Math.round(drawdownPct * 100) / 100,
    drawdownStatus,
    directEquityExposurePct: stockValue > 0 ? 100 : 0,
    totalEstimatedEquityExposurePct: 0, // Would include MF look-through if available
    sectorConcentration,
    positionConcentration,
    openPositionCount: stocks.filter((s) => s.currentQuantity > 0).length,
    cashPct: 0,
  };

  // Persist snapshot
  try {
    await prisma.stockPortfolioRiskSnapshot.create({
      data: {
        equityPeak: snapshot.equityPeak,
        currentEquity: snapshot.currentEquity,
        drawdownPct: snapshot.drawdownPct,
        drawdownStatus: snapshot.drawdownStatus,
        directEquityExposurePct: snapshot.directEquityExposurePct,
        totalEstEquityExposurePct: snapshot.totalEstimatedEquityExposurePct,
        sectorConcentration: JSON.stringify(snapshot.sectorConcentration),
        positionConcentration: JSON.stringify(snapshot.positionConcentration),
        openPositionCount: snapshot.openPositionCount,
        cashPct: snapshot.cashPct,
      },
    });
  } catch (err) {
    console.error("[stockRisk] Failed to persist risk snapshot:", err);
  }

  return snapshot;
}

// ─── Position Sizing ─────────────────────────────────────────────────────────

/**
 * Calculate position size for a proposed trade.
 *
 * Final quantity = min(risk-based, capital-based, allocation cap, sector cap, cash available)
 * Always returns whole shares (floor).
 */
export function calculatePositionSize(
  symbol: string,
  entryPrice: number,
  stopLoss: number,
  availableCapital: number,
  totalPortfolioValue: number,
  currentSectorExposure: number,
  currentPositionCount: number,
): PositionSize {
  const rejectedResult = (reason: string): PositionSize => ({
    symbol,
    riskBasedQuantity: 0,
    capitalBasedQuantity: 0,
    finalQuantity: 0,
    bindingConstraint: reason,
    estimatedCapital: 0,
    estimatedCosts: 0,
    riskAmount: 0,
    allocationPct: 0,
    sectorExposurePct: currentSectorExposure,
    rejectedReason: reason,
  });

  // Validate inputs
  if (entryPrice <= 0 || !Number.isFinite(entryPrice)) {
    return rejectedResult("Invalid entry price");
  }
  if (stopLoss <= 0 || stopLoss >= entryPrice) {
    return rejectedResult("Invalid stop loss (must be > 0 and < entry price)");
  }
  if (availableCapital <= 0) {
    return rejectedResult("No available capital");
  }

  // Risk per share
  const riskPerShare = entryPrice - stopLoss;
  if (riskPerShare <= 0) {
    return rejectedResult("Risk per share is zero or negative");
  }

  // Max position risk amount
  const maxPositionRisk = totalPortfolioValue * (RISK_CONFIG.maxPositionRiskPct / 100);

  // Risk-based quantity
  const riskBasedQuantity = Math.floor(maxPositionRisk / riskPerShare);

  // Capital allocation cap for single position
  const maxPositionCapital = totalPortfolioValue * (RISK_CONFIG.maxSinglePositionPct / 100);
  const capitalBasedQuantity = Math.floor(Math.min(availableCapital, maxPositionCapital) / entryPrice);

  // Sector cap
  const _sector = getSector(symbol);
  const maxSectorCapital = totalPortfolioValue * (RISK_CONFIG.maxSectorConcentrationPct / 100);
  const currentSectorValue = totalPortfolioValue * (currentSectorExposure / 100);
  const sectorRemainder = Math.max(0, maxSectorCapital - currentSectorValue);
  const sectorBasedQuantity = Math.floor(sectorRemainder / entryPrice);

  // Maximum concurrent positions
  if (currentPositionCount >= RISK_CONFIG.maxOpenPositions) {
    return rejectedResult(`Maximum open positions (${RISK_CONFIG.maxOpenPositions}) reached`);
  }

  // Final quantity: most restrictive
  const quantities = [
    { name: "risk_based", qty: riskBasedQuantity },
    { name: "capital_based", qty: capitalBasedQuantity },
    { name: "sector_cap", qty: sectorBasedQuantity },
  ];

  const sorted = [...quantities].sort((a, b) => a.qty - b.qty);
  const finalQuantity = Math.max(0, sorted[0].qty);

  if (finalQuantity === 0) {
    return rejectedResult(`Insufficient capacity: ${sorted[0].name} constraint yields 0 shares`);
  }

  // Check risk/reward
  // (This is a basic check; strategies should set target prices for proper R/R calculation)

  const estimatedCapital = finalQuantity * entryPrice;
  const estimatedCosts = TRADING_COSTS.estimateBuyCost(estimatedCapital);
  const riskAmount = finalQuantity * riskPerShare;
  const allocationPct = totalPortfolioValue > 0
    ? ((estimatedCapital / totalPortfolioValue) * 100)
    : 0;

  const newSectorExposure = currentSectorExposure +
    (totalPortfolioValue > 0 ? (estimatedCapital / totalPortfolioValue) * 100 : 0);

  return {
    symbol,
    riskBasedQuantity,
    capitalBasedQuantity,
    finalQuantity,
    bindingConstraint: sorted[0].name,
    estimatedCapital,
    estimatedCosts,
    riskAmount,
    allocationPct: Math.round(allocationPct * 100) / 100,
    sectorExposurePct: Math.round(newSectorExposure * 100) / 100,
    rejectedReason: null,
  };
}

// ─── Stop Loss Calculation ───────────────────────────────────────────────────

/**
 * Calculate ATR-based stop loss for a stock.
 * Returns stop price or null if ATR is unavailable.
 */
export function calculateStopLoss(
  currentPrice: number,
  atr: IndicatorValue,
  multiplier: number = RISK_CONFIG.stopLossAtrMultiplier,
): number | null {
  if (!atr.available || atr.value <= 0 || currentPrice <= 0) {
    return null;
  }

  const stopDistance = atr.value * multiplier;
  const stopPrice = currentPrice - stopDistance;

  // Enforce max stop distance
  const maxDistance = currentPrice * (RISK_CONFIG.maxStopLossDistancePct / 100);
  const effectiveStop = Math.max(stopPrice, currentPrice - maxDistance);

  // Stop must be above 0
  return effectiveStop > 0 ? Math.round(effectiveStop * 100) / 100 : null;
}

// ─── Trade Eligibility Check ─────────────────────────────────────────────────

/**
 * Check if a trade passes all hard risk constraints.
 * Returns { eligible: true } or { eligible: false, reasons: [...] }.
 */
export function checkTradeEligibility(params: {
  financialPhase: FinancialPhase;
  marketRegime: MarketRegime;
  drawdownStatus: PortfolioRiskSnapshot["drawdownStatus"];
  dataQuality: string;
  entryPrice: number;
  stopLoss: number | null;
  positionSize: PositionSize;
  riskRewardRatio: number | null;
}): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Phase check
  if (!PHASE_TRADING_POLICY[params.financialPhase].newPurchasesAllowed) {
    reasons.push(`Financial phase ${params.financialPhase} blocks new purchases`);
  }

  // Regime check
  if (!REGIME_POLICY[params.marketRegime].newPurchasesAllowed) {
    reasons.push(`Market regime ${params.marketRegime} blocks new purchases`);
  }

  // Drawdown check
  if (params.drawdownStatus === "HALTED") {
    reasons.push("Portfolio drawdown has reached halt threshold — new purchases blocked");
  } else if (params.drawdownStatus === "RESTRICTED") {
    reasons.push("Portfolio drawdown is in restricted zone — increased scrutiny required");
  }

  // Data quality
  if (params.dataQuality === "STALE" || params.dataQuality === "INVALID" || params.dataQuality === "MISSING") {
    reasons.push(`Market data quality is ${params.dataQuality} — new purchases blocked`);
  }

  // Stop loss must exist
  if (params.stopLoss == null || params.stopLoss <= 0) {
    reasons.push("No valid stop-loss level — cannot size the risk");
  }

  // Position size must be > 0
  if (params.positionSize.rejectedReason) {
    reasons.push(`Position sizing rejected: ${params.positionSize.rejectedReason}`);
  }

  // Risk/reward check
  if (params.riskRewardRatio != null && params.riskRewardRatio < RISK_CONFIG.minRiskRewardRatio) {
    reasons.push(`Risk/reward ratio ${params.riskRewardRatio.toFixed(2)} is below minimum ${RISK_CONFIG.minRiskRewardRatio}`);
  }

  return { eligible: reasons.length === 0, reasons };
}

export { calculateDrawdown as calculatePortfolioRiskSnapshot };
