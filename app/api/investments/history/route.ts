import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
    try {
        const [history, profile] = await Promise.all([
            prisma.investmentHistory.findMany({
                orderBy: { investedAt: "desc" },
                take: 50,
            }),
            prisma.financialProfile.findFirst({ select: { investmentStreak: true } }),
        ]);

        return NextResponse.json({ ok: true, history, streak: profile?.investmentStreak ?? 0 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
