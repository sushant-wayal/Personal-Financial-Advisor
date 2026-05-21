/**
 * Simple feasibility and health scoring helpers.
 */

export type HealthStatus = "Ahead of Schedule" | "On Track" | "At Risk" | "Off Track";

export function computeHealthStatus(requiredMonthly: number, availableMonthly: number) {
    if (availableMonthly <= 0) return "Off Track" as HealthStatus;
    const ratio = availableMonthly / Math.max(1, requiredMonthly);
    if (ratio >= 1.25) return "Ahead of Schedule" as HealthStatus;
    if (ratio >= 0.9) return "On Track" as HealthStatus;
    if (ratio >= 0.5) return "At Risk" as HealthStatus;
    return "Off Track" as HealthStatus;
}

/**
 * Confidence score (0-100) based on ratio and volatility factor (0-1)
 */
export function computeConfidenceScore(requiredMonthly: number, availableMonthly: number, volatility = 0.3) {
    if (requiredMonthly <= 0) return 100;
    const ratio = Math.min(2, availableMonthly / requiredMonthly);
    // base score from ratio (50..100+), penalize volatility
    const base = Math.round(Math.min(100, Math.max(0, ratio * 50 + 50)));
    const penalty = Math.round(volatility * 40); // up to -40
    const score = Math.max(0, Math.min(100, base - penalty));
    return score;
}
