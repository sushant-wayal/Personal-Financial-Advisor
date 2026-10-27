import { NextRequest, NextResponse } from "next/server";
import { generateDailyIpoRecommendations } from "../../../../src/services/ipoRecommendations";

export async function POST(req: NextRequest) {
  try {
    let forceRerun = false;
    try {
      const body = await req.json();
      forceRerun = Boolean(body?.forceRerun);
    } catch {
      // no body provided
    }

    const run = await generateDailyIpoRecommendations({ forceRerun });
    return NextResponse.json({ ok: true, run });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/ipo-intelligence/run] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
