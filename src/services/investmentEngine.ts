import { prisma } from "../lib/prisma";
import { INVESTMENT_DEFAULTS, FinancialPhase } from "../config/investmentDefaults";
import { calculateBurnRate, calculateRunway } from "./analytics";
import { CREDIT_TYPES } from "./balance";
import { clamp } from "./shared/math";
import { daysBetween } from "./shared/dates";

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

export type EquityBreakdown = {
    nifty50: { amount: number; pctOfEquity: number; pctOfTotal: number };
    niftyNext50: { amount: number; pctOfEquity: number; pctOfTotal: number };
    midcap: { amount: number; pctOfEquity: number; pctOfTotal: number };
};

export type SubAllocationBreakdown = {
    equity: {
        suggested: number;
        edited: number | null;
        final: number;
        pct: number;
        breakdown: EquityBreakdown;
    };
    debt: { suggested: number; edited: number | null; final: number; pct: number };
    gold: { suggested: number; edited: number | null; final: number; pct: number };
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
            transactionType: { in: ["SALARY", "CREDITED", "salary", "credited"] },
            amount: { gt: 0 },
        },
        select: { timestamp: true },
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

    const txSelect = {
        amount: true,
        type: true,
        transactionType: true,
        timestamp: true,
    };

    const [threeCycleTxs, profile] = await Promise.all([
        prisma.transaction.findMany({ where: { timestamp: { gte: threeCyclesStart } }, select: txSelect }),
        prisma.financialProfile.findFirst({ select: { balance: true } }),
    ]);

    const currentTxs = threeCycleTxs.filter((t) => new Date(t.timestamp!) >= currentStart);
    const prevTxs = threeCycleTxs.filter((t) => {
        const ts = new Date(t.timestamp!);
        return ts >= prevStart && ts < currentStart;
    });

    const currentBalance = Math.max(0, profile?.balance ?? 0);

    const isCreditTx = (t: any) => {
        const type = String(t.transactionType || t.type || "").toUpperCase();
        return CREDIT_TYPES.has(type);
    };

    const isSelfTransfer = (t: any) => {
        const type = String(t.transactionType || t.type || "").toUpperCase();
        return type === "TRANSFER" || type === "SELF_TRANSFER";
    };

    const calcSurplus = (txs: any[]) => {
        let inc = 0;
        let exp = 0;
        for (const t of txs) {
            if (isSelfTransfer(t)) continue;
            const amt = Math.abs(t.amount || 0);
            if (isCreditTx(t)) inc += amt;
            else exp += amt;
        }
        return { inc, exp, surplus: inc - exp };
    };

    const currentData = calcSurplus(currentTxs);
    const prevData = calcSurplus(prevTxs);

    // Surplus cannot exceed available liquid balance
    const rawSurplus = Math.min(currentData.surplus, currentBalance);
    const previousSurplus = Math.min(prevData.surplus, currentBalance);

    // Weighted Smoothed Surplus: 0.7 * current + 0.3 * previous, capped by current liquid balance
    const smoothedSurplus = Math.min(
        Math.max(0, Math.round(0.7 * rawSurplus + 0.3 * previousSurplus)),
        currentBalance
    );

    // 3-cycle average calculation for trend
    const valid3CycleTxs = threeCycleTxs.filter((t) => !isSelfTransfer(t));
    const total3CycleIncome = valid3CycleTxs.filter(isCreditTx).reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
    const total3CycleExpenses = valid3CycleTxs.filter((t) => !isCreditTx(t)).reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
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
 * Calculates the next streak value when an investment is recorded.
 * Increments streak if last investment was <= 40 days ago, else resets to 1.
 */
export function calculateNextStreak(currentStreak: number, lastInvestedAt: Date | null, now: Date = new Date()): number {
    if (!lastInvestedAt) return 1;
    const days = daysBetween(now, lastInvestedAt);
    return days <= 40 ? currentStreak + 1 : 1;
}

/**
 * Get Profile Config or Fallbacks
 */
