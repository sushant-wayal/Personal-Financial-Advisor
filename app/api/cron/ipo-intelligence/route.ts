import { NextRequest, NextResponse } from "next/server";
import { generateDailyIpoRecommendations } from "../../../../src/services/ipoRecommendations";
import { ensureSeedIpos } from "../../../../src/services/ipoData";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const isDev = process.env.NODE_ENV === "development";
      if (!isDev) {
        return NextResponse.json({ ok: false, error: "Unauthorized cron request" }, { status: 401 });
      }
    }

    console.info("[cron] Starting North IPO Intelligence daily morning sync...");

    await ensureSeedIpos();
    const run = await generateDailyIpoRecommendations({ forceRerun: true });

    console.info(
      `[cron] IPO Intelligence completed for ${run.sessionDate}: Best pick ${run.bestIpoSymbol ?? "None"} (${run.bestIpoVerdict}).`,
    );

    return NextResponse.json({
      ok: true,
      sessionDate: run.sessionDate,
      bestIpoSymbol: run.bestIpoSymbol,
      bestIpoVerdict: run.bestIpoVerdict,
      totalOpenIpos: run.totalOpenIpos,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Cron execution failed";
    console.error("[cron/ipo-intelligence] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
