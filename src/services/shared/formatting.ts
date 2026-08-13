/**
 * formatting.ts — Canonical currency and number formatting utilities.
 *
 * All currency formatting in this application should use functions from this
 * module. Do NOT define inline formatCurrency functions in components or
 * services — import from here instead.
 */

/**
 * Category names that are considered invalid/noise for analytics and
 * categorization purposes. Transactions in these categories are treated
 * as "Miscellaneous" or unclassified.
 *
 * Used by: categorizer.ts, analytics.ts
 */
export const INVALID_TRANSACTION_CATEGORIES = new Set([
    "bank",
    "transfer",
    "upi",
    "vpa",
    "paytm",
    "phonepe",
    "google pay",
    "gpay",
    "hdfc",
    "icici",
]);

/**
 * Formats a number as Indian Rupee (INR) currency by default.
 * Locale is always "en-IN" since this app targets Indian users.
 *
 * @param amount  - The numeric value to format
 * @param currency - ISO 4217 currency code (default: "INR")
 * @returns Formatted currency string, e.g. "₹1,23,456"
 */
export function formatCurrency(amount: number, currency = "INR"): string {
    const safeCurrency = currency || "INR";
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: safeCurrency,
        maximumFractionDigits: 0,
    }).format(amount || 0);
}

/**
 * Formats a number as a percentage with one decimal place.
 *
 * @param value - The numeric value (e.g. 0.85 or 85)
 * @param alreadyPercent - If true, value is already 0-100; if false, multiply by 100
 * @returns Formatted string, e.g. "85.0%"
 */
export function formatPercent(value: number, alreadyPercent = true): string {
    const pct = alreadyPercent ? value : value * 100;
    return `${pct.toFixed(1)}%`;
}
