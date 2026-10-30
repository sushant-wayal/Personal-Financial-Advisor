/**
 * exchangeCalendar.ts — Official Indian Stock Exchange (NSE/BSE) Trading Calendar
 *
 * Enforces trading day rules:
 * 1. Monday to Friday regular trading sessions.
 * 2. Closed on Saturdays and Sundays (Asia/Kolkata timezone).
 * 3. Closed on official NSE/BSE annual exchange trading holidays.
 */

import { DATA_FRESHNESS_CONFIG } from "../../config/stockEngineDefaults";

/**
 * Official NSE/BSE Trading Holidays for Cash Equity (Equities & Derivatives).
 * Format: "YYYY-MM-DD": "Holiday Name"
 */
export const NSE_TRADING_HOLIDAYS: Record<string, string> = {
  // 2024
  "2024-01-22": "Special Holiday (Ayodhya Ram Mandir Inauguration)",
  "2024-01-26": "Republic Day",
  "2024-03-08": "Mahashivratri",
  "2024-03-25": "Holi",
  "2024-03-29": "Good Friday",
  "2024-04-11": "Id-Ul-Fitr (Ramzan Id)",
  "2024-04-17": "Ram Navami",
  "2024-05-01": "Maharashtra Day",
  "2024-05-20": "General Parliamentary Elections (Mumbai)",
  "2024-06-17": "Bakri Id / Eid ul-Adha",
  "2024-07-17": "Muharram",
  "2024-08-15": "Independence Day",
  "2024-10-02": "Mahatma Gandhi Jayanti",
  "2024-11-01": "Diwali Laxmi Pujan (Regular Market Closed)",
  "2024-11-15": "Guru Nanak Jayanti",
  "2024-11-20": "Maharashtra Assembly Elections",
  "2024-12-25": "Christmas",

  // 2025
  "2025-02-26": "Mahashivratri",
  "2025-03-14": "Holi",
  "2025-03-31": "Id-Ul-Fitr (Ramzan Id)",
  "2025-04-10": "Mahavir Jayanti",
  "2025-04-14": "Dr. Baba Saheb Ambedkar Jayanti",
  "2025-04-18": "Good Friday",
  "2025-05-01": "Maharashtra Day",
  "2025-08-15": "Independence Day",
  "2025-08-27": "Ganesh Chaturthi",
  "2025-10-02": "Mahatma Gandhi Jayanti / Dussehra",
  "2025-10-21": "Diwali Laxmi Pujan (Regular Market Closed)",
  "2025-10-22": "Diwali Balipratipada",
  "2025-11-05": "Guru Nanak Jayanti",
  "2025-12-25": "Christmas",

  // 2026
  "2026-01-26": "Republic Day",
  "2026-02-16": "Mahashivratri",
  "2026-03-04": "Holi",
  "2026-03-20": "Id-Ul-Fitr (Ramzan Id)",
  "2026-04-03": "Good Friday",
  "2026-04-14": "Dr. Baba Saheb Ambedkar Jayanti",
  "2026-04-21": "Ram Navami",
  "2026-05-01": "Maharashtra Day",
  "2026-05-27": "Bakri Id / Eid ul-Adha",
  "2026-06-26": "Muharram",
  "2026-08-15": "Independence Day",
  "2026-09-15": "Ganesh Chaturthi",
  "2026-10-02": "Mahatma Gandhi Jayanti",
  "2026-10-20": "Dussehra",
  "2026-11-09": "Diwali Laxmi Pujan (Regular Market Closed)",
  "2026-11-10": "Diwali Balipratipada",
  "2026-11-24": "Guru Nanak Jayanti",
  "2026-12-25": "Christmas",

  // 2027
  "2027-01-26": "Republic Day",
  "2027-03-08": "Mahashivratri",
  "2027-03-23": "Holi",
  "2027-03-26": "Good Friday",
  "2027-04-14": "Dr. Baba Saheb Ambedkar Jayanti",
  "2027-05-01": "Maharashtra Day",
  "2027-08-15": "Independence Day",
  "2027-10-02": "Mahatma Gandhi Jayanti",
  "2027-10-29": "Diwali Laxmi Pujan (Regular Market Closed)",
  "2027-12-25": "Christmas",
};

/**
 * Returns YYYY-MM-DD formatted date in Indian exchange timezone (Asia/Kolkata).
 */
export function getExchangeDateString(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", {
    timeZone: DATA_FRESHNESS_CONFIG.exchangeTimezone,
  });
}

/**
 * Returns day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday) in Asia/Kolkata.
 */
export function getExchangeDayOfWeek(date: Date = new Date()): number {
  const dayStr = new Intl.DateTimeFormat("en-US", {
    timeZone: DATA_FRESHNESS_CONFIG.exchangeTimezone,
    weekday: "short",
  }).format(date);

  switch (dayStr) {
    case "Sun":
      return 0;
    case "Mon":
      return 1;
    case "Tue":
      return 2;
    case "Wed":
      return 3;
    case "Thu":
      return 4;
    case "Fri":
      return 5;
    case "Sat":
      return 6;
    default:
      return date.getDay();
  }
}

/**
 * Checks whether the specified date falls on a weekend (Saturday or Sunday) in Asia/Kolkata.
 */
export function isWeekend(date: Date = new Date()): boolean {
  const day = getExchangeDayOfWeek(date);
  return day === 0 || day === 6;
}

/**
 * Checks whether the specified date is an official NSE exchange trading holiday.
 */
export function isExchangeHoliday(date: Date = new Date()): {
  isHoliday: boolean;
  holidayName?: string;
} {
  const dateStr = getExchangeDateString(date);
  const holidayName = NSE_TRADING_HOLIDAYS[dateStr];
  if (holidayName) {
    return { isHoliday: true, holidayName };
  }
  return { isHoliday: false };
}

/**
 * Comprehensive stock trading day check.
 * Validates that the market date is a weekday and not an exchange holiday.
 */
export function isStockTradingDay(date: Date = new Date()): {
  isTradingDay: boolean;
  dateStr: string;
  reason?: string;
  holidayName?: string;
} {
  const dateStr = getExchangeDateString(date);
  const dayOfWeek = getExchangeDayOfWeek(date);

  if (dayOfWeek === 0) {
    return { isTradingDay: false, dateStr, reason: "Weekend (Sunday)" };
  }
  if (dayOfWeek === 6) {
    return { isTradingDay: false, dateStr, reason: "Weekend (Saturday)" };
  }

  const holidayCheck = isExchangeHoliday(date);
  if (holidayCheck.isHoliday) {
    return {
      isTradingDay: false,
      dateStr,
      reason: `Exchange Holiday: ${holidayCheck.holidayName}`,
      holidayName: holidayCheck.holidayName,
    };
  }

  return { isTradingDay: true, dateStr };
}
