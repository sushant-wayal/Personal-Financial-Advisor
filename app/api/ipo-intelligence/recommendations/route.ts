import { NextResponse } from "next/server";
import { generateDailyIpoRecommendations } from "../../../../src/services/ipoRecommendations";

export async function GET() {
  try {
    const run = await generateDailyIpoRecommendations();
    return NextResponse.json({ ok: true, run });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/ipo-intelligence/recommendations] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
