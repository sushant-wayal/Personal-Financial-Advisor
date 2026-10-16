import { describe, it, expect, vi, beforeEach } from "vitest";
import { scoutAiStockCandidates } from "./aiScout";
import * as gemini from "../gemini";
import * as marketData from "../marketData";
import { prisma } from "../../lib/prisma";

vi.mock("../gemini");
vi.mock("../marketData");
vi.mock("../../lib/prisma", () => ({
  prisma: {
    stockMarketBar: {
      count: vi.fn(),
    },
  },
}));

describe("aiScout — Dynamic Stock Candidate Discovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks AI scouting when market regime is BEARISH or DATA_UNRELIABLE", async () => {
    const bearishRes = await scoutAiStockCandidates({
      marketRegime: "BEARISH",
      financialPhase: "WEALTH_BUILDING",
      deployableBudget: 10000,
      existingSymbols: ["RELIANCE", "TCS"],
    });

    const unreliableRes = await scoutAiStockCandidates({
      marketRegime: "DATA_UNRELIABLE",
      financialPhase: "WEALTH_BUILDING",
      deployableBudget: 10000,
      existingSymbols: ["RELIANCE", "TCS"],
    });

    expect(bearishRes).toEqual([]);
    expect(unreliableRes).toEqual([]);
    expect(gemini.generateText).not.toHaveBeenCalled();
  });

  it("parses valid JSON response, filters out existing symbols, and verifies market data", async () => {
    vi.mocked(gemini.generateText).mockResolvedValueOnce({
      text: JSON.stringify([
        { symbol: "DIXON", thesis: "High momentum breakout in EMS sector." },
        { symbol: "RELIANCE", thesis: "Duplicate symbol that should be skipped." },
        { symbol: "POLYCAB", thesis: "Volume expansion near 20-day moving average." },
      ]),
    });

    // DIXON already has 60 bars in DB
    vi.mocked(prisma.stockMarketBar.count).mockImplementation((({ where }: any) => {
      if (where?.symbol === "DIXON") return Promise.resolve(60);
      if (where?.symbol === "POLYCAB") return Promise.resolve(10);
      return Promise.resolve(0);
    }) as any);

    // POLYCAB fetches 40 new bars successfully
    vi.mocked(marketData.fetchAndPersistHistory).mockResolvedValueOnce({
      symbol: "POLYCAB",
      fetched: 40,
      persisted: 40,
      error: null,
    });

    const result = await scoutAiStockCandidates({
      marketRegime: "BULLISH",
      financialPhase: "WEALTH_BUILDING",
      deployableBudget: 15000,
      existingSymbols: ["RELIANCE", "TCS"],
    });

    expect(result).toHaveLength(2);
    expect(result[0].symbol).toBe("DIXON");
    expect(result[0].thesis).toContain("EMS sector");
    expect(result[1].symbol).toBe("POLYCAB");
    expect(result[1].thesis).toContain("20-day moving average");
  });

  it("gracefully returns empty array on LLM or network failure without throwing", async () => {
    vi.mocked(gemini.generateText).mockRejectedValueOnce(new Error("Gemini quota exceeded"));

    const result = await scoutAiStockCandidates({
      marketRegime: "BULLISH",
      financialPhase: "WEALTH_BUILDING",
      deployableBudget: 10000,
      existingSymbols: ["RELIANCE"],
    });

    expect(result).toEqual([]);
  });
});
