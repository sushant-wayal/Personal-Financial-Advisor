import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import { recommendMonthlyContribution, predictETA } from "../../../../src/services/goals";

export async function GET() {
    try {
        const goals = await prisma.goal.findMany({ orderBy: { priority: "asc" } });
        const now = new Date();
        const enriched = goals.map((g: any) => {
            const current = g.currentAmount || 0;
            const target = g.targetAmount || 0;
            let monthsLeft = 12;
            if (g.targetDate) {
                const td = new Date(g.targetDate);
                const diff = (td.getFullYear() - now.getFullYear()) * 12 + (td.getMonth() - now.getMonth());
                monthsLeft = Math.max(1, diff);
            }
            const recommended = recommendMonthlyContribution(current, target, monthsLeft);
            const eta = predictETA(current, recommended, target);
            return { ...g, monthsLeft, recommendedMonthly: Math.round(recommended), eta };
        });
        return NextResponse.json({ ok: true, goals: enriched });
    } catch (e: any) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
