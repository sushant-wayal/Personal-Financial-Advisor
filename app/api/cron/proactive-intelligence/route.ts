import { NextRequest, NextResponse } from "next/server";
import { runDailyProactiveIntelligence } from "../../../../src/services/proactiveIntelligence";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Verify Vercel Cron Secret if configured in production
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const isDev = process.env.NODE_ENV === "development";
      if (!isDev) {
        return NextResponse.json({ ok: false, error: "Unauthorized cron request" }, { status: 401 });
      }
    }

    const { searchParams } = new URL(req.url);
    const forceNotify = searchParams.get("forceNotify") === "true";

    const report = await runDailyProactiveIntelligence({ forceNotify });

    return NextResponse.json({
      ok: true,
      report,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Proactive execution failed";
    console.error("[cron/proactive-intelligence] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
