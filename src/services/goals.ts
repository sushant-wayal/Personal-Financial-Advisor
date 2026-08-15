import { prisma } from "../lib/prisma";
import { calculateBurnRate } from "./analytics";
import { estimateForecast } from "./GoalForecastService";
import { computeHealthStatus, computeConfidenceScore } from "./GoalFeasibilityService";
import { allocateMonthlyCapacity, simulateCapacityShift } from "./GoalAllocationService";
import { buildGoalProgressSignals, deriveGoalProgress } from "./goalProgress";
import { getEmergencyFundStatus } from "./emergencyFund";
import { getOrGenerateInvestmentSuggestion } from "./investmentEngine";
import { formatCurrency } from "./shared/formatting";
import { monthsUntil } from "./shared/dates";

export type GoalMilestone = {
    label: string;
    thresholdPct: number;
    achieved: boolean;
    amount: number;
    amountLabel: string;
};

export type GoalConflict = {
    type: "budget" | "timeline" | "currency";
    severity: "low" | "medium" | "high";
    message: string;
    affectedGoalIds: string[];
};

type GoalRecord = {
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



function resolvedCurrency(goal: GoalRecord, fallbackCurrency = "INR") {
    return goal.currency || fallbackCurrency || "INR";
}

export function recommendMonthlyContribution(currentAmount: number, targetAmount: number, monthsLeft: number) {
    if (monthsLeft <= 0) return targetAmount - currentAmount;
    return Math.max(0, (targetAmount - currentAmount) / monthsLeft);
}

export function predictETA(currentAmount: number, monthlyContribution: number, targetAmount: number) {
    if (monthlyContribution <= 0) return null;
    const months = Math.ceil((targetAmount - currentAmount) / monthlyContribution);
    const now = new Date();
    const eta = new Date(now.getFullYear(), now.getMonth() + months, now.getDate());
    return { months, eta };
}

export function buildGoalMilestones(goal: GoalRecord, fallbackCurrency = "INR"): GoalMilestone[] {
    const currency = resolvedCurrency(goal, fallbackCurrency);
    const progressPct = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;
    const thresholds = [25, 50, 75, 100];

    return thresholds.map((thresholdPct) => {
        const amount = (goal.targetAmount * thresholdPct) / 100;
        return {
            label: `${thresholdPct}% milestone`,
            thresholdPct,
            achieved: progressPct >= thresholdPct,
            amount: Math.round(amount),
            amountLabel: formatCurrency(amount, currency),
        };
    });
}

export function analyzeGoalConflicts(goals: GoalRecord[], monthlyCapacity: number, fallbackCurrency = "INR") {
    const currencyGroups = new Map<string, GoalRecord[]>();
    for (const goal of goals) {
        const key = resolvedCurrency(goal, fallbackCurrency);
        currencyGroups.set(key, [...(currencyGroups.get(key) || []), goal]);
    }

    const conflicts: GoalConflict[] = [];
    const goalSummaries = goals.map((goal) => {
        const currency = resolvedCurrency(goal, fallbackCurrency);
        const monthsLeft = monthsUntil(goal.targetDate) ?? null;

        // estimate forecast using observed monthly capacity as a proxy for savings velocity
        const forecast = estimateForecast({
            currentAmount: goal.currentAmount,
            targetAmount: goal.targetAmount,
            monthsLeft,
            currentSavingsVelocity: monthlyCapacity,
        });

        const rawProgressPct = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
        const progressPct = goal.targetAmount > 0
            ? (goal.currentAmount >= goal.targetAmount
                ? 100
                : Math.max(0, Math.min(99.9, Math.round(rawProgressPct * 10) / 10)))
            : 0;
        const health = computeHealthStatus(forecast.requiredMonthly, monthlyCapacity);
        const confidence = computeConfidenceScore(forecast.requiredMonthly, monthlyCapacity, 0.25);

        const recommendations: string[] = [];
        if (forecast.requiredMonthly > monthlyCapacity) {
            const deficit = Math.round(forecast.requiredMonthly - monthlyCapacity);
            recommendations.push(`Increase monthly savings by ${formatCurrency(deficit, currency)}`);
            recommendations.push(`Extend target date or lower target by ${formatCurrency(deficit * 3, currency)} (example)`);
        } else if (forecast.requiredMonthly > 0) {
            recommendations.push(`You are on pace — consider allocating surplus to accelerate this goal`);
        }

        return {
            ...goal,
            currency,
            targetAmountLabel: formatCurrency(goal.targetAmount, currency),
            currentAmountLabel: formatCurrency(goal.currentAmount, currency),
            progressPct,
            monthsLeft,
            requiredMonthly: Math.round(forecast.requiredMonthly),
            requiredMonthlyLabel: formatCurrency(forecast.requiredMonthly, currency),
            recommendedMonthlyContribution: Math.round(forecast.requiredMonthly),
            recommendedMonthly: Math.round(forecast.requiredMonthly),
            recommendedMonthlyContributionLabel: formatCurrency(forecast.requiredMonthly, currency),
            eta: forecast.estimatedCompletion,
            milestones: buildGoalMilestones(goal, fallbackCurrency),
            nextMilestone: buildGoalMilestones(goal, fallbackCurrency).find((milestone) => !milestone.achieved) || null,
            health,
            confidenceScore: confidence,
            recommendations,
        };
    });

    const allocationStrategies = {
        priorityFirst: allocateMonthlyCapacity(goalSummaries, monthlyCapacity, { strategy: "priority-first" }),
        proportional: allocateMonthlyCapacity(goalSummaries, monthlyCapacity, { strategy: "proportional" }),
        utility: allocateMonthlyCapacity(goalSummaries, monthlyCapacity, { strategy: "utility" }),
    };
    const allocation = allocationStrategies.utility;
    const allocationScenarios = [
        simulateCapacityShift(goalSummaries, monthlyCapacity, -Math.round(monthlyCapacity * 0.25), "utility"),
        simulateCapacityShift(goalSummaries, monthlyCapacity, 0, "utility"),
        simulateCapacityShift(goalSummaries, monthlyCapacity, Math.round(monthlyCapacity * 0.25), "utility"),
    ];

    const totalRecommended = goalSummaries.reduce((sum, goal) => sum + (goal.recommendedMonthlyContribution || 0), 0);
    if (monthlyCapacity > 0 && totalRecommended > monthlyCapacity) {
        const overBy = totalRecommended - monthlyCapacity;
        const affectedGoalIds = goalSummaries
            .sort((a, b) => a.priority - b.priority)
            .slice(-Math.min(goalSummaries.length, 3))
            .map((goal) => goal.id);
        conflicts.push({
            type: "budget",
            severity: overBy > monthlyCapacity * 0.5 ? "high" : "medium",
            message: `Total recommended monthly contributions exceed available monthly capacity by ${formatCurrency(overBy, fallbackCurrency)}. Some goals will compete for the same savings pool.`,
            affectedGoalIds,
        });
    }

    const upcomingGoals = goalSummaries
        .filter((goal) => goal.monthsLeft !== null && goal.monthsLeft <= 6)
        .sort((a, b) => (a.monthsLeft ?? 12) - (b.monthsLeft ?? 12));
    if (upcomingGoals.length >= 2) {
        conflicts.push({
            type: "timeline",
            severity: upcomingGoals.some((goal) => (goal.priority ?? 3) >= 4) ? "high" : "medium",
            message: `You have ${upcomingGoals.length} goals due within the next 6 months. Tight timelines can force one goal to delay another.`,
            affectedGoalIds: upcomingGoals.map((goal) => goal.id),
        });
    }

    if (currencyGroups.size > 1) {
        const currencyList = Array.from(currencyGroups.keys()).join(", ");
        conflicts.push({
            type: "currency",
            severity: "low",
            message: `You are tracking goals across multiple currencies: ${currencyList}. The app will keep each goal in its own currency, but comparisons are only approximate until you add conversion rates.`,
            affectedGoalIds: goals.map((goal) => goal.id),
        });
    }

    return {
        goals: goalSummaries,
        conflicts,
        totalRecommendedMonthlyContribution: Math.round(totalRecommended),
        monthlyCapacity,
        monthlyCapacityLabel: formatCurrency(monthlyCapacity, fallbackCurrency),
        totalRecommendedMonthlyContributionLabel: formatCurrency(totalRecommended, fallbackCurrency),
        allocation,
        allocationStrategies,
        allocationScenarios,
    };
}

async function loadDerivedGoals(providedEfStatus?: Awaited<ReturnType<typeof getEmergencyFundStatus>>) {
    const [goals, signals] = await Promise.all([
        prisma.goal.findMany({
            orderBy: { priority: "asc" },
            select: {
                id: true,
                title: true,
                status: true,
                targetAmount: true,
                currentAmount: true,
                monthlyTarget: true,
                priority: true,
                currency: true,
                targetDate: true,
                notes: true,
                createdAt: true,
            },
        }),
        buildGoalProgressSignals(providedEfStatus),
    ]);

    return {
        goals: deriveGoalProgress(goals as GoalRecord[], signals),
        signals,
    };
}

export async function listGoals() {
    const { goals, signals } = await loadDerivedGoals();
    return analyzeGoalConflicts(goals as GoalRecord[], signals.availableGoalCapacity, signals.currency).goals;
}

export async function getGoalOverview() {
    const [_burnData, efStatus, investmentData] = await Promise.all([
        calculateBurnRate(),
        getEmergencyFundStatus(),
        getOrGenerateInvestmentSuggestion().catch(() => null),
    ]);

    const { goals, signals } = await loadDerivedGoals(efStatus);

    const effectiveCapacity = signals.availableGoalCapacity;

    const overview = analyzeGoalConflicts(goals as GoalRecord[], effectiveCapacity, signals.currency);

    const uncompletedGoalsSum = overview.goals
        .filter((g) => g.progressPct < 100)
        .reduce((sum, g) => sum + (g.recommendedMonthlyContribution || 0), 0);
    const efDripComponent = !efStatus.isComplete ? efStatus.efMonthlyDrip : 0;
    const combinedTotalRecommended = Math.round(uncompletedGoalsSum + efDripComponent);

    overview.totalRecommendedMonthlyContribution = combinedTotalRecommended;
    overview.totalRecommendedMonthlyContributionLabel = formatCurrency(combinedTotalRecommended, signals.currency);
    overview.monthlyCapacity = efStatus.monthlyCapacity;
    overview.monthlyCapacityLabel = formatCurrency(efStatus.monthlyCapacity, signals.currency);

    if (!signals.efIsComplete) {
        const efDripLabel = new Intl.NumberFormat("en-IN", { style: "currency", currency: signals.currency || "INR", maximumFractionDigits: 0 }).format(efStatus.efMonthlyDrip);
        const goalPoolLabel = new Intl.NumberFormat("en-IN", { style: "currency", currency: signals.currency || "INR", maximumFractionDigits: 0 }).format(efStatus.availableGoalCapacity);
        const efPct = Math.round((efStatus.efRatio || 0) * 100);
        const goalsPct = Math.round((efStatus.goalsRatio || 0) * 100);

        if (efStatus.goalsRatio > 0) {
            overview.conflicts.unshift({
                type: "budget" as const,
                severity: "low" as const,
                message: `Dual-Track Allocation Active (${efStatus.efStrategy} - Tier ${efStatus.tier}): ${efPct}% (${efDripLabel}/mo) is directed to your Emergency Fund, while ${goalsPct}% (${goalPoolLabel}/mo) is allocated across active goals.`,
                affectedGoalIds: goals.map((g) => g.id),
            });
        } else {
            const shortfallLabel = new Intl.NumberFormat("en-IN", { style: "currency", currency: signals.currency || "INR", maximumFractionDigits: 0 }).format(efStatus.shortfall);
            overview.conflicts.unshift({
                type: "budget" as const,
                severity: "high" as const,
                message: `Strict Protection Strategy Active: Emergency fund is not yet complete (${efStatus.progressPct.toFixed(1)}% funded, ${shortfallLabel} remaining). All goal allocations are paused until EF reaches target.`,
                affectedGoalIds: goals.map((g) => g.id),
            });
        }
    }

    return { ...overview, emergencyFund: efStatus, investmentSuggestion: investmentData?.suggestion ?? null };
}

export async function createGoal(data: { title: string; targetAmount: number; targetDate?: string; priority?: number; notes?: string; initialAllocation?: number; currentAmount?: number }) {
    const createData: any = {
        title: data.title,
        targetAmount: data.targetAmount,
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
        priority: data.priority ?? 3,
        notes: data.notes,
        currentAmount: Math.max(0, Number(data.initialAllocation ?? data.currentAmount ?? 0)),
    };
    return prisma.goal.create({ data: createData });
}

export async function updateGoal(id: string, patch: Partial<{ title: string; targetAmount: number; monthlyTarget: number; targetDate: string; priority: number; notes: string }>) {
    const data: any = { ...patch };
    if (patch.targetDate) data.targetDate = new Date(patch.targetDate as string);
    delete data.currentAmount;
    delete data.currency;
    return prisma.goal.update({ where: { id }, data });
}

export async function deleteGoal(id: string) {
    return prisma.goal.delete({ where: { id } });
}
