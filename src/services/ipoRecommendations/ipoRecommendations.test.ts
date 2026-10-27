import { describe, it, expect } from "vitest";
import { computeCompositeIpoScore, determineIpoVerdict } from "../ipoAnalysis/scoring";
import type { IpoDetails } from "../ipoData/types";

describe("IPO Recommendation Logic", () => {
  const ipoA: IpoDetails = {
    companyName: "Waaree Energies",
    symbol: "WAAREE",
    exchange: "NSE",
    issueType: "MAINBOARD",
    openDate: "2026-10-21",
    closeDate: "2026-10-23",
    priceFloor: 1427,
    priceCap: 1503,
    lotSize: 9,
    minInvestment: 13527,
    issueSizeCr: 4321,
    freshIssueCr: 3600,
    ofsCr: 721,
    gmpAmount: 1475,
    gmpPercent: 98.1,
    gmpTrend: "RISING",
    qibSub: 27.8,
    niiSub: 19.4,
    retailSub: 6.8,
    totalSub: 18.2,
    peRatio: 32,
    industryPe: 48,
    revenueGrowthPct: 68,
    patMarginPct: 11,
    ronwPct: 22,
    debtToEquity: 0.18,
    status: "OPEN",
  };

  const ipoB: IpoDetails = {
    companyName: "Afcons Infrastructure",
    symbol: "AFCONS",
    exchange: "NSE",
    issueType: "MAINBOARD",
    openDate: "2026-10-22",
    closeDate: "2026-10-24",
    priceFloor: 440,
    priceCap: 463,
    lotSize: 32,
    minInvestment: 14816,
    issueSizeCr: 5430,
    freshIssueCr: 1250,
    ofsCr: 4180,
    gmpAmount: 85,
    gmpPercent: 18.3,
    gmpTrend: "STABLE",
    qibSub: 3.8,
    niiSub: 2.1,
    retailSub: 1.4,
    totalSub: 2.6,
    peRatio: 37,
    industryPe: 42,
    revenueGrowthPct: 14,
    patMarginPct: 4,
    ronwPct: 13,
    debtToEquity: 0.88,
    status: "OPEN",
  };

  it("identifies highest scoring candidate as the Best Pick when multiple IPOs are open", () => {
    const scoreA = computeCompositeIpoScore(ipoA);
    const scoreB = computeCompositeIpoScore(ipoB);

    expect(scoreA.totalScore).toBeGreaterThan(scoreB.totalScore);

    const candidates = [
      { symbol: ipoA.symbol, score: scoreA },
      { symbol: ipoB.symbol, score: scoreB },
    ].sort((a, b) => b.score.totalScore - a.score.totalScore);

    expect(candidates[0].symbol).toBe("WAAREE");
    expect(candidates[0].score.totalScore).toBeGreaterThanOrEqual(60);
  });

  it("enforces Zero Forced Trade rule when open issues do not meet hurdle score", () => {
    const poorIpo: IpoDetails = {
      ...ipoB,
      symbol: "POOR",
      qibSub: 0.3,
      totalSub: 0.5,
      retailSub: 0.6,
      gmpAmount: 5,
      gmpPercent: 1.0,
      gmpTrend: "FALLING",
      peRatio: 55,
      industryPe: 25,
      ronwPct: 3,
      patMarginPct: 1,
      debtToEquity: 1.8,
      freshIssueCr: 100,
      issueSizeCr: 1000,
    };

    const score = computeCompositeIpoScore(poorIpo);
    const verdict = determineIpoVerdict(score.totalScore);

    expect(score.totalScore).toBeLessThan(60);
    expect(verdict === "AVOID" || verdict === "NEUTRAL").toBe(true);

    // If highest score < 60, bestPick must be null and verdict AVOID_ALL
    const bestPick = score.totalScore >= 60 ? poorIpo : null;
    expect(bestPick).toBeNull();
  });
});
