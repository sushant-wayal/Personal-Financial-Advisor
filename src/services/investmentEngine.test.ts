import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeSurplus, getOrGenerateInvestmentSuggestion } from "./investmentEngine";
import { prisma } from "../lib/prisma";

vi.mock("../lib/prisma", () => ({
    prisma: {
        transaction: {
            findMany: vi.fn(),
        },
        financialProfile: {
            findFirst: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        investmentSuggestion: {
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        goal: {
            findMany: vi.fn(),
        },
        investmentHistory: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
        },
    },
}));

vi.mock("./analytics", () => ({
    calculateBurnRate: vi.fn().mockResolvedValue({ burnRate: 50000 }),
    calculateRunway: vi.fn().mockResolvedValue({ runwayMonths: 6 }),
}));

describe("investmentEngine - surplus & suggestions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(prisma.investmentHistory.findMany).mockResolvedValue([]);
    });

    describe("calculateNextStreak", () => {
        it("returns 1 for the first ever investment when no prior investment date exists", async () => {
            const { calculateNextStreak } = await import("./investmentEngine");
            const streak = calculateNextStreak(0, null, new Date("2026-08-10"));
            expect(streak).toBe(1);
        });

        it("resets streak to 1 if the prior investment was over 40 days ago", async () => {
            const { calculateNextStreak } = await import("./investmentEngine");
            const priorDate = new Date("2026-06-01"); // 70 days prior to Aug 10
            const streak = calculateNextStreak(5, priorDate, new Date("2026-08-10"));
            expect(streak).toBe(1);
        });

        it("increments current streak if prior investment was within 40 days", async () => {
            const { calculateNextStreak } = await import("./investmentEngine");
            const priorDate = new Date("2026-07-20"); // 21 days prior to Aug 10
            const streak = calculateNextStreak(3, priorDate, new Date("2026-08-10"));
            expect(streak).toBe(4);
        });
    });

    describe("computeSurplus", () => {
        it("correctly calculates surplus as Income minus Expenses using global CREDIT_TYPES and DEBIT_TYPES", async () => {
            vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({ balance: 250000 } as any);

            // Mock currentTxs (last 30d): 100k Salary credit, 40k Expense debit with positive amount
            vi.mocked(prisma.transaction.findMany)
                .mockResolvedValueOnce([
                    { amount: 100000, transactionType: "SALARY", category: { name: "Salary" }, timestamp: new Date() },
                    { amount: 40000, transactionType: "DEBIT", category: { name: "Shopping" }, timestamp: new Date() },
                ] as any);

            const result = await computeSurplus(30);

            expect(result.grossIncome).toBe(100000);
            expect(result.totalExpenses).toBe(40000);
            expect(result.rawSurplus).toBe(60000); // 100k - 40k
        });

        it("filters out self-transfers (TRANSFER / category 'transfer' / category 'bank')", async () => {
            vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({ balance: 250000 } as any);

            vi.mocked(prisma.transaction.findMany)
                .mockResolvedValueOnce([
                    { amount: 100000, transactionType: "SALARY", category: { name: "Salary" }, timestamp: new Date() },
                    { amount: 50000, transactionType: "TRANSFER", category: { name: "Transfer" }, timestamp: new Date() }, // Self transfer
                    { amount: 20000, transactionType: "DEBIT", category: { name: "Food" }, timestamp: new Date() },
                ] as any);

            const result = await computeSurplus(30);

            expect(result.grossIncome).toBe(100000);
            expect(result.totalExpenses).toBe(20000); // 50k transfer skipped
            expect(result.rawSurplus).toBe(80000);
        });

        it("caps surplus at current available liquid balance", async () => {
            // Balance is only 50k, but computed income - expense is 90k
            vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({ balance: 50000 } as any);

            vi.mocked(prisma.transaction.findMany)
                .mockResolvedValueOnce([
                    { amount: 100000, transactionType: "CREDIT", category: { name: "Freelance" }, timestamp: new Date() },
                    { amount: 10000, transactionType: "DEBIT", category: { name: "Bills" }, timestamp: new Date() },
                ] as any);

            const result = await computeSurplus(30);

            expect(result.rawSurplus).toBe(50000); // Capped at balance (50k)
            expect(result.smoothedSurplus).toBe(35000); // 0.7 * 50,000
        });
    });

    describe("getOrGenerateInvestmentSuggestion", () => {
        it("dynamically updates an existing active suggestion with live derived surplus", async () => {
            vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({
                salaryCycleDays: 30,
                autoSalaryCycle: false,
                balance: 500000, // EF complete threshold reached
                emergencyFundMonths: 6,
                monthlyExpenses: 50000,
                wealthBuildingInvestableRate: 50,
            } as any);

            // Active suggestion exists in DB with stale surplus 285k
            const activeSuggestion = {
                id: "sug-1",
                status: "ACTIVE",
                phase: "WEALTH_BUILDING",
                cycleDays: 30,
                rawSurplus: 285000,
                smoothedSurplus: 285000,
                investableRate: 50,
                baseInvestable: 142500,
                totalInvestable: 142500,
                suggestedEquity: 99750,
                suggestedDebt: 28500,
                suggestedGold: 14250,
                isManuallyEdited: false,
                createdAt: new Date(),
            };

            vi.mocked(prisma.investmentSuggestion.findFirst).mockResolvedValue(activeSuggestion as any);
            vi.mocked(prisma.goal.findMany).mockResolvedValue([]);

            // Live transactions: Income 150k, Expenses 50k => Net Surplus 100k
            vi.mocked(prisma.transaction.findMany)
                .mockResolvedValueOnce([
                    { amount: 150000, transactionType: "SALARY", category: { name: "Salary" }, timestamp: new Date() },
                    { amount: 50000, transactionType: "DEBIT", category: { name: "Rent" }, timestamp: new Date() },
                ] as any);

            (prisma.investmentSuggestion.update as any).mockImplementation(async ({ data }: any) => ({
                ...activeSuggestion,
                ...data,
            }));

            const result = await getOrGenerateInvestmentSuggestion();

            expect(prisma.investmentSuggestion.update).toHaveBeenCalled();
            expect(result.suggestion.rawSurplus).toBe(100000); // Dynamically updated from live txs
            expect(result.suggestion.smoothedSurplus).toBe(70000); // 0.7 * 100k
            expect(result.suggestion.baseInvestable).toBe(35000); // 50% of 70k in Wealth Building phase
            expect(result.suggestion.buckets.equity.breakdown).toEqual({
                nifty50: { amount: 14700, pctOfEquity: 60, pctOfTotal: 42 },
                niftyNext50: { amount: 4900, pctOfEquity: 20, pctOfTotal: 14 },
                midcap: { amount: 4900, pctOfEquity: 20, pctOfTotal: 14 },
            });
        });
    });
});
