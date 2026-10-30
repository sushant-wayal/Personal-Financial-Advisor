import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import { DATA_FRESHNESS_CONFIG } from "../../../../src/config/stockEngineDefaults";
import {
  generateDailyRecommendations,
  formatPersistedRun,
} from "../../../../src/services/stockRecommendations";
import { calculateCapitalAllocation } from "../../../../src/services/stockRisk";
import { detectMarketRegime } from "../../../../src/services/stockAnalysis/regime";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");

    if (dateParam) {
      const targetDate = new Date(dateParam);
      const run = await prisma.stockRecommendationRun.findUnique({
        where: { marketSessionDate: targetDate },
        include: { items: true },
      });

      if (!run) {
        return NextResponse.json(
          { ok: false, error: `No recommendation run found for ${dateParam}` },
          { status: 404 },
        );
      }

      return NextResponse.json({ ok: true, run: formatPersistedRun(run) });
    }

    // Otherwise fetch the latest run
    const latestRun = await prisma.stockRecommendationRun.findFirst({
      orderBy: { marketSessionDate: "desc" },
      include: { items: true },
    });

    if (latestRun) {
      const todayStr = new Date().toLocaleDateString("en-CA", {
        timeZone: DATA_FRESHNESS_CONFIG.exchangeTimezone,
      });
      const runDateStr = latestRun.marketSessionDate.toISOString().slice(0, 10);
      let liveCapitalAllocation;
      if (todayStr === runDateStr) {
        try {
          const regime = await detectMarketRegime();
          liveCapitalAllocation = await calculateCapitalAllocation(regime);
        } catch {
          // Fall back to persisted allocation if live calculation fails
        }
      }

      return NextResponse.json({
        ok: true,
        run: formatPersistedRun(latestRun, liveCapitalAllocation),
      });
    }

    // If no run exists at all, generate the initial daily run
    const generated = await generateDailyRecommendations();
    return NextResponse.json({ ok: true, run: generated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/stock-intelligence/recommendations] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
