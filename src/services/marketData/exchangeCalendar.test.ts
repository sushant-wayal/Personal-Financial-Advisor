import { describe, it, expect } from "vitest";
import {
  isWeekend,
  isExchangeHoliday,
  isStockTradingDay,
  getExchangeDateString,
  getExchangeDayOfWeek,
  NSE_TRADING_HOLIDAYS,
} from "./exchangeCalendar";

describe("Exchange Calendar — NSE/BSE Trading Days & Holidays", () => {
  it("correctly identifies weekend days in Asia/Kolkata exchange timezone", () => {
    // 2026-10-31 is Saturday
    const saturday = new Date("2026-10-31T05:00:00.000Z"); // ~10:30 AM IST
    expect(isWeekend(saturday)).toBe(true);
    expect(getExchangeDayOfWeek(saturday)).toBe(6);

    // 2026-11-01 is Sunday
    const sunday = new Date("2026-11-01T05:00:00.000Z"); // ~10:30 AM IST
    expect(isWeekend(sunday)).toBe(true);
    expect(getExchangeDayOfWeek(sunday)).toBe(0);

    // 2026-10-30 is Friday (Regular trading day)
    const friday = new Date("2026-10-30T05:00:00.000Z");
    expect(isWeekend(friday)).toBe(false);
    expect(getExchangeDayOfWeek(friday)).toBe(5);
  });

  it("identifies official NSE trading holidays", () => {
    // Republic Day 2026-01-26
    const republicDay = new Date("2026-01-26T06:00:00.000Z");
    const check1 = isExchangeHoliday(republicDay);
    expect(check1.isHoliday).toBe(true);
    expect(check1.holidayName).toBe("Republic Day");

    // Mahatma Gandhi Jayanti 2026-10-02
    const gandhiJayanti = new Date("2026-10-02T06:00:00.000Z");
    const check2 = isExchangeHoliday(gandhiJayanti);
    expect(check2.isHoliday).toBe(true);
    expect(check2.holidayName).toBe("Mahatma Gandhi Jayanti");

    // Diwali Laxmi Pujan 2026-11-09
    const diwali = new Date("2026-11-09T06:00:00.000Z");
    const check3 = isExchangeHoliday(diwali);
    expect(check3.isHoliday).toBe(true);
    expect(check3.holidayName).toContain("Diwali");

    // Regular trading session 2026-10-27 (Tuesday)
    const regularDay = new Date("2026-10-27T06:00:00.000Z");
    const check4 = isExchangeHoliday(regularDay);
    expect(check4.isHoliday).toBe(false);
  });

  it("evaluates isStockTradingDay with explicit reasons", () => {
    // 1. Regular trading day (Tuesday 2026-10-27)
    const regular = new Date("2026-10-27T06:00:00.000Z");
    const resRegular = isStockTradingDay(regular);
    expect(resRegular.isTradingDay).toBe(true);
    expect(resRegular.dateStr).toBe("2026-10-27");
    expect(resRegular.reason).toBeUndefined();

    // 2. Saturday
    const sat = new Date("2026-10-31T06:00:00.000Z");
    const resSat = isStockTradingDay(sat);
    expect(resSat.isTradingDay).toBe(false);
    expect(resSat.reason).toBe("Weekend (Saturday)");

    // 3. Sunday
    const sun = new Date("2026-11-01T06:00:00.000Z");
    const resSun = isStockTradingDay(sun);
    expect(resSun.isTradingDay).toBe(false);
    expect(resSun.reason).toBe("Weekend (Sunday)");

    // 4. Exchange Holiday (Dr. Ambedkar Jayanti 2026-04-14, Tuesday)
    const holiday = new Date("2026-04-14T06:00:00.000Z");
    const resHoliday = isStockTradingDay(holiday);
    expect(resHoliday.isTradingDay).toBe(false);
    expect(resHoliday.reason).toContain("Exchange Holiday");
    expect(resHoliday.holidayName).toBe("Dr. Baba Saheb Ambedkar Jayanti");
  });

  it("contains major multi-year NSE holiday definitions", () => {
    expect(Object.keys(NSE_TRADING_HOLIDAYS).length).toBeGreaterThan(40);
    expect(NSE_TRADING_HOLIDAYS["2024-08-15"]).toBe("Independence Day");
    expect(NSE_TRADING_HOLIDAYS["2025-08-15"]).toBe("Independence Day");
    expect(NSE_TRADING_HOLIDAYS["2026-08-15"]).toBe("Independence Day");
    expect(NSE_TRADING_HOLIDAYS["2026-12-25"]).toBe("Christmas");
  });

  it("formats date in Indian exchange timezone accurately", () => {
    // 2026-10-30 23:00 UTC is 2026-10-31 04:30 AM IST
    const lateUtc = new Date("2026-10-30T23:00:00.000Z");
    expect(getExchangeDateString(lateUtc)).toBe("2026-10-31");
    expect(getExchangeDayOfWeek(lateUtc)).toBe(6); // Saturday in IST
  });
});
