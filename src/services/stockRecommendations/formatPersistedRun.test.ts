import { describe, it, expect } from "vitest";
import { formatPersistedRun } from "./index";

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
});

