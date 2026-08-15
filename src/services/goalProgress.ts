import { prisma } from "../lib/prisma";
import { calculateMonthlySavingsRate } from "./analytics";
import { computeHealthStatus, computeConfidenceScore } from "./GoalFeasibilityService";
import { estimateForecast } from "./GoalForecastService";
import { allocateMonthlyCapacity } from "./GoalAllocationService";
import { getEmergencyFundStatus } from "./emergencyFund";
import { formatCurrency } from "./shared/formatting";
import { monthsUntil } from "./shared/dates";
import { clamp } from "./shared/math";

export type GoalProgressSeed = {
    id: string;
    title: string;
    status?: string | null;
    targetAmount: number;
    currentAmount: number;
    monthlyTarget?: number | null;
    priority: number;
    currency?: string | null;
    targetDate?: string | Date | null;
    notes?: string | null;
    createdAt?: string | Date | null;
};

export type GoalProgressSignals = {
    currency: string;
    availableBalance: number;
    currentBalance: number;
    monthlyCapacity: number;
    availableGoalCapacity: number;
    monthlySavings: number;
    currentMonthSavingsRate: number;
    savingsRateChange: number;
    /** Whether the emergency fund target has been reached */
    efIsComplete: boolean;
    /** The emergency fund target amount (targetMonths × avgMonthlyExpenses) */
    efTarget: number;
    /** Monthly drip going into EF */
    efMonthlyDrip: number;
    /** EF Allocation ratio */
    efRatio: number;
    /** Goals Allocation ratio */
    goalsRatio: number;
    /** Selected EF strategy preset */
    efStrategy: string;
};

export type DerivedGoalProgress = GoalProgressSeed & {
    initialAllocation: number;
    derivedCurrentAmount: number;
    currentAmount: number;
    currentAmountLabel: string;
    progressPct: number;
    monthsLeft: number | null;
    requiredMonthly: number;
    requiredMonthlyLabel: string;
    recommendedMonthlyContribution: number;
    recommendedMonthlyContributionLabel: string;
    eta: { months: number | null; eta: Date | null } | null;
    health: string;
    confidenceScore: number;
    recommendations: string[];
};



function estimateGoalMonthlyNeed(goal: GoalProgressSeed, monthsLeft: number | null) {
    if (goal.monthlyTarget && goal.monthlyTarget > 0) {
        return goal.monthlyTarget;
    }

    const effectiveMonths = Math.max(1, monthsLeft ?? 12);
    return Math.max(0, (goal.targetAmount - Math.max(0, goal.currentAmount || 0)) / effectiveMonths);
}

export async function buildGoalProgressSignals(providedEfStatus?: Awaited<ReturnType<typeof getEmergencyFundStatus>>): Promise<GoalProgressSignals> {
    const [profile, savingsRate, efStatus] = await Promise.all([
        prisma.financialProfile.findFirst({
            select: { currency: true, balance: true, monthlyIncome: true, monthlyExpenses: true },
        }),
        calculateMonthlySavingsRate(),
        providedEfStatus ?? getEmergencyFundStatus(),
    ]);

    const currentBalanceValue = Number(profile?.balance || 0);

    // Available balance = unreserved balance after deducting EF saved amount
    const availableBalance = efStatus.availableBalance;

    const monthlyCapacity = Math.max(
        0,
        Number(profile?.monthlyIncome || 0) - Number(profile?.monthlyExpenses || 0),
    );

    return {
        currency: profile?.currency || "INR",
        availableBalance,
        currentBalance: currentBalanceValue,
        monthlyCapacity,
        availableGoalCapacity: efStatus.availableGoalCapacity,
        monthlySavings: savingsRate.monthlySavings,
        currentMonthSavingsRate: savingsRate.currentMonthSavingsRate,
        savingsRateChange: savingsRate.savingsRateChange,
        efIsComplete: efStatus.isComplete,
        efTarget: efStatus.targetAmount,
        efMonthlyDrip: efStatus.efMonthlyDrip,
        efRatio: efStatus.efRatio,
        goalsRatio: efStatus.goalsRatio,
        efStrategy: efStatus.efStrategy,
    };
}

