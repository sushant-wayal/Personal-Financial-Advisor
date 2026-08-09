import { prisma } from "../lib/prisma";
import { INVESTMENT_DEFAULTS, FinancialPhase } from "../config/investmentDefaults";
import { calculateBurnRate, calculateRunway } from "./analytics";

export type SalaryCycleInfo = {
    cycleDays: number;
    isAutoDetected: boolean;
    lastSalaryDate: Date | null;
};

export type SurplusComputation = {
    rawSurplus: number;
    previousSurplus: number;
    smoothedSurplus: number;
    grossIncome: number;
    totalExpenses: number;
    surplusTrend: "accelerating" | "growing" | "stable" | "decreasing" | "dropping";
};

export type SubAllocationBreakdown = {
    equity: { suggested: number; edited: number | null; final: number; pct: number };
    debt: { suggested: number; edited: number | null; final: number; pct: number };
    gold: { suggested: number; edited: number | null; final: number; pct: number };
    cash: { suggested: number; edited: number | null; final: number; pct: number };
};

export type InvestmentSuggestionResult = {
    suggestion: {
        id: string;
        status: "ACTIVE" | "INVESTED" | "EXPIRED";
        phase: FinancialPhase;
        phaseLabel: string;
        cycleDays: number;
        rawSurplus: number;
        smoothedSurplus: number;
        investableRate: number; // 0..100
        baseInvestable: number;
        spillover: number;
        totalInvestable: number;
        isManuallyEdited: boolean;
        buckets: SubAllocationBreakdown;
        maxInvestable: number;
        investedAt: Date | null;
        createdAt: Date;
        nextSuggestionIn: number | null; // Days remaining if invested
        streak: number;
        surplusTrend: string;
        belowMinThreshold: boolean;
    };
    computation: SurplusComputation & {
        phaseInvestableRate: number;
        baseInvestable: number;
        spillover: number;
    };
};

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function daysBetween(d1: Date, d2: Date): number {
    return Math.abs(Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * 1. Detect Salary Cycle Length (Clamped between 30 and 33 days, default 33)
 */
export async function detectSalaryCycle(): Promise<SalaryCycleInfo> {
    const profile = await prisma.financialProfile.findFirst({
        select: { salaryCycleDays: true, autoSalaryCycle: true },
    });

    if (profile && !profile.autoSalaryCycle && profile.salaryCycleDays) {
        return {
            cycleDays: clamp(profile.salaryCycleDays, INVESTMENT_DEFAULTS.salaryCycle.minDays, INVESTMENT_DEFAULTS.salaryCycle.maxDays),
            isAutoDetected: false,
            lastSalaryDate: null,
        };
    }

    const salaryTxs = await prisma.transaction.findMany({
        where: {
            OR: [
                { category: { name: { equals: "Salary", mode: "insensitive" } } },
                { transactionType: { in: ["SALARY", "CREDITED"], mode: "insensitive" } },
            ],
            amount: { gt: 0 },
        },
        orderBy: { timestamp: "desc" },
        take: 3,
    });

    if (salaryTxs.length < 2) {
        return {
            cycleDays: INVESTMENT_DEFAULTS.salaryCycle.defaultDays, // 33
            isAutoDetected: true,
            lastSalaryDate: salaryTxs[0]?.timestamp ? new Date(salaryTxs[0].timestamp) : null,
        };
    }

    const gap = daysBetween(new Date(salaryTxs[0].timestamp), new Date(salaryTxs[1].timestamp));
    const cycleDays = clamp(gap, INVESTMENT_DEFAULTS.salaryCycle.minDays, INVESTMENT_DEFAULTS.salaryCycle.maxDays);

    return {
        cycleDays,
        isAutoDetected: true,
        lastSalaryDate: new Date(salaryTxs[0].timestamp),
    };
}

/**
 * 2. Compute Surplus (Current cycle, previous cycle, smoothed surplus, trend)
 */
export async function computeSurplus(cycleDays: number): Promise<SurplusComputation> {
    const now = new Date();
    const currentStart = new Date(now.getTime() - cycleDays * 24 * 60 * 60 * 1000);
    const prevStart = new Date(now.getTime() - cycleDays * 2 * 24 * 60 * 60 * 1000);
    const threeCyclesStart = new Date(now.getTime() - cycleDays * 3 * 24 * 60 * 60 * 1000);

    const [currentTxs, prevTxs, threeCycleTxs] = await Promise.all([
        prisma.transaction.findMany({ where: { timestamp: { gte: currentStart } } }),
        prisma.transaction.findMany({ where: { timestamp: { gte: prevStart, lt: currentStart } } }),
        prisma.transaction.findMany({ where: { timestamp: { gte: threeCyclesStart } } }),
    ]);

    const isIncome = (t: any) => {
        const type = String(t.transactionType || t.type || "").toUpperCase();
        return type === "CREDIT" || type === "CREDITED" || type === "SALARY" || t.amount > 0;
    };

    const calcSurplus = (txs: any[]) => {
        let inc = 0;
        let exp = 0;
        for (const t of txs) {
            const amt = Math.abs(t.amount);
            if (isIncome(t)) inc += amt;
            else exp += amt;
        }
        return { inc, exp, surplus: inc - exp };
    };

    const currentData = calcSurplus(currentTxs);
    const prevData = calcSurplus(prevTxs);
    const rawSurplus = currentData.surplus;
    const previousSurplus = prevData.surplus;

    // Weighted Smoothed Surplus: 0.7 * current + 0.3 * previous
    const smoothedSurplus = Math.round(0.7 * rawSurplus + 0.3 * previousSurplus);

    // 3-cycle average calculation for trend
    const total3CycleIncome = threeCycleTxs.filter(isIncome).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const total3CycleExpenses = threeCycleTxs.filter((t) => !isIncome(t)).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const avg3CycleSurplus = Math.round((total3CycleIncome - total3CycleExpenses) / 3);

    let surplusTrend: SurplusComputation["surplusTrend"] = "stable";
    if (avg3CycleSurplus !== 0) {
        const ratio = (rawSurplus - avg3CycleSurplus) / Math.abs(avg3CycleSurplus);
        if (ratio >= 0.15) surplusTrend = "accelerating";
        else if (ratio >= 0.05) surplusTrend = "growing";
        else if (ratio <= -0.15) surplusTrend = "dropping";
        else if (ratio <= -0.05) surplusTrend = "decreasing";
    }

    return {
        rawSurplus,
        previousSurplus,
        smoothedSurplus: Math.max(0, smoothedSurplus),
        grossIncome: currentData.inc,
        totalExpenses: currentData.exp,
        surplusTrend,
    };
}

/**
 * 3. Determine Financial Phase
 */
export function determinePhase(
    surplus: number,
    runwayMonths: number,
    efComplete: boolean,
    hasImminentGoal: boolean
): FinancialPhase {
    if (surplus <= 0 || runwayMonths < 1) return "CRISIS";
    if (!efComplete) return "EF_BUILDING";
    if (hasImminentGoal) return "GOAL_SPRINT";
    return "WEALTH_BUILDING";
}

/**
 * Get Profile Config or Fallbacks
 */
export async function getEffectiveProfileConfig() {
    const profile = await prisma.financialProfile.findFirst();
    return {
        profile,
        phaseRates: {
            CRISIS: profile?.crisisInvestableRate ?? INVESTMENT_DEFAULTS.phaseRates.CRISIS,
            EF_BUILDING: profile?.efBuildingInvestableRate ?? INVESTMENT_DEFAULTS.phaseRates.EF_BUILDING,
            GOAL_SPRINT: profile?.goalSprintInvestableRate ?? INVESTMENT_DEFAULTS.phaseRates.GOAL_SPRINT,
            WEALTH_BUILDING: profile?.wealthBuildingInvestableRate ?? INVESTMENT_DEFAULTS.phaseRates.WEALTH_BUILDING,
        },
        subAllocations: {
            standard: {
                equity: profile?.stdEquityPct ?? INVESTMENT_DEFAULTS.subAllocations.standard.equity,
                debt: profile?.stdDebtPct ?? INVESTMENT_DEFAULTS.subAllocations.standard.debt,
                gold: profile?.stdGoldPct ?? INVESTMENT_DEFAULTS.subAllocations.standard.gold,
                cash: profile?.stdCashPct ?? INVESTMENT_DEFAULTS.subAllocations.standard.cash,
            },
            conservative: {
                equity: profile?.consEquityPct ?? INVESTMENT_DEFAULTS.subAllocations.conservative.equity,
                debt: profile?.consDebtPct ?? INVESTMENT_DEFAULTS.subAllocations.conservative.debt,
                gold: profile?.consGoldPct ?? INVESTMENT_DEFAULTS.subAllocations.conservative.gold,
                cash: profile?.consCashPct ?? INVESTMENT_DEFAULTS.subAllocations.conservative.cash,
            },
        },
        streak: profile?.investmentStreak ?? 0,
    };
}

/**
 * 4. Get Active Carveout Amount (Used by emergencyFund.ts)
 */
export async function getActiveInvestableCarveout(): Promise<number> {
    const active = await prisma.investmentSuggestion.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
    });
    if (!active) return 0;

    // Check if auto-expired (> cycleDays + 7 days)
    const ageDays = daysBetween(new Date(), new Date(active.createdAt));
    if (ageDays > active.cycleDays + INVESTMENT_DEFAULTS.staleSuggestionDays) {
        return 0;
    }

    if (active.isManuallyEdited) {
        return (active.editedEquity ?? 0) + (active.editedDebt ?? 0) + (active.editedGold ?? 0) + (active.editedCash ?? 0);
    }
    return active.totalInvestable;
}

