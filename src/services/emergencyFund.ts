import { prisma } from "../lib/prisma";
import { calculateBurnRate } from "./analytics";
import { computeSavingsCapacity } from "./savings";
import { getActiveInvestableCarveout, getOrGenerateInvestmentSuggestion } from "./investmentEngine";

export type EfStrategy = "BALANCED" | "AGGRESSIVE_EF" | "ACCELERATED_GOALS" | "STRICT";

export type EmergencyFundStatus = {
    /** User-configured number of months the fund should cover (>= 3) */
    targetMonths: number;
    /** Average monthly expenses derived from last 3 months of transactions */
    avgMonthlyExpenses: number;
    /** How much money the fund needs to hold = targetMonths × avgMonthlyExpenses */
    targetAmount: number;
    /**
     * Auto-derived attribute: portion of current bank balance allocated to EF based on active strategy & tier.
     * Includes surplus spillover from goals pool if goal targets are fully satisfied.
     */
    savedAmount: number;
    /** Portion of bank balance remaining for active goals (currentBalance - savedAmount) */
    availableBalance: number;
    /** 0–100 */
    progressPct: number;
    /** targetAmount - savedAmount, floored at 0 */
    shortfall: number;
    /** Estimated months to fill the gap at current savings capacity & EF drip rate */
    monthsToComplete: number | null;
    /** Estimated completion date */
    estimatedCompletionDate: Date | null;
    /** True when savedAmount >= targetAmount */
    isComplete: boolean;
    /** Monthly savings capacity (income - expenses or detected from transactions) */
    monthlyCapacity: number;
    /** Selected strategy preset: BALANCED | AGGRESSIVE_EF | ACCELERATED_GOALS | STRICT */
    efStrategy: EfStrategy;
    /** Allocation ratio assigned to EF (0.0 to 1.0) */
    efRatio: number;
    /** Allocation ratio assigned to Goals pool (0.0 to 1.0) */
    goalsRatio: number;
    /** Current active EF Safety Tier: 1 (Starter), 2 (Core), or 3 (Fully Funded) */
    tier: 1 | 2 | 3;
    /** Actual monthly amount dripping into Emergency Fund */
    efMonthlyDrip: number;
    /** Remaining monthly capacity available for active goals pool */
    availableGoalCapacity: number;
};

export function getEfStrategyRatios(
    strategy: string | undefined | null,
    progressPct: number,
    avgMonthlyExpenses: number,
    savedAmount: number,
    isComplete: boolean
): { efRatio: number; goalsRatio: number; tier: 1 | 2 | 3 } {
    if (isComplete) {
        return { efRatio: 0, goalsRatio: 1.0, tier: 3 };
    }

    // Dynamic Tier 1 Evaluation: Starter Net triggers if saved < 1 mo expense OR EF progress < 25%
    const isTier1 = savedAmount < avgMonthlyExpenses || progressPct < 25;
    const tier: 1 | 2 = isTier1 ? 1 : 2;

    switch (strategy) {
        case "AGGRESSIVE_EF":
            return isTier1
                ? { efRatio: 0.95, goalsRatio: 0.05, tier }
                : { efRatio: 0.85, goalsRatio: 0.15, tier };
        case "ACCELERATED_GOALS":
            return isTier1
                ? { efRatio: 0.70, goalsRatio: 0.30, tier }
                : { efRatio: 0.50, goalsRatio: 0.50, tier };
        case "STRICT":
            return { efRatio: 1.0, goalsRatio: 0.0, tier };
        case "BALANCED":
        default:
            return isTier1
                ? { efRatio: 0.85, goalsRatio: 0.15, tier }
                : { efRatio: 0.70, goalsRatio: 0.30, tier };
    }
}

