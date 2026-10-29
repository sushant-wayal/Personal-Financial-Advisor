import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "./relativeTime";

describe("formatRelativeTime", () => {
  const baseDate = new Date("2026-10-29T12:00:00.000Z");

  it("handles empty or invalid date inputs gracefully", () => {
    expect(formatRelativeTime("")).toBe("");
    expect(formatRelativeTime(null)).toBe("");
    expect(formatRelativeTime(undefined)).toBe("");
    expect(formatRelativeTime("invalid-date")).toBe("invalid-date");
  });

  it("formats seconds before correctly", () => {
    const justNow = new Date("2026-10-29T12:00:00.000Z");
    const oneSecAgo = new Date("2026-10-29T11:59:59.000Z");
    const thirtySecsAgo = new Date("2026-10-29T11:59:30.000Z");

    expect(formatRelativeTime(justNow, baseDate)).toBe("0 secs before");
    expect(formatRelativeTime(oneSecAgo, baseDate)).toBe("1 sec before");
    expect(formatRelativeTime(thirtySecsAgo, baseDate)).toBe("30 secs before");
  });

  it("formats minutes before correctly", () => {
    const oneMinAgo = new Date("2026-10-29T11:59:00.000Z");
    const tenMinAgo = new Date("2026-10-29T11:50:00.000Z");

    expect(formatRelativeTime(oneMinAgo, baseDate)).toBe("1 min before");
    expect(formatRelativeTime(tenMinAgo, baseDate)).toBe("10 min before");
  });

  it("formats hours before correctly", () => {
    const oneHourAgo = new Date("2026-10-29T11:00:00.000Z");
    const threeHoursAgo = new Date("2026-10-29T09:00:00.000Z");

    expect(formatRelativeTime(oneHourAgo, baseDate)).toBe("1 hour before");
    expect(formatRelativeTime(threeHoursAgo, baseDate)).toBe("3 hours before");
  });

  it("formats days before correctly", () => {
    const oneDayAgo = new Date("2026-10-28T12:00:00.000Z");
    const fiveDaysAgo = new Date("2026-10-24T12:00:00.000Z");

    expect(formatRelativeTime(oneDayAgo, baseDate)).toBe("1 day before");
    expect(formatRelativeTime(fiveDaysAgo, baseDate)).toBe("5 days before");
  });

  it("formats months before correctly", () => {
    const oneMonthAgo = new Date("2026-09-29T12:00:00.000Z");
    const threeMonthsAgo = new Date("2026-07-29T12:00:00.000Z");

    expect(formatRelativeTime(oneMonthAgo, baseDate)).toBe("1 month before");
    expect(formatRelativeTime(threeMonthsAgo, baseDate)).toBe("3 months before");
  });

  it("formats years before correctly", () => {
    const oneYearAgo = new Date("2025-10-29T12:00:00.000Z");
    const twoYearsAgo = new Date("2024-10-29T12:00:00.000Z");

    expect(formatRelativeTime(oneYearAgo, baseDate)).toBe("1 year before");
    expect(formatRelativeTime(twoYearsAgo, baseDate)).toBe("2 years before");
  });
});
