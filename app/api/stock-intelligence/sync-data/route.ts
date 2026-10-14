import { NextRequest, NextResponse } from "next/server";
import { fetchUniverseData, getDataProviderStatus } from "../../../../src/services/marketData";
import { DEFAULT_UNIVERSE_SYMBOLS } from "../../../../src/config/stockEngineDefaults";

export async function POST(req: NextRequest) {
  try {
    let symbols = DEFAULT_UNIVERSE_SYMBOLS.slice(0, 20);
    try {
      const body = await req.json();
      if (Array.isArray(body.symbols) && body.symbols.length > 0) {
        symbols = body.symbols;
      }
    } catch {
      // Use default symbols if body not provided
    }

    const result = await fetchUniverseData(symbols, "NSE", 250);
    const health = await getDataProviderStatus();

    return NextResponse.json({
      ok: true,
      result,
      providerHealth: health,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Data synchronization failed";
    console.error("[api/stock-intelligence/sync-data] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
