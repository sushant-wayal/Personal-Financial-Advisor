import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getOrGenerateInvestmentSuggestion } from "@/src/services/investmentEngine";

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const notes = typeof body.notes === "string" ? body.notes : null;

        const active = await prisma.investmentSuggestion.findFirst({
            where: { status: "ACTIVE" },
            orderBy: { createdAt: "desc" },
        });

        if (!active) {
            return NextResponse.json({ error: "No active investment suggestion found" }, { status: 400 });
        }

        const now = new Date();
        const isEdited = active.isManuallyEdited;
        const eq = isEdited ? (active.editedEquity ?? 0) : active.suggestedEquity;
        const db = isEdited ? (active.editedDebt ?? 0) : active.suggestedDebt;
        const gd = isEdited ? (active.editedGold ?? 0) : active.suggestedGold;
        const cs = isEdited ? (active.editedCash ?? 0) : active.suggestedCash;
        const totalInvested = eq + db + gd + cs;

        // 1. Record in InvestmentHistory
        const historyRecord = await prisma.investmentHistory.create({
            data: {
                suggestionId: active.id,
                phase: active.phase,
                rawSurplus: active.rawSurplus,
                totalInvested,
                equity: eq,
                debt: db,
                gold: gd,
                cash: cs,
                investedAt: now,
                notes,
            },
        });

        // 2. Mark InvestmentSuggestion as INVESTED
        await prisma.investmentSuggestion.update({
            where: { id: active.id },
            data: {
                status: "INVESTED",
                investedAt: now,
            },
        });

        // 3. Increment investmentStreak on profile
        const profile = await prisma.financialProfile.findFirst();
        if (profile) {
            await prisma.financialProfile.update({
                where: { id: profile.id },
                data: {
                    investmentStreak: (profile.investmentStreak || 0) + 1,
                },
            });
        }

        const freshResult = await getOrGenerateInvestmentSuggestion();
        return NextResponse.json({ ok: true, history: historyRecord, ...freshResult });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
