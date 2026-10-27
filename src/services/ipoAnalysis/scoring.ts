/**
 * ipoAnalysis/scoring.ts — Quantitative 100-Point IPO Composite Scoring Engine.
 *
 * Provides deterministic, mathematical evaluation of IPO attractiveness based on:
 * 1. Institutional & Overall Subscription Demand (35 points)
 * 2. Grey Market Premium (GMP) & Sentiment (30 points)
 * 3. Fundamentals & Peer Valuation (20 points)
 * 4. Issue Structure & Governance (15 points)
 */

import type {
  IpoDetails,
  IpoScoreBreakdown,
  IpoVerdict,
  IpoStrategy,
} from "../ipoData/types";

/**
 * 1. Subscription Demand Sub-Score (Max 35 points)
 */
export function calculateDemandScore(ipo: Pick<IpoDetails, "qibSub" | "totalSub" | "retailSub">): number {
  let score = 0;

  // QIB Demand (Max 20 pts)
  if (ipo.qibSub >= 15) {
    score += 20;
  } else if (ipo.qibSub >= 5) {
    score += 15;
  } else if (ipo.qibSub >= 2) {
    score += 10;
  } else if (ipo.qibSub >= 1) {
    score += 6;
  }

  // Total Subscription Multiple (Max 10 pts)
  if (ipo.totalSub >= 20) {
    score += 10;
  } else if (ipo.totalSub >= 5) {
    score += 7;
  } else if (ipo.totalSub >= 1.5) {
    score += 4;
  }

  // Retail Traction (Max 5 pts)
  if (ipo.retailSub >= 3) {
    score += 5;
  } else if (ipo.retailSub >= 1) {
    score += 3;
  }

  return Math.min(35, Math.max(0, score));
}

/**
 * 2. Grey Market Premium (GMP) Sub-Score (Max 30 points)
 */
export function calculateGmpScore(ipo: Pick<IpoDetails, "gmpPercent" | "gmpTrend">): number {
  let score = 0;

  // Expected Listing Gain % (Max 20 pts)
  if (ipo.gmpPercent >= 40) {
    score += 20;
  } else if (ipo.gmpPercent >= 20) {
    score += 15;
  } else if (ipo.gmpPercent >= 10) {
    score += 10;
  } else if (ipo.gmpPercent > 0) {
    score += 3;
  } else if (ipo.gmpPercent < 0) {
    score -= 15; // Strong penalty for negative listing expectation
  }

  // GMP Trend (Max 10 pts)
  if (ipo.gmpTrend === "RISING") {
    score += 10;
  } else if (ipo.gmpTrend === "STABLE") {
    score += 5;
  } else {
    // FALLING trend gives 0 pts
    score += 0;
  }

  return Math.min(30, Math.max(0, score));
}

/**
 * 3. Valuation & Fundamentals Sub-Score (Max 20 points)
 */
export function calculateValuationScore(
  ipo: Pick<IpoDetails, "peRatio" | "industryPe" | "ronwPct" | "patMarginPct" | "revenueGrowthPct">,
): number {
  let score = 0;

  // P/E vs Industry (Max 8 pts)
  if (ipo.peRatio != null && ipo.industryPe != null && ipo.industryPe > 0) {
    const ratio = ipo.peRatio / ipo.industryPe;
    if (ratio <= 0.8) {
      score += 8; // >20% discount
    } else if (ratio <= 1.15) {
      score += 5; // Fairly valued
    } else {
      score += 1; // Expensive
    }
  } else if (ipo.peRatio == null) {
    // Loss-making tech: evaluate by growth
    if ((ipo.revenueGrowthPct ?? 0) >= 25) {
      score += 3;
    }
  } else {
    score += 3;
  }

  // Profitability & RoNW (Max 7 pts)
  const ronw = ipo.ronwPct ?? 0;
  const patMargin = ipo.patMarginPct ?? 0;
  if (ronw >= 15 && patMargin >= 10) {
    score += 7;
  } else if (ronw >= 8 || patMargin >= 5) {
    score += 4;
  } else if (ronw > 0) {
    score += 1;
  }

  // Revenue CAGR (Max 5 pts)
  const revGrowth = ipo.revenueGrowthPct ?? 0;
  if (revGrowth >= 25) {
    score += 5;
  } else if (revGrowth >= 12) {
    score += 3;
  } else if (revGrowth > 0) {
    score += 1;
  }

  return Math.min(20, Math.max(0, score));
}

/**
 * 4. Issue Structure & Governance Sub-Score (Max 15 points)
 */
export function calculateIssueQualityScore(
  ipo: Pick<IpoDetails, "freshIssueCr" | "issueSizeCr" | "debtToEquity" | "issueType">,
): number {
  let score = 0;

  // Fresh Issue Ratio (Max 6 pts)
  if (ipo.issueSizeCr > 0) {
    const freshRatio = (ipo.freshIssueCr / ipo.issueSizeCr) * 100;
    if (freshRatio >= 60) {
      score += 6;
    } else if (freshRatio >= 30) {
      score += 3;
    } else {
      score += 0; // Pure or heavy OFS (promoter exit)
    }
  }

  // Debt-to-Equity (Max 5 pts)
  const dToE = ipo.debtToEquity ?? 0.5;
  if (dToE < 0.4) {
    score += 5;
  } else if (dToE <= 1.0) {
    score += 3;
  } else {
    score += 0;
  }

  // Baseline Governance & Listing Type (Max 4 pts)
  if (ipo.issueType === "MAINBOARD") {
    score += 4;
  } else {
    score += 2; // SME issues carry higher illiquidity risk
  }

  return Math.min(15, Math.max(0, score));
}

/**
 * Full Composite IPO Scoring calculation.
 */
export function computeCompositeIpoScore(ipo: IpoDetails): IpoScoreBreakdown {
  const demandScore = calculateDemandScore(ipo);
  const gmpScore = calculateGmpScore(ipo);
  const valuationScore = calculateValuationScore(ipo);
  const issueQualityScore = calculateIssueQualityScore(ipo);
  const totalScore = Math.min(100, Math.max(0, demandScore + gmpScore + valuationScore + issueQualityScore));

  return {
    demandScore,
    gmpScore,
    valuationScore,
    issueQualityScore,
    totalScore,
  };
}

/**
 * Determine the conviction verdict.
 */
export function determineIpoVerdict(totalScore: number): IpoVerdict {
  if (totalScore >= 75) return "STRONG_APPLY";
  if (totalScore >= 60) return "APPLY";
  if (totalScore >= 45) return "NEUTRAL";
  return "AVOID";
}

/**
 * Determine recommended strategy.
 */
export function determineIpoStrategy(
  verdict: IpoVerdict,
  ipo: Pick<IpoDetails, "ronwPct" | "debtToEquity" | "peRatio" | "industryPe">,
): IpoStrategy {
  if (verdict === "AVOID") return "AVOID";

  // If company has strong return on equity and low debt, it can be held for long term
  const isCompounder =
    (ipo.ronwPct ?? 0) >= 18 &&
    (ipo.debtToEquity ?? 1) <= 0.5 &&
    (ipo.peRatio == null || (ipo.industryPe != null && ipo.peRatio <= ipo.industryPe * 1.1));

  if (verdict === "STRONG_APPLY" && isCompounder) {
    return "LONG_TERM";
  }

  return "LISTING_GAINS";
}
