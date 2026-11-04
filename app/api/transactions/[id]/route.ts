import { NextResponse } from "next/server";
import { prisma } from "../../../../src/lib/prisma";
import { findOrCreateCategory, teachMerchantCategory } from "../../../../src/services/categorizer";
import { getTransactionImpact, updateProfileBalanceBy } from "../../../../src/services/balance";
import {
    isEligibleGoalTransaction,
    handleGoalSpendingTransition,
    revertGoalSpending,
} from "../../../../src/services/goalSpending";

type UpdateBody = {
    merchant?: string;
    category?: string;
    amount?: number | string;
    timestamp?: string;
    paymentMethod?: string | null;
    bankName?: string | null;
    transactionType?: string;
    goalId?: string | null;
    notes?: string | null;
};

function cleanOptional(value: unknown) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = (await req.json()) as UpdateBody;

        const existing = await prisma.transaction.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: "transaction not found" }, { status: 404 });
        }

        const amount = body.amount === undefined ? undefined : Math.abs(Number(body.amount));
        if (amount !== undefined && !Number.isFinite(amount)) {
            return NextResponse.json({ error: "invalid amount" }, { status: 400 });
        }

        const timestamp = body.timestamp ? new Date(body.timestamp) : undefined;
        if (timestamp && Number.isNaN(timestamp.getTime())) {
            return NextResponse.json({ error: "invalid timestamp" }, { status: 400 });
        }

        const category = body.category ? await findOrCreateCategory(body.category) : undefined;
        const transactionType = body.transactionType?.trim().toUpperCase() || undefined;

        const oldEligible = isEligibleGoalTransaction(existing.type, existing.transactionType);
        const effectiveType = transactionType || existing.transactionType || existing.type;
        const newEligible = isEligibleGoalTransaction(effectiveType, effectiveType);

        let nextGoalId: string | null | undefined = undefined;
        if (body.goalId !== undefined) {
            nextGoalId = newEligible && body.goalId ? body.goalId.trim() : null;
        } else if (!newEligible && existing.goalId) {
            nextGoalId = null;
        }

        const tx = await prisma.transaction.update({
            where: { id },
            data: {
                ...(body.merchant !== undefined ? { merchant: body.merchant.trim() || "Unknown" } : {}),
                ...(amount !== undefined ? { amount } : {}),
                ...(timestamp ? { timestamp } : {}),
                ...(category ? { categoryId: category.id } : {}),
                ...(transactionType ? { type: transactionType } : {}),
                ...(nextGoalId !== undefined ? { goalId: nextGoalId } : {}),
                ...(body.notes !== undefined ? { notes: cleanOptional(body.notes) } : {}),
                confidence: category ? 0.98 : undefined,
            },
            include: { category: true, goal: { select: { id: true, title: true } } },
        });

        await prisma.$executeRaw`
            UPDATE "Transaction"
            SET "paymentMethod" = ${cleanOptional(body.paymentMethod)},
                "bankName" = ${cleanOptional(body.bankName)},
                "transactionType" = ${transactionType || tx.type}
            WHERE "id" = ${id}
        `;

        if (category) {
            await teachMerchantCategory(tx.merchant, category.name);
        }

        const oldImpact = getTransactionImpact(existing.amount, existing.type, existing.transactionType);
        const newAmount = amount ?? existing.amount;
        const newImpact = getTransactionImpact(newAmount, effectiveType, effectiveType);
        await updateProfileBalanceBy(newImpact - oldImpact);

        await handleGoalSpendingTransition({
            oldGoalId: existing.goalId,
            newGoalId: nextGoalId !== undefined ? nextGoalId : existing.goalId,
            oldAmount: existing.amount,
            newAmount,
            oldIsEligible: oldEligible,
            newIsEligible: newEligible,
        });

        return NextResponse.json({ ok: true, transaction: tx });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const existing = await prisma.transaction.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: "transaction not found" }, { status: 404 });
        }

        await prisma.transaction.delete({ where: { id } });

        if (existing.goalId && isEligibleGoalTransaction(existing.type, existing.transactionType)) {
            await revertGoalSpending(existing.goalId, existing.amount);
        }

        const impact = getTransactionImpact(existing.amount, existing.type, existing.transactionType);
        await updateProfileBalanceBy(-impact);
        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
