/**
 * Shared Goal domain types used across Goal components and services.
 */

export type AIRecommendation = {
    text: string;
    rationale?: string;
    priority?: string;
};

export type WhatIfImpact = {
    goalId: string;
    goalTitle: string;
    daysDelta: number;
    summary: string;
};

export type GoalMilestone = {
    label: string;
    thresholdPct: number;
    achieved: boolean;
    amount: number;
    amountLabel: string;
};

export type Goal = {
    id: string;
    title: string;
    targetAmount: number;
    currentAmount: number;
    monthlyTarget?: number | null;
    priority: number;
    currency?: string | null;
    targetDate?: string | null;
    notes?: string | null;
    monthsLeft?: number | null;
    recommendedMonthly?: number | null;
    recommendedMonthlyContribution?: number | null;
    recommendedMonthlyContributionLabel?: string | null;
    eta?: { months: number; eta: string } | null;
    milestones?: GoalMilestone[];
    nextMilestone?: GoalMilestone | null;
    requiredMonthly?: number | null;
    requiredMonthlyLabel?: string | null;
    health?: string | null;
    confidenceScore?: number | null;
    recommendations?: string[] | null;
};

export type AllocationItem = {
    goalId: string;
    goalTitle?: string;
    requested: number;
    allocated: number;
    shortfall: number;
    sharePct: number;
    utilityScore: number;
    urgencyScore: number;
    priorityScore: number;
    reason: string;
};

export type AllocationPlan = {
    strategy: "priority-first" | "proportional" | "utility";
    allocations: AllocationItem[];
    remainingCapacity: number;
    deployedCapacity: number;
    totalRequested: number;
    utilizationPct: number;
    summary: string;
    tradeoffs: string[];
};

export type AllocationImpact = {
    goalId: string;
    goalTitle: string;
    oldAllocated: number;
    newAllocated: number;
    allocatedDelta: number;
    oldSharePct: number;
    newSharePct: number;
    summary: string;
    reason: string;
};

export type AllocationScenario = {
    strategy: "priority-first" | "proportional" | "utility";
    description: string;
    baseCapacity: number;
    newMonthlyCapacity: number;
    impacts: AllocationImpact[];
    tradeoffs: string[];
};

export type EmergencyFundData = {
    targetMonths: number;
    avgMonthlyExpenses: number;
    targetAmount: number;
    savedAmount: number;
    progressPct: number;
    shortfall: number;
    monthsToComplete: number | null;
    estimatedCompletionDate: string | null;
    monthlyDrip?: number;
    efRatio?: number;
    strategy?: string;
    isComplete?: boolean;
};
