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
            cash: number;
        };
        conservative: {
            equity: number;
            debt: number;
            gold: number;
            cash: number;
        };
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
            equity: 50,
            debt: 25,
            gold: 15,
            cash: 10,
        },
        conservative: {
            equity: 20,
            debt: 50,
            gold: 10,
            cash: 20,
        },
    },
    minInvestableThreshold: 500,
    staleSuggestionDays: 7,
};
