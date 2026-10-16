import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeSurplus, getOrGenerateInvestmentSuggestion, distributeWithMinimumThreshold, getMutualFundMinInvestments } from "./investmentEngine";
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
        mutualFund: {
            findMany: vi.fn().mockResolvedValue([]),
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
                nifty50: { amount: 14700, pctOfEquity: 60, pctOfTotal: 42, minAmount: 500 },
                niftyNext50: { amount: 4900, pctOfEquity: 20, pctOfTotal: 14, minAmount: 500 },
                midcap: { amount: 4900, pctOfEquity: 20, pctOfTotal: 14, minAmount: 100 },
            });
        });
    });

    describe("distributeWithMinimumThreshold", () => {
        it("returns all zeros when total is strictly below minimum required amount", () => {
            const result = distributeWithMinimumThreshold(400, [
                { key: "equity", weight: 70, minAmount: 500 },
                { key: "debt", weight: 20, minAmount: 500 },
                { key: "gold", weight: 10, minAmount: 500 },
            ]);

            expect(result).toEqual({ equity: 0, debt: 0, gold: 0 });
        });

        it("allocates entire amount to highest-weight fund when splits all fall below threshold but total >= threshold", () => {
            // ₹800 investable with 70/20/10 weights yields raw 560 / 160 / 80 -> debt & gold fail (< 500), so equity receives all 800
            const result = distributeWithMinimumThreshold(800, [
                { key: "equity", weight: 70, minAmount: 500 },
                { key: "debt", weight: 20, minAmount: 500 },
                { key: "gold", weight: 10, minAmount: 500 },
            ]);

            expect(result.debt).toBe(0);
            expect(result.gold).toBe(0);
            expect(result.equity).toBe(800);
            expect(result.equity + result.debt + result.gold).toBe(800);
        });

        it("redistributes removed bucket amount to remaining active buckets when only one bucket fails", () => {
            // ₹4000 with 70/20/10 weights -> raw: eq 2800, debt 800, gold 400 (< 500 min).
            // Gold is removed (0) and its 400 is spread proportionally between equity (70) and debt (20).
            const result = distributeWithMinimumThreshold(4000, [
                { key: "equity", weight: 70, minAmount: 500 },
                { key: "debt", weight: 20, minAmount: 500 },
                { key: "gold", weight: 10, minAmount: 500 },
            ]);

            expect(result.gold).toBe(0);
            expect(result.equity).toBeGreaterThanOrEqual(500);
            expect(result.debt).toBeGreaterThanOrEqual(500);
            expect(result.equity).toBe(3112);
            expect(result.debt).toBe(888);
            expect(result.equity + result.debt + result.gold).toBe(4000);
        });

        it("preserves proportional distribution when all allocations exceed threshold", () => {
            // ₹10,000 with 70/20/10 -> eq 7000, debt 2000, gold 1000
            const result = distributeWithMinimumThreshold(10000, [
                { key: "equity", weight: 70, minAmount: 500 },
                { key: "debt", weight: 20, minAmount: 500 },
                { key: "gold", weight: 10, minAmount: 500 },
            ]);

            expect(result).toEqual({ equity: 7000, debt: 2000, gold: 1000 });
        });

        it("correctly handles equity sub-breakdown redistribution for ₹1000 equity (60/20/20)", () => {
            // 60% = 600, 20% = 200 (< 500), 20% = 200 (< 500)
            // niftyNext50 and midcap are removed (0) and shifted to nifty50 (1000)
            const result = distributeWithMinimumThreshold(1000, [
                { key: "nifty50", weight: 60, minAmount: 500 },
                { key: "niftyNext50", weight: 20, minAmount: 500 },
                { key: "midcap", weight: 20, minAmount: 500 },
            ]);

            expect(result.nifty50).toBe(1000);
            expect(result.niftyNext50).toBe(0);
            expect(result.midcap).toBe(0);
        });

        it("handles scheme-specific minimums where midcap allows ₹100 and nifty50 requires ₹500", () => {
            // ₹800 equity with 60/20/20 weights -> raw: n50 = 480 (< 500, fails), nn50 = 160 (< 500, fails), midcap = 160 (>= 100, passes!).
            // Midcap receives the redistributed amount because it satisfies its scheme-specific ₹100 threshold!
            const result = distributeWithMinimumThreshold(800, [
                { key: "nifty50", weight: 60, minAmount: 500 },
                { key: "niftyNext50", weight: 20, minAmount: 500 },
                { key: "midcap", weight: 20, minAmount: 100 },
            ]);

            expect(result.nifty50).toBe(0);
            expect(result.niftyNext50).toBe(0);
            expect(result.midcap).toBe(800);
        });

        it("never outputs any non-zero allocation below the threshold", () => {
            const totals = [0, 100, 499, 500, 600, 1000, 1499, 1500, 2300, 3750, 5000];
            for (const total of totals) {
                const res = distributeWithMinimumThreshold(total, [
                    { key: "nifty50", weight: 60, minAmount: 500 },
                    { key: "niftyNext50", weight: 20, minAmount: 500 },
                    { key: "midcap", weight: 20, minAmount: 100 },
                ]);

                for (const [key, val] of Object.entries(res)) {
                    if (val > 0) {
                        const min = key === "midcap" ? 100 : 500;
                        expect(val).toBeGreaterThanOrEqual(min);
                    }
                }
            }
        });
    });

    describe("getMutualFundMinInvestments", () => {
        it("retrieves scheme-specific overrides from user holdings in the database", async () => {
            vi.mocked(prisma.mutualFund.findMany).mockResolvedValueOnce([
                { schemeName: "Nippon India Gold Savings Fund - Direct Plan", minInvestment: 100 } as any,
                { schemeName: "HDFC NIFTY Midcap 150 Index Fund", minInvestment: 100 } as any,
                { schemeName: "UTI Nifty 50 Index Fund", minInvestment: 500 } as any,
                { schemeName: "UTI - Nifty Next 50 Index Fund", minInvestment: 500 } as any,
            ]);

            const mins = await getMutualFundMinInvestments();
            expect(mins.gold).toBe(100);
            expect(mins.midcap).toBe(100);
            expect(mins.nifty50).toBe(500);
            expect(mins.niftyNext50).toBe(500);
        });
    });
});