/**
 * Phase Labels & Formatting
 */
export function getPhaseLabel(phase: FinancialPhase): string {
    switch (phase) {
        case "CRISIS":
            return "Crisis Mode (Survival)";
        case "EF_BUILDING":
            return "Emergency Reserve Building";
        case "GOAL_SPRINT":
            return "Short-Term Goal Sprint";
        case "WEALTH_BUILDING":
            return "Wealth Building Phase";
    }
}

/**
 * 5. Main Generator/Fetcher for Suggestions
 */
export async function getOrGenerateInvestmentSuggestion(): Promise<InvestmentSuggestionResult> {
    const cycleInfo = await detectSalaryCycle();
    const cycleDays = cycleInfo.cycleDays;
    const config = await getEffectiveProfileConfig();

    // Check for existing active suggestion
    const active = await prisma.investmentSuggestion.findFirst({
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
    });

    const now = new Date();

    if (active) {
        const ageDays = daysBetween(now, new Date(active.createdAt));
        if (ageDays > cycleDays + INVESTMENT_DEFAULTS.staleSuggestionDays) {
            // Auto-expire stale suggestion
            await prisma.investmentSuggestion.update({
                where: { id: active.id },
                data: { status: "EXPIRED" },
            });
        } else {
            // Return existing active suggestion
            return buildSuggestionResult(active, config, cycleDays);
        }
    }

    // Check if last suggestion was INVESTED and cycle has NOT completed yet
    const lastInvested = await prisma.investmentSuggestion.findFirst({
        where: { status: "INVESTED" },
        orderBy: { investedAt: "desc" },
    });

    if (lastInvested && lastInvested.investedAt) {
        const daysSinceInvested = daysBetween(now, new Date(lastInvested.investedAt));
        if (daysSinceInvested < cycleDays) {
            // Still in invested cool-down period
            return buildSuggestionResult(lastInvested, config, cycleDays, cycleDays - daysSinceInvested);
        }
    }

    // Generate NEW Suggestion
    const surplusComp = await computeSurplus(cycleDays);
    const runway = await calculateRunway();
    const efTargetMonths = Math.max(3, config.profile?.emergencyFundMonths ?? 6);
    const burnData = await calculateBurnRate();
    const avgMonthlyExpenses = burnData.burnRate > 0 ? burnData.burnRate : (config.profile?.monthlyExpenses ?? 0);
    const efTargetAmount = efTargetMonths * avgMonthlyExpenses;
    const currentBalance = config.profile?.balance ?? 0;
    const efComplete = currentBalance >= efTargetAmount && efTargetAmount > 0;

    const imminentGoals = await prisma.goal.findMany({
        where: {
            targetDate: { lte: new Date(now.getFullYear(), now.getMonth() + 6, now.getDate()) },
            status: { not: "COMPLETED" },
        },
    });

    const phase = determinePhase(surplusComp.smoothedSurplus, runway.runwayMonths ?? 0, efComplete, imminentGoals.length > 0);
    const phaseRate = config.phaseRates[phase];
    const baseInvestable = Math.max(0, Math.round(surplusComp.smoothedSurplus * (phaseRate / 100)));

    // Calculate sub-allocations
    const subConfig = phase === "EF_BUILDING" ? config.subAllocations.conservative : config.subAllocations.standard;
    const suggestedEquity = Math.round(baseInvestable * (subConfig.equity / 100));
    const suggestedDebt = Math.round(baseInvestable * (subConfig.debt / 100));
    const suggestedGold = Math.round(baseInvestable * (subConfig.gold / 100));
    const suggestedCash = Math.round(baseInvestable * (subConfig.cash / 100));

    const created = await prisma.investmentSuggestion.create({
        data: {
            status: "ACTIVE",
            phase,
            cycleDays,
            rawSurplus: surplusComp.rawSurplus,
            smoothedSurplus: surplusComp.smoothedSurplus,
            investableRate: phaseRate,
            baseInvestable,
            spillover: 0,
            totalInvestable: baseInvestable,
            suggestedEquity,
            suggestedDebt,
            suggestedGold,
            suggestedCash,
            isManuallyEdited: false,
        },
    });

    return buildSuggestionResult(created, config, cycleDays);
}

