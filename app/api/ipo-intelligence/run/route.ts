import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import {
  generateDailyIpoRecommendations,
  formatPersistedIpoRun,
} from "../../../../src/services/ipoRecommendations";
import { formatIstDateStr, normalizeDate } from "../../../../src/services/ipoData";

export async function POST(req: NextRequest) {
  try {
    let forceRerun = false;
    try {
      const body = await req.json();
      forceRerun = Boolean(body?.forceRerun);
    } catch {
      // no body provided
    }

    const sessionDateStr = formatIstDateStr(new Date());
    const sessionDateObj = normalizeDate(sessionDateStr);

    const existingRun = await prisma.ipoRecommendationRun.findUnique({
      where: { sessionDate: sessionDateObj },
      include: {
        items: {
          include: { ipo: true },
        },
      },
    });

    const todayStart = new Date(`${sessionDateStr}T00:00:00.000+05:30`);
    const todayEnd = new Date(`${sessionDateStr}T23:59:59.999+05:30`);
    const todayApplications = await prisma.ipoApplicationRecord.count({
      where: {
        applicationDate: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    if (existingRun && todayApplications > 0) {
      return NextResponse.json({
        ok: true,
        message:
          "Today's IPO recommendation plan is active with submitted applications. Daily session plan is locked to prevent changing suggestions.",
        run: await formatPersistedIpoRun(existingRun),
        isSessionLocked: true,
      });
    }

    if (!forceRerun && existingRun) {
      return NextResponse.json({
        ok: true,
        run: await formatPersistedIpoRun(existingRun),
      });
    }

    const run = await generateDailyIpoRecommendations({ forceRerun });
    return NextResponse.json({ ok: true, run });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/ipo-intelligence/run] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
