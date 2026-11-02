import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import { getTransactionsNetImpact, updateProfileBalanceBy } from "../../../../src/services/balance";
import { recalibrateGoalsSpent } from "../../../../src/services/goals";

type BulkDeleteBody = {
    ids?: string[];
    all?: boolean;
};

export async function DELETE(req: Request) {
    try {
        const body = await req.json().catch(() => ({})) as BulkDeleteBody;

        if (body.all) {
            const netImpact = await getTransactionsNetImpact();
            const result = await prisma.transaction.deleteMany();
            await updateProfileBalanceBy(-netImpact);
            await prisma.goal.updateMany({ data: { spentAmount: 0 } });
            return NextResponse.json({ ok: true, deleted: result.count });
        }

        const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === "string" && id.trim()) : [];
        if (!ids.length) {
            return NextResponse.json({ error: "missing transaction ids" }, { status: 400 });
        }

        const taggedGoals = await prisma.transaction.findMany({
            where: { id: { in: ids }, goalId: { not: null } },
            select: { goalId: true },
            distinct: ["goalId"],
        });

        const netImpact = await getTransactionsNetImpact({ id: { in: ids } });
        const result = await prisma.transaction.deleteMany({ where: { id: { in: ids } } });
        await updateProfileBalanceBy(-netImpact);

        if (taggedGoals.length > 0) {
            await recalibrateGoalsSpent(taggedGoals.map((t) => t.goalId));
        }

        return NextResponse.json({ ok: true, deleted: result.count });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
