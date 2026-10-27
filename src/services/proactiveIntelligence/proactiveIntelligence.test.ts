import { describe, it, expect, vi } from "vitest";
import { runDailyProactiveIntelligence } from "./index";
import * as investmentEngineService from "../investmentEngine";
import * as stockRecService from "../stockRecommendations";
import * as ipoRecService from "../ipoRecommendations";
import * as notifierService from "./notifier";

vi.mock("../marketData", () => ({
  fetchUniverseData: vi.fn().mockResolvedValue({ successCount: 30 }),
}));

vi.mock("../stockRecommendations", () => ({
  generateDailyRecommendations: vi.fn(),
}));

vi.mock("../ipoRecommendations", () => ({
  generateDailyIpoRecommendations: vi.fn(),
}));

vi.mock("../investmentEngine", () => ({
  getOrGenerateInvestmentSuggestion: vi.fn(),
}));

vi.mock("./notifier", () => ({
  dispatchDirectNotification: vi.fn().mockResolvedValue(true),
}));

describe("Proactive Intelligence Orchestrator", () => {
  it("orchestrates daily pre-computation and dispatches notification when actionable Stock and IPO exist", async () => {
    vi.mocked(stockRecService.generateDailyRecommendations).mockResolvedValue({
      marketSessionDate: "2026-10-27",
      marketRegime: "BULLISH",
      financialPhase: "WEALTH_BUILDING",
      recommendations: [
        {
          type: "BUY",
          symbol: "WAAREE",
          exchange: "NSE",
          timestamp: new Date(),
          latestPrice: 1503,
          latestPriceTimestamp: new Date(),
          dataSource: "YAHOO",
          strategy: "TREND_PULLBACK",
          strategyVersion: "1.0",
          score: { totalScore: 82 } as any,
          entryPrice: 1503,
          entryCondition: "LIMIT",
          quantity: 9,
          estimatedCapital: 13527,
          estimatedCosts: 25,
          stopLoss: 1410,
          targetPrice: 1650,
          trailingExitRules: "",
          expectedHoldingDays: 10,
          riskRewardRatio: 1.8,
          portfolioAllocationAfter: 15,
          sectorExposureAfter: 15,
          reasonsFor: ["Strong momentum"],
          reasonsAgainst: [],
          uncertainties: [],
          cancellationConditions: [],
          maxChasePrice: 1520,
        },
      ],
    } as any);

    vi.mocked(ipoRecService.generateDailyIpoRecommendations).mockResolvedValue({
      id: "run_1",
      sessionDate: "2026-10-27",
      marketRegime: "BULLISH",
      totalOpenIpos: 3,
      bestIpoSymbol: "WAAREE",
      bestIpoVerdict: "STRONG_APPLY",
      aiSynthesis: "Top pick",
      bestPick: {
        companyName: "Waaree Energies",
        symbol: "WAAREE",
        gmpPercent: 98.1,
        gmpAmount: 1475,
        priceCap: 1503,
        lotSize: 9,
        qibSub: 27.8,
        score: { totalScore: 88 } as any,
      } as any,
      openIpos: [],
      upcomingIpos: [],
      closedIpos: [],
      personalBudget: {} as any,
    });

    vi.mocked(investmentEngineService.getOrGenerateInvestmentSuggestion).mockResolvedValue({
      suggestion: {
        createdAt: new Date(),
        totalInvestable: 24000,
        totalStockInvestable: 16000,
      },
    } as any);

    const report = await runDailyProactiveIntelligence();

    expect(report.hasStockAction).toBe(true);
    expect(report.hasIpoAction).toBe(true);
    expect(report.stockBuyCount).toBe(1);
    expect(report.bestIpoSymbol).toBe("WAAREE");
    expect(notifierService.dispatchDirectNotification).toHaveBeenCalledTimes(1);
    expect(report.notificationDispatched).toBe(true);
  });

  it("suppresses notification when no actionable opportunities exist (Zero Spam)", async () => {
    vi.mocked(notifierService.dispatchDirectNotification).mockClear();

    vi.mocked(stockRecService.generateDailyRecommendations).mockResolvedValue({
      marketSessionDate: "2026-10-27",
      marketRegime: "BEARISH",
      financialPhase: "WEALTH_BUILDING",
      recommendations: [], // Zero buys in bearish regime
    } as any);

    vi.mocked(ipoRecService.generateDailyIpoRecommendations).mockResolvedValue({
      id: "run_2",
      sessionDate: "2026-10-27",
      marketRegime: "BEARISH",
      totalOpenIpos: 1,
      bestIpoSymbol: null,
      bestIpoVerdict: "AVOID_ALL",
      aiSynthesis: null,
      bestPick: null, // Zero qualifying IPOs
      openIpos: [],
      upcomingIpos: [],
      closedIpos: [],
      personalBudget: {} as any,
    });

    vi.mocked(investmentEngineService.getOrGenerateInvestmentSuggestion).mockResolvedValue({
      suggestion: {
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days old (not fresh)
        totalInvestable: 24000,
        totalStockInvestable: 16000,
      },
    } as any);

    const report = await runDailyProactiveIntelligence();

    expect(report.hasStockAction).toBe(false);
    expect(report.hasIpoAction).toBe(false);
    expect(notifierService.dispatchDirectNotification).not.toHaveBeenCalled();
    expect(report.notificationDispatched).toBe(false);
  });
});
