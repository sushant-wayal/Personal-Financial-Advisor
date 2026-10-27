/**
 * ipoData/types.ts — Core TypeScript definitions for North IPO Intelligence.
 */

export type IpoStatus = "UPCOMING" | "OPEN" | "CLOSED" | "ALLOTTED" | "LISTED";
export type IpoIssueType = "MAINBOARD" | "SME";
export type GmpTrend = "RISING" | "STABLE" | "FALLING";
export type IpoVerdict = "STRONG_APPLY" | "APPLY" | "NEUTRAL" | "AVOID";
export type IpoStrategy = "LISTING_GAINS" | "LONG_TERM" | "AVOID";
export type IpoApplicationStatus = "APPLIED" | "ALLOTTED" | "NOT_ALLOTTED" | "WITHDRAWN";

export interface IpoDetails {
  id?: string;
  companyName: string;
  symbol: string;
  exchange: "NSE" | "BSE" | "BOTH";
  issueType: IpoIssueType;

  // Key Dates (YYYY-MM-DD string or Date)
  openDate: string | Date;
  closeDate: string | Date;
  allotmentDate?: string | Date | null;
  refundsDate?: string | Date | null;
  dematCreditDate?: string | Date | null;
  listingDate?: string | Date | null;

  // Sizing & Pricing
  priceFloor: number;
  priceCap: number;
  lotSize: number;
  minInvestment: number;
  issueSizeCr: number;
  freshIssueCr: number;
  ofsCr: number;

  // Sentiment & Subscriptions
  gmpAmount: number;
  gmpPercent: number;
  gmpTrend: GmpTrend;
  qibSub: number;
  niiSub: number;
  retailSub: number;
  totalSub: number;

  // Financial Health
  peRatio?: number | null;
  industryPe?: number | null;
  revenueGrowthPct?: number | null;
  patMarginPct?: number | null;
  ronwPct?: number | null;
  debtToEquity?: number | null;

  // Status & Analysis
  status: IpoStatus;
  listingPrice?: number | null;
  listingGainPct?: number | null;
  rhpUrl?: string | null;
  summaryThesis?: string | null;
  keyRisks?: string[];
}

export interface IpoScoreBreakdown {
  demandScore: number;       // 0 - 35
  gmpScore: number;          // 0 - 30
  valuationScore: number;    // 0 - 20
  issueQualityScore: number; // 0 - 15
  totalScore: number;        // 0 - 100
}

export interface IpoRecommendationItemData {
  ipoId: string;
  symbol: string;
  companyName: string;
  issueType: IpoIssueType;
  exchange: string;
  priceCap: number;
  lotSize: number;
  minInvestment: number;
  openDate: string;
  closeDate: string;
  listingDate?: string | null;

  isBestPick: boolean;
  score: IpoScoreBreakdown;
  verdict: IpoVerdict;
  strategy: IpoStrategy;
  expectedListingGain: number;

  recommendedLots: number;
  recommendedBidPrice: number;
  requiredCapital: number;
  userCanAfford: boolean;

  gmpAmount: number;
  gmpPercent: number;
  gmpTrend: GmpTrend;
  qibSub: number;
  niiSub: number;
  retailSub: number;
  totalSub: number;

  reasonsFor: string[];
  reasonsAgainst: string[];
  aiThesis?: string | null;
}

export interface IpoRunResult {
  id: string;
  sessionDate: string;
  marketRegime: string;
  totalOpenIpos: number;
  bestIpoSymbol: string | null;
  bestIpoVerdict: string | null;
  aiSynthesis: string | null;
  bestPick: IpoRecommendationItemData | null;
  openIpos: IpoRecommendationItemData[];
  upcomingIpos: IpoDetails[];
  closedIpos: IpoDetails[];
  personalBudget: {
    deployableBudget: number;
    financialPhase: string;
    canAffordOneLot: boolean;
    minimumLotRequired: number;
  };
}
