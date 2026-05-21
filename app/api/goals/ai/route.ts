import { NextResponse } from "next/server";
import { generateAIRecommendations } from "../../../../src/services/AIGoalAdvisorService";
import prisma from "../../../../src/lib/prisma";

const MEMORY_KEY = "ai_goals_recommendation";
const HOUR = 1000 * 60 * 60;

export async function GET(req: Request) {
    try {
        const url = new URL(req.url);
        const force = url.searchParams.get("force") === "true";

        const mem = await prisma.aIMemory.findFirst({ where: { key: MEMORY_KEY } });

        // If not forcing and we have a recent cached value (within 24h), return it
        if (!force && mem) {
            const age = Date.now() - mem.updatedAt.getTime();
            if (age < 24 * HOUR) {
                try {
                    const parsed = JSON.parse(mem.value);
                    return NextResponse.json({ ok: true, ...parsed });
                } catch (e) {
                    // fall through to regenerate if cached parse fails
                }
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
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
