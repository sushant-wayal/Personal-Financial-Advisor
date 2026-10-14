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
  PositionSize,
  PortfolioRiskSnapshot,
  IndicatorValue,
} from "../../types/stockIntelligence";
import { calculateBurnRate } from "../analytics";
import { getEmergencyFundStatus } from "../emergencyFund";
import { determinePhase, computeSurplus, detectSalaryCycle, getEffectiveProfileConfig } from "../investmentEngine";
import { calculateRunway } from "../analytics";

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
    return createBlockedAllocation("No financial profile found", now, marketRegime);
  }

  const verifiedLiquidCash = Math.max(0, profile.balance);

  // 2. Emergency fund reserve
  let protectedEmergencyReserve = 0;
  try {
    const efStatus = await getEmergencyFundStatus();
    if (!efStatus.isComplete) {
      protectedEmergencyReserve = efStatus.targetAmount;
      deductions.push({
        label: "Emergency fund target (not yet complete)",
        amount: protectedEmergencyReserve,
        source: "emergencyFund",
      });
    }
  } catch {
    // If EF calculation fails, protect 6 months of expenses
    const fallbackEf = (profile.monthlyExpenses || 0) * 6;
    protectedEmergencyReserve = fallbackEf;
    warnings.push("Emergency fund status unavailable; using fallback 6-month protection.");
    deductions.push({
      label: "Emergency fund fallback (6 months expenses)",
      amount: fallbackEf,
      source: "fallback",
    });
  }

  // 3. Essential expenses buffer (1 month)
  const essentialExpensesCash = Math.max(0, profile.monthlyExpenses || 0);
  deductions.push({
    label: "Essential expenses buffer (1 month)",
    amount: essentialExpensesCash,
    source: "financialProfile",
  });

  // 4. Near-term goal commitments (next 6 months)
  const sixMonthsFromNow = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());
  const imminentGoals = await prisma.goal.findMany({
    where: {
      targetDate: { lte: sixMonthsFromNow },
      status: { not: "COMPLETED" },
    },
  });

  let nearTermGoalCommitments = 0;
  for (const goal of imminentGoals) {
    const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
    nearTermGoalCommitments += remaining;
  }
  if (nearTermGoalCommitments > 0) {
    deductions.push({
      label: `Near-term goal commitments (${imminentGoals.length} goals)`,
      amount: nearTermGoalCommitments,
      source: "goals",
    });
  }

  // 5. Known upcoming obligations (EMI, credit card, BNPL due within 30 days)
  let upcomingObligations = 0;

  const loans = await prisma.loanLiability.findMany();
  for (const loan of loans) {
    upcomingObligations += loan.emiAmount;
  }

  const creditCards = await prisma.creditCardLiability.findMany();
  for (const cc of creditCards) {
    upcomingObligations += Math.max(0, cc.currentOutstanding);
  }

  const bnpls = await prisma.bnplLiability.findMany({
    where: { isClosed: false },
  });
  for (const bnpl of bnpls) {
    upcomingObligations += bnpl.monthlyInstallment;
  }

  if (upcomingObligations > 0) {
    deductions.push({
      label: "Upcoming monthly obligations (EMI, CC, BNPL)",
      amount: upcomingObligations,
      source: "liabilities",
    });
  }

  // 6. Other protected cash: active investment suggestions
  let otherProtectedCash = 0;
  const activeInvestment = await prisma.investmentSuggestion.findFirst({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  if (activeInvestment) {
    otherProtectedCash = activeInvestment.totalInvestable;
    deductions.push({
      label: "Active investment suggestion (reserved for SIP/MF)",
      amount: otherProtectedCash,
      source: "investmentEngine",
    });
  }

  // Calculate potentially deployable cash
  const totalDeductions = protectedEmergencyReserve + essentialExpensesCash +
    nearTermGoalCommitments + upcomingObligations + otherProtectedCash;
  const potentiallyDeployableCash = Math.max(0, verifiedLiquidCash - totalDeductions);

  // 7. Financial phase restriction
  const cycleInfo = await detectSalaryCycle();
  const surplusComp = await computeSurplus(cycleInfo.cycleDays);
  const config = await getEffectiveProfileConfig();
  const burnData = await calculateBurnRate();
  const runway = await calculateRunway({ burnData });

  const efTargetMonths = Math.max(3, config.profile?.emergencyFundMonths ?? 6);
  const avgMonthlyExpenses = burnData.burnRate > 0 ? burnData.burnRate : (config.profile?.monthlyExpenses ?? 0);
  const efTargetAmount = efTargetMonths * avgMonthlyExpenses;
  const efComplete = verifiedLiquidCash >= efTargetAmount && efTargetAmount > 0;

  const financialPhase = determinePhase(
    surplusComp.smoothedSurplus,
    runway.runwayMonths ?? 0,
    efComplete,
    imminentGoals.length > 0,
  );

  const phasePolicy = PHASE_TRADING_POLICY[financialPhase];
  const phaseMaxPct = phasePolicy.maxTradingCapitalPct;
  const phaseLimitedCapital = Math.round(potentiallyDeployableCash * (phaseMaxPct / 100));

  if (!phasePolicy.newPurchasesAllowed) {
    warnings.push(`New purchases blocked: ${phasePolicy.description}`);
  }

  // 8. Market regime restriction
  const regimePolicy = REGIME_POLICY[marketRegime];
  const regimeLimitedCapital = Math.round(phaseLimitedCapital * (regimePolicy.maxExposurePct / 100));

  if (!regimePolicy.newPurchasesAllowed) {
    warnings.push(`New purchases blocked by market regime: ${regimePolicy.description}`);
  }

  // 9. Already deployed capital
  const stocks = await prisma.stock.findMany({
    where: { currentQuantity: { gt: 0 } },
  });
  const deployedCapital = stocks.reduce((sum, s) => sum + (s.currentWorth ?? 0), 0);

  // 10. Final eligible budget
  const eligibleNewPurchaseBudget = Math.max(0, Math.round(regimeLimitedCapital - deployedCapital));

  // Determine binding constraint
  let bindingConstraint = "none";
  const candidates = [
    { name: "deployable_cash", value: potentiallyDeployableCash },
    { name: "phase_limit", value: phaseLimitedCapital },
    { name: "regime_limit", value: regimeLimitedCapital },
    { name: "net_of_deployed", value: Math.max(0, regimeLimitedCapital - deployedCapital) },
  ];
  const sortedConstraints = [...candidates].sort((a, b) => a.value - b.value);
  bindingConstraint = sortedConstraints[0].name;

  return {
    timestamp: now,
    verifiedLiquidCash,
    protectedEmergencyReserve,
    essentialExpensesCash,
    nearTermGoalCommitments,
    upcomingObligations,
    otherProtectedCash,
    potentiallyDeployableCash,
    financialPhase,
    phaseMaxPct,
    phaseLimitedCapital,
    marketRegime,
    regimeLimitedCapital,
    deployedCapital,
    eligibleNewPurchaseBudget,
    bindingConstraint,
    deductions,
    dataTimestamp: now,
    warnings,
  };
}

function createBlockedAllocation(reason: string, now: Date, regime: MarketRegime): CapitalAllocation {
  return {
    timestamp: now,
    verifiedLiquidCash: 0,
    protectedEmergencyReserve: 0,
    essentialExpensesCash: 0,
    nearTermGoalCommitments: 0,
    upcomingObligations: 0,
    otherProtectedCash: 0,
    potentiallyDeployableCash: 0,
    financialPhase: "CRISIS",
    phaseMaxPct: 0,
    phaseLimitedCapital: 0,
    marketRegime: regime,
    regimeLimitedCapital: 0,
    deployedCapital: 0,
    eligibleNewPurchaseBudget: 0,
    bindingConstraint: reason,
    deductions: [],
    dataTimestamp: now,
    warnings: [reason],
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