function buildSuggestionResult(
    record: any,
    config: any,
    cycleDays: number,
    nextSuggestionIn: number | null = null
): InvestmentSuggestionResult {
    const isEdited = record.isManuallyEdited;
    const eq = isEdited ? (record.editedEquity ?? 0) : record.suggestedEquity;
    const db = isEdited ? (record.editedDebt ?? 0) : record.suggestedDebt;
    const gd = isEdited ? (record.editedGold ?? 0) : record.suggestedGold;
    const cs = isEdited ? (record.editedCash ?? 0) : record.suggestedCash;
    const total = eq + db + gd + cs;

    const currentBalance = config.profile?.balance ?? 0;
    const maxInvestable = Math.max(0, Math.round(currentBalance));

    const calcPct = (amt: number) => (total > 0 ? Math.round((amt / total) * 100) : 0);

    return {
        suggestion: {
            id: record.id,
            status: record.status as "ACTIVE" | "INVESTED" | "EXPIRED",
            phase: record.phase as FinancialPhase,
            phaseLabel: getPhaseLabel(record.phase as FinancialPhase),
            cycleDays: record.cycleDays || cycleDays,
            rawSurplus: record.rawSurplus,
            smoothedSurplus: record.smoothedSurplus,
            investableRate: record.investableRate,
            baseInvestable: record.baseInvestable,
            spillover: record.spillover,
            totalInvestable: total,
            isManuallyEdited: isEdited,
            buckets: {
                equity: { suggested: record.suggestedEquity, edited: record.editedEquity, final: eq, pct: calcPct(eq) },
                debt: { suggested: record.suggestedDebt, edited: record.editedDebt, final: db, pct: calcPct(db) },
                gold: { suggested: record.suggestedGold, edited: record.editedGold, final: gd, pct: calcPct(gd) },
                cash: { suggested: record.suggestedCash, edited: record.editedCash, final: cs, pct: calcPct(cs) },
            },
            maxInvestable,
            investedAt: record.investedAt ? new Date(record.investedAt) : null,
            createdAt: new Date(record.createdAt),
            nextSuggestionIn,
            streak: config.streak,
            surplusTrend: "stable", // populated by caller if needed
            belowMinThreshold: record.smoothedSurplus < INVESTMENT_DEFAULTS.minInvestableThreshold,
        },
        computation: {
            rawSurplus: record.rawSurplus,
            previousSurplus: 0,
            smoothedSurplus: record.smoothedSurplus,
            grossIncome: 0,
            totalExpenses: 0,
            surplusTrend: "stable",
            phaseInvestableRate: record.investableRate,
            baseInvestable: record.baseInvestable,
            spillover: record.spillover,
        },
    };
}
