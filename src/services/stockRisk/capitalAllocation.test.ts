import { describe, it, expect, vi, beforeEach } from "vitest";
import { calculateCapitalAllocation } from "./index";
import { prisma } from "../../lib/prisma";
import * as emergencyFundService from "../emergencyFund";
import * as analyticsService from "../analytics";
import * as investmentEngineService from "../investmentEngine";

vi.mock("../../lib/prisma", () => ({
  prisma: {
    financialProfile: {
      findFirst: vi.fn(),
    },
    goal: {
      findMany: vi.fn(),
    },
    loanLiability: {
      findMany: vi.fn(),
    },
    creditCardLiability: {
      findMany: vi.fn(),
    },
    bnplLiability: {
      findMany: vi.fn(),
    },
    stock: {
      findMany: vi.fn(),
    },
    investmentSuggestion: {
      findFirst: vi.fn(),
    },
    stockPaperPortfolio: {
      findFirst: vi.fn(),
    },
    stockPortfolioRiskSnapshot: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));


vi.mock("../emergencyFund", () => ({
  getEmergencyFundStatus: vi.fn(),
}));

vi.mock("../analytics", () => ({
  calculateBurnRate: vi.fn(),
  calculateRunway: vi.fn(),
}));

vi.mock("../investmentEngine", () => ({
  determinePhase: vi.fn(),
  computeSurplus: vi.fn(),
  detectSalaryCycle: vi.fn(),
  getOrGenerateInvestmentSuggestion: vi.fn(),
}));

function mockEf(data: any): emergencyFundService.EmergencyFundStatus {
  return {
    investableCarveout: 0,
    mfInvestableCarveout: 0,
    stockInvestableCarveout: 0,
    ...data,
  } as emergencyFundService.EmergencyFundStatus;
}

describe("capitalAllocation — Cycle-Based Stock Trading Safeguards", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default safe mocks
    vi.mocked(analyticsService.calculateBurnRate).mockResolvedValue({
      burnRate: 50000,
      previousBurnRate: 50000,
      burnRateChange: 0,
      burnRateChangeDirection: "neutral",
      previousPeriodHasData: true,
    });
    vi.mocked(analyticsService.calculateRunway).mockResolvedValue({
      runwayMonths: 6,
      previousRunwayMonths: 6,
      runwayChange: 0,
      runwayChangeDirection: "neutral",
    });
    vi.mocked(investmentEngineService.detectSalaryCycle).mockResolvedValue({ cycleDays: 30 } as any);
    vi.mocked(investmentEngineService.computeSurplus).mockResolvedValue({ smoothedSurplus: 50000, rawSurplus: 50000 } as any);
    vi.mocked(investmentEngineService.determinePhase).mockReturnValue("WEALTH_BUILDING");
    vi.mocked(investmentEngineService.getOrGenerateInvestmentSuggestion).mockResolvedValue({
      suggestion: {
        id: "test-sug-1",
        status: "ACTIVE",
        totalStockInvestable: 10000,
        remainingStockBalance: 10000,
        stockCycle: {
          totalInvestable: 10000,
          remainingStockBalance: 10000,
        },
      },
    } as any);
    vi.mocked(prisma.goal.findMany).mockResolvedValue([]);
    vi.mocked(prisma.loanLiability.findMany).mockResolvedValue([]);
    vi.mocked(prisma.creditCardLiability.findMany).mockResolvedValue([]);
    vi.mocked(prisma.bnplLiability.findMany).mockResolvedValue([]);
    vi.mocked(prisma.stock.findMany).mockResolvedValue([]);
    vi.mocked(prisma.investmentSuggestion.findFirst).mockResolvedValue({
      totalStockInvestable: 10000,
      remainingStockBalance: 10000,
      stockCycle: {
        totalInvestable: 10000,
        remainingStockBalance: 10000,
      },
    } as any);
    vi.mocked(prisma.stockPaperPortfolio.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.stockPortfolioRiskSnapshot.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.stockPortfolioRiskSnapshot.create).mockResolvedValue({} as any);
  });


  // 1. No financial profile
  it("Requirement 1: handles missing financial profile gracefully with MISSING_PROFILE status", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue(null);

    const result = await calculateCapitalAllocation("NEUTRAL");

    expect(result.status).toBe("MISSING_PROFILE");
    expect(result.eligibleNewPurchaseBudget).toBe(0);
    expect(result.statusReason).toContain("Complete profile setup");
  });

  // 2. Zero liquid cash
  it("Requirement 2: blocks trading with ZERO_SURPLUS when liquid cash is zero", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 0,
      monthlyIncome: 100000,
      monthlyExpenses: 50000,
      emergencyFundMonths: 6,
    } as any);

    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue(mockEf({
      targetMonths: 6,
      avgMonthlyExpenses: 50000,
      targetAmount: 300000,
      savedAmount: 0,
      availableBalance: 0,
      progressPct: 0,
      shortfall: 300000,
      isComplete: false,
    }));

    const result = await calculateCapitalAllocation("BULLISH");

    expect(result.status).toBe("ZERO_SURPLUS");
    expect(result.eligibleNewPurchaseBudget).toBe(0);
    expect(result.warnings.some((w) => w.includes("₹0"))).toBe(true);
  });

  // 3. Cycle stock trading credit is zero (feature not yet run or budget exhausted)
  it("Requirement 3: sets safe trading budget to 0 when remainingCycleStockBalance is 0", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 250000,
      monthlyIncome: 100000,
      monthlyExpenses: 50000,
      emergencyFundMonths: 6,
    } as any);

    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue(mockEf({
      targetMonths: 6,
      avgMonthlyExpenses: 50000,
      targetAmount: 300000,
      savedAmount: 200000,
      availableBalance: 50000,
      isComplete: false,
    }));

    vi.mocked(investmentEngineService.getOrGenerateInvestmentSuggestion).mockResolvedValue({
      suggestion: {
        id: "test-sug-zero",
        status: "INVESTED",
        totalStockInvestable: 0,
        remainingStockBalance: 0,
        stockCycle: {
          totalInvestable: 0,
          remainingStockBalance: 0,
        },
      },
    } as any);

    const result = await calculateCapitalAllocation("NEUTRAL");

    expect(result.cycleStockTradingPool).toBe(0);
    expect(result.remainingCycleStockBalance).toBe(0);
    expect(result.potentiallyDeployableCash).toBe(0);
    expect(result.eligibleNewPurchaseBudget).toBe(0);
    expect(result.status).toBe("CYCLE_BUDGET_EXHAUSTED");
    expect(result.bindingConstraint).toBe("cycle_budget_exhausted");
  });

  // 4. Sizing operates strictly from cycle stock trading credit
  it("Requirement 4: sizes trading budget from cycle stock credit bounded by market regime", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 100000,
      monthlyIncome: 100000,
      monthlyExpenses: 50000,
      emergencyFundMonths: 6,
    } as any);

    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue(mockEf({
      targetMonths: 6,
      avgMonthlyExpenses: 50000,
      targetAmount: 300000,
      savedAmount: 200000,
      availableBalance: 50000,
      isComplete: false,
    }));

    vi.mocked(investmentEngineService.determinePhase).mockReturnValue("WEALTH_BUILDING");

    vi.mocked(investmentEngineService.getOrGenerateInvestmentSuggestion).mockResolvedValue({
      suggestion: {
        id: "test-sug-active",
        status: "ACTIVE",
        totalStockInvestable: 20000,
        remainingStockBalance: 20000,
        stockCycle: {
          totalInvestable: 20000,
          remainingStockBalance: 20000,
        },
      },
    } as any);

    // In NEUTRAL regime: 20,000 cycle credit, 10 open slots -> 2,000 slot capacity, 2-slot tranche base = 4,000
    // Multi-factor target: 4,000 * 0.65 = 2,600
    const result = await calculateCapitalAllocation("NEUTRAL");

    expect(result.cycleStockTradingPool).toBe(20000);
    expect(result.remainingCycleStockBalance).toBe(20000);
    expect(result.potentiallyDeployableCash).toBe(20000);
    expect(result.eligibleNewPurchaseBudget).toBe(2600);
    expect(result.status).toBe("ACTIVE");
    expect(result.bindingConstraint).toBe("market_regime_moderated");
    expect(result.marketRegimeFactor).toBe(0.65);
    expect(result.availablePositionSlots).toBe(10);
  });



  // 5. Does not perform ad-hoc deductions for goals or living buffers
  it("Requirement 5: does not perform ad-hoc deductions for near-term goals or buffers in stock intelligence", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 248000,
      monthlyIncome: 100000,
      monthlyExpenses: 50000,
      emergencyFundMonths: 6,
    } as any);

    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue(mockEf({
      targetMonths: 6,
      avgMonthlyExpenses: 50000,
      targetAmount: 300000,
      savedAmount: 200000,
      availableBalance: 48000,
      isComplete: false,
    }));

    // Even if goals exist in DB (e.g. Goa trip 50,000), stockRisk does not deduct 25k
    vi.mocked(prisma.goal.findMany).mockResolvedValue([
      { id: "goal-1", name: "Goa Trip", targetAmount: 50000, currentAmount: 0 } as any,
    ]);

    vi.mocked(investmentEngineService.getOrGenerateInvestmentSuggestion).mockResolvedValue({
      suggestion: {
        id: "test-sug-1",
        status: "ACTIVE",
        totalStockInvestable: 5000,
        remainingStockBalance: 5000,
        stockCycle: {
          totalInvestable: 5000,
          remainingStockBalance: 5000,
        },
      },
    } as any);

    const result = await calculateCapitalAllocation("BULLISH");

    expect(result.nearTermGoalCommitments).toBe(0);
    expect(result.totalDeductions).toBe(0);
    expect(result.deductions.length).toBe(0);
    expect(result.eligibleNewPurchaseBudget).toBe(5000);
  });

  // 6. Existing direct equity holdings count toward exposure cap without reducing cash
  it("Requirement 6: includes existing direct-equity holdings in total exposure cap", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 100000,
      monthlyIncome: 100000,
      monthlyExpenses: 50000,
      emergencyFundMonths: 6,
    } as any);

    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue(mockEf({
      targetMonths: 6,
      avgMonthlyExpenses: 50000,
      targetAmount: 300000,
      savedAmount: 300000,
      availableBalance: 100000,
      isComplete: true,
    }));

    vi.mocked(prisma.stock.findMany).mockResolvedValue([
      { id: "s1", symbol: "INFY", currentQuantity: 10, currentWorth: 18000 } as any,
    ]);

    vi.mocked(investmentEngineService.getOrGenerateInvestmentSuggestion).mockResolvedValue({
      suggestion: {
        id: "test-sug-1",
        status: "ACTIVE",
        totalStockInvestable: 20000,
        remainingStockBalance: 20000,
        stockCycle: {
          totalInvestable: 20000,
          remainingStockBalance: 20000,
        },
      },
    } as any);

    const result = await calculateCapitalAllocation("BULLISH");

    expect(result.deployedCapital).toBe(18000);
    expect(result.totalTradingBase).toBe(20000 + 18000);
    expect(result.remainingExposureCapacity).toBe(20000);
  });

  // 7. Halts new purchases when holdings exceed exposure limit
  it("Requirement 7: halts new purchases with EXPOSURE_CAP_REACHED when holdings exceed exposure limit", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 100000,
      monthlyIncome: 100000,
      monthlyExpenses: 50000,
      emergencyFundMonths: 6,
    } as any);

    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue(mockEf({
      targetMonths: 6,
      avgMonthlyExpenses: 50000,
      targetAmount: 300000,
      savedAmount: 300000,
      availableBalance: 100000,
      isComplete: true,
    }));

    // Large existing holdings that saturate regime exposure
    vi.mocked(prisma.stock.findMany).mockResolvedValue([
      { id: "s1", symbol: "TCS", currentQuantity: 50, currentWorth: 200000 } as any,
    ]);

    vi.mocked(investmentEngineService.getOrGenerateInvestmentSuggestion).mockResolvedValue({
      suggestion: {
        id: "test-sug-1",
        status: "ACTIVE",
        totalStockInvestable: 10000,
        remainingStockBalance: 10000,
        stockCycle: {
          totalInvestable: 10000,
          remainingStockBalance: 10000,
        },
      },
    } as any);

    // In NEUTRAL regime, max exposure is 70%
    const result = await calculateCapitalAllocation("NEUTRAL");

    // Holdings 200,000 + Deployable 10,000 = 210,000. 70% of 210,000 = 147,000 max exposure.
    // Deployed is 200,000 > 147,000 -> remainingExposureCapacity = 0
    expect(result.status).toBe("EXPOSURE_CAP_REACHED");
    expect(result.eligibleNewPurchaseBudget).toBe(0);
    expect(result.remainingExposureCapacity).toBe(0);
    expect(result.bindingConstraint).toBe("exposure_cap_limit");
  });

  // 8. CRISIS phase blocks all purchases
  it("Requirement 8: blocks all purchases in CRISIS phase", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 10000,
      monthlyIncome: 50000,
      monthlyExpenses: 60000,
      emergencyFundMonths: 6,
    } as any);

    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue(mockEf({
      targetMonths: 6,
      avgMonthlyExpenses: 60000,
      targetAmount: 360000,
      savedAmount: 10000,
      availableBalance: 0,
      isComplete: false,
    }));

    vi.mocked(investmentEngineService.determinePhase).mockReturnValue("CRISIS");

    const result = await calculateCapitalAllocation("BULLISH");

    expect(result.status).toBe("BLOCKED_BY_PHASE");
    expect(result.eligibleNewPurchaseBudget).toBe(0);
    expect(result.bindingConstraint).toBe("phase_blocked_crisis");
  });

  // 9. BEARISH regime blocks all purchases
  it("Requirement 9: blocks all purchases in BEARISH market regime", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 100000,
      monthlyIncome: 100000,
      monthlyExpenses: 50000,
      emergencyFundMonths: 6,
    } as any);

    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue(mockEf({
      targetMonths: 6,
      avgMonthlyExpenses: 50000,
      targetAmount: 300000,
      savedAmount: 300000,
      availableBalance: 100000,
      isComplete: true,
    }));

    vi.mocked(investmentEngineService.getOrGenerateInvestmentSuggestion).mockResolvedValue({
      suggestion: {
        id: "test-sug-1",
        status: "ACTIVE",
        totalStockInvestable: 10000,
        remainingStockBalance: 10000,
        stockCycle: {
          totalInvestable: 10000,
          remainingStockBalance: 10000,
        },
      },
    } as any);

    const result = await calculateCapitalAllocation("BEARISH");

    expect(result.status).toBe("BLOCKED_BY_REGIME");
    expect(result.eligibleNewPurchaseBudget).toBe(0);
    expect(result.bindingConstraint).toBe("regime_blocked_bearish");
  });

  // 10. Deducts active stock holdings from remaining cycle credit
  it("Requirement 10: deducts deployed stock holdings from remaining cycle credit", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 100000,
      monthlyIncome: 50000,
      monthlyExpenses: 25000,
      emergencyFundMonths: 6,
    } as any);

    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue(mockEf({
      targetMonths: 6,
      avgMonthlyExpenses: 25000,
      targetAmount: 150000,
      savedAmount: 150000,
      availableBalance: 100000,
      isComplete: true,
    }));

    vi.mocked(investmentEngineService.getOrGenerateInvestmentSuggestion).mockResolvedValue({
      suggestion: {
        id: "test-sug-1",
        status: "INVESTED",
        totalStockInvestable: 1147,
        remainingStockBalance: 1147,
        createdAt: new Date("2026-10-29T10:00:00Z"),
        stockCycle: {
          totalInvestable: 1147,
          remainingStockBalance: 1147,
        },
      },
    } as any);

    // Mock an active stock holding purchased during this cycle (e.g. ETERNAL worth 686)
    vi.mocked(prisma.stock.findMany).mockResolvedValue([
      {
        id: "stock-1",
        symbol: "ETERNAL",
        currentQuantity: 2,
        currentPrice: 343,
        currentWorth: 686,
        createdAt: new Date("2026-10-30T10:00:00Z"),
      } as any,
    ]);

    const result = await calculateCapitalAllocation("BULLISH");

    expect(result.cycleStockTradingPool).toBe(1147);
    expect(result.deployedCapital).toBe(686);
    expect(result.remainingCycleStockBalance).toBe(454); // 1147 - (686 + 6.71 charges)
    expect(result.potentiallyDeployableCash).toBe(454);
  });
});
