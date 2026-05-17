import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

export async function GET() {
    try {
        const txs = await prisma.transaction.findMany({ orderBy: { timestamp: "desc" }, take: 200 });
        return NextResponse.json({ ok: true, transactions: txs });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
