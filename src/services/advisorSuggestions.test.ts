import { describe, it, expect } from "vitest";
import {
    formatRelativeTime,
    formatSuggestionsContext,
    getAdvisorDynamicSuggestions,
    FALLBACK_SUGGESTIONS,
} from "./advisorSuggestions";

describe("advisorSuggestions domain service", () => {
    describe("formatRelativeTime", () => {
        const baseDate = new Date("2026-08-28T12:00:00Z");

        it("correctly identifies 'Today'", () => {
            const today = new Date("2026-08-28T08:00:00Z");
            expect(formatRelativeTime(today, baseDate)).toBe("Today");
        });

        it("correctly identifies 'Yesterday'", () => {
            const yesterday = new Date("2026-08-27T10:00:00Z");
            expect(formatRelativeTime(yesterday, baseDate)).toBe("Yesterday");
        });

        it("correctly formats days ago", () => {
            const fourDaysAgo = new Date("2026-08-24T12:00:00Z");
            expect(formatRelativeTime(fourDaysAgo, baseDate)).toBe("4 days ago");
        });

        it("correctly formats weeks ago", () => {
            const twoWeeksAgo = new Date("2026-08-14T12:00:00Z");
            expect(formatRelativeTime(twoWeeksAgo, baseDate)).toBe("2 weeks ago");
        });

        it("correctly formats months ago", () => {
            const twoMonthsAgo = new Date("2026-06-28T12:00:00Z");
            expect(formatRelativeTime(twoMonthsAgo, baseDate)).toBe("2 months ago");
        });

        it("handles invalid or null date gracefully", () => {
            expect(formatRelativeTime(null, baseDate)).toBe("Unknown date");
            expect(formatRelativeTime("invalid-date", baseDate)).toBe("Unknown date");
        });
    });

    describe("formatSuggestionsContext", () => {
        const baseDate = new Date("2026-08-28T12:00:00Z");

        it("formats financial context into a comprehensive, temporal summary", () => {
            const mockContext: any = {
                profile: {
                    balance: 150000,
                    balanceLabel: "₹1,50,000",
                    monthlyIncome: 80000,
                    monthlyIncomeLabel: "₹80,000",
                    monthlyExpenses: 45000,
                    monthlyExpensesLabel: "₹45,000",
                    currency: "INR",
                },
                monthlySurplusLabel: "₹35,000",
                analytics: {
                    runway: { runwayMonths: 6.2 },
                },
                financialHealthSummary: {
                    status: "Healthy",
                },
                monthSnapshot: {
                    currentMonthExpenses: 28000,
                    currentMonthIncome: 80000,
                    currentMonthSavingsRate: 65,
                },
                recentTransactions: [
                    {
                        id: "tx-1",
                        timestamp: new Date("2026-08-27T10:00:00Z"),
                        amount: -1200,
                        amountLabel: "₹1,200",
                        merchant: "Swiggy",
                        category: "Dining",
                        type: "DEBIT",
                    },
                    {
                        id: "tx-2",
                        timestamp: new Date("2026-06-25T10:00:00Z"),
                        amount: 100000,
                        amountLabel: "₹1,00,000",
                        merchant: "Tech Corp",
                        category: "Salary",
                        type: "CREDIT",
                    },
                ],
                budgets: [
                    {
                        categoryName: "Dining",
                        spent: 8000,
                        totalLimit: 10000,
                    },
                ],
                goalSummary: {
                    totalGoals: 2,
                    onTrackCount: 1,
                    offTrackCount: 1,
                },
                goals: [
                    {
                        id: "g1",
                        title: "Emergency Fund",
                        targetAmount: 200000,
                        currentAmount: 120000,
                        progressPct: 60,
                        targetDate: "2026-11-28T00:00:00Z",
                    },
                ],
                investmentSuggestion: {
                    phaseLabel: "Wealth Building",
                    baseInvestable: 25000,
                },
                subscriptions: {
                    activeCount: 3,
                    monthlyRecurringSpend: 1500,
                    monthlyRecurringSpendLabel: "₹1,500",
                },
                insights: [
                    {
                        id: "ins-1",
                        createdAt: new Date("2026-06-26T00:00:00Z"),
                        message: "Relocation bonus of ₹1,00,000 received. Consider allocating to emergency fund.",
                    },
                ],
            };

            const summary = formatSuggestionsContext(mockContext, baseDate);

            // Assertions
            expect(summary).toContain("CURRENT DATE:");
            expect(summary).toContain("Current Balance: ₹1,50,000");
            expect(summary).toContain("Monthly Income (90-day avg): ₹80,000");
            expect(summary).toContain("Monthly Surplus: ₹35,000");
            expect(summary).toContain("Cash Runway: ~6 months");
            expect(summary).toContain("This Month's Spending So Far: ₹28,000");

            // Verify recent transactions include relative dates
            expect(summary).toContain("Yesterday: DEBIT ₹1,200 - Swiggy [Dining]");
            expect(summary).toContain("2 months ago: CREDIT ₹1,00,000 - Tech Corp [Salary]");

            // Verify budget and goal formatting
            expect(summary).toContain("Dining: ₹8,000 / ₹10,000 (80% used)");
            expect(summary).toContain('"Emergency Fund": ₹1,20,000 / ₹2,00,000 (60% complete');

            // Verify stored insights accurately indicate age (e.g. 2 months ago)
            expect(summary).toContain("(2 months ago): Relocation bonus of ₹1,00,000 received");
        });
    });

    describe("getAdvisorDynamicSuggestions", () => {
        it("returns fallback suggestions when GEMINI_API_KEY is not set", async () => {
            const originalKey = process.env.GEMINI_API_KEY;
            delete process.env.GEMINI_API_KEY;

            const suggestions = await getAdvisorDynamicSuggestions();
            expect(suggestions).toEqual(FALLBACK_SUGGESTIONS);

            process.env.GEMINI_API_KEY = originalKey;
        });
    });
});
