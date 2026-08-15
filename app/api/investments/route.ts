import { NextResponse } from "next/server";
import { getOrGenerateInvestmentSuggestion } from "@/src/services/investmentEngine";
import { prisma } from "@/src/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const [result, history] = await Promise.all([
            getOrGenerateInvestmentSuggestion(),
            prisma.investmentHistory.findMany({
                orderBy: { investedAt: "desc" },
                take: 20,
                select: {
                    id: true,
                    suggestionId: true,
                    phase: true,
                    rawSurplus: true,
                    totalInvested: true,
                    equity: true,
                    debt: true,
                    gold: true,
                    investedAt: true,
                    notes: true,
                },
            }),
        ]);
        return NextResponse.json({ ok: true, ...result, history });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json();
        const equity = Math.max(0, Number(body.equity || 0));
        const debt = Math.max(0, Number(body.debt || 0));
        const gold = Math.max(0, Number(body.gold || 0));

        const active = await prisma.investmentSuggestion.findFirst({
            where: { status: "ACTIVE" },
            orderBy: { createdAt: "desc" },
        });

        if (!active) {
            return NextResponse.json({ error: "No active investment suggestion to edit" }, { status: 400 });
        }

        const profile = await prisma.financialProfile.findFirst({ select: { balance: true } });
        const maxAllowed = profile?.balance ?? 0;
        const requestedTotal = equity + debt + gold;

        if (requestedTotal > maxAllowed) {
            return NextResponse.json(
                { error: `Total allocated investment (₹${requestedTotal.toLocaleString("en-IN")}) cannot exceed total liquid balance (₹${maxAllowed.toLocaleString("en-IN")})` },
                { status: 400 }
            );
        }

        await prisma.investmentSuggestion.update({
            where: { id: active.id },
            data: {
                isManuallyEdited: true,
                editedEquity: equity,
                editedDebt: debt,
                editedGold: gold,
            },
        });

        const result = await getOrGenerateInvestmentSuggestion();
        return NextResponse.json({ ok: true, ...result });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
