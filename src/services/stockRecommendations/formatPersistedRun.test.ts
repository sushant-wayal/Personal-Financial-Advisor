import { describe, it, expect } from "vitest";
import { formatPersistedRun } from "./index";
import { calculateStockBrokerage, calculateStockCharges } from "../shared";

describe("formatPersistedRun — Stock Recommendation Serialization", () => {
  it("correctly unpacks database run record into domain RecommendationRun with recommendations array", () => {
    const rawRecord = {
      id: "run-123",
      marketSessionDate: new Date("2026-10-30T00:00:00.000Z"),
      marketRegime: "NEUTRAL",
      financialPhase: "EF_BUILDING",
      capitalAllocation: JSON.stringify({
        eligibleNewPurchaseBudget: 746,
        bindingConstraint: "market_regime_moderated",
        financialPhase: "EF_BUILDING",
      }),
      dataQuality: "VALID",
      strategyVersions: JSON.stringify({
        RELATIVE_STRENGTH: "1.0.0",
        TREND_PULLBACK: "1.0.0",
        MOMENTUM: "1.0.0",
      }),
      candidateCount: 40,
      eligibleCount: 15,
      rejections: JSON.stringify([{ symbol: "RELIANCE", reason: "Score too low" }]),
      warnings: JSON.stringify(["Minor data latency on benchmark"]),
      aiExplanation: "Today's pipeline has identified a single high-probability entry in ETERNAL.",
      status: "COMPLETE",
      pipelineDurationMs: 450,
      createdAt: new Date("2026-10-30T04:14:52.943Z"),
      items: [
        {
          id: "item-1",
          symbol: "ETERNAL",
          exchange: "NSE",
          type: "BUY",
          status: "PENDING",
          investedAt: null,
          investedAmount: null,
          detail: JSON.stringify({
            type: "BUY",
            symbol: "ETERNAL",
            exchange: "NSE",
            status: "PENDING",
            entryPrice: 342.45,
            quantity: 2,
            estimatedCapital: 684.9,
            stopLoss: 320.16,
            targetPrice: 380.95,
            strategy: "RELATIVE_STRENGTH",
            reasonsFor: ["Strong 20-day absolute gain of +7.0%"],
          }),
        },
      ],
    };

    const run = formatPersistedRun(rawRecord);

    expect(run.id).toBe("run-123");
    expect(run.marketSessionDate).toBe("2026-10-30");
    expect(run.marketRegime).toBe("NEUTRAL");
    expect(run.financialPhase).toBe("EF_BUILDING");
    expect(run.capitalAllocation.eligibleNewPurchaseBudget).toBe(746);
    expect(run.rejections).toHaveLength(1);
    expect(run.rejections[0].symbol).toBe("RELIANCE");
    expect(run.warnings).toEqual(["Minor data latency on benchmark"]);

    // Key fix verification: recommendations array must be populated with all unpacked fields
    expect(run.recommendations).toHaveLength(1);
    const buy = run.recommendations[0];
    expect(buy.type).toBe("BUY");
    expect(buy.symbol).toBe("ETERNAL");
    expect((buy as any).quantity).toBe(2);
    expect((buy as any).entryPrice).toBe(342.45);
    expect((buy as any).stopLoss).toBe(320.16);
    expect((buy as any).targetPrice).toBe(380.95);
    expect((buy as any).status).toBe("PENDING");
  });

  it("handles corrupted or empty item details gracefully without throwing", () => {
    const rawRecord = {
      id: "run-empty",
      marketSessionDate: new Date("2026-10-30T00:00:00.000Z"),
      marketRegime: "BULLISH",
      financialPhase: "WEALTH_BUILDING",
      capitalAllocation: "not-json",
      dataQuality: "VALID",
      strategyVersions: "not-json",
      candidateCount: 0,
      eligibleCount: 0,
      rejections: "invalid-json",
      warnings: "invalid-json",
      aiExplanation: null,
      status: "COMPLETE",
      pipelineDurationMs: 120,
      createdAt: new Date("2026-10-30T04:14:52.943Z"),
      items: [
        {
          id: "corrupted-item",
          symbol: "TCS",
          exchange: "NSE",
          type: "HOLD",
          detail: "invalid-json{{{",
        },
      ],
    };

    const run = formatPersistedRun(rawRecord);

    expect(run.recommendations).toHaveLength(1);
    expect(run.recommendations[0].symbol).toBe("TCS");
    expect(run.recommendations[0].type).toBe("HOLD");
    expect(run.capitalAllocation).toEqual({});
    expect(run.strategyVersions).toEqual({});
    expect(run.rejections).toEqual([]);
    expect(run.warnings).toEqual([]);
  });

  it("carries over status: INVESTED, investedAmount, and execution details to unpacked recommendation", () => {
    const rawRecord = {
      id: "run-invested",
      marketSessionDate: new Date("2026-10-30T00:00:00.000Z"),
      marketRegime: "NEUTRAL",
      financialPhase: "EF_BUILDING",
      capitalAllocation: "{}",
      dataQuality: "VALID",
      strategyVersions: "{}",
      candidateCount: 1,
      eligibleCount: 1,
      rejections: "[]",
      warnings: "[]",
      aiExplanation: "Invested run",
      status: "COMPLETE",
      pipelineDurationMs: 100,
      createdAt: new Date("2026-10-30T04:14:52.943Z"),
      items: [
        {
          id: "item-invested-1",
          symbol: "ETERNAL",
          exchange: "NSE",
          type: "BUY",
          status: "INVESTED",
          investedAt: new Date("2026-10-30T06:12:46.000Z"),
          investedAmount: 686.0,
          detail: JSON.stringify({
            type: "BUY",
            symbol: "ETERNAL",
            exchange: "NSE",
            status: "INVESTED",
            entryPrice: 342.45,
            executedPrice: 343.0,
            quantity: 2,
            tradeValue: 686.0,
            brokerage: 6.71,
            investedAmount: 686.0,
            totalDeduction: 692.71,
            stopLoss: 320.16,
            targetPrice: 380.95,
            strategy: "RELATIVE_STRENGTH",
            reasonsFor: ["Strong absolute gain"],
          }),
        },
      ],
    };

    const run = formatPersistedRun(rawRecord);

    expect(run.recommendations).toHaveLength(1);
    const buy = run.recommendations[0];
    expect(buy.id).toBe("item-invested-1");
    expect(buy.status).toBe("INVESTED");
    expect((buy as any).investedAmount).toBe(686.0);
    expect((buy as any).executedPrice).toBe(343.0);
    expect((buy as any).brokerage).toBe(6.71);
    expect(new Date((buy as any).investedAt).toISOString()).toBe("2026-10-30T06:12:46.000Z");
  });

  it("calculates itemized regulatory delivery charges accurately", () => {
    // For 686 trade:
    // brokerage: max(5, min(0.001 * 686, 20)) = 5
    // stt: 0.001 * 686 = 0.69
    // stampDuty: 0.00015 * 686 = 0.10
    // exchangeCharges: 0.0000297 * 686 = 0.02
    // gst: 0.18 * (5 + 0.02) = 0.90
    // total: 5 + 0.69 + 0.10 + 0.02 + 0.90 = 6.71
    const charges686 = calculateStockCharges(686);
    expect(charges686.brokerage).toBe(5);
    expect(charges686.stt).toBe(0.69);
    expect(charges686.stampDuty).toBe(0.1);
    expect(charges686.exchangeCharges).toBe(0.02);
    expect(charges686.gst).toBe(0.9);
    expect(charges686.totalCharges).toBe(6.71);
    expect(calculateStockBrokerage(686)).toBe(6.71);

    // Large trade capping at max brokerage ₹20:
    const chargesLarge = calculateStockCharges(25000);
    expect(chargesLarge.brokerage).toBe(20);

    // Zero or negative trade value
    expect(calculateStockBrokerage(0)).toBe(0);
    expect(calculateStockBrokerage(-100)).toBe(0);
  });
});
