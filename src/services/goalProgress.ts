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
    spentAmount?: number;
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
    resultantTargetAmount: number;
    resultantTargetAmountLabel: string;
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

export function getResultantTarget(goal: GoalProgressSeed): number {
    const spent = Math.max(0, goal.spentAmount || 0);
    return Math.max(0, Number((goal.targetAmount - spent).toFixed(2)));
}

function estimateGoalMonthlyNeed(goal: GoalProgressSeed, monthsLeft: number | null) {
    if (goal.monthlyTarget && goal.monthlyTarget > 0) {
        return goal.monthlyTarget;
    }

    const effectiveMonths = Math.max(1, monthsLeft ?? 12);
    const resultantTarget = getResultantTarget(goal);
    return Math.max(0, (resultantTarget - Math.max(0, goal.currentAmount || 0)) / effectiveMonths);
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

    // 1. Calculate seed allocations for explicitly seeded goals capped at resultant target
    const balanceScale = (totalSeededGoalAmount > 0 && totalSeededGoalAmount > maxGoalPoolFundable)
        ? maxGoalPoolFundable / totalSeededGoalAmount
        : 1.0;

    const initialSeeds = goals.map((goal) => {
        const rawSeed = Math.max(0, Number(goal.currentAmount || 0));
        const isSeeded = rawSeed > 0;
        const resultantTarget = getResultantTarget(goal);
        const seedAmount = isSeeded ? Math.min(resultantTarget, Math.round(rawSeed * balanceScale)) : 0;
        return { goal, isSeeded, seedAmount, resultantTarget };
    });

    const totalAllocatedSeeded = initialSeeds.reduce((sum, item) => sum + item.seedAmount, 0);
    const remainingPool = Math.max(0, maxGoalPoolFundable - totalAllocatedSeeded);

    // 2. Distribute remaining available balance pool across un-seeded goals by priority
    const unseededItems = initialSeeds.filter((item) => !item.isSeeded);
    const unseededWeightTotal = unseededItems.reduce((wSum, item) => wSum + (6 - clamp(item.goal.priority || 3, 1, 5)), 0);

    const finalSeeds = new Map<string, number>();
    for (const item of initialSeeds) {
        if (item.isSeeded) {
            finalSeeds.set(item.goal.id, item.seedAmount);
        } else if (remainingPool > 0 && unseededItems.length > 0) {
            const myWeight = 6 - clamp(item.goal.priority || 3, 1, 5);
            const poolShare = unseededWeightTotal > 0
                ? (remainingPool * myWeight) / unseededWeightTotal
                : remainingPool / unseededItems.length;
            finalSeeds.set(item.goal.id, Math.min(item.resultantTarget, Math.round(poolShare)));
        } else {
            finalSeeds.set(item.goal.id, 0);
        }
    }

    const normalizedGoals = goals.map((goal) => {
        const monthsLeft = monthsUntil(goal.targetDate);
        const seedAmount = finalSeeds.get(goal.id) ?? 0;
        const requiredMonthly = estimateGoalMonthlyNeed({ ...goal, currentAmount: seedAmount }, monthsLeft);
        return {
            ...goal,
            monthsLeft,
            seedAmount,
            requiredMonthly,
        };
    });

    const _allocationPlan = allocateMonthlyCapacity(
        normalizedGoals.map((goal) => {
            const resultantTarget = getResultantTarget(goal);
            const progressPct = resultantTarget <= 0
                ? 100
                : (goal.seedAmount >= resultantTarget ? 100 : (goal.seedAmount / resultantTarget) * 100);
            return {
                id: goal.id,
                title: goal.title,
                priority: goal.priority,
                recommendedMonthlyContribution: goal.requiredMonthly,
                requiredMonthly: goal.requiredMonthly,
                monthsLeft: goal.monthsLeft,
                targetAmount: resultantTarget,
                currentAmount: goal.seedAmount,
                progressPct,
            };
        }),
        signals.availableGoalCapacity,
        { strategy: "utility" },
    );

    const behaviorMultiplier = clamp(0.75 + signals.currentMonthSavingsRate / 100 + signals.savingsRateChange / 200, 0.5, 1.5);

    return normalizedGoals.map((goal) => {
        const resultantTarget = getResultantTarget(goal);
        const derivedCurrentAmount = Math.min(resultantTarget, goal.seedAmount);

        const forecast = estimateForecast({
            currentAmount: derivedCurrentAmount,
            targetAmount: resultantTarget,
            monthsLeft: goal.monthsLeft,
            currentSavingsVelocity: signals.availableGoalCapacity,
        });

        // Health considers resultant target:
        // If resultant target is 0 (all spent) or derivedCurrentAmount >= resultantTarget, it is completely funded -> Ahead of Schedule!
        const isFunded = resultantTarget <= 0 || derivedCurrentAmount >= resultantTarget;
        const health = isFunded
            ? "Ahead of Schedule"
            : computeHealthStatus(forecast.requiredMonthly, signals.availableGoalCapacity);
        const confidence = isFunded
            ? 100
            : computeConfidenceScore(forecast.requiredMonthly, signals.availableGoalCapacity, Math.abs(1 - behaviorMultiplier));
        const currency = goal.currency || signals.currency || "INR";

        const remaining = Math.max(0, resultantTarget - derivedCurrentAmount);
        const recommendations: string[] = [];
        if (forecast.requiredMonthly > signals.availableGoalCapacity) {
            const deficit = Math.round(forecast.requiredMonthly - signals.availableGoalCapacity);
            recommendations.push(`Increase monthly savings by ${formatCurrency(deficit, currency)} to stay on pace`);
        } else if (remaining > 0) {
            recommendations.push("Current savings behavior supports this goal. Keep allocations steady.");
        } else {
            recommendations.push("Goal target satisfied considering current progress and spending.");
        }

        const rawProgressPct = resultantTarget > 0
            ? (derivedCurrentAmount / resultantTarget) * 100
            : 100;
        const progressPct = isFunded ? 100 : Math.max(0, Math.min(99.9, Math.round(rawProgressPct * 10) / 10));

        return {
            ...goal,
            resultantTargetAmount: resultantTarget,
            resultantTargetAmountLabel: formatCurrency(resultantTarget, currency),
            initialAllocation: goal.seedAmount,
            derivedCurrentAmount,
            currentAmount: derivedCurrentAmount,
            currentAmountLabel: formatCurrency(derivedCurrentAmount, currency),
            progressPct,
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
