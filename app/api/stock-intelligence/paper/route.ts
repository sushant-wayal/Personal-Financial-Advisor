import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreatePaperPortfolio,
  executePaperBuy,
  executePaperSell,
  syncPaperPortfolioWithMarketBars,
  resetPaperPortfolio,
} from "../../../../src/services/paperTrading";

export async function GET() {
  try {
    const portfolio = await getOrCreatePaperPortfolio();
    return NextResponse.json({ ok: true, portfolio });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load paper portfolio";
    console.error("[api/stock-intelligence/paper] GET Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body.action as string;

    if (action === "SYNC") {
      const portfolio = await syncPaperPortfolioWithMarketBars();
      return NextResponse.json({ ok: true, portfolio });
    }

    if (action === "RESET") {
      const initialCash = typeof body.initialCash === "number" ? body.initialCash : 100000;
      const portfolio = await resetPaperPortfolio(initialCash);
      return NextResponse.json({ ok: true, portfolio });
    }

    if (action === "BUY") {
      const { symbol, exchange, strategy, quantity, entryPrice, stopLoss, targetPrice } = body;
      if (!symbol || !strategy || !quantity || !entryPrice || !stopLoss) {
        return NextResponse.json(
          { ok: false, error: "Missing required order parameters for paper BUY" },
          { status: 400 },
        );
      }

      const trade = await executePaperBuy({
        symbol,
        exchange,
        strategy,
        quantity: Math.floor(quantity),
        entryPrice: Number(entryPrice),
        stopLoss: Number(stopLoss),
        targetPrice: targetPrice ? Number(targetPrice) : null,
      });

      const portfolio = await getOrCreatePaperPortfolio();
      return NextResponse.json({ ok: true, trade, portfolio });
    }

    if (action === "SELL") {
      const { tradeId, exitPrice, exitReason } = body;
      if (!tradeId || !exitPrice) {
        return NextResponse.json(
          { ok: false, error: "Missing required parameters (tradeId, exitPrice) for paper SELL" },
          { status: 400 },
        );
      }

      const trade = await executePaperSell(
        tradeId,
        Number(exitPrice),
        exitReason || "MANUAL_EXIT",
      );

      const portfolio = await getOrCreatePaperPortfolio();
      return NextResponse.json({ ok: true, trade, portfolio });
    }

    return NextResponse.json(
      { ok: false, error: `Invalid action: ${action}. Expected BUY, SELL, SYNC, or RESET.` },
      { status: 400 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Paper trading operation failed";
    console.error("[api/stock-intelligence/paper] POST Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
