/**
 * ipoRecommendations/index.ts — Primary IPO Recommendation Orchestrator.
 *
 * Daily orchestration pipeline for North IPO Intelligence.
 * Answers the core questions:
 * 1. Which Indian IPOs are open to apply today?
 * 2. Which single open IPO is the undisputed BEST to apply to (or AVOID ALL)?
 * 3. What strategy, cut-off bid, and lot sizing align with user's financial phase?
 */

import { prisma } from "../../lib/prisma";
import {
  getOpenIpos,
  getUpcomingIpos,
  getClosedAndListedIpos,
  formatIstDateStr,
  normalizeDate,
} from "../ipoData";
import type {
  IpoRecommendationItemData,
  IpoRunResult,
} from "../ipoData/types";
import {
  computeCompositeIpoScore,
  determineIpoVerdict,
  determineIpoStrategy,
} from "../ipoAnalysis/scoring";
import { detectMarketRegime } from "../stockAnalysis/regime";
import { calculateCapitalAllocation } from "../stockRisk";
import { generateAiIpoBriefing } from "./aiIpoAdvisor";

export async function generateDailyIpoRecommendations(options?: {
  forceRerun?: boolean;
}): Promise<IpoRunResult> {
  const now = new Date();
  const sessionDateStr = formatIstDateStr(now);
  const sessionDateObj = normalizeDate(sessionDateStr);

  // If already run for today and not forced, return cached run
  if (!options?.forceRerun) {
    const existingRun = await prisma.ipoRecommendationRun.findUnique({
      where: { sessionDate: sessionDateObj },
      include: {
        items: {
          include: { ipo: true },
        },
      },
    });

    if (existingRun) {
      return formatPersistedIpoRun(existingRun);
    }
  }

  // 1. Fetch current Macro Market Regime
  const marketRegime = await detectMarketRegime();

  // 2. Fetch Personal Capital Allocation & Financial Phase
  const capitalAllocation = await calculateCapitalAllocation(marketRegime);
  const deployableBudget = capitalAllocation.eligibleNewPurchaseBudget;

  // 3. Load Open, Upcoming, and Closed IPOs for today
  const [openIpoList, upcomingIpos, closedIpos] = await Promise.all([
    getOpenIpos(now),
    getUpcomingIpos(now),
    getClosedAndListedIpos(now),
  ]);

  // 4. Score all open IPOs
  const scoredItems: IpoRecommendationItemData[] = [];

  for (const ipo of openIpoList) {
    const score = computeCompositeIpoScore(ipo);
    const verdict = determineIpoVerdict(score.totalScore);
    const strategy = determineIpoStrategy(verdict, ipo);

    const minInvestment = ipo.priceCap * ipo.lotSize;
    const canAfford = deployableBudget >= minInvestment;

    const reasonsFor: string[] = [];
    const reasonsAgainst: string[] = [];

    // Reasons For
    if (ipo.qibSub >= 5) {
      reasonsFor.push(`Substantial institutional appetite (${ipo.qibSub}x QIB subscription)`);
    }
    if (ipo.gmpPercent >= 20) {
      reasonsFor.push(`High estimated listing gain (+${ipo.gmpPercent.toFixed(1)}% GMP)`);
    }
    if ((ipo.ronwPct ?? 0) >= 15) {
      reasonsFor.push(`Strong return profile (RoNW ${(ipo.ronwPct ?? 0).toFixed(1)}%)`);
    }
    if (ipo.freshIssueCr > (ipo.issueSizeCr * 0.5)) {
      reasonsFor.push(`Growth-oriented fresh issue (${Math.round((ipo.freshIssueCr / ipo.issueSizeCr) * 100)}% fresh capital)`);
    }

    // Reasons Against / Risks
    if (ipo.gmpPercent <= 5) {
      reasonsAgainst.push(`Low or stagnant listing premium (+${ipo.gmpPercent.toFixed(1)}%)`);
    }
    if (ipo.qibSub < 1.5) {
      reasonsAgainst.push(`Subdued institutional demand (${ipo.qibSub}x QIB multiple)`);
    }
    if ((ipo.debtToEquity ?? 0) > 1.0) {
      reasonsAgainst.push(`Elevated balance sheet leverage (D/E ${(ipo.debtToEquity ?? 0).toFixed(2)})`);
    }
    if (ipo.ofsCr >= (ipo.issueSizeCr * 0.7)) {
      reasonsAgainst.push(`Heavy promoter divestment (Offer for Sale is ${Math.round((ipo.ofsCr / ipo.issueSizeCr) * 100)}% of issue)`);
    }

    scoredItems.push({
      ipoId: ipo.id || "",
      symbol: ipo.symbol,
      companyName: ipo.companyName,
      issueType: ipo.issueType,
      exchange: ipo.exchange,
      priceCap: ipo.priceCap,
      lotSize: ipo.lotSize,
      minInvestment,
      openDate: typeof ipo.openDate === "string" ? ipo.openDate : ipo.openDate.toISOString().slice(0, 10),
      closeDate: typeof ipo.closeDate === "string" ? ipo.closeDate : ipo.closeDate.toISOString().slice(0, 10),
      listingDate: ipo.listingDate ? (typeof ipo.listingDate === "string" ? ipo.listingDate : ipo.listingDate.toISOString().slice(0, 10)) : null,
      isBestPick: false,
      score,
      verdict,
      strategy,
      expectedListingGain: ipo.gmpPercent,
      recommendedLots: 1, // 1 lot per PAN optimization
      recommendedBidPrice: ipo.priceCap, // Cut-Off price
      requiredCapital: minInvestment,
      userCanAfford: canAfford,
      gmpAmount: ipo.gmpAmount,
      gmpPercent: ipo.gmpPercent,
      gmpTrend: ipo.gmpTrend,
      qibSub: ipo.qibSub,
      niiSub: ipo.niiSub,
      retailSub: ipo.retailSub,
      totalSub: ipo.totalSub,
      reasonsFor,
      reasonsAgainst,
      aiThesis: ipo.summaryThesis,
    });
  }

  // 5. Sort by Composite Score descending
  scoredItems.sort((a, b) => b.score.totalScore - a.score.totalScore);

  // 6. Designate the #1 Best Pick (Zero-Forced-Trade rule: must have score >= 60)
  let bestPick: IpoRecommendationItemData | null = null;
  let bestVerdict = "AVOID_ALL";

  if (scoredItems.length > 0 && scoredItems[0].score.totalScore >= 60) {
    scoredItems[0].isBestPick = true;
    bestPick = scoredItems[0];
    bestVerdict = bestPick.verdict;
  }

  // 7. Generate Gemini AI Synthesis
  let aiSynthesis: string | null = null;
  try {
    aiSynthesis = await generateAiIpoBriefing({
      marketRegime,
      financialPhase: capitalAllocation.financialPhase,
      deployableCapital: deployableBudget,
      bestPick,
      openIpos: scoredItems,
    });
  } catch (err) {
    console.warn("[ipoRecommendations] AI briefing fallback:", err);
  }

  // 8. Persist Run in Prisma
  const savedRun = await prisma.ipoRecommendationRun.upsert({
    where: { sessionDate: sessionDateObj },
    update: {
      marketRegime,
      totalOpenIpos: scoredItems.length,
      bestIpoSymbol: bestPick ? bestPick.symbol : null,
      bestIpoVerdict: bestVerdict,
      aiSynthesis,
      status: "COMPLETE",
    },
    create: {
      sessionDate: sessionDateObj,
      marketRegime,
      totalOpenIpos: scoredItems.length,
      bestIpoSymbol: bestPick ? bestPick.symbol : null,
      bestIpoVerdict: bestVerdict,
      aiSynthesis,
      status: "COMPLETE",
    },
  });

  // Re-sync recommendation items
  await prisma.ipoRecommendationItem.deleteMany({
    where: { runId: savedRun.id },
  });

  for (const item of scoredItems) {
    // Look up matching ipo record id if needed
    let dbIpoId = item.ipoId;
    if (!dbIpoId) {
      const match = await prisma.ipoListing.findUnique({
        where: { symbol: item.symbol },
      });
      if (match) dbIpoId = match.id;
    }

    if (dbIpoId) {
      await prisma.ipoRecommendationItem.create({
        data: {
          runId: savedRun.id,
          ipoId: dbIpoId,
          symbol: item.symbol,
          isBestPick: item.isBestPick,
          score: item.score.totalScore,
          verdict: item.verdict,
          strategy: item.strategy,
          expectedListingGain: item.expectedListingGain,
          demandScore: item.score.demandScore,
          gmpScore: item.score.gmpScore,
          valuationScore: item.score.valuationScore,
          issueQualityScore: item.score.issueQualityScore,
          recommendedLots: item.recommendedLots,
          recommendedBidPrice: item.recommendedBidPrice,
          requiredCapital: item.requiredCapital,
          userCanAfford: item.userCanAfford,
          reasonsFor: JSON.stringify(item.reasonsFor),
          reasonsAgainst: JSON.stringify(item.reasonsAgainst),
          aiThesis: item.aiThesis,
        },
      });
    }
  }

  const minRequired = bestPick ? bestPick.minInvestment : 15000;

  return {
    id: savedRun.id,
    sessionDate: sessionDateStr,
    marketRegime,
    totalOpenIpos: scoredItems.length,
    bestIpoSymbol: bestPick ? bestPick.symbol : null,
    bestIpoVerdict: bestVerdict,
    aiSynthesis,
    bestPick,
    openIpos: scoredItems,
    upcomingIpos,
    closedIpos,
    personalBudget: {
      deployableBudget,
      financialPhase: capitalAllocation.financialPhase,
      canAffordOneLot: deployableBudget >= minRequired,
      minimumLotRequired: minRequired,
    },
  };
}