export async function getEffectiveProfileConfig() {
    const profile = await prisma.financialProfile.findFirst();
    let streak = profile?.investmentStreak ?? 0;

    // Check if stored streak has expired because >40 days passed since last investment
    const lastHistory = await prisma.investmentHistory.findFirst({
        orderBy: { investedAt: "desc" },
    });

    if (lastHistory?.investedAt && daysBetween(new Date(), new Date(lastHistory.investedAt)) > 40) {
        streak = 0;
        if (profile && profile.investmentStreak !== 0) {
            await prisma.financialProfile.update({
                where: { id: profile.id },
                data: { investmentStreak: 0 },
            });
        }
    }

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
            },
            conservative: {
                equity: profile?.consEquityPct ?? INVESTMENT_DEFAULTS.subAllocations.conservative.equity,
                debt: profile?.consDebtPct ?? INVESTMENT_DEFAULTS.subAllocations.conservative.debt,
                gold: profile?.consGoldPct ?? INVESTMENT_DEFAULTS.subAllocations.conservative.gold,
            },
        },
        equityBreakdown: {
            nifty50: (profile as any)?.equityNifty50Pct ?? INVESTMENT_DEFAULTS.equityBreakdown.nifty50,
            niftyNext50: (profile as any)?.equityNiftyNext50Pct ?? INVESTMENT_DEFAULTS.equityBreakdown.niftyNext50,
            midcap: (profile as any)?.equityMidcapPct ?? INVESTMENT_DEFAULTS.equityBreakdown.midcap,
        },
        streak,
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

    if (active.isManuallyEdited) {
        return (active.editedEquity ?? 0) + (active.editedDebt ?? 0) + (active.editedGold ?? 0);
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
export async function getOrGenerateInvestmentSuggestion(options?: { burnData?: Awaited<ReturnType<typeof calculateBurnRate>> }): Promise<InvestmentSuggestionResult> {
    const now = new Date();
    const sixMonthsFromNow = new Date(now.getFullYear(), now.getMonth() + 6, now.getDate());

    const [cycleInfo, config, imminentGoals, active] = await Promise.all([
        detectSalaryCycle(),
        getEffectiveProfileConfig(),
        prisma.goal.findMany({
            where: {
                targetDate: { lte: sixMonthsFromNow },
                status: { not: "COMPLETED" },
            },
            select: { id: true },
        }),
        prisma.investmentSuggestion.findFirst({
            where: { status: "ACTIVE" },
            orderBy: { createdAt: "desc" },
        }),
    ]);
    const cycleDays = cycleInfo.cycleDays;

    // Compute live dynamic cycle data in parallel
    const [surplusComp, runway, burnData] = await Promise.all([
        computeSurplus(cycleDays),
        calculateRunway(options),
        options?.burnData ?? calculateBurnRate(),
    ]);

    const efTargetMonths = Math.max(3, config.profile?.emergencyFundMonths ?? 6);
    const avgMonthlyExpenses = burnData.burnRate > 0 ? burnData.burnRate : (config.profile?.monthlyExpenses ?? 0);
    const efTargetAmount = efTargetMonths * avgMonthlyExpenses;
    const currentBalance = config.profile?.balance ?? 0;
    const efComplete = currentBalance >= efTargetAmount && efTargetAmount > 0;

    const phase = determinePhase(surplusComp.smoothedSurplus, runway.runwayMonths ?? 0, efComplete, imminentGoals.length > 0);
    const phaseRate = config.phaseRates[phase];
    const baseInvestable = Math.max(0, Math.round(surplusComp.smoothedSurplus * (phaseRate / 100)));

    const subConfig = phase === "EF_BUILDING" ? config.subAllocations.conservative : config.subAllocations.standard;
    const suggestedEquity = Math.round(baseInvestable * (subConfig.equity / 100));
    const suggestedDebt = Math.round(baseInvestable * (subConfig.debt / 100));
    const suggestedGold = Math.max(0, baseInvestable - suggestedEquity - suggestedDebt);

    if (active) {
        const liveActive = {
            ...active,
            phase,
            cycleDays,
            rawSurplus: surplusComp.rawSurplus,
            smoothedSurplus: surplusComp.smoothedSurplus,
            investableRate: phaseRate,
            baseInvestable,
            totalInvestable: active.isManuallyEdited
                ? (active.editedEquity ?? 0) + (active.editedDebt ?? 0) + (active.editedGold ?? 0)
                : baseInvestable,
            suggestedEquity,
            suggestedDebt,
            suggestedGold,
        };

        // Non-blocking async background persist
        prisma.investmentSuggestion.update({
            where: { id: active.id },
            data: {
                phase,
                cycleDays,
                rawSurplus: surplusComp.rawSurplus,
                smoothedSurplus: surplusComp.smoothedSurplus,
                investableRate: phaseRate,
                baseInvestable,
                totalInvestable: liveActive.totalInvestable,
                suggestedEquity,
                suggestedDebt,
                suggestedGold,
            },
        }).catch(() => null);

        return buildSuggestionResult(liveActive, config, cycleDays, null, surplusComp);
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
            return buildSuggestionResult(lastInvested, config, cycleDays, cycleDays - daysSinceInvested, surplusComp);
        }
    }

    // Generate NEW Suggestion
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
            isManuallyEdited: false,
        },
    });

    return buildSuggestionResult(created, config, cycleDays, null, surplusComp);
}

