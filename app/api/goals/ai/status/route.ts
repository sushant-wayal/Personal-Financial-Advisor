import { NextResponse } from "next/server";
import prisma from "@/src/lib/prisma";

const MEMORY_KEY = "ai_goals_recommendation";

export async function GET() {
    try {
        const mem = await prisma.aIMemory.findFirst({ where: { key: MEMORY_KEY }, orderBy: { updatedAt: "desc" } });
        const lastRun = mem?.updatedAt ? mem.updatedAt.toISOString() : null;
        let recommendations: unknown = null;

        if (mem?.value) {
            try {
                recommendations = JSON.parse(mem.value);
            } catch {
                recommendations = null;
            }
        }

        return NextResponse.json({ ok: true, lastRun, recommendations });
    } catch (e: any) {
        console.error("AI status error:", e);
        return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
    }
}
