import { prisma } from "../lib/prisma";
import { calculateBurnRate } from "./analytics";
import { computeSavingsCapacity } from "./savings";

export type EmergencyFundStatus = {
    /** User-configured number of months the fund should cover (>= 3) */
    targetMonths: number;
    /** Average monthly expenses derived from last 3 months of transactions */
    avgMonthlyExpenses: number;
    /** How much money the fund needs to hold = targetMonths × avgMonthlyExpenses */
    targetAmount: number;
    /**
     * Auto-derived: min(targetAmount, currentBalance).
     * The portion of the user's balance that covers the emergency fund target.
     */
    savedAmount: number;
    /** 0–100 */
    progressPct: number;
    /** targetAmount - savedAmount, floored at 0 */
    shortfall: number;
    /** Estimated months to fill the gap at current savings capacity */
    monthsToComplete: number | null;
    /** Estimated completion date */
    estimatedCompletionDate: Date | null;
    /** True when savedAmount >= targetAmount */
    isComplete: boolean;
    /** Monthly savings capacity (income - expenses or detected from transactions) */
    monthlyCapacity: number;
};

export async function getEmergencyFundStatus(): Promise<EmergencyFundStatus> {
    const [profile, burnData, savingsCapacity] = await Promise.all([
        prisma.financialProfile.findFirst({
            select: {
                emergencyFundMonths: true,
                balance: true,
                monthlyIncome: true,
                monthlyExpenses: true,
            },
        }),
        calculateBurnRate(),
        computeSavingsCapacity(3),
    ]);

    const targetMonths = Math.max(3, profile?.emergencyFundMonths ?? 6);
    const currentBalance = Math.max(0, profile?.balance ?? 0);

    // Use the 3-month rolling burn rate as the best estimate of monthly expenses.
    // Fall back to profile monthlyExpenses if no transactions exist.
    const avgMonthlyExpenses =
        burnData.burnRate > 0
            ? burnData.burnRate
            : Math.max(0, profile?.monthlyExpenses ?? 0);

    const targetAmount = targetMonths * avgMonthlyExpenses;

    // Auto-derive: how much of the current balance is "in" the emergency fund
    const savedAmount = Math.min(targetAmount, currentBalance);

    const shortfall = Math.max(0, targetAmount - savedAmount);
    const progressPct = targetAmount > 0 ? Math.min(100, (savedAmount / targetAmount) * 100) : 100;
    const isComplete = shortfall === 0 && targetAmount > 0;

    // Monthly capacity = income - expenses (or detected from transactions)
    const profileCapacity = Math.max(
        0,
        Number(profile?.monthlyIncome ?? 0) - Number(profile?.monthlyExpenses ?? 0),
    );
    const monthlyCapacity = Math.max(profileCapacity, savingsCapacity);

    let monthsToComplete: number | null = null;
    let estimatedCompletionDate: Date | null = null;
    if (!isComplete && shortfall > 0 && monthlyCapacity > 0) {
        monthsToComplete = Math.ceil(shortfall / monthlyCapacity);
        const now = new Date();
        estimatedCompletionDate = new Date(
            now.getFullYear(),
            now.getMonth() + monthsToComplete,
            now.getDate(),
        );
    }

    return {
        targetMonths,
        avgMonthlyExpenses: Math.round(avgMonthlyExpenses),
        targetAmount: Math.round(targetAmount),
        savedAmount: Math.round(savedAmount),
        progressPct: Math.round(progressPct * 10) / 10,
        shortfall: Math.round(shortfall),
        monthsToComplete,
        estimatedCompletionDate,
        isComplete,
        monthlyCapacity: Math.round(monthlyCapacity),
    };
}
