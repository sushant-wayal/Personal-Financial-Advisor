import { describe, it, expect } from "vitest";
import { calculateMonthlyEpfInterest, processEpfMonthlyCredit } from "./epf";

describe("EPF Interest and Monthly Credit Service", () => {
    describe("calculateMonthlyEpfInterest", () => {
        it("calculates exact monthly interest for standard EPF rate (8.25%)", () => {
            // 100,000 * 8.25% / 12 = 687.5
            const interest = calculateMonthlyEpfInterest(100000, 8.25);
            expect(interest).toBe(687.5);
        });

        it("rounds monthly interest to 2 decimal places", () => {
            // 153,245 * 8.25% / 12 = 1053.559375 -> 1053.56
            const interest = calculateMonthlyEpfInterest(153245, 8.25);
            expect(interest).toBe(1053.56);
        });

        it("returns 0 for zero or negative balance", () => {
            expect(calculateMonthlyEpfInterest(0, 8.25)).toBe(0);
            expect(calculateMonthlyEpfInterest(-50000, 8.25)).toBe(0);
        });

        it("returns 0 for zero, negative or NaN interest rates", () => {
            expect(calculateMonthlyEpfInterest(100000, 0)).toBe(0);
            expect(calculateMonthlyEpfInterest(100000, -8.25)).toBe(0);
            expect(calculateMonthlyEpfInterest(100000, NaN)).toBe(0);
        });
    });

    describe("processEpfMonthlyCredit", () => {
        it("credits interest based on balance BEFORE that month's contribution credit", () => {
            const initialBalance = 100000;
            const empContrib = 5000;
            const emplyrContrib = 5000;
            const rate = 8.25;

            const result = processEpfMonthlyCredit({
                currentBalance: initialBalance,
                monthlyEmployeeContribution: empContrib,
                monthlyEmployerContribution: emplyrContrib,
                currentInterestRate: rate,
            });

            // Interest should be on initialBalance (100,000), not on 110,000
            expect(result.balanceBeforeContribution).toBe(100000);
            expect(result.monthlyInterest).toBe(687.5);
            expect(result.totalContribution).toBe(10000);
            // newBalance = 100,000 + 687.5 + 10,000 = 110,687.5
            expect(result.newBalance).toBe(110687.5);
            expect(result.newAccruedInterest).toBe(0);
        });

        it("folds legacy accrued interest into balance and resets newAccruedInterest to 0", () => {
            const initialBalance = 200000;
            const legacyAccrued = 1500;
            const empContrib = 3000;
            const emplyrContrib = 3000;
            const rate = 8.25;

            const result = processEpfMonthlyCredit({
                currentBalance: initialBalance,
                monthlyEmployeeContribution: empContrib,
                monthlyEmployerContribution: emplyrContrib,
                currentInterestRate: rate,
                accruedInterest: legacyAccrued,
            });

            // Opening balance before contribution becomes 200,000 + 1,500 = 201,500
            expect(result.balanceBeforeContribution).toBe(201500);
            // 201,500 * 8.25% / 12 = 1385.3125 -> 1385.31
            expect(result.monthlyInterest).toBe(1385.31);
            expect(result.totalContribution).toBe(6000);
            expect(result.newBalance).toBe(208885.31);
            expect(result.newAccruedInterest).toBe(0);
        });

        it("handles zero contributions correctly", () => {
            const result = processEpfMonthlyCredit({
                currentBalance: 50000,
                monthlyEmployeeContribution: 0,
                monthlyEmployerContribution: 0,
                currentInterestRate: 8.25,
            });

            expect(result.balanceBeforeContribution).toBe(50000);
            expect(result.monthlyInterest).toBe(343.75);
            expect(result.totalContribution).toBe(0);
            expect(result.newBalance).toBe(50343.75);
        });
    });
});