function buildSuggestionResult(
    record: any,
    config: any,
    cycleDays: number,
    nextSuggestionIn: number | null = null,
    surplusComp: SurplusComputation | null = null
): InvestmentSuggestionResult {
    const isEdited = record.isManuallyEdited;
    const eq = isEdited ? (record.editedEquity ?? 0) : record.suggestedEquity;
    const db = isEdited ? (record.editedDebt ?? 0) : record.suggestedDebt;
    const gd = isEdited ? (record.editedGold ?? 0) : record.suggestedGold;
    const total = isEdited ? (eq + db + gd) : (record.baseInvestable || (eq + db + gd));

    const currentBalance = config.profile?.balance ?? 0;
    const maxInvestable = Math.max(0, Math.round(currentBalance));

    const eqPct = total > 0 ? Math.round((eq / total) * 100) : 0;
    const dbPct = total > 0 ? Math.round((db / total) * 100) : 0;
    const gdPct = total > 0 ? Math.max(0, 100 - eqPct - dbPct) : 0;

    // Calculate Equity Breakdown based on profile config (default 60 / 20 / 20)
    const n50Pct = config.equityBreakdown?.nifty50 ?? INVESTMENT_DEFAULTS.equityBreakdown.nifty50;
    const nn50Pct = config.equityBreakdown?.niftyNext50 ?? INVESTMENT_DEFAULTS.equityBreakdown.niftyNext50;
    const mcPct = config.equityBreakdown?.midcap ?? INVESTMENT_DEFAULTS.equityBreakdown.midcap;

    const nifty50Amt = Math.round(eq * (n50Pct / 100));
    const niftyNext50Amt = Math.round(eq * (nn50Pct / 100));
    const midcapAmt = Math.max(0, eq - nifty50Amt - niftyNext50Amt);

    const calcSubPct = (amt: number) => (total > 0 ? Math.round((amt / total) * 100) : 0);

    const equityBreakdown: EquityBreakdown = {
        nifty50: {
            amount: nifty50Amt,
            pctOfEquity: n50Pct,
            pctOfTotal: calcSubPct(nifty50Amt),
        },
        niftyNext50: {
            amount: niftyNext50Amt,
            pctOfEquity: nn50Pct,
            pctOfTotal: calcSubPct(niftyNext50Amt),
        },
        midcap: {
            amount: midcapAmt,
            pctOfEquity: mcPct,
            pctOfTotal: calcSubPct(midcapAmt),
        },
    };

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
                equity: {
                    suggested: record.suggestedEquity,
                    edited: record.editedEquity,
                    final: eq,
                    pct: eqPct,
                    breakdown: equityBreakdown,
                },
                debt: { suggested: record.suggestedDebt, edited: record.editedDebt, final: db, pct: dbPct },
                gold: { suggested: record.suggestedGold, edited: record.editedGold, final: gd, pct: gdPct },
            },
            maxInvestable,
            investedAt: record.investedAt ? new Date(record.investedAt) : null,
            createdAt: new Date(record.createdAt),
            nextSuggestionIn,
            streak: config.streak,
            surplusTrend: surplusComp?.surplusTrend ?? "stable",
            belowMinThreshold: record.smoothedSurplus < INVESTMENT_DEFAULTS.minInvestableThreshold,
        },
        computation: {
            rawSurplus: surplusComp?.rawSurplus ?? record.rawSurplus,
            previousSurplus: surplusComp?.previousSurplus ?? 0,
            smoothedSurplus: surplusComp?.smoothedSurplus ?? record.smoothedSurplus,
            grossIncome: surplusComp?.grossIncome ?? 0,
            totalExpenses: surplusComp?.totalExpenses ?? 0,
            surplusTrend: surplusComp?.surplusTrend ?? "stable",
            phaseInvestableRate: record.investableRate,
            baseInvestable: record.baseInvestable,
            spillover: record.spillover,
        },
    };
}
