import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { calculateStockBrokerage, calculateStockCharges } from "@/src/services/shared";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      itemId,
      symbol: rawSymbol,
      amount: rawAmount,
      executedPrice: rawExecutedPrice,
      quantity: rawQuantity,
      brokerage: rawBrokerage,
    } = body;

    let item = itemId
      ? await prisma.stockRecommendationItem.findUnique({ where: { id: itemId } })
      : null;

    if (!item && rawSymbol) {
      item = await prisma.stockRecommendationItem.findFirst({
        where: { symbol: rawSymbol, type: "BUY" },
        orderBy: { createdAt: "desc" },
      });
    }

    let detail: Record<string, unknown> = {};
    if (item?.detail) {
      try {
        detail = JSON.parse(item.detail);
      } catch {
        detail = {};
      }
    }

    const symbol = item?.symbol || rawSymbol || (detail.symbol as string);
    if (!symbol) {
      return NextResponse.json({ ok: false, error: "Symbol or recommendation item ID is required" }, { status: 400 });
    }

    // Sized quantity
    const quantity = Number(rawQuantity || body.quantity || detail.quantity || 1);

    // Executed price per share & calculations
    let executedPrice: number;
    let tradeValue: number;
    let brokerage: number;
    let totalDeduction: number;

    if (rawExecutedPrice != null || body.executedPrice != null) {
      executedPrice = Number(rawExecutedPrice ?? body.executedPrice);
      tradeValue = Number((executedPrice * quantity).toFixed(2));
      brokerage = rawBrokerage != null ? Number(rawBrokerage) : (body.brokerage != null ? Number(body.brokerage) : calculateStockBrokerage(tradeValue));
      totalDeduction = Number((tradeValue + brokerage).toFixed(2));
    } else if (rawAmount != null || body.amount != null) {
      totalDeduction = Number(rawAmount ?? body.amount);
      executedPrice = quantity > 0 ? Number((((totalDeduction - 5) / quantity)).toFixed(2)) : Number((detail.entryPrice as number) || 0);
      tradeValue = Number((executedPrice * quantity).toFixed(2));
      brokerage = rawBrokerage != null ? Number(rawBrokerage) : (body.brokerage != null ? Number(body.brokerage) : calculateStockBrokerage(tradeValue));
      tradeValue = Math.max(0, Number((totalDeduction - brokerage).toFixed(2)));
    } else {
      executedPrice = Number((detail.entryPrice as number) || body.entryPrice || 0);
      tradeValue = Number((executedPrice * quantity).toFixed(2));
      brokerage = rawBrokerage != null ? Number(rawBrokerage) : (body.brokerage != null ? Number(body.brokerage) : calculateStockBrokerage(tradeValue));
      totalDeduction = Number((tradeValue + brokerage).toFixed(2));
    }

    // 1. Fetch active cycle investment suggestion and deduct totalDeduction
    const activeSuggestion = await prisma.investmentSuggestion.findFirst({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });

    let newRemainingStockBalance = 0;
    if (activeSuggestion) {
      const currentRemaining = activeSuggestion.remainingStockBalance != null
        ? activeSuggestion.remainingStockBalance
        : (activeSuggestion.totalStockInvestable || 0);
      newRemainingStockBalance = Math.max(0, currentRemaining - totalDeduction);

      await prisma.investmentSuggestion.update({
        where: { id: activeSuggestion.id },
        data: { remainingStockBalance: newRemainingStockBalance },
      });
    }

    // 2. Mark Recommendation Item as INVESTED if found
    const chargesBreakdown = calculateStockCharges(tradeValue);
    const updatedDetail = {
      ...detail,
      status: "INVESTED",
      executedPrice,
      quantity,
      tradeValue,
      investedAmount: tradeValue, // Exactly what was invested in the stock asset
      brokerage,                  // Regulatory & broker fees
      totalDeduction,             // Total budget outflow (tradeValue + brokerage)
      chargesBreakdown,
      investedAt: new Date().toISOString(),
    };

    if (item) {
      await prisma.stockRecommendationItem.update({
        where: { id: item.id },
        data: {
          status: "INVESTED",
          investedAt: new Date(),
          investedAmount: tradeValue,
          detail: JSON.stringify(updatedDetail),
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
        const newWorth = (existingStock.currentWorth ?? 0) + tradeValue;
        await prisma.stock.update({
          where: { id: existingStock.id },
          data: {
            currentQuantity: newQty,
            currentPrice: executedPrice > 0 ? executedPrice : existingStock.currentPrice,
            currentWorth: newWorth,
          },
        });
      } else {
        await prisma.stock.create({
          data: {
            symbol,
            exchange: (detail.exchange as string) || "NSE",
            currentQuantity: quantity,
            currentPrice: executedPrice,
            currentWorth: tradeValue,
          },
        });
      }
    }

    // Note: Bank profile balance is preserved untouched here because transfers
    // to broker funds (Groww) are automatically tracked via debit transactions.

    return NextResponse.json({
      ok: true,
      symbol,
      executedPrice,
      quantity,
      tradeValue,
      brokerage,
      chargesBreakdown,
      totalDeduction,
      investedAmount: tradeValue,
      remainingStockBalance: newRemainingStockBalance,
      message: `Successfully recorded purchase of ${quantity} shares of ${symbol} @ ₹${executedPrice.toFixed(2)} (Invested: ₹${tradeValue.toFixed(2)}, Charges: ₹${brokerage.toFixed(2)}, Budget Used: ₹${totalDeduction.toFixed(2)}).`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record stock investment";
    console.error("[api/stock-intelligence/recommendations/invest] Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
