import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { fetchLiveQuotes, getExchangeMarketStatus } from "@/src/services/marketData";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawSymbols = searchParams.get("symbols");

    let symbolsToFetch: string[] = [];

    if (rawSymbols && rawSymbols.trim().length > 0) {
      symbolsToFetch = rawSymbols
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => s.length > 0);
    } else {
      // Auto-discover active stock symbols across portfolio, recommendations, and paper trading
      const [ownedStocks, latestRun, openPaper] = await Promise.all([
        prisma.stock.findMany({
          select: { symbol: true },
        }),
        prisma.stockRecommendationRun.findFirst({
          orderBy: { marketSessionDate: "desc" },
          include: { items: { select: { symbol: true } } },
        }),
        prisma.stockPaperTrade.findMany({
          where: { status: "OPEN" },
          select: { symbol: true },
        }),
      ]);

      const symbolSet = new Set<string>();
      for (const s of ownedStocks) {
        if (s.symbol) symbolSet.add(s.symbol.toUpperCase());
      }
      if (latestRun?.items) {
        for (const item of latestRun.items) {
          if (item.symbol) symbolSet.add(item.symbol.toUpperCase());
        }
      }
      for (const p of openPaper) {
        if (p.symbol) symbolSet.add(p.symbol.toUpperCase());
      }

      symbolsToFetch = Array.from(symbolSet);
    }

    const marketStatus = getExchangeMarketStatus();
    const quotes = await fetchLiveQuotes(symbolsToFetch);

    return NextResponse.json(
      {
        ok: true,
        marketStatus,
        quotes,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/stocks/live/quotes] Failed to fetch live quotes:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