export async function getEmergencyFundStatus(): Promise<EmergencyFundStatus> {
    const [profile, burnData, savingsCapacity, goals, investableCarveout, investableSuggestion] = await Promise.all([
        prisma.financialProfile.findFirst({
            select: {
                emergencyFundMonths: true,
                balance: true,
                monthlyIncome: true,
                monthlyExpenses: true,
                efStrategy: true,
            },
        }),
        calculateBurnRate(),
        computeSavingsCapacity(3),
        prisma.goal.findMany({ select: { targetAmount: true, currentAmount: true } }),
        getActiveInvestableCarveout(),
        getOrGenerateInvestmentSuggestion().catch(() => null),
    ]);

    const targetMonths = Math.max(3, profile?.emergencyFundMonths ?? 6);
    const rawBalance = Math.max(0, profile?.balance ?? 0);
    const currentBalance = Math.max(0, rawBalance - investableCarveout);
    const rawStrategy = profile?.efStrategy || "BALANCED";
    const efStrategy: EfStrategy = ["BALANCED", "AGGRESSIVE_EF", "ACCELERATED_GOALS", "STRICT"].includes(rawStrategy)
        ? (rawStrategy as EfStrategy)
        : "BALANCED";

    // Use the 3-month rolling burn rate as the best estimate of monthly expenses.
    // Fall back to profile monthlyExpenses if no transactions exist.
    const avgMonthlyExpenses =
        burnData.burnRate > 0
            ? burnData.burnRate
            : Math.max(0, profile?.monthlyExpenses ?? 0);

    const targetAmount = targetMonths * avgMonthlyExpenses;

    // Step 1: Determine provisional ratios based on current balance to split liquid cash stock
    const provisionalPct = targetAmount > 0 ? (currentBalance / targetAmount) * 100 : 100;
    const provisionalIsComplete = targetAmount > 0 && currentBalance >= targetAmount;
    const provisionalRatios = getEfStrategyRatios(
        efStrategy,
        provisionalPct,
        avgMonthlyExpenses,
        currentBalance,
        provisionalIsComplete
    );

    // Initial strategy split on liquid balance
    const initialEfSaved = provisionalIsComplete
        ? targetAmount
        : Math.min(targetAmount, Math.round(currentBalance * provisionalRatios.efRatio));

    const initialGoalBalance = Math.max(0, currentBalance - initialEfSaved);

    // Step 2: Surplus Spillover from Goals to EF
    // Calculate total capital required by all active goals to be 100% funded
    const totalGoalsNeeded = goals.reduce((sum, g) => sum + Math.max(0, g.targetAmount - Math.max(0, g.currentAmount)), 0);
    
    // If goal pool has more money than all active goals need, spill surplus back into EF
    const unusedGoalSurplus = goals.length > 0 ? Math.max(0, initialGoalBalance - totalGoalsNeeded) : 0;

    const savedAmount = provisionalIsComplete
        ? targetAmount
        : Math.min(targetAmount, initialEfSaved + unusedGoalSurplus);

    const availableBalance = Math.max(0, currentBalance - savedAmount);

    const shortfall = Math.max(0, targetAmount - savedAmount);
    const progressPct = targetAmount > 0 ? Math.min(100, (savedAmount / targetAmount) * 100) : 100;
    const isComplete = shortfall === 0 && targetAmount > 0;

    // Monthly capacity = explicit profile budget surplus (income - expenses), falling back to transaction heuristics if missing
    const profileCapacity = Math.max(
        0,
        Number(profile?.monthlyIncome ?? 0) - Number(profile?.monthlyExpenses ?? 0),
    );
    const monthlyCapacity = profileCapacity > 0 ? profileCapacity : Math.max(0, savingsCapacity);

    const strategyRatios = getEfStrategyRatios(
        efStrategy,
        progressPct,
        avgMonthlyExpenses,
        savedAmount,
        isComplete
    );
    let efRatio = strategyRatios.efRatio;
    let goalsRatio = strategyRatios.goalsRatio;
    const tier = strategyRatios.tier;

    // If EF is incomplete but no active goals need monthly funding (all goals fully funded or no goals exist),
    // redirect 100% of non-investment monthly capacity into EF drip.
    if (!isComplete && totalGoalsNeeded === 0) {
        efRatio = 1.0;
        goalsRatio = 0.0;
    }

    // Deduct configured phase investable percentage (e.g., 15% for EF_BUILDING, 40% for GOAL_SPRINT, 60% for WEALTH_BUILDING, 0% for CRISIS)
    const phaseInvestableRate = investableSuggestion?.suggestion?.investableRate ?? (isComplete ? 60 : 15);
    const efAndGoalsAvailableCapacity = Math.max(0, monthlyCapacity * ((100 - phaseInvestableRate) / 100));

    const efMonthlyDrip = isComplete
        ? 0
        : Math.min(shortfall, Math.round(efAndGoalsAvailableCapacity * efRatio));

    const availableGoalCapacity = isComplete
        ? Math.round(efAndGoalsAvailableCapacity)
        : Math.max(0, Math.round(efAndGoalsAvailableCapacity - efMonthlyDrip));

    let monthsToComplete: number | null = null;
    let estimatedCompletionDate: Date | null = null;
    if (!isComplete && shortfall > 0 && efMonthlyDrip > 0) {
        monthsToComplete = Math.ceil(shortfall / efMonthlyDrip);
        const now = new Date();
        estimatedCompletionDate = new Date(
            now.getFullYear(),
            now.getMonth() + monthsToComplete,
            now.getDate(),
        );
    }

    return {
        targetMonths,
        avgMonthlyExpenses: Math.round(avgMonthlyExpenses),
        targetAmount: Math.round(targetAmount),
        savedAmount: Math.round(savedAmount),
        availableBalance: Math.round(availableBalance),
        progressPct: Math.round(progressPct * 10) / 10,
        shortfall: Math.round(shortfall),
        monthsToComplete,
        estimatedCompletionDate,
        isComplete,
        monthlyCapacity: Math.round(monthlyCapacity),
        efStrategy,
        efRatio,
        goalsRatio,
        tier,
        efMonthlyDrip,
        availableGoalCapacity,
    };
}
