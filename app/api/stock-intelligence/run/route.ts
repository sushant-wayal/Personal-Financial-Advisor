import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import { DATA_FRESHNESS_CONFIG } from "../../../../src/config/stockEngineDefaults";
import {
  generateDailyRecommendations,
  formatPersistedRun,
} from "../../../../src/services/stockRecommendations";

export async function POST(req: NextRequest) {
  try {
    let body: { symbols?: string[]; forceRerun?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      // Default to empty body if no json passed
    }

    const sessionDateStr = new Date().toLocaleDateString("en-CA", {
      timeZone: DATA_FRESHNESS_CONFIG.exchangeTimezone,
    });
    const sessionDateObj = new Date(sessionDateStr);

    const existingRun = await prisma.stockRecommendationRun.findUnique({
      where: { marketSessionDate: sessionDateObj },
      include: { items: true },
    });

    if (existingRun && existingRun.items.some((i) => i.status === "INVESTED")) {
      return NextResponse.json({
        ok: true,
        message: "Today's recommendation plan is active with executed trades. Daily session plan is locked to prevent overtrading.",
        run: formatPersistedRun(existingRun),
        isSessionLocked: true,
      });
    }

    const run = await generateDailyRecommendations({
      symbols: body.symbols,
      forceRerun: body.forceRerun ?? true,
    });

    return NextResponse.json({ ok: true, run });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Pipeline execution failed";
    console.error("[api/stock-intelligence/run] Execution error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
