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
        },
        investmentSuggestion: {
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
        goal: {
            findMany: vi.fn(),
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
    });

    describe("computeSurplus", () => {
        it("correctly calculates surplus as Income minus Expenses using global CREDIT_TYPES and DEBIT_TYPES", async () => {
            vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({ balance: 250000 } as any);

            // Mock currentTxs (last 30d): 100k Salary credit, 40k Expense debit with positive amount
            vi.mocked(prisma.transaction.findMany)
                .mockResolvedValueOnce([
                    { amount: 100000, transactionType: "SALARY", category: { name: "Salary" } },
                    { amount: 40000, transactionType: "DEBIT", category: { name: "Shopping" } },
                ] as any)
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

            const result = await computeSurplus(30);

            expect(result.grossIncome).toBe(100000);
            expect(result.totalExpenses).toBe(40000);
            expect(result.rawSurplus).toBe(60000); // 100k - 40k
        });

        it("filters out self-transfers (TRANSFER / category 'transfer' / category 'bank')", async () => {
            vi.mocked(prisma.financialProfile.findFirst).mockResolvedValue({ balance: 250000 } as any);

            vi.mocked(prisma.transaction.findMany)
                .mockResolvedValueOnce([
                    { amount: 100000, transactionType: "SALARY", category: { name: "Salary" } },
                    { amount: 50000, transactionType: "TRANSFER", category: { name: "Transfer" } }, // Self transfer
                    { amount: 20000, transactionType: "DEBIT", category: { name: "Food" } },
                ] as any)
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

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
                    { amount: 100000, transactionType: "CREDIT", category: { name: "Freelance" } },
                    { amount: 10000, transactionType: "DEBIT", category: { name: "Bills" } },
                ] as any)
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]);

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
                suggestedEquity: 85500,
                suggestedDebt: 28500,
                suggestedGold: 14250,
                suggestedCash: 14250,
                isManuallyEdited: false,
                createdAt: new Date(),
            };

            vi.mocked(prisma.investmentSuggestion.findFirst).mockResolvedValue(activeSuggestion as any);
            vi.mocked(prisma.goal.findMany).mockResolvedValue([]);

            // Live transactions: Income 150k, Expenses 50k => Net Surplus 100k
            vi.mocked(prisma.transaction.findMany)
                .mockResolvedValueOnce([
                    { amount: 150000, transactionType: "SALARY", category: { name: "Salary" } },
                    { amount: 50000, transactionType: "DEBIT", category: { name: "Rent" } },
                ] as any)
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([]); // salary check

            (prisma.investmentSuggestion.update as any).mockImplementation(async ({ data }: any) => ({
                ...activeSuggestion,
                ...data,
            }));

            const result = await getOrGenerateInvestmentSuggestion();

            expect(prisma.investmentSuggestion.update).toHaveBeenCalled();
            expect(result.suggestion.rawSurplus).toBe(100000); // Dynamically updated from live txs
            expect(result.suggestion.smoothedSurplus).toBe(70000); // 0.7 * 100k
            expect(result.suggestion.baseInvestable).toBe(35000); // 50% of 70k in Wealth Building phase
        });
    });
});