export function deriveGoalProgress(goals: GoalProgressSeed[], signals: GoalProgressSignals): DerivedGoalProgress[] {
    // Balance Safeguard: Enforce that total allocated across EF + all goals does not exceed user's current balance.
    const maxGoalPoolFundable = signals.availableBalance;
    const totalSeededGoalAmount = goals.reduce((sum, g) => sum + Math.max(0, Number(g.currentAmount || 0)), 0);

    const normalizedGoals = goals.map((goal) => {
        const monthsLeft = monthsUntil(goal.targetDate);
        const rawSeed = Math.max(0, Number(goal.currentAmount || 0));
        let seedAmount = rawSeed;

        if (totalSeededGoalAmount > 0) {
            // Apply balance scale if total explicit goal seeds exceed available balance
            const balanceScale = totalSeededGoalAmount > maxGoalPoolFundable
                ? maxGoalPoolFundable / totalSeededGoalAmount
                : 1.0;
            seedAmount = Math.min(goal.targetAmount, Math.round(rawSeed * balanceScale));
        } else if (maxGoalPoolFundable > 0 && goals.length > 0) {
            // Distribute available balance pool across un-seeded goals by priority
            const totalWeight = goals.reduce((wSum, g) => wSum + (6 - clamp(g.priority || 3, 1, 5)), 0);
            const myWeight = 6 - clamp(goal.priority || 3, 1, 5);
            const poolShare = totalWeight > 0 ? (maxGoalPoolFundable * myWeight) / totalWeight : maxGoalPoolFundable / goals.length;
            seedAmount = Math.min(goal.targetAmount, Math.round(poolShare));
        }

        const requiredMonthly = estimateGoalMonthlyNeed({ ...goal, currentAmount: seedAmount }, monthsLeft);
        return {
            ...goal,
            monthsLeft,
            seedAmount,
            requiredMonthly,
        };
    });

    const _allocationPlan = allocateMonthlyCapacity(
        normalizedGoals.map((goal) => ({
            id: goal.id,
            title: goal.title,
            priority: goal.priority,
            recommendedMonthlyContribution: goal.requiredMonthly,
            requiredMonthly: goal.requiredMonthly,
            monthsLeft: goal.monthsLeft,
            targetAmount: goal.targetAmount,
            currentAmount: goal.seedAmount,
            progressPct: goal.targetAmount > 0 ? (goal.seedAmount / goal.targetAmount) * 100 : 0,
        })),
        signals.availableGoalCapacity,
        { strategy: "utility" },
    );

    const behaviorMultiplier = clamp(0.75 + signals.currentMonthSavingsRate / 100 + signals.savingsRateChange / 200, 0.5, 1.5);

    return normalizedGoals.map((goal) => {
        const derivedCurrentAmount = Math.min(goal.targetAmount, goal.seedAmount);

        const forecast = estimateForecast({
            currentAmount: derivedCurrentAmount,
            targetAmount: goal.targetAmount,
            monthsLeft: goal.monthsLeft,
            currentSavingsVelocity: signals.availableGoalCapacity,
        });
        const health = computeHealthStatus(forecast.requiredMonthly, signals.availableGoalCapacity);
        const confidence = computeConfidenceScore(forecast.requiredMonthly, signals.availableGoalCapacity, Math.abs(1 - behaviorMultiplier));
        const currency = goal.currency || signals.currency || "INR";

        const remaining = Math.max(0, goal.targetAmount - derivedCurrentAmount);
        const recommendations: string[] = [];
        if (forecast.requiredMonthly > signals.availableGoalCapacity) {
            const deficit = Math.round(forecast.requiredMonthly - signals.availableGoalCapacity);
            recommendations.push(`Increase monthly savings by ${formatCurrency(deficit, currency)} to stay on pace`);
        } else if (remaining > 0) {
            recommendations.push("Current savings behavior supports this goal. Keep allocations steady.");
        }

        return {
            ...goal,
            initialAllocation: goal.seedAmount,
            derivedCurrentAmount,
            currentAmount: derivedCurrentAmount,
            currentAmountLabel: formatCurrency(derivedCurrentAmount, currency),
            progressPct: goal.targetAmount > 0 ? Math.min(100, (derivedCurrentAmount / goal.targetAmount) * 100) : 0,
            requiredMonthly: Math.round(forecast.requiredMonthly),
            requiredMonthlyLabel: formatCurrency(forecast.requiredMonthly, currency),
            recommendedMonthlyContribution: Math.round(forecast.requiredMonthly),
            recommendedMonthlyContributionLabel: formatCurrency(forecast.requiredMonthly, currency),
            eta: forecast.estimatedCompletion,
            health,
            confidenceScore: confidence,
            recommendations,
        };
    });
}
