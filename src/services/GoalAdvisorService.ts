import { prisma } from "../lib/prisma";
import { getGoalOverview } from "./goals";
import { impactMessageForChange } from "./GoalInsightService";

function daysBetween(a?: Date | string | null, b?: Date | string | null) {
    if (!a || !b) return 0;
    const da = new Date(a).getTime();
    const db = new Date(b).getTime();
    return Math.round((da - db) / (1000 * 60 * 60 * 24));
}

export async function adviseGoals({ persist = true } = {}) {
    const overview = await getGoalOverview();

    // fetch recent timeline insights and index by goalId
    const recent = await prisma.financialInsight.findMany({
        where: { type: "goal-timeline" },
        orderBy: { createdAt: "desc" },
        take: 200,
    });

    const lastByGoal = new Map<string, { eta?: string | null; createdAt: Date }>();
    for (const r of recent) {
        try {
            const meta = r.meta ? JSON.parse(r.meta) : null;
            if (meta?.goalId && !lastByGoal.has(meta.goalId)) {
                lastByGoal.set(meta.goalId, { eta: meta.currentEta || meta.eta || null, createdAt: r.createdAt });
            }
        } catch (e) {
            // ignore
        }
    }

    const insights: Array<{ goalId: string; message: string; daysDelta: number }> = [];
    const recommendations: Array<any> = [];

    const monthlyCapacity = overview.monthlyCapacity || 0;

    for (const g of overview.goals) {
        const curEta = g.eta?.eta ? new Date(g.eta.eta).toISOString() : null;
        const prev = lastByGoal.get(g.id);
        const prevEta = prev?.eta ?? null;
        const daysDelta = daysBetween(curEta, prevEta);
        if (prevEta && curEta && daysDelta !== 0) {
            const message = impactMessageForChange(g.title, daysDelta);
            insights.push({ goalId: g.id, message, daysDelta });
            if (persist) {
                await prisma.financialInsight.create({
                    data: {
                        type: "goal-timeline",
                        message,
                        score: g.confidenceScore ?? undefined,
                        meta: JSON.stringify({ goalId: g.id, previousEta: prevEta, currentEta: curEta, daysDelta }),
                    },
                });
            }
        }

        // build deterministic recommendations
        if (g.requiredMonthly && g.requiredMonthly > monthlyCapacity) {
            const deficit = Math.round(g.requiredMonthly - monthlyCapacity);
            // estimate impact of covering the deficit fully
            const monthsNow = g.eta?.months ?? null;
            // if we allocate deficit from surplus, new monthly = monthlyCapacity + deficit
            const newMonthly = monthlyCapacity + deficit;
            let newEtaMonths: number | null = null;
            if (newMonthly > 0) {
                const remaining = Math.max(0, g.targetAmount - g.currentAmount);
                newEtaMonths = Math.ceil(remaining / newMonthly);
            }
            const monthsSaved = monthsNow && newEtaMonths ? Math.max(0, monthsNow - newEtaMonths) : null;
            recommendations.push({
                goalId: g.id,
                reason: "cover_deficit",
                deficit,
                impactMonthsSaved: monthsSaved,
                text: `Increase monthly savings by ${deficit} to meet required pace`,
            });
        } else if (g.requiredMonthly && g.requiredMonthly > 0) {
            recommendations.push({ goalId: g.id, reason: "ok", text: "On pace; consider accelerating with surplus" });
        }
    }

    return {
        overview,
        insights,
        recommendations,
    };
}
