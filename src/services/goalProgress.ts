import { prisma } from "../lib/prisma";
import { calculateMonthlySavingsRate } from "./analytics";
import { computeHealthStatus, computeConfidenceScore } from "./GoalFeasibilityService";
import { estimateForecast } from "./GoalForecastService";
import { allocateMonthlyCapacity } from "./GoalAllocationService";
import { computeSavingsCapacity } from "./savings";

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
    monthlySavings: number;
    currentMonthSavingsRate: number;
    savingsRateChange: number;
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

function formatCurrency(amount: number, currency = "INR") {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
    }).format(amount || 0);
}

function monthsUntil(targetDate?: string | Date | null) {
    if (!targetDate) return null;
    const target = new Date(targetDate);
    const now = new Date();
    return Math.max(0, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()));
}

function monthsSince(date?: string | Date | null) {
    if (!date) return 1;
    const started = new Date(date);
    const now = new Date();
    return Math.max(1, (now.getFullYear() - started.getFullYear()) * 12 + (now.getMonth() - started.getMonth()) + 1);
}

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

function estimateGoalMonthlyNeed(goal: GoalProgressSeed, monthsLeft: number | null) {
    if (goal.monthlyTarget && goal.monthlyTarget > 0) {
        return goal.monthlyTarget;
    }

    const effectiveMonths = Math.max(1, monthsLeft ?? 12);
    return Math.max(0, (goal.targetAmount - Math.max(0, goal.currentAmount || 0)) / effectiveMonths);
}

export async function buildGoalProgressSignals(): Promise<GoalProgressSignals> {
    const [profile, savingsRate, savingsCapacity] = await Promise.all([
        prisma.financialProfile.findUnique({
            where: { id: "default" },
            select: { currency: true, balance: true, emergencyFund: true, monthlyIncome: true, monthlyExpenses: true },
        }),
        calculateMonthlySavingsRate(),
        computeSavingsCapacity(3),
    ]);

    const currentBalanceValue = Number(profile?.balance || 0);
    const availableBalance = Math.max(0, currentBalanceValue - Number(profile?.emergencyFund || 0));
    const monthlyCapacity = Math.max(
        0,
        Number(profile?.monthlyIncome || 0) - Number(profile?.monthlyExpenses || 0),
        savingsRate.monthlySavings,
        savingsCapacity,
    );

    return {
        currency: profile?.currency || "INR",
        availableBalance,
        currentBalance: currentBalanceValue,
        monthlyCapacity,
        monthlySavings: savingsRate.monthlySavings,
        currentMonthSavingsRate: savingsRate.currentMonthSavingsRate,
        savingsRateChange: savingsRate.savingsRateChange,
    };
}

export function deriveGoalProgress(goals: GoalProgressSeed[], signals: GoalProgressSignals): DerivedGoalProgress[] {
    const normalizedGoals = goals.map((goal) => {
        const monthsLeft = monthsUntil(goal.targetDate);
        const seedAmount = Math.max(0, Number(goal.currentAmount || 0));
        const requiredMonthly = estimateGoalMonthlyNeed(goal, monthsLeft);
        return {
            ...goal,
            monthsLeft,
            seedAmount,
            requiredMonthly,
        };
    });

    const allocationPlan = allocateMonthlyCapacity(
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
        signals.monthlyCapacity,
        { strategy: "utility" },
    );

    const behaviorMultiplier = clamp(0.75 + signals.currentMonthSavingsRate / 100 + signals.savingsRateChange / 200, 0.5, 1.5);
    const availableGrowthBudget = Math.max(0, signals.availableBalance - normalizedGoals.reduce((sum, goal) => sum + goal.seedAmount, 0));
    const provisionalGrowth = normalizedGoals.map((goal, index) => {
        const allocatedMonthly = allocationPlan.allocations[index]?.allocated ?? 0;
        const activeMonths = monthsSince(goal.createdAt);
        return allocatedMonthly * activeMonths * behaviorMultiplier;
    });

    const totalProvisionalGrowth = provisionalGrowth.reduce((sum, amount) => sum + amount, 0);
    const growthScale = totalProvisionalGrowth > 0 ? Math.min(1, availableGrowthBudget / totalProvisionalGrowth) : 0;

    return normalizedGoals.map((goal, index) => {
        const scaledGrowth = provisionalGrowth[index] * growthScale;
        const derivedCurrentAmount = Math.min(goal.targetAmount, goal.seedAmount + scaledGrowth);
        const forecast = estimateForecast({
            currentAmount: derivedCurrentAmount,
            targetAmount: goal.targetAmount,
            monthsLeft: goal.monthsLeft,
            currentSavingsVelocity: signals.monthlyCapacity,
        });
        const health = computeHealthStatus(forecast.requiredMonthly, signals.monthlyCapacity);
        const confidence = computeConfidenceScore(forecast.requiredMonthly, signals.monthlyCapacity, Math.abs(1 - behaviorMultiplier));
        const currency = goal.currency || signals.currency || "INR";

        const remaining = Math.max(0, goal.targetAmount - derivedCurrentAmount);
        const recommendations: string[] = [];
        if (forecast.requiredMonthly > signals.monthlyCapacity) {
            const deficit = Math.round(forecast.requiredMonthly - signals.monthlyCapacity);
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
