import { prisma } from "../lib/prisma";
import { estimateForecast } from "./GoalForecastService";
import { computeHealthStatus, computeConfidenceScore } from "./GoalFeasibilityService";
import { allocateMonthlyCapacity, simulateCapacityShift } from "./GoalAllocationService";
import { impactMessageForChange } from "./GoalInsightService";
import { buildGoalProgressSignals, deriveGoalProgress } from "./goalProgress";

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
    targetAmount: number;
    currentAmount: number;
    monthlyTarget?: number | null;
    priority: number;
    currency?: string | null;
    targetDate?: string | Date | null;
    notes?: string | null;
    createdAt?: string | Date | null;
};

function formatCurrency(amount: number, currency = "INR") {
    const safeCurrency = currency || "INR";
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: safeCurrency,
        maximumFractionDigits: 0,
    }).format(amount);
}

function monthsUntil(targetDate?: string | Date | null) {
    if (!targetDate) return null;
    const target = new Date(targetDate);
    const now = new Date();
    return Math.max(0, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()));
}

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
        const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

        // estimate forecast using observed monthly capacity as a proxy for savings velocity
        const forecast = estimateForecast({
            currentAmount: goal.currentAmount,
            targetAmount: goal.targetAmount,
            monthsLeft,
            currentSavingsVelocity: monthlyCapacity,
        });

        const progressPct = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;
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
            progressPct: Math.round(progressPct),
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

async function loadDerivedGoals() {
    const [goals, signals] = await Promise.all([
        prisma.goal.findMany({
            orderBy: { priority: "asc" }, select: {
                id: true,
                title: true,
                targetAmount: true,
                currentAmount: true,
                monthlyTarget: true,
                priority: true,
                currency: true,
                targetDate: true,
                notes: true,
                createdAt: true,
            }
        }),
        buildGoalProgressSignals(),
    ]);

    return {
        goals: deriveGoalProgress(goals as GoalRecord[], signals),
        signals,
    };
}

export async function listGoals() {
    const { goals, signals } = await loadDerivedGoals();
    return analyzeGoalConflicts(goals as GoalRecord[], signals.monthlyCapacity, signals.currency).goals;
}

export async function getGoalOverview() {
    const { goals, signals } = await loadDerivedGoals();
    return analyzeGoalConflicts(goals as GoalRecord[], signals.monthlyCapacity, signals.currency);
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
