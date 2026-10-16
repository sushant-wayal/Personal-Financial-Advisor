import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { itemId, symbol: rawSymbol, amount: rawAmount } = body;

    let item = itemId
      ? await prisma.stockRecommendationItem.findUnique({ where: { id: itemId } })
      : null;

    if (!item && rawSymbol) {
      item = await prisma.stockRecommendationItem.findFirst({
        where: { symbol: rawSymbol, type: "BUY", status: "PENDING" },
        orderBy: { createdAt: "desc" },
      });
    }

    let detail: any = {};
    if (item?.detail) {
      try {
        detail = JSON.parse(item.detail);
      } catch {
        detail = {};
      }
    }

    const symbol = item?.symbol || rawSymbol || detail.symbol;
    if (!symbol) {
      return NextResponse.json({ ok: false, error: "Symbol or recommendation item ID is required" }, { status: 400 });
    }

    const quantity = Number(detail.quantity || body.quantity || 1);
    const entryPrice = Number(detail.entryPrice || body.entryPrice || 0);
    const estimatedCapital = Number(detail.estimatedCapital || rawAmount || entryPrice * quantity || 0);
    const investedAmount = rawAmount ? Number(rawAmount) : estimatedCapital;

    // 1. Fetch active cycle investment suggestion
    const activeSuggestion = await prisma.investmentSuggestion.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });

    let newRemainingStockBalance = 0;
    if (activeSuggestion) {
      const currentRemaining = activeSuggestion.remainingStockBalance != null
        ? activeSuggestion.remainingStockBalance
        : (activeSuggestion.totalStockInvestable || 0);
      newRemainingStockBalance = Math.max(0, currentRemaining - investedAmount);

      await prisma.investmentSuggestion.update({
        where: { id: activeSuggestion.id },
        data: { remainingStockBalance: newRemainingStockBalance },
      });
    }

    // 2. Mark Recommendation Item as INVESTED if found
    if (item) {
      await prisma.stockRecommendationItem.update({
        where: { id: item.id },
        data: {
          status: "INVESTED",
          investedAt: new Date(),
          investedAmount,
        },
      });
    }

    // 3. Update or create direct equity holding in Stock model
    if (prisma.stock) {
      const existingStock = await prisma.stock.findFirst({
        where: { symbol },
      });

      if (existingStock) {
        const newQty = existingStock.currentQuantity + quantity;
        const newWorth = (existingStock.currentWorth ?? 0) + investedAmount;
        await prisma.stock.update({
          where: { id: existingStock.id },
          data: {
            currentQuantity: newQty,
            currentPrice: entryPrice > 0 ? entryPrice : existingStock.currentPrice,
            currentWorth: newWorth,
          },
        });
      } else {
        await prisma.stock.create({
          data: {
            symbol,
            exchange: detail.exchange || "NSE",
            currentQuantity: quantity,
            currentPrice: entryPrice,
            currentWorth: investedAmount,
          },
        });
      }
    }

    // 4. Update FinancialProfile balance (deduct invested cash from liquid bank account)
    const profile = await prisma.financialProfile.findFirst();
    if (profile && profile.balance > 0) {
      await prisma.financialProfile.update({
        where: { id: profile.id },
        data: {
          balance: Math.max(0, profile.balance - investedAmount),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      symbol,
      investedAmount,
      quantity,
      remainingStockBalance: newRemainingStockBalance,
      message: `Successfully recorded purchase of ${quantity} shares of ${symbol} for ₹${investedAmount.toLocaleString("en-IN")}.`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record stock investment";
    console.error("[api/stock-intelligence/recommendations/invest] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
