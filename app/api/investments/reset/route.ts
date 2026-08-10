import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getOrGenerateInvestmentSuggestion } from "@/src/services/investmentEngine";

export async function POST() {
    try {
        const active = await prisma.investmentSuggestion.findFirst({
            where: { status: "ACTIVE" },
            orderBy: { createdAt: "desc" },
        });

        if (active) {
            await prisma.investmentSuggestion.update({
                where: { id: active.id },
                data: {
                    isManuallyEdited: false,
                    editedEquity: null,
                    editedDebt: null,
                    editedGold: null,
                },
            });
        }

        const freshResult = await getOrGenerateInvestmentSuggestion();
        return NextResponse.json({ ok: true, ...freshResult });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
