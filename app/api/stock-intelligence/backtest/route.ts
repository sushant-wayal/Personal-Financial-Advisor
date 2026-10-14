import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import { runBacktest, BacktestParams } from "../../../../src/services/backtesting";
import { DEFAULT_UNIVERSE_SYMBOLS } from "../../../../src/config/stockEngineDefaults";
import type { StrategyName } from "../../../../src/config/stockEngineDefaults";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const strategy = searchParams.get("strategy");

    const results = await prisma.stockBacktestResult.findMany({
      where: strategy ? { strategyName: strategy } : undefined,
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const parsed = results.map((r) => {
      try {
        return JSON.parse(r.result);
      } catch {
        return {
          strategyName: r.strategyName,
          strategyVersion: r.strategyVersion,
          startDate: r.startDate.toISOString().slice(0, 10),
          endDate: r.endDate.toISOString().slice(0, 10),
          initialCapital: r.initialCapital,
        };
      }
    });

    return NextResponse.json({ ok: true, results: parsed });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load backtest history";
    console.error("[api/stock-intelligence/backtest] GET Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const strategyName = (body.strategyName || "TREND_PULLBACK") as StrategyName;
    const symbols = Array.isArray(body.symbols) && body.symbols.length > 0
      ? body.symbols
      : DEFAULT_UNIVERSE_SYMBOLS.slice(0, 15);

    const now = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(now.getFullYear() - 1);

    const startDate = body.startDate || oneYearAgo.toISOString().slice(0, 10);
    const endDate = body.endDate || now.toISOString().slice(0, 10);

    const params: BacktestParams = {
      strategyName,
      symbols,
      startDate,
      endDate,
      initialCapital: body.initialCapital ? Number(body.initialCapital) : 100000,
      slippagePct: body.slippagePct ? Number(body.slippagePct) : 0.2,
      maxPositions: body.maxPositions ? Number(body.maxPositions) : 5,
    };

    const result = await runBacktest(params);
    return NextResponse.json({ ok: true, result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Backtest execution failed";
    console.error("[api/stock-intelligence/backtest] POST Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
