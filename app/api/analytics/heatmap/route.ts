import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";

export async function GET() {
    try {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89);
        const txs = await prisma.transaction.findMany({ where: { timestamp: { gte: start } }, select: { amount: true, timestamp: true } });
        const map: Record<string, number> = {};
        for (const t of txs) {
            const d = new Date(t.timestamp as any);
            const key = d.toISOString().slice(0, 10);
            map[key] = (map[key] || 0) + Math.abs(t.amount as number || 0);
        }
        const out = Object.entries(map).map(([date, amount]) => ({ date, amount }));
        return NextResponse.json({ ok: true, data: out });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
    }
}
