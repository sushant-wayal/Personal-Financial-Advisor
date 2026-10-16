import { describe, it, expect } from "vitest";
import { calculatePositionSize, checkTradeEligibility } from "./index";

describe("stockRisk — Position Sizing & Hard Constraints", () => {
  it("calculates conservative whole-share position size capped by risk and capital", () => {
    // Available capital: ₹50,000, Total Portfolio: ₹200,000
    // Entry price: ₹2,500, Stop Loss: ₹2,400 (risk = ₹100/share)
    // Max position risk (2% of ₹200,000 = ₹4,000) -> 4,000 / 100 = 40 shares
    // Max single position capital (15% of ₹200,000 = ₹30,000) -> 30,000 / 2,500 = 12 shares
    // Available capital (₹50,000) -> min(50000, 30000) / 2500 = 12 shares
    const size = calculatePositionSize(
      "RELIANCE",
      2500, // entryPrice
      2400, // stopLoss
      50000, // availableCapital
      200000, // totalPortfolioValue
      10, // currentSectorExposure %
      2, // currentPositionCount
    );

    expect(size.finalQuantity).toBe(12);
    expect(Number.isInteger(size.finalQuantity)).toBe(true);
    expect(size.estimatedCapital).toBe(12 * 2500);
    expect(size.estimatedCosts).toBeGreaterThan(0);
    expect(size.rejectedReason).toBeNull();
  });

  it("rejects position sizing when stop loss is above entry price", () => {
    const size = calculatePositionSize(
      "INFY",
      1500,
      1600, // invalid stop above entry
      50000,
      200000,
      10,
      1,
    );

    expect(size.finalQuantity).toBe(0);
    expect(size.rejectedReason).toContain("Invalid stop loss");
  });

  it("rejects position sizing when available trading capital is zero", () => {
    const size = calculatePositionSize(
      "INFY",
      1500,
      1400,
      0, // zero capital
      200000,
      10,
      1,
    );

    expect(size.finalQuantity).toBe(0);
    expect(size.rejectedReason).toContain("No available capital");
  });

  it("rejects position sizing when maximum open position limit is reached", () => {
    const size = calculatePositionSize(
      "INFY",
      1500,
      1400,
      50000,
      200000,
      10,
      10, // 10 open positions (max allowed is 10)
    );

    expect(size.finalQuantity).toBe(0);
    expect(size.rejectedReason).toContain("Maximum open positions");
  });

  it("rejects position sizing when available capital cannot fund the minimum investment threshold or 1 whole share", () => {
    // Available capital ₹400 is less than minimum investment threshold ₹500
    const size = calculatePositionSize(
      "ITC",
      400,
      380,
      400, // available capital ₹400
      200000,
      5,
      1,
    );

    expect(size.finalQuantity).toBe(0);
    expect(size.rejectedReason).toContain("below minimum investment threshold");
  });

  describe("checkTradeEligibility", () => {
    it("blocks trade when financial phase is CRISIS", () => {
      const size = calculatePositionSize("TCS", 3500, 3350, 50000, 200000, 5, 1);
      const eligibility = checkTradeEligibility({
        financialPhase: "CRISIS",
        marketRegime: "BULLISH",
        drawdownStatus: "NORMAL",
        dataQuality: "VALID",
        entryPrice: 3500,
        stopLoss: 3350,
        positionSize: size,
        riskRewardRatio: 2.0,
      });

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reasons.some((r) => r.includes("CRISIS"))).toBe(true);
    });

    it("blocks trade when portfolio drawdown status is HALTED", () => {
      const size = calculatePositionSize("TCS", 3500, 3350, 50000, 200000, 5, 1);
      const eligibility = checkTradeEligibility({
        financialPhase: "WEALTH_BUILDING",
        marketRegime: "BULLISH",
        drawdownStatus: "HALTED",
        dataQuality: "VALID",
        entryPrice: 3500,
        stopLoss: 3350,
        positionSize: size,
        riskRewardRatio: 2.0,
      });

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reasons.some((r) => r.includes("drawdown has reached halt"))).toBe(true);
    });

    it("blocks trade when market data quality is STALE", () => {
      const size = calculatePositionSize("TCS", 3500, 3350, 50000, 200000, 5, 1);
      const eligibility = checkTradeEligibility({
        financialPhase: "WEALTH_BUILDING",
        marketRegime: "BULLISH",
        drawdownStatus: "NORMAL",
        dataQuality: "STALE",
        entryPrice: 3500,
        stopLoss: 3350,
        positionSize: size,
        riskRewardRatio: 2.0,
      });

      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reasons.some((r) => r.includes("data quality is STALE"))).toBe(true);
    });

    it("passes all checks when conditions are fully compliant", () => {
      const size = calculatePositionSize("TCS", 3500, 3350, 50000, 200000, 5, 1);
      const eligibility = checkTradeEligibility({
        financialPhase: "WEALTH_BUILDING",
        marketRegime: "BULLISH",
        drawdownStatus: "NORMAL",
        dataQuality: "VALID",
        entryPrice: 3500,
        stopLoss: 3350,
        positionSize: size,
        riskRewardRatio: 2.0,
      });

      expect(eligibility.eligible).toBe(true);
      expect(eligibility.reasons.length).toBe(0);
    });
  });
});
