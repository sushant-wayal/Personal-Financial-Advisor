export type FinancialPhase = "CRISIS" | "EF_BUILDING" | "WEALTH_BUILDING" | "GOAL_SPRINT";

export type InvestmentDefaults = {
    salaryCycle: {
        minDays: number;
        maxDays: number;
        defaultDays: number;
    };
    phaseRates: Record<FinancialPhase, number>; // 0 to 100
    subAllocations: {
        standard: {
            equity: number;
            debt: number;
            gold: number;
        };
        conservative: {
            equity: number;
            debt: number;
            gold: number;
        };
    };
    equityBreakdown: {
        nifty50: number;
        niftyNext50: number;
        midcap: number;
    };
    minInvestableThreshold: number; // ₹500
    staleSuggestionDays: number; // 7 days after cycleDays
};

export const INVESTMENT_DEFAULTS: InvestmentDefaults = {
    salaryCycle: {
        minDays: 30,
        maxDays: 33,
        defaultDays: 33,
    },
    phaseRates: {
        CRISIS: 0,
        EF_BUILDING: 15,
        GOAL_SPRINT: 40,
        WEALTH_BUILDING: 100,
    },
    subAllocations: {
        standard: {
            equity: 70,
            debt: 20,
            gold: 10,
        },
        conservative: {
            equity: 30,
            debt: 60,
            gold: 10,
        },
    },
    equityBreakdown: {
        nifty50: 60,
        niftyNext50: 20,
        midcap: 20,
    },
    minInvestableThreshold: 500,
    staleSuggestionDays: 7,
};
