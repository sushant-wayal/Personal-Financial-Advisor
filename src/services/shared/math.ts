/**
 * math.ts — Canonical numeric / math utility functions.
 *
 * Do NOT redefine clamp or similar utilities inline in services or
 * components — import from here instead.
 */

/**
 * Clamps a value between min and max (inclusive).
 *
 * @param value - The value to clamp
 * @param min   - Minimum allowed value
 * @param max   - Maximum allowed value
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/**
 * Safely divides numerator by denominator.
 * Returns 0 if denominator is 0 or non-finite.
 *
 * @param numerator   - The dividend
 * @param denominator - The divisor
 */
export function safeDivide(numerator: number, denominator: number): number {
    if (!denominator || !Number.isFinite(denominator)) return 0;
    return numerator / denominator;
}

/**
 * Rounds a number to a given number of decimal places.
 *
 * @param value  - The value to round
 * @param places - Number of decimal places (default: 2)
 */
export function roundTo(value: number, places = 2): number {
    const factor = Math.pow(10, places);
    return Math.round(value * factor) / factor;
}
