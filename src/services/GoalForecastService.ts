export type Forecast = {
    requiredMonthly: number;
    estimatedCompletion: { months: number | null; eta: Date | null } | null;
};

function predictETA(currentAmount: number, monthlyContribution: number, targetAmount: number) {
    if (monthlyContribution <= 0) return null;
    const months = Math.ceil((targetAmount - currentAmount) / monthlyContribution);
    const now = new Date();
    const eta = new Date(now.getFullYear(), now.getMonth() + months, now.getDate());
    return { months, eta };
}

/**
 * Estimate forecast for a goal using multiple signals.
 * - remaining amount / monthsRemaining when targetDate provided
 * - otherwise uses currentSavingsVelocity to predict ETA
 */
export function estimateForecast({
    currentAmount,
    targetAmount,
    monthsLeft,
    currentSavingsVelocity,
}: {
    currentAmount: number;
    targetAmount: number;
    monthsLeft: number | null;
    currentSavingsVelocity: number; // observed monthly savings
}): Forecast {
    const remaining = Math.max(0, targetAmount - currentAmount);
    let requiredMonthly = 0;
    if (monthsLeft && monthsLeft > 0) {
        requiredMonthly = remaining / monthsLeft;
    } else {
        // fallback to a recommended heuristic of using either velocity or remaining (one-time)
        requiredMonthly = Math.max(0, remaining);
    }

    // use observed velocity to predict ETA; prefer velocity but fall back to requiredMonthly
    const monthlyContributionForEta = Math.max(currentSavingsVelocity, requiredMonthly);
    const eta = predictETA(currentAmount, monthlyContributionForEta, targetAmount);

    return {
        requiredMonthly: Math.round(requiredMonthly),
        estimatedCompletion: eta ? { months: eta.months, eta: eta.eta } : null,
    };
}
