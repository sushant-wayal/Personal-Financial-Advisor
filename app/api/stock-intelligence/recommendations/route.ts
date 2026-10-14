import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import { generateDailyRecommendations } from "../../../../src/services/stockRecommendations";

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

      return NextResponse.json({ ok: true, run });
    }

    // Otherwise fetch the latest run
    const latestRun = await prisma.stockRecommendationRun.findFirst({
      orderBy: { marketSessionDate: "desc" },
      include: { items: true },
    });

    if (latestRun) {
      return NextResponse.json({ ok: true, run: latestRun });
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
