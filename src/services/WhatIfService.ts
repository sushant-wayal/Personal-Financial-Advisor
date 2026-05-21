import { estimateForecast } from "./GoalForecastService";
import { simulateCapacityShift } from "./GoalAllocationService";
import { getGoalOverview } from "./goals";

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export type WhatIfScenario = {
    description: string;
    newMonthlyCapacity: number;
    impacts: Array<{
        goalId: string;
        goalTitle: string;
        oldETA?: { months: number | null; eta: Date | null } | null;
        newETA?: { months: number | null; eta: Date | null } | null;
        daysDelta: number;
        summary: string;
        allocationDelta?: number;
        allocationReason?: string;
    }>;
    allocationTradeoffs?: string[];
};

export async function simulateWhatIf(capacityDelta: number): Promise<WhatIfScenario> {
    const overview = await getGoalOverview();
    const currentCapacity = overview.monthlyCapacity;
    const newCapacity = Math.max(0, currentCapacity + capacityDelta);
    const comparison = simulateCapacityShift(overview.goals, currentCapacity, capacityDelta, "utility");

    const impacts = overview.goals.map((goal) => {
        const oldForecast = estimateForecast({
            currentAmount: goal.currentAmount,
            targetAmount: goal.targetAmount,
            monthsLeft: goal.monthsLeft ?? null,
            currentSavingsVelocity: currentCapacity,
        });
        const newForecast = estimateForecast({
            currentAmount: goal.currentAmount,
            targetAmount: goal.targetAmount,
            monthsLeft: goal.monthsLeft ?? null,
            currentSavingsVelocity: newCapacity,
        });

        const oldETA = oldForecast.estimatedCompletion;
        const newETA = newForecast.estimatedCompletion;
        const oldMonths = oldETA?.months ?? null;
        const newMonths = newETA?.months ?? null;
        const daysDelta = oldMonths != null && newMonths != null ? Math.round((oldMonths - newMonths) * 30) : 0;
        const allocationImpact = comparison.impacts.find((impact) => impact.goalId === goal.id);
        const allocationDelta = allocationImpact?.allocatedDelta ?? 0;
        const allocationReason = allocationImpact?.reason;

        const pieces = [] as string[];
        if (daysDelta > 0) {
            pieces.push(`Accelerates by ${daysDelta} days`);
        } else if (daysDelta < 0) {
            pieces.push(`Delays by ${Math.abs(daysDelta)} days`);
        } else {
            pieces.push("No change in ETA");
        }
        if (allocationDelta !== 0) {
            pieces.push(allocationDelta > 0 ? `Funding increases by ${formatCurrency(allocationDelta)}` : `Funding decreases by ${formatCurrency(Math.abs(allocationDelta))}`);
        }

        return {
            goalId: goal.id,
            goalTitle: goal.title,
            oldETA,
            newETA,
            daysDelta,
            summary: pieces.join(" | "),
            allocationDelta,
            allocationReason,
        };
    });

    return {
        description: comparison.description,
        newMonthlyCapacity: newCapacity,
        impacts,
        allocationTradeoffs: comparison.tradeoffs,
    };
}

export async function simulateSpendingReduction(categoryName: string, reductionAmount: number): Promise<WhatIfScenario> {
    const scenario = await simulateWhatIf(reductionAmount);
    scenario.description = `If you reduce ${categoryName} spending by ${formatCurrency(reductionAmount)}`;
    return scenario;
}

export async function simulateLargeExpense(expenseName: string, amount: number): Promise<WhatIfScenario> {
    const scenario = await simulateWhatIf(-amount);
    scenario.description = `If you spend ${formatCurrency(amount)} on ${expenseName}`;
    return scenario;
}
