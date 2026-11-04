import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    isEligibleGoalTransaction,
    applyGoalSpending,
    revertGoalSpending,
    handleGoalSpendingTransition,
} from "./goalSpending";

describe("goalSpending Service", () => {
    describe("isEligibleGoalTransaction", () => {
        it("returns true for debit/expense types", () => {
            expect(isEligibleGoalTransaction("DEBIT")).toBe(true);
            expect(isEligibleGoalTransaction("EXPENSE")).toBe(true);
            expect(isEligibleGoalTransaction("PURCHASE")).toBe(true);
            expect(isEligibleGoalTransaction("PAYMENT")).toBe(true);
            expect(isEligibleGoalTransaction("SUBSCRIPTION")).toBe(true);
            expect(isEligibleGoalTransaction("TRANSFER")).toBe(true);
            expect(isEligibleGoalTransaction(null, "DEBIT")).toBe(true);
            expect(isEligibleGoalTransaction()).toBe(true);
        });

        it("returns false for income/credit types", () => {
            expect(isEligibleGoalTransaction("CREDIT")).toBe(false);
            expect(isEligibleGoalTransaction("SALARY")).toBe(false);
            expect(isEligibleGoalTransaction("REFUND")).toBe(false);
            expect(isEligibleGoalTransaction("INCOME")).toBe(false);
            expect(isEligibleGoalTransaction(null, "CREDIT")).toBe(false);
        });
    });

    describe("applyGoalSpending", () => {
        it("deducts amount from currentAmount and targetAmount, and increments spentAmount", async () => {
            const mockGoal = {
                id: "goal-1",
                currentAmount: 5000,
                targetAmount: 20000,
                spentAmount: 1000,
            };

            const mockFindUnique = vi.fn().mockResolvedValue(mockGoal);
            const mockUpdate = vi.fn().mockResolvedValue({ ...mockGoal, spentAmount: 3000, currentAmount: 3000, targetAmount: 18000 });

            const mockClient: any = {
                goal: {
                    findUnique: mockFindUnique,
                    update: mockUpdate,
                },
            };

            await applyGoalSpending("goal-1", 2000, mockClient);

            expect(mockFindUnique).toHaveBeenCalledWith({
                where: { id: "goal-1" },
                select: { id: true, currentAmount: true, targetAmount: true, spentAmount: true },
            });
            expect(mockUpdate).toHaveBeenCalledWith({
                where: { id: "goal-1" },
                data: {
                    spentAmount: 3000,
                    currentAmount: 3000,
                    targetAmount: 18000,
                },
            });
        });

        it("clamps currentAmount and targetAmount to 0 if spent exceeds them", async () => {
            const mockGoal = {
                id: "goal-1",
                currentAmount: 1000,
                targetAmount: 1500,
                spentAmount: 500,
            };

            const mockFindUnique = vi.fn().mockResolvedValue(mockGoal);
            const mockUpdate = vi.fn().mockResolvedValue(mockGoal);

            const mockClient: any = {
                goal: {
                    findUnique: mockFindUnique,
                    update: mockUpdate,
                },
            };

            await applyGoalSpending("goal-1", 3000, mockClient);

            expect(mockUpdate).toHaveBeenCalledWith({
                where: { id: "goal-1" },
                data: {
                    spentAmount: 3500,
                    currentAmount: 0,
                    targetAmount: 0,
                },
            });
        });
    });

    describe("revertGoalSpending", () => {
        it("restores amount to currentAmount and targetAmount, and decrements spentAmount", async () => {
            const mockGoal = {
                id: "goal-1",
                currentAmount: 3000,
                targetAmount: 18000,
                spentAmount: 3000,
            };

            const mockFindUnique = vi.fn().mockResolvedValue(mockGoal);
            const mockUpdate = vi.fn().mockResolvedValue(mockGoal);

            const mockClient: any = {
                goal: {
                    findUnique: mockFindUnique,
                    update: mockUpdate,
                },
            };

            await revertGoalSpending("goal-1", 2000, mockClient);

            expect(mockUpdate).toHaveBeenCalledWith({
                where: { id: "goal-1" },
                data: {
                    spentAmount: 1000,
                    currentAmount: 5000,
                    targetAmount: 20000,
                },
            });
        });
    });

    describe("handleGoalSpendingTransition", () => {
        let mockClient: any;
        let mockGoals: Record<string, { id: string; currentAmount: number; targetAmount: number; spentAmount: number }>;

        beforeEach(() => {
            mockGoals = {
                "goal-1": { id: "goal-1", currentAmount: 10000, targetAmount: 50000, spentAmount: 2000 },
                "goal-2": { id: "goal-2", currentAmount: 8000, targetAmount: 30000, spentAmount: 0 },
            };

            mockClient = {
                goal: {
                    findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
                        return Promise.resolve(mockGoals[where.id] ? { ...mockGoals[where.id] } : null);
                    }),
                    update: vi.fn().mockImplementation(({ where, data }: { where: { id: string }; data: any }) => {
                        if (mockGoals[where.id]) {
                            mockGoals[where.id] = { ...mockGoals[where.id], ...data };
                        }
                        return Promise.resolve(mockGoals[where.id]);
                    }),
                },
            };
        });

        it("does nothing when neither old nor new has goal", async () => {
            await handleGoalSpendingTransition({
                oldGoalId: null,
                newGoalId: null,
                oldAmount: 100,
                newAmount: 200,
                oldIsEligible: true,
                newIsEligible: true,
                client: mockClient,
            });

            expect(mockClient.goal.findUnique).not.toHaveBeenCalled();
            expect(mockClient.goal.update).not.toHaveBeenCalled();
        });

        it("applies spending when goal is newly added", async () => {
            await handleGoalSpendingTransition({
                oldGoalId: null,
                newGoalId: "goal-1",
                oldAmount: 1500,
                newAmount: 1500,
                oldIsEligible: true,
                newIsEligible: true,
                client: mockClient,
            });

            expect(mockGoals["goal-1"].spentAmount).toBe(3500);
            expect(mockGoals["goal-1"].currentAmount).toBe(8500);
            expect(mockGoals["goal-1"].targetAmount).toBe(48500);
        });

        it("reverts spending when goal is removed", async () => {
            await handleGoalSpendingTransition({
                oldGoalId: "goal-1",
                newGoalId: null,
                oldAmount: 1500,
                newAmount: 1500,
                oldIsEligible: true,
                newIsEligible: true,
                client: mockClient,
            });

            expect(mockGoals["goal-1"].spentAmount).toBe(500);
            expect(mockGoals["goal-1"].currentAmount).toBe(11500);
            expect(mockGoals["goal-1"].targetAmount).toBe(51500);
        });

        it("reverts spending on old goal and applies on new goal when switched", async () => {
            await handleGoalSpendingTransition({
                oldGoalId: "goal-1",
                newGoalId: "goal-2",
                oldAmount: 2000,
                newAmount: 2500,
                oldIsEligible: true,
                newIsEligible: true,
                client: mockClient,
            });

            // goal-1 reverted by 2000
            expect(mockGoals["goal-1"].spentAmount).toBe(0);
            expect(mockGoals["goal-1"].currentAmount).toBe(12000);
            expect(mockGoals["goal-1"].targetAmount).toBe(52000);

            // goal-2 applied by 2500
            expect(mockGoals["goal-2"].spentAmount).toBe(2500);
            expect(mockGoals["goal-2"].currentAmount).toBe(5500);
            expect(mockGoals["goal-2"].targetAmount).toBe(27500);
        });

        it("adjusts delta on same goal when amount is increased", async () => {
            await handleGoalSpendingTransition({
                oldGoalId: "goal-1",
                newGoalId: "goal-1",
                oldAmount: 1000,
                newAmount: 1500,
                oldIsEligible: true,
                newIsEligible: true,
                client: mockClient,
            });

            // Delta +500
            expect(mockGoals["goal-1"].spentAmount).toBe(2500);
            expect(mockGoals["goal-1"].currentAmount).toBe(9500);
            expect(mockGoals["goal-1"].targetAmount).toBe(49500);
        });

        it("adjusts delta on same goal when amount is decreased", async () => {
            await handleGoalSpendingTransition({
                oldGoalId: "goal-1",
                newGoalId: "goal-1",
                oldAmount: 1000,
                newAmount: 600,
                oldIsEligible: true,
                newIsEligible: true,
                client: mockClient,
            });

            // Delta -400
            expect(mockGoals["goal-1"].spentAmount).toBe(1600);
            expect(mockGoals["goal-1"].currentAmount).toBe(10400);
            expect(mockGoals["goal-1"].targetAmount).toBe(50400);
        });

        it("reverts goal when transaction type changes from expense to income", async () => {
            await handleGoalSpendingTransition({
                oldGoalId: "goal-1",
                newGoalId: "goal-1",
                oldAmount: 1000,
                newAmount: 1000,
                oldIsEligible: true,
                newIsEligible: false, // became income
                client: mockClient,
            });

            expect(mockGoals["goal-1"].spentAmount).toBe(1000);
            expect(mockGoals["goal-1"].currentAmount).toBe(11000);
            expect(mockGoals["goal-1"].targetAmount).toBe(51000);
        });
    });
});

