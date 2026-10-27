import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

export async function GET() {
  try {
    const applications = await prisma.ipoApplicationRecord.findMany({
      include: { ipo: true },
      orderBy: { applicationDate: "desc" },
    });

    return NextResponse.json({ ok: true, applications });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/ipo-intelligence/apply] GET Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      symbol,
      lotsApplied = 1,
      bidPrice,
      totalAmountBlocked,
      upiIdUsed,
      applicationNumber,
      notes,
    } = body;

    if (!symbol) {
      return NextResponse.json({ ok: false, error: "Symbol is required" }, { status: 400 });
    }

    const ipo = await prisma.ipoListing.findUnique({
      where: { symbol },
    });

    if (!ipo) {
      return NextResponse.json({ ok: false, error: `IPO listing not found for ${symbol}` }, { status: 404 });
    }

    const effectiveBidPrice = bidPrice ?? ipo.priceCap;
    const effectiveBlockedAmount = totalAmountBlocked ?? effectiveBidPrice * ipo.lotSize * lotsApplied;

    const application = await prisma.ipoApplicationRecord.create({
      data: {
        ipoId: ipo.id,
        symbol: ipo.symbol,
        lotsApplied: Number(lotsApplied) || 1,
        bidPrice: effectiveBidPrice,
        totalAmountBlocked: effectiveBlockedAmount,
        upiIdUsed: upiIdUsed ?? null,
        applicationNumber: applicationNumber ?? null,
        notes: notes ?? null,
        status: "APPLIED",
      },
    });

    return NextResponse.json({ ok: true, application });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[api/ipo-intelligence/apply] POST Error:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
