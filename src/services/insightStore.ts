import { prisma } from "../lib/prisma";

export const INSIGHT_RETENTION_DAYS = 120;

function getInsightRetentionCutoff(days = INSIGHT_RETENTION_DAYS) {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

type InsightDraft = {
    type: string;
    message: string;
    score?: number | null;
    meta?: unknown;
};

export async function persistInsightIfNew(draft: InsightDraft) {
    const existing = await prisma.financialInsight.findFirst({
        where: {
            type: draft.type,
            message: draft.message,
        },
    });

    if (existing) {
        return { created: false, insight: existing };
    }

    const insight = await prisma.financialInsight.create({
        data: {
            type: draft.type,
            message: draft.message,
            score: draft.score ?? null,
            meta: draft.meta !== undefined ? JSON.stringify(draft.meta) : null,
        },
    });

    return { created: true, insight };
}

export async function pruneOldInsights(days = INSIGHT_RETENTION_DAYS) {
    const cutoff = getInsightRetentionCutoff(days);
    const result = await prisma.financialInsight.deleteMany({
        where: {
            createdAt: {
                lt: cutoff,
            },
        },
    });

    return result.count;
}

export function getInsightRetentionWindowStart(days = INSIGHT_RETENTION_DAYS) {
    return getInsightRetentionCutoff(days);
}
