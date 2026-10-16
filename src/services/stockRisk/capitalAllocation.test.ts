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
}));

describe("capitalAllocation — Comprehensive Safety & Sizing Tests (17 Requirements)", () => {
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
    vi.mocked(investmentEngineService.computeSurplus).mockResolvedValue({ surplus: 50000 } as any);
    vi.mocked(investmentEngineService.determinePhase).mockReturnValue("WEALTH_BUILDING");
    vi.mocked(prisma.goal.findMany).mockResolvedValue([]);
    vi.mocked(prisma.loanLiability.findMany).mockResolvedValue([]);
    vi.mocked(prisma.creditCardLiability.findMany).mockResolvedValue([]);
    vi.mocked(prisma.bnplLiability.findMany).mockResolvedValue([]);
    vi.mocked(prisma.stock.findMany).mockResolvedValue([]);
    vi.mocked(prisma.investmentSuggestion.findFirst).mockResolvedValue(null);
  });

  // 1. No financial profile
  it("Requirement 1: handles missing financial profile gracefully with MISSING_PROFILE status", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue(null);

    const result = await calculateCapitalAllocation("NEUTRAL");

    expect(result.status).toBe("MISSING_PROFILE");
    expect(result.eligibleNewPurchaseBudget).toBe(0);
    expect(result.statusReason).toContain("Complete profile setup");
  });

  // 2. Zero or negative liquid cash
  it("Requirement 2: blocks trading with ZERO_SURPLUS when liquid cash is zero or negative", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 0,
      monthlyIncome: 100000,
      monthlyExpenses: 50000,
      emergencyFundMonths: 6,
    } as any);

    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue({
      targetMonths: 6,
      avgMonthlyExpenses: 50000,
      targetAmount: 300000,
      savedAmount: 0,
      availableBalance: 0,
      progressPct: 0,
      shortfall: 300000,
      monthsToComplete: null,
      estimatedCompletionDate: null,
      isComplete: false,
      monthlyCapacity: 50000,
      efStrategy: "BALANCED",
      efRatio: 0.7,
      goalsRatio: 0.3,
      tier: 1,
      efMonthlyDrip: 0,
      availableGoalCapacity: 0,
    });

    const result = await calculateCapitalAllocation("BULLISH");

    expect(result.status).toBe("ZERO_SURPLUS");
    expect(result.eligibleNewPurchaseBudget).toBe(0);
    expect(result.warnings.some((w) => w.includes("₹0"))).toBe(true);
  });

  // 3. Incomplete emergency fund
  it("Requirement 3: correctly allocates savedAmount without deducting future shortfall", async () => {
    // Production bug scenario: balance ₹2,48,798, EF target ₹4,43,856, EF saved ₹1,98,798
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 248798,
      monthlyIncome: 150000,
      monthlyExpenses: 73976,
      emergencyFundMonths: 6,
    } as any);

    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue({
      targetMonths: 6,
      avgMonthlyExpenses: 73976,
      targetAmount: 443856,
      savedAmount: 198798,
      availableBalance: 50000,
      progressPct: 44.79,
      shortfall: 245058,
      monthsToComplete: 4,
      estimatedCompletionDate: new Date("2027-02-15"),
      isComplete: false,
      monthlyCapacity: 76024,
      efStrategy: "BALANCED",
      efRatio: 0.7,
      goalsRatio: 0.3,
      tier: 2,
      efMonthlyDrip: 53216,
      availableGoalCapacity: 22808,
    });

    vi.mocked(investmentEngineService.determinePhase).mockReturnValue("EF_BUILDING");

    const result = await calculateCapitalAllocation("NEUTRAL");

    // The saved ₹1,98,798 is protected
    expect(result.efAllocatedCash).toBe(198798);
    // The shortfall ₹2,45,058 is tracked diagnostically, NOT deducted as cash
    expect(result.efShortfall).toBe(245058);
    // Potentially deployable cash = 248798 - 198798 = 50000
    expect(result.potentiallyDeployableCash).toBe(50000);
    // In EF_BUILDING, phase cap is 10% -> ₹5,000. In NEUTRAL (regime factor 0.70) -> ₹3,500
    expect(result.eligibleNewPurchaseBudget).toBe(3500);
    expect(result.status).toBe("ACTIVE");
  });

  // 4. Fully funded emergency fund
  it("Requirement 4: allows WEALTH_BUILDING allocation up to 100% when emergency fund is complete", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 500000,
      monthlyIncome: 120000,
      monthlyExpenses: 50000,
      emergencyFundMonths: 6,
    } as any);

    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue({
      targetMonths: 6,
      avgMonthlyExpenses: 50000,
      targetAmount: 300000,
      savedAmount: 300000,
      availableBalance: 200000,
      progressPct: 100,
      shortfall: 0,
      monthsToComplete: 0,
      estimatedCompletionDate: null,
      isComplete: true,
      monthlyCapacity: 70000,
      efStrategy: "BALANCED",
      efRatio: 0.7,
      goalsRatio: 0.3,
      tier: 3,
      efMonthlyDrip: 0,
      availableGoalCapacity: 70000,
    });

    vi.mocked(investmentEngineService.determinePhase).mockReturnValue("WEALTH_BUILDING");

    const result = await calculateCapitalAllocation("BULLISH");

    expect(result.efAllocatedCash).toBe(300000);
    expect(result.efShortfall).toBe(0);
    expect(result.potentiallyDeployableCash).toBe(200000);
    expect(result.phaseMaxPct).toBe(100);
    // BULLISH regime factor is 1.0, so full ₹200,000 is eligible
    expect(result.eligibleNewPurchaseBudget).toBe(200000);
    expect(result.status).toBe("ACTIVE");
  });

  // 5. Emergency-fund money not being double-counted
  it("Requirement 5: does not double count emergency fund money in expenses or goals", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 300000,
      monthlyIncome: 100000,
      monthlyExpenses: 50000,
      emergencyFundMonths: 6,
    } as any);

    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue({
      targetMonths: 6,
      avgMonthlyExpenses: 50000,
      targetAmount: 300000,
      savedAmount: 200000,
      availableBalance: 100000,
      progressPct: 66.6,
      shortfall: 100000,
      monthsToComplete: 2,
      estimatedCompletionDate: null,
      isComplete: false,
      monthlyCapacity: 50000,
      efStrategy: "BALANCED",
      efRatio: 0.7,
      goalsRatio: 0.3,
      tier: 2,
      efMonthlyDrip: 35000,
      availableGoalCapacity: 15000,
    });

    const result = await calculateCapitalAllocation("NEUTRAL");

    // Only one deduction for EF
    const efDeductions = result.deductions.filter((d) => d.source === "emergencyFund");
    expect(efDeductions.length).toBe(1);
    expect(efDeductions[0].amount).toBe(200000);
    // Since EF reserve (₹200,000) > 1 month expenses (₹50,000), living expenses buffer is 0 (no double count)
    const expDeductions = result.deductions.filter((d) => d.label.includes("Essential living expenses"));
    expect(expDeductions.length).toBe(0);
  });

  // 6. A future emergency-fund shortfall not being deducted as though it were current cash
  it("Requirement 6: never deducts future shortfall from current liquid cash", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 150000,
      monthlyIncome: 100000,
      monthlyExpenses: 50000,
      emergencyFundMonths: 6,
    } as any);

    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue({
      targetMonths: 6,
      avgMonthlyExpenses: 50000,
      targetAmount: 300000,
      savedAmount: 80000,
      availableBalance: 70000,
      progressPct: 26.6,
      shortfall: 220000, // Shortfall > balance!
      monthsToComplete: 5,
      estimatedCompletionDate: null,
      isComplete: false,
      monthlyCapacity: 50000,
      efStrategy: "BALANCED",
      efRatio: 0.7,
      goalsRatio: 0.3,
      tier: 2,
      efMonthlyDrip: 35000,
      availableGoalCapacity: 15000,
    });

    const result = await calculateCapitalAllocation("NEUTRAL");

    // If shortfall (220,000) was deducted, deployable cash would be clamped to 0.
    // Correct behavior: only actual allocated cash (80,000) is deducted -> 150,000 - 80,000 = 70,000.
    expect(result.potentiallyDeployableCash).toBe(70000);
    expect(result.efShortfall).toBe(220000);
  });

  // 7. One-month expense buffer not overlapping with the emergency reserve
  it("Requirement 7: expense buffer protects only the gap if emergency reserve < 1 month expenses", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 100000,
      monthlyIncome: 80000,
      monthlyExpenses: 50000,
      emergencyFundMonths: 6,
    } as any);

    // Emergency reserve is only ₹20,000 (less than ₹50,000 monthly expenses)
    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue({
      targetMonths: 6,
      avgMonthlyExpenses: 50000,
      targetAmount: 300000,
      savedAmount: 20000,
      availableBalance: 80000,
      progressPct: 6.6,
      shortfall: 280000,
      monthsToComplete: 8,
      estimatedCompletionDate: null,
      isComplete: false,
      monthlyCapacity: 30000,
      efStrategy: "BALANCED",
      efRatio: 0.7,
      goalsRatio: 0.3,
      tier: 1,
      efMonthlyDrip: 21000,
      availableGoalCapacity: 9000,
    });

    const result = await calculateCapitalAllocation("NEUTRAL");

    // EF allocated = 20,000. Gap to 1 month (50,000) = 30,000.
    const expDeduction = result.deductions.find((d) => d.label.includes("Essential living expenses"));
    expect(expDeduction).toBeDefined();
    expect(expDeduction?.amount).toBe(30000);
    // Total living reserve + EF = 20,000 + 30,000 = 50,000.
    // Deployable cash = 100,000 - 20,000 - 30,000 = 50,000.
    expect(result.potentiallyDeployableCash).toBe(50000);
  });

  // 8. Goals with different target dates and partially funded amounts
  it("Requirement 8: pro-rates medium-term goals and full-commits immediate goals (<= 30 days)", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 200000,
      monthlyIncome: 100000,
      monthlyExpenses: 40000,
      emergencyFundMonths: 6,
    } as any);

    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue({
      targetMonths: 6,
      avgMonthlyExpenses: 40000,
      targetAmount: 240000,
      savedAmount: 100000,
      availableBalance: 100000,
      progressPct: 41.6,
      shortfall: 140000,
      monthsToComplete: 3,
      estimatedCompletionDate: null,
      isComplete: false,
      monthlyCapacity: 60000,
      efStrategy: "BALANCED",
      efRatio: 0.7,
      goalsRatio: 0.3,
      tier: 2,
      efMonthlyDrip: 42000,
      availableGoalCapacity: 18000,
    });

    const now = new Date();
    // Goal 1: Immediate (due in 15 days) -> Target ₹20,000, Current ₹5,000 -> commits full shortfall ₹15,000
    const immediateDueDate = new Date(now.getTime() + 15 * 86400000);
    // Goal 2: 3 months out (due in 90 days) -> Target ₹60,000, Current ₹0 -> pro-rates to ₹20,000/mo
    const threeMonthsDueDate = new Date(now.getTime() + 90 * 86400000);

    vi.mocked(prisma.goal.findMany).mockResolvedValue([
      {
        id: "goal-imm",
        title: "Laptop Repair",
        targetAmount: 20000,
        currentAmount: 5000,
        targetDate: immediateDueDate,
        status: "IN_PROGRESS",
      } as any,
      {
        id: "goal-3mo",
        title: "Annual Insurance",
        targetAmount: 60000,
        currentAmount: 0,
        targetDate: threeMonthsDueDate,
        status: "IN_PROGRESS",
      } as any,
    ]);

    const result = await calculateCapitalAllocation("NEUTRAL");

    const goalImm = result.deductions.find((d) => d.label.includes("Laptop Repair"));
    const goal3mo = result.deductions.find((d) => d.label.includes("Annual Insurance"));

    expect(goalImm?.amount).toBe(15000); // 100% of shortfall
    expect(goal3mo?.amount).toBe(20000); // Pro-rated 60,000 / 3
  });

  // 9. Loan instalments and credit-card obligations
  it("Requirement 9: deducts upcoming monthly EMI and credit card payments", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 150000,
      monthlyIncome: 100000,
      monthlyExpenses: 40000,
      emergencyFundMonths: 6,
    } as any);

    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue({
      targetMonths: 6,
      avgMonthlyExpenses: 40000,
      targetAmount: 240000,
      savedAmount: 80000,
      availableBalance: 70000,
      progressPct: 33.3,
      shortfall: 160000,
      monthsToComplete: 3,
      estimatedCompletionDate: null,
      isComplete: false,
      monthlyCapacity: 60000,
      efStrategy: "BALANCED",
      efRatio: 0.7,
      goalsRatio: 0.3,
      tier: 2,
      efMonthlyDrip: 42000,
      availableGoalCapacity: 18000,
    });

    vi.mocked(prisma.loanLiability.findMany).mockResolvedValue([
      {
        id: "loan-1",
        name: "Car Loan EMI",
        emiAmount: 12000,
        totalAmount: 300000,
      } as any,
    ]);

    vi.mocked(prisma.creditCardLiability.findMany).mockResolvedValue([
      {
        id: "cc-1",
        cardName: "HDFC Credit Card",
        lastStatementAmount: 8000,
        amountPaidSinceStatement: 0,
        currentOutstanding: 8000,
      } as any,
    ]);

    const result = await calculateCapitalAllocation("NEUTRAL");

    const obligationsDeduction = result.deductions.find((d) => d.source === "liabilities");
    // Loan EMI (12,000) + CC statement due (8,000) = 20,000
    expect(obligationsDeduction?.amount).toBe(20000);
  });

  // 10. Active investment suggestions that are not actually committed
  it("Requirement 10: does not treat advisory investment suggestions as cash locks", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 100000,
      monthlyIncome: 80000,
      monthlyExpenses: 30000,
      emergencyFundMonths: 6,
    } as any);

    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue({
      targetMonths: 6,
      avgMonthlyExpenses: 30000,
      targetAmount: 180000,
      savedAmount: 50000,
      availableBalance: 50000,
      progressPct: 27.7,
      shortfall: 130000,
      monthsToComplete: 3,
      estimatedCompletionDate: null,
      isComplete: false,
      monthlyCapacity: 50000,
      efStrategy: "BALANCED",
      efRatio: 0.7,
      goalsRatio: 0.3,
      tier: 2,
      efMonthlyDrip: 35000,
      availableGoalCapacity: 15000,
    });

    // Mock an active advisory investment suggestion
    vi.mocked(prisma.investmentSuggestion.findFirst).mockResolvedValue({
      id: "sug-1",
      suggestedAmount: 25000,
      status: "ACTIVE",
    } as any);

    const result = await calculateCapitalAllocation("NEUTRAL");

    // The suggested ₹25,000 must NOT be deducted as a cash lock
    const sugDeduction = result.deductions.find((d) => d.source === "investmentSuggestions");
    expect(sugDeduction).toBeUndefined();
    expect(result.potentiallyDeployableCash).toBe(50000);
  });

  // 11. Existing stock holdings with positive unreserved cash
  it("Requirement 11: calculates total trading base including holdings without subtracting them from cash", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 150000,
      monthlyIncome: 100000,
      monthlyExpenses: 40000,
      emergencyFundMonths: 6,
    } as any);

    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue({
      targetMonths: 6,
      avgMonthlyExpenses: 40000,
      targetAmount: 240000,
      savedAmount: 50000,
      availableBalance: 100000,
      progressPct: 20.8,
      shortfall: 190000,
      monthsToComplete: 4,
      estimatedCompletionDate: null,
      isComplete: false,
      monthlyCapacity: 60000,
      efStrategy: "BALANCED",
      efRatio: 0.7,
      goalsRatio: 0.3,
      tier: 2,
      efMonthlyDrip: 42000,
      availableGoalCapacity: 18000,
    });

    // Existing holding: ₹30,000
    vi.mocked(prisma.stock.findMany).mockResolvedValue([
      {
        id: "pos-1",
        symbol: "TCS",
        currentQuantity: 10,
        buyPrice: 3000,
        currentWorth: 30000,
      } as any,
    ]);

    const result = await calculateCapitalAllocation("BULLISH");

    // Potentially deployable cash = 150,000 - 50,000 = 100,000
    expect(result.potentiallyDeployableCash).toBe(100000);
    expect(result.deployedCapital).toBe(30000);
    // Total Trading Base = 100,000 + 30,000 = 130,000
    expect(result.totalTradingBase).toBe(130000);
    // Deployed capital was NOT deducted from cash!
    expect(result.deductions.some((d) => d.label.includes("TCS"))).toBe(false);
  });

  // 12. Existing holdings exceeding the permitted exposure limit
  it("Requirement 12: halts new purchases with EXPOSURE_CAP_REACHED when holdings exceed exposure limit", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 100000,
      monthlyIncome: 100000,
      monthlyExpenses: 40000,
      emergencyFundMonths: 6,
    } as any);

    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue({
      targetMonths: 6,
      avgMonthlyExpenses: 40000,
      targetAmount: 240000,
      savedAmount: 50000,
      availableBalance: 50000,
      progressPct: 20.8,
      shortfall: 190000,
      monthsToComplete: 4,
      estimatedCompletionDate: null,
      isComplete: false,
      monthlyCapacity: 60000,
      efStrategy: "BALANCED",
      efRatio: 0.7,
      goalsRatio: 0.3,
      tier: 2,
      efMonthlyDrip: 42000,
      availableGoalCapacity: 18000,
    });

    // Deployable cash = ₹50,000
    // Large existing holdings: ₹300,000
    vi.mocked(prisma.stock.findMany).mockResolvedValue([
      {
        id: "pos-large",
        symbol: "RELIANCE",
        currentQuantity: 100,
        buyPrice: 3000,
        currentWorth: 300000,
      } as any,
    ]);

    vi.mocked(investmentEngineService.determinePhase).mockReturnValue("GOAL_SPRINT"); // Phase cap = 30%

    // Total trading base = 50,000 + 300,000 = 350,000
    // In NEUTRAL (regime 0.70) with phase 30%: max exposure = 350,000 * 0.30 * 0.70 = 73,500
    // Existing holdings (300,000) > max permitted exposure (73,500)
    const result = await calculateCapitalAllocation("NEUTRAL");

    expect(result.status).toBe("EXPOSURE_CAP_REACHED");
    expect(result.eligibleNewPurchaseBudget).toBe(0);
    expect(result.remainingExposureCapacity).toBe(0);
    expect(result.statusReason).toContain("exceeds the permitted exposure cap");
  });

  // 13. CRISIS and EF_BUILDING financial phases
  it("Requirement 13: blocks all trades in CRISIS phase and caps to 10% in EF_BUILDING", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 100000,
      monthlyIncome: 50000,
      monthlyExpenses: 60000,
      emergencyFundMonths: 6,
    } as any);

    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue({
      targetMonths: 6,
      avgMonthlyExpenses: 60000,
      targetAmount: 360000,
      savedAmount: 20000,
      availableBalance: 80000,
      progressPct: 5.5,
      shortfall: 340000,
      monthsToComplete: 12,
      estimatedCompletionDate: null,
      isComplete: false,
      monthlyCapacity: 0,
      efStrategy: "BALANCED",
      efRatio: 0.7,
      goalsRatio: 0.3,
      tier: 1,
      efMonthlyDrip: 0,
      availableGoalCapacity: 0,
    });

    // Test CRISIS
    vi.mocked(investmentEngineService.determinePhase).mockReturnValue("CRISIS");

    const crisisResult = await calculateCapitalAllocation("BULLISH");
    expect(crisisResult.status).toBe("BLOCKED_BY_PHASE");
    expect(crisisResult.eligibleNewPurchaseBudget).toBe(0);
    expect(crisisResult.phaseMaxPct).toBe(0);

    // Test EF_BUILDING
    vi.mocked(investmentEngineService.determinePhase).mockReturnValue("EF_BUILDING");

    const efBuildingResult = await calculateCapitalAllocation("BULLISH");
    expect(efBuildingResult.status).toBe("ACTIVE");
    expect(efBuildingResult.phaseMaxPct).toBe(10);
  });

  // 14. BEARISH, HIGH_VOLATILITY, and DATA_UNRELIABLE market regimes
  it("Requirement 14: blocks trades in BEARISH and HIGH_VOLATILITY regimes", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 200000,
      monthlyIncome: 100000,
      monthlyExpenses: 50000,
      emergencyFundMonths: 6,
    } as any);

    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue({
      targetMonths: 6,
      avgMonthlyExpenses: 50000,
      targetAmount: 300000,
      savedAmount: 300000,
      availableBalance: 200000,
      progressPct: 100,
      shortfall: 0,
      monthsToComplete: 0,
      estimatedCompletionDate: null,
      isComplete: true,
      monthlyCapacity: 50000,
      efStrategy: "BALANCED",
      efRatio: 0.7,
      goalsRatio: 0.3,
      tier: 3,
      efMonthlyDrip: 0,
      availableGoalCapacity: 50000,
    });

    vi.mocked(investmentEngineService.determinePhase).mockReturnValue("WEALTH_BUILDING");

    // BEARISH regime: newPurchasesAllowed = false
    const bearishResult = await calculateCapitalAllocation("BEARISH");
    expect(bearishResult.status).toBe("BLOCKED_BY_REGIME");
    expect(bearishResult.eligibleNewPurchaseBudget).toBe(0);

    // HIGH_VOLATILITY regime: newPurchasesAllowed = false
    const highVolResult = await calculateCapitalAllocation("HIGH_VOLATILITY");
    expect(highVolResult.status).toBe("BLOCKED_BY_REGIME");
    expect(highVolResult.eligibleNewPurchaseBudget).toBe(0);
  });

  // 15. Missing or stale API data
  it("Requirement 15: falls back safely without unhandled exception when emergency fund status fails", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 300000,
      monthlyIncome: 80000,
      monthlyExpenses: 40000,
      emergencyFundMonths: 6,
    } as any);

    // Simulate emergency fund service failure
    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockRejectedValue(new Error("Redis timeout"));

    const result = await calculateCapitalAllocation("NEUTRAL");

    expect(result.warnings.some((w) => w.includes("emergency fund status unavailable"))).toBe(true);
    expect(result.status).toBe("ACTIVE");
    expect(result.eligibleNewPurchaseBudget).toBeGreaterThan(0);
  });

  // 16. API failure versus a valid zero result
  it("Requirement 16: distinguishes valid policy zero from unexpected missing profile", async () => {
    // Valid policy zero: Bearish regime
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 500000,
      monthlyIncome: 100000,
      monthlyExpenses: 40000,
      emergencyFundMonths: 6,
    } as any);

    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue({
      targetMonths: 6,
      avgMonthlyExpenses: 40000,
      targetAmount: 240000,
      savedAmount: 240000,
      availableBalance: 260000,
      progressPct: 100,
      shortfall: 0,
      monthsToComplete: 0,
      estimatedCompletionDate: null,
      isComplete: true,
      monthlyCapacity: 60000,
      efStrategy: "BALANCED",
      efRatio: 0.7,
      goalsRatio: 0.3,
      tier: 3,
      efMonthlyDrip: 0,
      availableGoalCapacity: 60000,
    });

    const bearishResult = await calculateCapitalAllocation("BEARISH");
    expect(bearishResult.status).toBe("BLOCKED_BY_REGIME");
    expect(bearishResult.eligibleNewPurchaseBudget).toBe(0);

    // Missing profile: MISSING_PROFILE
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue(null);
    const missingResult = await calculateCapitalAllocation("BULLISH");
    expect(missingResult.status).toBe("MISSING_PROFILE");
    expect(missingResult.eligibleNewPurchaseBudget).toBe(0);
  });

  // 17. Consistency between the capital API and recommendation pipeline
  it("Requirement 17: guarantees budget never exceeds unreserved cash or remaining exposure", async () => {
    vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
      balance: 248798,
      monthlyIncome: 150000,
      monthlyExpenses: 73976,
      emergencyFundMonths: 6,
    } as any);

    vi.mocked(emergencyFundService.getEmergencyFundStatus).mockResolvedValue({
      targetMonths: 6,
      avgMonthlyExpenses: 73976,
      targetAmount: 443856,
      savedAmount: 198798,
      availableBalance: 50000,
      progressPct: 44.79,
      shortfall: 245058,
      monthsToComplete: 4,
      estimatedCompletionDate: new Date("2027-02-15"),
      isComplete: false,
      monthlyCapacity: 76024,
      efStrategy: "BALANCED",
      efRatio: 0.7,
      goalsRatio: 0.3,
      tier: 2,
      efMonthlyDrip: 53216,
      availableGoalCapacity: 22808,
    });

    vi.mocked(investmentEngineService.determinePhase).mockReturnValue("EF_BUILDING");

    const result = await calculateCapitalAllocation("NEUTRAL");

    // Critical invariant from Section 8:
    // Assert that the final new-purchase budget never exceeds available unreserved cash or the remaining permitted exposure
    expect(result.eligibleNewPurchaseBudget).toBeLessThanOrEqual(result.potentiallyDeployableCash);
    expect(result.eligibleNewPurchaseBudget).toBeLessThanOrEqual(result.remainingExposureCapacity);
    expect(result.eligibleNewPurchaseBudget).toBeGreaterThan(0);
  });
});
