/**
 * Small helper that formats insight messages about timeline deltas or impacts.
 */

export function impactMessageForChange(goalTitle: string, daysChanged: number) {
    if (daysChanged === 0) return `${goalTitle} unchanged`;
    if (daysChanged > 0) return `${goalTitle} delayed by ${Math.abs(daysChanged)} days`;
    return `${goalTitle} accelerated by ${Math.abs(daysChanged)} days`;
}
