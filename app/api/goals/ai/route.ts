import { NextResponse } from "next/server";
import { generateAIRecommendations } from "../../../../src/services/AIGoalAdvisorService";
import prisma from "../../../../src/lib/prisma";

const MEMORY_KEY = "ai_goals_recommendation";
const HOUR = 1000 * 60 * 60;

export async function GET(req: Request) {
    let cachedPayload: any = null;

    try {
        const url = new URL(req.url);
        const force = url.searchParams.get("force") === "true";

        const mem = await prisma.aIMemory.findFirst({ where: { key: MEMORY_KEY } });
        cachedPayload = mem?.value
            ? (() => {
                try {
                    return JSON.parse(mem.value);
                } catch {
                    return null;
                }
            })()
            : null;

        // If not forcing and we have a recent cached value (within 24h), return it
        if (!force && mem && cachedPayload) {
            const age = Date.now() - mem.updatedAt.getTime();
            if (age < 24 * HOUR) {
                return NextResponse.json({ ok: true, ...cachedPayload });
            }
        }

        // Otherwise generate fresh recommendations
        const result = await generateAIRecommendations();

        const payload = JSON.stringify(result);
        if (mem) {
            await prisma.aIMemory.update({ where: { id: mem.id }, data: { value: payload } });
        } else {
            await prisma.aIMemory.create({ data: { key: MEMORY_KEY, value: payload, tags: JSON.stringify(["ai"]) } });
        }

        return NextResponse.json({ ok: true, ...result });
    } catch (e: any) {
        console.error("AI recommendation error (route):", e);
        if (cachedPayload) {
            return NextResponse.json({ ok: true, ...cachedPayload, stale: true, fallbackReason: "gemini_unavailable" });
        }
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