async function formatPersistedIpoRun(run: any): Promise<IpoRunResult> {
  const sessionDateStr = run.sessionDate.toISOString().slice(0, 10);
  const [upcomingIpos, closedIpos] = await Promise.all([
    getUpcomingIpos(run.sessionDate),
    getClosedAndListedIpos(run.sessionDate),
  ]);

  const items: IpoRecommendationItemData[] = (run.items || []).map((dbItem: any) => {
    const ipo = dbItem.ipo;
    let reasonsFor: string[] = [];
    let reasonsAgainst: string[] = [];
    try {
      reasonsFor = JSON.parse(dbItem.reasonsFor || "[]");
      reasonsAgainst = JSON.parse(dbItem.reasonsAgainst || "[]");
    } catch {
      // keep empty
    }

    return {
      ipoId: dbItem.ipoId,
      symbol: dbItem.symbol,
      companyName: ipo?.companyName || dbItem.symbol,
      issueType: ipo?.issueType || "MAINBOARD",
      exchange: ipo?.exchange || "NSE",
      priceCap: ipo?.priceCap || dbItem.recommendedBidPrice,
      lotSize: ipo?.lotSize || 1,
      minInvestment: ipo?.minInvestment || dbItem.requiredCapital,
      openDate: ipo?.openDate ? ipo.openDate.toISOString().slice(0, 10) : sessionDateStr,
      closeDate: ipo?.closeDate ? ipo.closeDate.toISOString().slice(0, 10) : sessionDateStr,
      listingDate: ipo?.listingDate ? ipo.listingDate.toISOString().slice(0, 10) : null,
      isBestPick: dbItem.isBestPick,
      score: {
        demandScore: dbItem.demandScore,
        gmpScore: dbItem.gmpScore,
        valuationScore: dbItem.valuationScore,
        issueQualityScore: dbItem.issueQualityScore,
        totalScore: dbItem.score,
      },
      verdict: dbItem.verdict,
      strategy: dbItem.strategy,
      expectedListingGain: dbItem.expectedListingGain,
      recommendedLots: dbItem.recommendedLots,
      recommendedBidPrice: dbItem.recommendedBidPrice,
      requiredCapital: dbItem.requiredCapital,
      userCanAfford: dbItem.userCanAfford,
      gmpAmount: ipo?.gmpAmount || 0,
      gmpPercent: ipo?.gmpPercent || 0,
      gmpTrend: ipo?.gmpTrend || "STABLE",
      qibSub: ipo?.qibSub || 0,
      niiSub: ipo?.niiSub || 0,
      retailSub: ipo?.retailSub || 0,
      totalSub: ipo?.totalSub || 0,
      reasonsFor,
      reasonsAgainst,
      aiThesis: dbItem.aiThesis || ipo?.summaryThesis,
    };
  });

  const bestPick = items.find((i) => i.isBestPick) || null;

  return {
    id: run.id,
    sessionDate: sessionDateStr,
    marketRegime: run.marketRegime,
    totalOpenIpos: run.totalOpenIpos,
    bestIpoSymbol: run.bestIpoSymbol,
    bestIpoVerdict: run.bestIpoVerdict,
    aiSynthesis: run.aiSynthesis,
    bestPick,
    openIpos: items,
    upcomingIpos,
    closedIpos,
    personalBudget: {
      deployableBudget: 50000,
      financialPhase: "WEALTH_BUILDING",
      canAffordOneLot: true,
      minimumLotRequired: bestPick?.minInvestment || 15000,
    },
  };
}
