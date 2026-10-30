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

export interface StockTradeCharges {
    brokerage: number;
    stt: number;
    stampDuty: number;
    exchangeCharges: number;
    sebiCharges: number;
    gst: number;
    totalCharges: number;
}

/**
 * Calculates itemized Indian equity delivery trading costs (Groww / Zerodha standard):
 * - Brokerage: max(5, min(0.001 * tradeValue, 20))
 * - STT: 0.001 * tradeValue (0.1%)
 * - Stamp Duty: 0.00015 * tradeValue (0.015%)
 * - Exchange Charges: 0.0000297 * tradeValue (NSE)
 * - SEBI Charges: 0.000001 * tradeValue
 * - GST: 18% (0.18) on applicable services (Brokerage + Exchange + SEBI)
 *
 * @param tradeValue - Total monetary value of the trade (shares * price)
 */
export function calculateStockCharges(tradeValue: number): StockTradeCharges {
    if (!tradeValue || tradeValue <= 0) {
        return {
            brokerage: 0,
            stt: 0,
            stampDuty: 0,
            exchangeCharges: 0,
            sebiCharges: 0,
            gst: 0,
            totalCharges: 0,
        };
    }

    const brokerage = clamp(tradeValue * 0.001, 5, 20);
    const stt = tradeValue * 0.001;
    const stampDuty = tradeValue * 0.00015;
    const exchangeCharges = tradeValue * 0.0000297;
    const sebiCharges = tradeValue * 0.000001;
    const gst = 0.18 * (brokerage + exchangeCharges + sebiCharges);
    const total = brokerage + stt + stampDuty + exchangeCharges + sebiCharges + gst;

    return {
        brokerage: roundTo(brokerage, 2),
        stt: roundTo(stt, 2),
        stampDuty: roundTo(stampDuty, 2),
        exchangeCharges: roundTo(exchangeCharges, 2),
        sebiCharges: roundTo(sebiCharges, 2),
        gst: roundTo(gst, 2),
        totalCharges: roundTo(total, 2),
    };
}

/**
 * Returns total regulatory and broker charges for an equity delivery buy order.
 *
 * @param tradeValue - Total monetary value of the trade (shares * price)
 */
export function calculateStockBrokerage(tradeValue: number): number {
    return calculateStockCharges(tradeValue).totalCharges;
}
