/**
 * dates.ts — Canonical date arithmetic utilities.
 *
 * All date calculations in this application should use functions from this
 * module. Do NOT define inline monthsUntil / daysBetween in services or
 * components — import from here instead.
 */

/**
 * Returns the number of whole calendar months from now until targetDate.
 * Returns null if no date is provided. Returns 0 if the date is in the past.
 *
 * @param targetDate - The future date to compute months until
 */
export function monthsUntil(targetDate?: string | Date | null): number | null {
    if (!targetDate) return null;
    const target = new Date(targetDate);
    const now = new Date();
    return Math.max(
        0,
        (target.getFullYear() - now.getFullYear()) * 12 +
            (target.getMonth() - now.getMonth()),
    );
}

/**
 * Returns the number of whole calendar months since a given date.
 * Returns 1 (minimum) if no date is provided or if date is in the future.
 *
 * @param date - The past date to compute months since
 */
export function monthsSince(date?: string | Date | null): number {
    if (!date) return 1;
    const started = new Date(date);
    const now = new Date();
    const months =
        (now.getFullYear() - started.getFullYear()) * 12 +
        (now.getMonth() - started.getMonth());
    return Math.max(1, months);
}

/**
 * Returns the absolute number of days between two dates (always positive).
 *
 * @param d1 - First date
 * @param d2 - Second date
 */
export function daysBetween(d1: Date, d2: Date): number {
    return Math.abs(Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Returns the start and end of the calendar month containing the given date.
 *
 * @param date - Any date within the desired month
 * @returns { start: Date, end: Date } where start is 00:00:00 on day 1 and
 *          end is 00:00:00 on day 1 of the NEXT month (exclusive upper bound)
 */
export function monthRange(date: Date): { start: Date; end: Date } {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    return { start, end };
}
