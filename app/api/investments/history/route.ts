import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
    try {
        const history = await prisma.investmentHistory.findMany({
            orderBy: { investedAt: "desc" },
            take: 50,
        });

        return NextResponse.json({ ok: true, history });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
