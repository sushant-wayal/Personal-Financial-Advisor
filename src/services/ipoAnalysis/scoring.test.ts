import { describe, it, expect } from "vitest";
import {
  calculateDemandScore,
  calculateGmpScore,
  calculateValuationScore,
  calculateIssueQualityScore,
  computeCompositeIpoScore,
  determineIpoVerdict,
  determineIpoStrategy,
} from "./scoring";
import type { IpoDetails } from "../ipoData/types";

describe("IPO Scoring Engine", () => {
  describe("calculateDemandScore", () => {
    it("awards full 35 points for stellar institutional and retail demand", () => {
      const score = calculateDemandScore({
        qibSub: 25,
        totalSub: 30,
        retailSub: 5,
      });
      expect(score).toBe(35);
    });

    it("handles moderate demand proportionally", () => {
      const score = calculateDemandScore({
        qibSub: 3.5,
        totalSub: 2.8,
        retailSub: 1.2,
      });
      // QIB 2-4.9x -> 10, Total 1.5-4.9x -> 4, Retail >=1x -> 3 = 17
      expect(score).toBe(17);
    });

    it("returns 0 points for completely undersubscribed issue", () => {
      const score = calculateDemandScore({
        qibSub: 0.4,
        totalSub: 0.6,
        retailSub: 0.7,
      });
      expect(score).toBe(0);
    });
  });

  describe("calculateGmpScore", () => {
    it("awards top 30 points for high listing gain with rising trend", () => {
      const score = calculateGmpScore({
        gmpPercent: 65,
        gmpTrend: "RISING",
      });
      expect(score).toBe(30);
    });

    it("applies penalty for negative listing expectation and decays to 0", () => {
      const score = calculateGmpScore({
        gmpPercent: -5,
        gmpTrend: "FALLING",
      });
      expect(score).toBe(0);
    });
  });

  describe("calculateValuationScore", () => {
    it("rewards undervalued companies with strong return on equity", () => {
      const score = calculateValuationScore({
        peRatio: 20,
        industryPe: 35,
        ronwPct: 22,
        patMarginPct: 14,
        revenueGrowthPct: 30,
      });
      // PE ratio 20/35 = 0.57 (<=0.8) -> 8
      // RoNW >=15 & margin >=10 -> 7
      // Revenue CAGR >=25 -> 5
      // Total = 20
      expect(score).toBe(20);
    });

    it("awards lower points for expensive issues with low margins", () => {
      const score = calculateValuationScore({
        peRatio: 65,
        industryPe: 30,
        ronwPct: 3,
        patMarginPct: 1,
        revenueGrowthPct: 5,
      });
      // PE > 1.15x -> 1
      // RoNW > 0 -> 1
      // Growth > 0 -> 1
      // Total = 3
      expect(score).toBe(3);
    });
  });

  describe("calculateIssueQualityScore", () => {
    it("rewards high fresh issue ratio and low balance sheet leverage", () => {
      const score = calculateIssueQualityScore({
        freshIssueCr: 700,
        issueSizeCr: 1000,
        debtToEquity: 0.2,
        issueType: "MAINBOARD",
      });
      // Fresh ratio 70% (>=60%) -> 6
      // Debt/Equity 0.2 (<0.4) -> 5
      // Mainboard -> 4
      // Total = 15
      expect(score).toBe(15);
    });

    it("penalizes 100% OFS promoter exit with high debt", () => {
      const score = calculateIssueQualityScore({
        freshIssueCr: 0,
        issueSizeCr: 1000,
        debtToEquity: 1.8,
        issueType: "MAINBOARD",
      });
      // Fresh ratio 0% -> 0
      // Debt > 1.0 -> 0
      // Mainboard -> 4
      // Total = 4
      expect(score).toBe(4);
    });
  });

  describe("computeCompositeIpoScore & Verdict", () => {
    const mockWaaree: IpoDetails = {
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

    it("scores high-quality issue as STRONG_APPLY", () => {
      const breakdown = computeCompositeIpoScore(mockWaaree);
      expect(breakdown.totalScore).toBeGreaterThanOrEqual(75);

      const verdict = determineIpoVerdict(breakdown.totalScore);
      expect(verdict).toBe("STRONG_APPLY");

      const strategy = determineIpoStrategy(verdict, mockWaaree);
      expect(strategy).toBe("LONG_TERM");
    });

    it("classifies sub-par issue as AVOID", () => {
      const weakIpo: IpoDetails = {
        ...mockWaaree,
        symbol: "WEAK",
        qibSub: 0.2,
        totalSub: 0.4,
        retailSub: 0.5,
        gmpAmount: -10,
        gmpPercent: -2.5,
        gmpTrend: "FALLING",
        peRatio: 75,
        industryPe: 25,
        ronwPct: 2,
        patMarginPct: 1,
        debtToEquity: 2.1,
        freshIssueCr: 0,
        ofsCr: 500,
      };

      const breakdown = computeCompositeIpoScore(weakIpo);
      expect(breakdown.totalScore).toBeLessThan(45);

      const verdict = determineIpoVerdict(breakdown.totalScore);
      expect(verdict).toBe("AVOID");

      const strategy = determineIpoStrategy(verdict, weakIpo);
      expect(strategy).toBe("AVOID");
    });
  });
});
