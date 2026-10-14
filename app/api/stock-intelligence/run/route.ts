import { NextRequest, NextResponse } from "next/server";
import { generateDailyRecommendations } from "../../../../src/services/stockRecommendations";

export async function POST(req: NextRequest) {
  try {


    let body: { symbols?: string[]; forceRerun?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      // Default to empty body if no json passed
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
