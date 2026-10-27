/**
 * ipoData/index.ts — Primary market data layer for North IPO Intelligence.
 *
 * Responsibilities:
 * - Load and manage Mainboard and SME IPO listings in PostgreSQL.
 * - Auto-seed initial real-world benchmark Indian IPO catalog if table is empty.
 * - Filter IPOs accurately into OPEN (today between openDate and closeDate), UPCOMING, and CLOSED.
 * - Calculate minimum investment amounts and dates in IST.
 */

import { prisma } from "../../lib/prisma";
import type { IpoDetails, IpoStatus, GmpTrend, IpoIssueType } from "./types";

/**
 * Format a Date to YYYY-MM-DD in Indian Standard Time (IST).
 */
export function formatIstDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/**
 * Normalizes any Date or YYYY-MM-DD string to start of day in UTC for Prisma @db.Date.
 */
export function normalizeDate(input: string | Date): Date {
  if (typeof input === "string") {
    const parts = input.slice(0, 10).split("-");
    if (parts.length === 3) {
      return new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
    }
    return new Date(input);
  }
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

/**
 * Relative date helper in IST.
 */
function getRelativeDate(daysOffset: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const istStr = formatIstDateStr(d);
  return normalizeDate(istStr);
}

/**
 * Initial curated catalog of Indian Mainboard & SME IPOs.
 * Seeded automatically if the IpoListing table is empty.
 */
export function getSeedIpoCatalog(): IpoDetails[] {
  return [
    {
      companyName: "Waaree Energies Limited",
      symbol: "WAAREE",
      exchange: "NSE",
      issueType: "MAINBOARD",
      openDate: getRelativeDate(-1), // Open yesterday
      closeDate: getRelativeDate(1), // Closes tomorrow
      allotmentDate: getRelativeDate(3),
      listingDate: getRelativeDate(6),
      priceFloor: 1427,
      priceCap: 1503,
      lotSize: 9,
      minInvestment: 1503 * 9, // ₹13,527
      issueSizeCr: 4321.44,
      freshIssueCr: 3600.0,
      ofsCr: 721.44,
      gmpAmount: 1475,
      gmpPercent: 98.14,
      gmpTrend: "RISING",
      qibSub: 27.8,
      niiSub: 19.4,
      retailSub: 6.8,
      totalSub: 18.2,
      peRatio: 32.4,
      industryPe: 48.6,
      revenueGrowthPct: 68.5,
      patMarginPct: 11.2,
      ronwPct: 22.8,
      debtToEquity: 0.18,
      status: "OPEN",
      rhpUrl: "https://www.sebi.gov.in",
      summaryThesis:
        "India's largest solar PV module manufacturer with 12 GW installed capacity. Exceptional demand driven by global decarbonization and substantial US export orders.",
      keyRisks: [
        "Raw material solar cell pricing volatility",
        "Geopolitical export duty risks to the US market",
      ],
    },
    {
      companyName: "Afcons Infrastructure Limited",
      symbol: "AFCONS",
      exchange: "NSE",
      issueType: "MAINBOARD",
      openDate: getRelativeDate(0), // Opens today
      closeDate: getRelativeDate(2), // Closes in 2 days
      allotmentDate: getRelativeDate(4),
      listingDate: getRelativeDate(7),
      priceFloor: 440,
      priceCap: 463,
      lotSize: 32,
      minInvestment: 463 * 32, // ₹14,816
      issueSizeCr: 5430.0,
      freshIssueCr: 1250.0,
      ofsCr: 4180.0,
      gmpAmount: 85,
      gmpPercent: 18.36,
      gmpTrend: "STABLE",
      qibSub: 3.8,
      niiSub: 2.1,
      retailSub: 1.4,
      totalSub: 2.6,
      peRatio: 37.8,
      industryPe: 42.1,
      revenueGrowthPct: 14.2,
      patMarginPct: 4.1,
      ronwPct: 13.5,
      debtToEquity: 0.88,
      status: "OPEN",
      rhpUrl: "https://www.sebi.gov.in",
      summaryThesis:
        "Flagship infrastructure engineering arm of Shapoorji Pallonji Group. Strong execution track record in complex maritime, tunnel, and metro projects globally.",
      keyRisks: [
        "High OFS proportion (77% of issue is promoter divestment)",
        "Working capital intensive operations with high debt burden",
      ],
    },
    {
      companyName: "Godavari Biorefineries Limited",
      symbol: "GODAVARI",
      exchange: "NSE",
      issueType: "MAINBOARD",
      openDate: getRelativeDate(-2), // Open 2 days ago
      closeDate: getRelativeDate(0), // Closes today
      allotmentDate: getRelativeDate(2),
      listingDate: getRelativeDate(5),
      priceFloor: 334,
      priceCap: 352,
      lotSize: 42,
      minInvestment: 352 * 42, // ₹14,784
      issueSizeCr: 554.75,
      freshIssueCr: 325.0,
      ofsCr: 229.75,
      gmpAmount: 12,
      gmpPercent: 3.41,
      gmpTrend: "FALLING",
      qibSub: 1.1,
      niiSub: 0.8,
      retailSub: 1.5,
      totalSub: 1.2,
      peRatio: 58.2,
      industryPe: 28.5,
      revenueGrowthPct: 3.8,
      patMarginPct: 1.4,
      ronwPct: 4.2,
      debtToEquity: 1.42,
      status: "OPEN",
      rhpUrl: "https://www.sebi.gov.in",
      summaryThesis:
        "Manufacturer of ethanol-based chemicals and biofuels. Facing margin compression due to sugar cane price controls and fluctuating export realization.",
      keyRisks: [
        "Stretched valuation at 58x P/E with falling PAT margins",
        "High debt-to-equity of 1.42 with declining GMP",
      ],
    },
    {
      companyName: "Deepak Builders & Engineers Limited",
      symbol: "DEEPAKENG",
      exchange: "BOTH",
      issueType: "MAINBOARD",
      openDate: getRelativeDate(-1),
      closeDate: getRelativeDate(1),
      allotmentDate: getRelativeDate(3),
      listingDate: getRelativeDate(6),
      priceFloor: 192,
      priceCap: 203,
      lotSize: 73,
      minInvestment: 203 * 73, // ₹14,819
      issueSizeCr: 260.04,
      freshIssueCr: 217.44,
      ofsCr: 42.6,
      gmpAmount: 48,
      gmpPercent: 23.65,
      gmpTrend: "RISING",
      qibSub: 6.2,
      niiSub: 8.4,
      retailSub: 12.1,
      totalSub: 9.3,
      peRatio: 16.8,
      industryPe: 22.4,
      revenueGrowthPct: 24.1,
      patMarginPct: 9.2,
      ronwPct: 28.4,
      debtToEquity: 0.42,
      status: "OPEN",
      rhpUrl: "https://www.sebi.gov.in",
      summaryThesis:
        "Engineering and construction firm executing turnkey hospital, stadium, and institutional infrastructure projects in northern India. Healthy return ratios and low leverage.",
      keyRisks: [
        "Geographic concentration of order book in Punjab and Haryana",
        "Competitive bidding pressure from mid-tier contractors",
      ],
    },
    {
      companyName: "Swiggy Limited",
      symbol: "SWIGGY",
      exchange: "NSE",
      issueType: "MAINBOARD",
      openDate: getRelativeDate(6), // Upcoming in 6 days
      closeDate: getRelativeDate(8),
      allotmentDate: getRelativeDate(10),
      listingDate: getRelativeDate(13),
      priceFloor: 371,
      priceCap: 390,
      lotSize: 38,
      minInvestment: 390 * 38, // ₹14,820
      issueSizeCr: 11327.43,
      freshIssueCr: 4499.0,
      ofsCr: 6828.43,
      gmpAmount: 25,
      gmpPercent: 6.41,
      gmpTrend: "STABLE",
      qibSub: 0,
      niiSub: 0,
      retailSub: 0,
      totalSub: 0,
      peRatio: null, // Loss-making tech platform
      industryPe: 85.0,
      revenueGrowthPct: 36.1,
      patMarginPct: -18.2,
      ronwPct: -12.4,
      debtToEquity: 0.05,
      status: "UPCOMING",
      rhpUrl: "https://www.sebi.gov.in",
      summaryThesis:
        "India's leading consumer tech ecosystem with Instamart quick commerce and food delivery. High user retention with rapid quick commerce dark-store expansion.",
      keyRisks: [
        "Intense rivalry with Zomato and Zepto in quick commerce",
        "Persistent negative EBITDA and regulatory scrutiny on gig delivery",
      ],
    },
    {
      companyName: "NTPC Green Energy Limited",
      symbol: "NTPCGREEN",
      exchange: "NSE",
      issueType: "MAINBOARD",
      openDate: getRelativeDate(12), // Upcoming in 12 days
      closeDate: getRelativeDate(14),
      allotmentDate: getRelativeDate(16),
      listingDate: getRelativeDate(19),
      priceFloor: 102,
      priceCap: 108,
      lotSize: 138,
      minInvestment: 108 * 138, // ₹14,904
      issueSizeCr: 10000.0,
      freshIssueCr: 10000.0, // 100% fresh issue!
      ofsCr: 0,
      gmpAmount: 18,
      gmpPercent: 16.67,
      gmpTrend: "RISING",
      qibSub: 0,
      niiSub: 0,
      retailSub: 0,
      totalSub: 0,
      peRatio: 52.0,
      industryPe: 46.0,
      revenueGrowthPct: 82.0,
      patMarginPct: 18.5,
      ronwPct: 14.1,
      debtToEquity: 1.15,
      status: "UPCOMING",
      rhpUrl: "https://www.sebi.gov.in",
      summaryThesis:
        "Maharatna PSU NTPC's dedicated renewable energy platform. 100% fresh issue earmarked for equity expansion and debt deleveraging across utility-scale solar and wind assets.",
      keyRisks: [
        "Reliance on state DISCOM power purchase agreements",
        "Capital expenditure execution dependencies",
      ],
    },
    {
      companyName: "Hyundai Motor India Limited",
      symbol: "HYUNDAI",
      exchange: "NSE",
      issueType: "MAINBOARD",
      openDate: getRelativeDate(-14),
      closeDate: getRelativeDate(-12),
      allotmentDate: getRelativeDate(-10),
      listingDate: getRelativeDate(-7),
      priceFloor: 1865,
      priceCap: 1960,
      lotSize: 7,
      minInvestment: 1960 * 7, // ₹13,720
      issueSizeCr: 27870.16,
      freshIssueCr: 0,
      ofsCr: 27870.16, // 100% OFS
      gmpAmount: -25,
      gmpPercent: -1.28,
      gmpTrend: "FALLING",
      qibSub: 6.97,
      niiSub: 0.6,
      retailSub: 0.5,
      totalSub: 2.37,
      peRatio: 26.2,
      industryPe: 27.5,
      revenueGrowthPct: 15.8,
      patMarginPct: 8.7,
      ronwPct: 24.5,
      debtToEquity: 0.02,
      status: "LISTED",
      listingPrice: 1934, // Discount of -1.3%
      listingGainPct: -1.33,
      rhpUrl: "https://www.sebi.gov.in",
      summaryThesis:
        "Second-largest passenger vehicle maker in India. Pure 100% OFS by South Korean parent company led to weak retail demand and a flat-to-discounted listing.",
      keyRisks: [
        "100% promoter dividend extraction with zero fresh capital into company",
        "Subdued retail subscription interest due to mega-issue supply overhang",
      ],
    },
    {
      companyName: "Bajaj Housing Finance Limited",
      symbol: "BAJAJHFL",
      exchange: "NSE",
      issueType: "MAINBOARD",
      openDate: getRelativeDate(-45),
      closeDate: getRelativeDate(-43),
      allotmentDate: getRelativeDate(-40),
      listingDate: getRelativeDate(-37),
      priceFloor: 66,
      priceCap: 70,
      lotSize: 214,
      minInvestment: 70 * 214, // ₹14,980
      issueSizeCr: 6560.0,
      freshIssueCr: 3560.0,
      ofsCr: 3000.0,
      gmpAmount: 85,
      gmpPercent: 121.43,
      gmpTrend: "RISING",
      qibSub: 222.05,
      niiSub: 43.84,
      retailSub: 7.41,
      totalSub: 67.43,
      peRatio: 29.8,
      industryPe: 28.0,
      revenueGrowthPct: 34.2,
      patMarginPct: 21.0,
      ronwPct: 15.2,
      debtToEquity: 4.8,
      status: "LISTED",
      listingPrice: 165, // Massive listing gain of +135.7%
      listingGainPct: 135.71,
      rhpUrl: "https://www.sebi.gov.in",
      summaryThesis:
        "Premier non-deposit taking housing finance company backed by Bajaj group. Listed at a massive 135% premium driven by phenomenal QIB bidding of 222x.",
      keyRisks: [
        "Intense mortgage rate competition from commercial banks",
      ],
    },
  ];
}

/**
 * Ensures the database has seed IPO records.
 */
export async function ensureSeedIpos(): Promise<void> {
  const count = await prisma.ipoListing.count();
  if (count > 0) return;

  const catalog = getSeedIpoCatalog();
  for (const item of catalog) {
    await prisma.ipoListing.create({
      data: {
        companyName: item.companyName,
        symbol: item.symbol,
        exchange: item.exchange,
        issueType: item.issueType,
        openDate: normalizeDate(item.openDate),
        closeDate: normalizeDate(item.closeDate),
        allotmentDate: item.allotmentDate ? normalizeDate(item.allotmentDate) : null,
        refundsDate: item.refundsDate ? normalizeDate(item.refundsDate) : null,
        dematCreditDate: item.dematCreditDate ? normalizeDate(item.dematCreditDate) : null,
        listingDate: item.listingDate ? normalizeDate(item.listingDate) : null,
        priceFloor: item.priceFloor,
        priceCap: item.priceCap,
        lotSize: item.lotSize,
        minInvestment: item.minInvestment,
        issueSizeCr: item.issueSizeCr,
        freshIssueCr: item.freshIssueCr,
        ofsCr: item.ofsCr,
        gmpAmount: item.gmpAmount,
        gmpPercent: item.gmpPercent,
        gmpTrend: item.gmpTrend,
        qibSub: item.qibSub,
        niiSub: item.niiSub,
        retailSub: item.retailSub,
        totalSub: item.totalSub,
        peRatio: item.peRatio,
        industryPe: item.industryPe,
        revenueGrowthPct: item.revenueGrowthPct,
        patMarginPct: item.patMarginPct,
        ronwPct: item.ronwPct,
        debtToEquity: item.debtToEquity,
        status: item.status,
        listingPrice: item.listingPrice,
        listingGainPct: item.listingGainPct,
        rhpUrl: item.rhpUrl,
        summaryThesis: item.summaryThesis,
        keyRisks: JSON.stringify(item.keyRisks ?? []),
      },
    });
  }
}

/**
 * Fetch all IPOs from Prisma database.
 */
export async function getAllIpos(): Promise<IpoDetails[]> {
  await ensureSeedIpos();

  const records = await prisma.ipoListing.findMany({
    orderBy: { openDate: "desc" },
  });

  return records.map(mapPrismaIpoToDetails);
}

/**
 * Filter IPOs that are currently OPEN for application today in IST.
 * openDate <= today <= closeDate
 */
export async function getOpenIpos(referenceDate: Date = new Date()): Promise<IpoDetails[]> {
  await ensureSeedIpos();

  const todayStr = formatIstDateStr(referenceDate);
  const todayUtc = normalizeDate(todayStr);

  const records = await prisma.ipoListing.findMany({
    where: {
      openDate: { lte: todayUtc },
      closeDate: { gte: todayUtc },
    },
    orderBy: { totalSub: "desc" },
  });

  return records.map(mapPrismaIpoToDetails);
}

/**
 * Filter UPCOMING IPOs (openDate > today).
 */
export async function getUpcomingIpos(referenceDate: Date = new Date()): Promise<IpoDetails[]> {
  await ensureSeedIpos();

  const todayStr = formatIstDateStr(referenceDate);
  const todayUtc = normalizeDate(todayStr);

  const records = await prisma.ipoListing.findMany({
    where: {
      openDate: { gt: todayUtc },
    },
    orderBy: { openDate: "asc" },
  });

  return records.map(mapPrismaIpoToDetails);
}

/**
 * Filter CLOSED or LISTED IPOs (closeDate < today).
 */
export async function getClosedAndListedIpos(referenceDate: Date = new Date()): Promise<IpoDetails[]> {
  await ensureSeedIpos();

  const todayStr = formatIstDateStr(referenceDate);
  const todayUtc = normalizeDate(todayStr);

  const records = await prisma.ipoListing.findMany({
    where: {
      closeDate: { lt: todayUtc },
    },
    orderBy: { listingDate: "desc" },
  });

  return records.map(mapPrismaIpoToDetails);
}

function mapPrismaIpoToDetails(rec: any): IpoDetails {
  let parsedRisks: string[] = [];
  try {
    parsedRisks = JSON.parse(rec.keyRisks || "[]");
  } catch {
    parsedRisks = [];
  }

  return {
    id: rec.id,
    companyName: rec.companyName,
    symbol: rec.symbol,
    exchange: rec.exchange as "NSE" | "BSE" | "BOTH",
    issueType: rec.issueType as IpoIssueType,
    openDate: rec.openDate.toISOString().slice(0, 10),
    closeDate: rec.closeDate.toISOString().slice(0, 10),
    allotmentDate: rec.allotmentDate ? rec.allotmentDate.toISOString().slice(0, 10) : null,
    refundsDate: rec.refundsDate ? rec.refundsDate.toISOString().slice(0, 10) : null,
    dematCreditDate: rec.dematCreditDate ? rec.dematCreditDate.toISOString().slice(0, 10) : null,
    listingDate: rec.listingDate ? rec.listingDate.toISOString().slice(0, 10) : null,
    priceFloor: rec.priceFloor,
    priceCap: rec.priceCap,
    lotSize: rec.lotSize,
    minInvestment: rec.minInvestment,
    issueSizeCr: rec.issueSizeCr,
    freshIssueCr: rec.freshIssueCr,
    ofsCr: rec.ofsCr,
    gmpAmount: rec.gmpAmount,
    gmpPercent: rec.gmpPercent,
    gmpTrend: rec.gmpTrend as GmpTrend,
    qibSub: rec.qibSub,
    niiSub: rec.niiSub,
    retailSub: rec.retailSub,
    totalSub: rec.totalSub,
    peRatio: rec.peRatio,
    industryPe: rec.industryPe,
    revenueGrowthPct: rec.revenueGrowthPct,
    patMarginPct: rec.patMarginPct,
    ronwPct: rec.ronwPct,
    debtToEquity: rec.debtToEquity,
    status: rec.status as IpoStatus,
    listingPrice: rec.listingPrice,
    listingGainPct: rec.listingGainPct,
    rhpUrl: rec.rhpUrl,
    summaryThesis: rec.summaryThesis,
    keyRisks: parsedRisks,
  };
}
